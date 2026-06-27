# -*- coding: utf-8 -*-
"""
Converte a base extraída (atos.json) para o esquema de Atos do Portal
(UffAct) usado pelo app — gera portal-data.json carregado pela interface.

Uso:
    python gerar_dados_portal.py                  # lê atos.json, escreve no app
    python gerar_dados_portal.py --saida app/portal-data.json

É chamado automaticamente por extrair_boletim.py ao final da indexação.
"""
import os
import re
import json
import argparse
from datetime import datetime

# Mapas de tradução para o esquema do app -------------------------------------
TIPO_MAP = {
    "PORTARIA": "Portaria",
    "RESOLUÇÃO": "Resolução",
    "DETERMINAÇÃO DE SERVIÇO": "Determinação de Serviço",
    "INSTRUÇÃO NORMATIVA": "Instrução Normativa",
    "NORMA DE SERVIÇO": "Norma de Serviço",
    "ORDEM DE SERVIÇO": "Ordem de Serviço",
    "DECISÃO": "Decisão",
    "DELIBERAÇÃO": "Deliberação",
    "COMUNICADO": "Comunicado",
    "EDITAL": "Edital",
    "RESUMO DE DESPACHOS E DECISÕES": "Resumo de Despachos",
    "RESUMO DE DESPACHOS": "Resumo de Despachos",
}
# relação do extrator -> tipoRelacao do app (Altera | Revoga | Complementa | Regulamenta)
REL_MAP = {
    "ALTERA": "Altera", "RETIFICA": "Altera", "REPUBLICA": "Altera", "PRORROGA": "Altera",
    "REVOGA": "Revoga", "TORNA SEM EFEITO": "Revoga", "ANULA": "Revoga", "SUBSTITUI": "Revoga",
    "CITA": "Complementa",
}


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    return s or "ato"


def tags_de(a):
    tags = []
    if a.get("tipo_acao"):
        tags.append(a["tipo_acao"])
    for parte in re.split(r"[/ ]", a.get("sigla", "")):
        p = parte.strip()
        if p and p not in tags:
            tags.append(p)
    tp = TIPO_MAP.get(a.get("tipo", ""), "Outro")
    if tp not in tags:
        tags.append(tp)
    return [t for t in tags if t][:6]


