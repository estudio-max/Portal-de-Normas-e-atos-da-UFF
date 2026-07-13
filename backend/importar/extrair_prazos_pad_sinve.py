#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extração de prazos PAD/SINVE (Processo Administrativo Disciplinar &
Sindicância Investigativa) com alta confiança. Diferente dos prazos
genéricos, estes são sempre literais (30, 60, 45, 15 dias) e rastreáveis
a uma cadeia de instauração → prorrogações → sobrestamentos.

Uso (validação local contra dump):
    python extrair_prazos_pad_sinve.py < pad_sinve.json > prazos_pad_sinve.json

Uso em produção (ser chamado pelo importar_v2.php):
    php -r "include 'extrair_prazos_pad_sinve.php'; ..."
"""

import json
import re
import sys
from collections import defaultdict

def norm(s):
    return (s or "").lower()

# Classificação por tipo de procedimento
PAD_SUM_RE = re.compile(r"processo administrativo disciplinar\s+sum[aá]rio", re.I)
PAD_RE = re.compile(r"processo administrativo disciplinar", re.I)
SINVE_RE = re.compile(r"sindic[âa]ncia investigat[óo]ria|sindic[âa]ncia investigativa", re.I)

# Classificação por papel no fluxo
INSTAURA_RE = re.compile(r"\binstaura(r|ção|da|do|m)?\b", re.I)
RECONDUZ_RE = re.compile(r"\breconduz\w*\b", re.I)
PRORROGA_RE = re.compile(r"\bprorroga\w*\b", re.I)
SOBRESTA_RE = re.compile(r"\bsobrest\w*\b", re.I)

# Extração de dias declarados: "prazo de 30 (trinta) dias" ou "prorrogar por mais 60 (sessenta) dias"
PRAZO_DIAS_RE = re.compile(
    r"prazo\s+(?:\S+\s+){0,2}?de\s+(\d{1,3})\s*\([^)]{0,25}\)?\s*dias",
    re.I
)
PRORROGA_POR_RE = re.compile(
    r"prorroga\w*\s+(?:o\s+prazo\s+)?por\s+(?:mais\s+)?(\d{1,3})\s*\(?[^)]{0,25}\)?\s*dias",
    re.I
)

# Citação ao ato originário (instaurador)
CITA_ORIGINARIO_RE = re.compile(
    r"(?:instaurad[oa]|institu[íi]d[oa]|designad[oa]|constitu[íi]d[oa])\s+"
    r"(?:atrav[ée]s\s+d[ae]|pel[ao]|n[ao])?\s*"
    r"(portaria|dts|determina[çc][ãa]o\s+de\s+servi[çc]o)\s*(?:n[ºo°.]*\s*)?\s*([\d.]+)"
    r"(?:\s*[-/,]?\s*(?:de\s*)?(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{1,2}\s+de\s+\w+\s+de\s+\d{4}))?",
    re.I
)

def classifica_tipo(txt):
    """Retorna 'SINVE', 'PAD_SUMARIO', 'PAD', ou None.

    SINVE é checado PRIMEIRO: 'sindicância investigativa' é o termo mais
    específico e distintivo. Uma SINVE costuma citar 'processo administrativo
    disciplinar' como possível desdobramento — se checássemos PAD antes, esses
    atos seriam rotulados PAD por engano.
    """
    if SINVE_RE.search(txt):
        return "SINVE"
    if PAD_SUM_RE.search(txt):
        return "PAD_SUMARIO"
    if PAD_RE.search(txt):
        return "PAD"
    return None

def classifica_papel(txt):
    """Retorna 'INSTAURACAO', 'EXTENSAO', ou 'OUTRO'."""
    inicio = txt[:600]
    if SOBRESTA_RE.search(inicio):
        return "SOBRESTAMENTO"
    if RECONDUZ_RE.search(inicio) or PRORROGA_RE.search(inicio):
        return "EXTENSAO"
    if INSTAURA_RE.search(inicio):
        return "INSTAURACAO"
    return "OUTRO"

def extrai_dias(txt):
    """Retorna nº de dias declarado, ou None."""
    m = PRAZO_DIAS_RE.search(txt) or PRORROGA_POR_RE.search(txt)
    return int(m.group(1)) if m else None

def extrai_citacao_originario(txt):
    """Retorna dict com tipo, numero, data da portaria originária, ou None."""
    m = CITA_ORIGINARIO_RE.search(txt)
    if not m:
        return None
    tipo_cit = m.group(1)
    numero_cit = m.group(2)
    # Deixar data por enquanto, mas não vamos usar pra matching (chave é tipo+numero+ano do ato)
    return {"tipo": tipo_cit.strip().upper(), "numero": numero_cit}

def processa_atos(atos_json_list):
    """
    Processa lista de atos (do dump ou JSON feed), retorna lista de prazos PAD/SINVE.
    Cada prazo tem:
      - uid, tipo_ato (PAD/SINVE), papel (INSTAURACAO/EXTENSAO/SOBRESTAMENTO)
      - dias (nº literal extraído do texto)
      - processo_sei (se houver)
      - ato_originario_uid (uid do ato que instaurou, se prorrogação)
      - vigente (bool: True se é o ato mais recente da cadeia process_sei)
    """
    prazos = []
    por_sei = defaultdict(list)

    for a in atos_json_list:
        txt_full = norm(a.get("ementa", "")) + " " + norm(a.get("texto_original", ""))
        tipo = classifica_tipo(txt_full)
        papel = classifica_papel(txt_full)

        if tipo is None or papel == "OUTRO":
            continue  # fora do escopo PAD/SINVE

        dias = extrai_dias(txt_full)
        if dias is None:
            continue  # sem prazo literal declarado

        sei = a.get("processo_sei")
        data_ato = a.get("data_ato")

        publico = {
            "PAD": "Comissão de PAD",
            "PAD_SUMARIO": "Comissão de PAD Sumário",
            "SINVE": "Comissão de Sindicância",
        }.get(tipo, "Comissão")
        papel_label = {
            "INSTAURACAO": "instauração",
            "EXTENSAO": "prorrogação/recondução",
            "SOBRESTAMENTO": "sobrestamento",
        }.get(papel, papel)

        p = {
            "uid": a["uid"],
            "tipo_ato": tipo,
            "papel": papel,
            "dias": dias,
            "processo_sei": sei,
            "data_ato": data_ato,
            "publico": publico,
            "origem": f"{tipo} · {papel_label} · prazo de {dias} dias",
        }

        # Se é extensão, tenta extrair citação ao originário
        if papel == "EXTENSAO":
            cit = extrai_citacao_originario(txt_full)
            if cit:
                p["citacao_tipo"] = cit["tipo"]
                p["citacao_numero"] = cit["numero"]

        prazos.append(p)

        # Agrupar por processo_sei pra marcar qual é vigente depois
        if sei:
            por_sei[sei].append((data_ato or "", p))

    # Marcar vigente: o de maior data_ato dentro de cada processo_sei
    vigentes_por_sei = set()
    for sei, lista in por_sei.items():
        lista.sort(key=lambda x: x[0], reverse=True)  # sort por data_ato (strings AAAA-MM-DD sortem lexicograficamente)
        if lista:
            vigentes_por_sei.add(lista[0][1]["uid"])

    for p in prazos:
        p["vigente"] = p["uid"] in vigentes_por_sei

    return prazos

if __name__ == "__main__":
    # Lê JSON do stdin (dump_pad_sinve.json)
    dados = json.load(sys.stdin)
    prazos = processa_atos(dados)
    json.dump(prazos, sys.stdout, ensure_ascii=False, indent=2)
