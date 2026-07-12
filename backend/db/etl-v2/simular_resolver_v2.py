# -*- coding: utf-8 -*-
"""Simula em Python a MESMA logica do resolver_relacoes_v2.php (parse_destino +
buscar_destino) contra os dados reais (v2_dados.sql + v2_backfill_relacoes.sql),
como teste de fumaca antes do usuario rodar o PHP de verdade em producao."""
import re
from collections import defaultdict
from parse_dump import extrair_tabela

DAD = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2/v2_dados.sql"
BKF = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2/v2_backfill_relacoes.sql"

ORGAOS_EXTERNOS_RE = re.compile(
    r"\b(MEC|SGP|SEDGG|SEGES|MGI|MPOG|MPDG|MP/SLTI|SLTI|DOU|CGU|AGU|TCU|STF|STJ|"
    r"CNE|CES|CAPES|CNPq|INEP|FNDE|PNUD|CONFEA|CONSUNI)\b", re.I)

TIPOS_MAP = {
    "determinação de serviço": "Determinação de Serviço",
    "instrução normativa":     "Instrução Normativa",
    "norma de serviço":        "Norma de Serviço",
    "ordem de serviço":        "Ordem de Serviço",
    "deliberação":             "Deliberação",
    "comunicado":              "Comunicado",
    "resolução":               "Resolução",
    "portaria":                "Portaria",
    "decisão":                 "Decisão",
    "edital":                  "Edital",
    "dts":                     "Determinação de Serviço",
    "in":                      "Instrução Normativa",
    "ns":                      "Norma de Serviço",
    "os":                      "Ordem de Serviço",
}
TIPOS_ORDENADOS = sorted(TIPOS_MAP.keys(), key=len, reverse=True)

def parse_destino(texto):
    m = re.match(r"^(.+?)\s+n[ºo°]\s*(.+)$", texto)
    if not m: return None
    prefix = m.group(1).strip().lower()
    num_txt = m.group(2).strip()
    for pat in TIPOS_ORDENADOS:
        if prefix.startswith(pat):
            sigla = prefix[len(pat):].strip(" /.,").upper()
            ano = None
            mm = re.match(r"^(.*?)\s*/\s*(\d{4})$", num_txt)
            if mm:
                num_txt = mm.group(1).strip()
                ano = int(mm.group(2))
            digits = re.sub(r"\D", "", num_txt)
            if not digits: return None
            return {"tipo": TIPOS_MAP[pat], "sigla": sigla, "numero": int(digits), "ano": ano}
    return None

print("carregando tipo_ato / ato / relacoes...")
tipo_ato = extrair_tabela(DAD, "tipo_ato")
tipos = {t[1]: int(t[0]) for t in tipo_ato}  # nome -> id

ato = extrair_tabela(DAD, "ato")
# 0 id,1 uid,2 boletim_id,3 tipo_id,4 orgao_id,5 numero,6 numero_norm,7 ano,8 sigla_orig,9 data_ato,...
indice = defaultdict(list)
ato_data = {}
for t in ato:
    aid = int(t[0])
    ato_data[aid] = {"data_ato": t[9] if t[9] != "NULL" else "", "ano": int(t[7])}
    if t[6] == "NULL": continue
    chave = f"{t[3]}|{t[6]}"
    indice[chave].append((aid, t[8] if t[8] != "NULL" else "", t[9] if t[9] != "NULL" else "", int(t[7])))
print(f"  ato: {len(ato)} | indice: {len(indice)} chaves")

rel_existentes = extrair_tabela(DAD, "relacao")
rel_novas = extrair_tabela(BKF, "relacao")
todas = [(r[0], r[3]) for r in rel_existentes] + [(r[0], r[3]) for r in rel_novas]
print(f"  relacoes totais a resolver: {len(todas)} ({len(rel_existentes)} existentes + {len(rel_novas)} novas)")

def buscar_destino(tipo_id, p, origem_data):
    chave = f"{tipo_id}|{p['numero']}"
    rows = indice.get(chave, [])
    if not rows: return None, "nao_encontrado"
    if origem_data:
        rows = [r for r in rows if r[2] == "" or r[2] <= origem_data]
        if not rows: return None, "nao_encontrado"
    if len(rows) == 1:
        return rows[0][0], "ok"
    if p["ano"] is not None:
        por_ano = [r for r in rows if r[3] == p["ano"]]
        if len(por_ano) == 1: return por_ano[0][0], "ok"
        if por_ano: rows = por_ano
    if p["sigla"]:
        alvo = p["sigla"].upper().replace("/UFF", "")
        cands = [r[0] for r in rows if r[1] and r[1].upper().replace("/UFF","") == alvo]
        if len(cands) == 1: return cands[0], "ok"
    return None, "ambiguo"

n_ext = n_ok = n_amb = n_miss = n_naoparseou = n_tiposemid = 0
for aid, destino_texto in todas:
    if ORGAOS_EXTERNOS_RE.search(destino_texto):
        n_ext += 1; continue
    p = parse_destino(destino_texto)
    if not p:
        n_naoparseou += 1; continue
    tid = tipos.get(p["tipo"])
    if tid is None:
        n_tiposemid += 1; continue
    origem_data = ato_data.get(int(aid), {}).get("data_ato", "")
    _, status = buscar_destino(tid, p, origem_data)
    if status == "ok": n_ok += 1
    elif status == "ambiguo": n_amb += 1
    else: n_miss += 1

print(f"\n===== SIMULACAO =====")
print(f"resolvidos:        {n_ok}")
print(f"externos:          {n_ext}")
print(f"ambiguos:          {n_amb}")
print(f"nao encontrados:   {n_miss}")
print(f"sem parse:         {n_naoparseou}")
print(f"tipo sem id:       {n_tiposemid}")
print(f"total:             {n_ok+n_ext+n_amb+n_miss+n_naoparseou+n_tiposemid} (esperado {len(todas)})")