def converter(dados, urls=None):
    """urls: dict opcional {arquivo.pdf: url_oficial_uff} para linkar o PDF
    de origem na UFF (sem hospedar cópia)."""
    urls = urls or {}
    atos = dados["atos"]
    ano_bs = {}
    for m in dados.get("boletins", []):
        d = m.get("bs_data", "")
        ano_bs[m["arquivo"]] = d.split("/")[-1] if "/" in d else "2026"

    # índice reverso: marca status de vigência (Revogado/Alterado) a partir
    # de atos que revogam/alteram outro com mesmo número+ano e tipo compatível
    saida = []
    ids = set()
    for i, a in enumerate(atos):
        base = f"{slug(a.get('tipo'))}-{slug(a.get('sigla'))}-{slug(a.get('numero'))}-{a.get('ano')}"
        aid = base
        n = 2
        while aid in ids:
            aid = f"{base}-{n}"; n += 1
        ids.add(aid)

        relacoes = []
        for r in a.get("relacoes", []):
            relacoes.append({
                "id": f"rel-{i}-{len(relacoes)}",
                "tipoRelacao": REL_MAP.get(r["relacao"], "Complementa"),
                "atoDestino": r["ato_citado"],
                "detalhes": r.get("bs_origem") or (r.get("trecho", "")[:90] or None),
            })

        orgao = a.get("sigla") or ("Reitoria" if a.get("tipo") == "PORTARIA" else "UFF")
        ano_pub = ano_bs.get(a.get("arquivo"), "2026")
        saida.append({
            "id": aid,
            "_idx": i,
            "tipoAto": TIPO_MAP.get(a.get("tipo", ""), "Outro"),
            "numero": a.get("numero", ""),
            "ano": int(a["ano"]) if str(a.get("ano", "")).isdigit() else 2026,
            "dataAssinatura": a.get("data_ato") or "",
            "orgaoEmissor": orgao,
            "ementa": a.get("ementa") or "(sem ementa formal no boletim)",
            "processoSei": a.get("processo_sei_principal") or None,
            "seiDocumento": a.get("sei_documento") or None,
            "linkSeiProcesso": a.get("link_sei_processo") or None,
            "linkSeiDocumento": a.get("link_sei_documento") or None,
            "relacoes": relacoes,
            "tags": tags_de(a),
            "siapes": a.get("siapes", []),
            "textoBusca": a.get("corpo_busca", ""),  # corpo p/ busca por nome/SIAPE
            "conteudoResumido": a.get("ementa") or "Ato administrativo publicado no Boletim de Serviço da UFF.",
            "status": "Ativo",  # ajustado abaixo
            "boletimNumero": f"BS nº {a.get('bs_numero','')}/{ano_pub}",
            "linkBoletim": urls.get(a.get("arquivo", ""),
                                    "https://boletimdeservico.uff.br/boletins/bs-2026/"),
            "secao": a.get("secao", ""),
            "pagina": a.get("pagina", ""),
            "arquivo": a.get("arquivo", ""),
            "notasInternas": (f"Extraído de {a.get('arquivo','')}."
                              + (f" Assinante: {a['signatario']}." if a.get("signatario") else "")),
            # data estável (a do próprio ato) — evita commits diários sem mudança
            "dataCriacao": a.get("data_ato") or "",
        })

    # --- status de vigência via índice reverso (quem revoga/altera quem) ------
    # chave por (numero_digits) -> lista de índices na saída
    por_num = {}
    for idx, s in enumerate(saida):
        nd = re.sub(r"\D", "", s["numero"])
        por_num.setdefault(nd, []).append(idx)

    TIPO_PALAVRAS = {
        "Portaria": "portaria", "Resolução": "resolu", "Decisão": "decis",
        "Determinação de Serviço": "determina", "Instrução Normativa": "instru",
        "Norma de Serviço": "norma", "Edital": "edital", "Comunicado": "comunicado",
    }

    def acha_alvos(ato_destino, alvo_filtro):
        """Casa a referência textual a atos da base, exigindo número + (sigla
        OU tipo) coincidentes, para evitar falsos positivos entre órgãos."""
        dest = ato_destino.lower()
        nums = {re.sub(r"\D", "", t) for t in re.findall(r"\d[\d.]*", ato_destino)}
        achados = []
        for nd in nums:
            if len(nd) < 2:
                continue
            for idx in por_num.get(nd, []):
                alvo = saida[idx]
                sigla = (alvo["orgaoEmissor"] or "").lower().split()[0] if alvo["orgaoEmissor"] else ""
                tem_sigla = sigla and sigla not in ("reitoria", "uff") and sigla in dest
                palavra = TIPO_PALAVRAS.get(alvo["tipoAto"], "")
                tem_tipo = palavra and palavra in dest
                # sem sigla (ex.: Portaria da Reitoria): exige a palavra do tipo
                if alvo["orgaoEmissor"] in ("Reitoria", "UFF", ""):
                    ok = tem_tipo and len(nd) >= 3
                else:
                    ok = tem_sigla and (tem_tipo or True)
                if ok and alvo["tipoAto"] == alvo_filtro:
                    achados.append(idx)
        return achados

    # passe único: liga cada ato citado (alvo) ao ato que o cita (origem),
    # preenchendo "referenciadoPor" e ajustando o status de vigência.
    for s in saida:
        for r in s["relacoes"]:
            destino = r["atoDestino"]
            tipo_alvo = None
            for tp_app, palavra in TIPO_PALAVRAS.items():
                if palavra in destino.lower():
                    tipo_alvo = tp_app
                    break
            if not tipo_alvo:
                continue
            for idx in acha_alvos(destino, tipo_alvo):
                alvo = saida[idx]
                if alvo["id"] == s["id"]:
                    continue
                # só atos de data igual/posterior "afetam" o alvo
                if (s["dataAssinatura"] or "") < (alvo["dataAssinatura"] or ""):
                    continue
                alvo.setdefault("referenciadoPor", []).append({
                    "relacao": r["tipoRelacao"],
                    "porId": s["id"],
                    "porLabel": f'{s["tipoAto"]} {s["orgaoEmissor"]} nº {s["numero"]}/{s["ano"]}',
                    "detalhes": r.get("detalhes"),
                })
                if r["tipoRelacao"] == "Revoga":
                    alvo["status"] = "Revogado"
                elif r["tipoRelacao"] == "Altera" and alvo["status"] != "Revogado":
                    alvo["status"] = "Alterado"

    for s in saida:
        ref = s.setdefault("referenciadoPor", [])
        vistos, unico = set(), []
        for r in ref:
            ch = (r["relacao"], r["porId"])
            if ch not in vistos:
                vistos.add(ch)
                unico.append(r)
        s["referenciadoPor"] = unico
    return saida


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrada", default=os.path.join(os.path.dirname(__file__), "atos.json"))
    ap.add_argument("--saida", default=os.path.join(os.path.dirname(__file__), "app", "portal-data.json"))
    ap.add_argument("--urls", default=None, help="manifesto nome.pdf->URL UFF (boletins/_urls.json)")
    args = ap.parse_args()

    with open(args.entrada, encoding="utf-8") as f:
        dados = json.load(f)
    urls = {}
    if args.urls and os.path.exists(args.urls):
        with open(args.urls, encoding="utf-8") as f:
            urls = json.load(f)
    saida = converter(dados, urls)
    os.makedirs(os.path.dirname(args.saida), exist_ok=True)
    with open(args.saida, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False)

    from collections import Counter
    st = Counter(s["status"] for s in saida)
    print(f"{len(saida)} atos -> {args.saida}")
    print("status:", dict(st))


if __name__ == "__main__":
    main()
