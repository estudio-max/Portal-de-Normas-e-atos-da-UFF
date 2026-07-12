# -*- coding: utf-8 -*-
"""Deriva NOME do órgão + CARGO do signatário da cláusula de abertura do corpo:
   "[o|a] <cargo> d[oa] <NOME DO ÓRGÃO>, no uso de suas atribuições ..."
Agrega por sigla do corpus -> nome mais frequente (autoritativo, do texto).
Também detecta delegação "delegad[oa] pelo ... reitor" (hierarquia -> Reitoria).
Read-only: só mede e propõe. Saída: out_v2/orgao_nomes_derivados.csv
"""
import os, re
from collections import Counter, defaultdict
from parse_dump import extrair_tabela, parse_tuples

DUMP = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out/fanara87_uffnormas.sql"
OUT  = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2"

atos = extrair_tabela(DUMP, "atos")
sig_de = {r[0]: r[3] for r in atos if r[3] not in ("","NULL")}

CARGOS = (r"(?:magn[ií]fico\s+)?(?:vice-?)?reitor[ae]?|chefe|coordenador[ae]?|"
          r"diretor[ae]?|presidente|pr[óo]-?reitor[ae]?|superintendente|decano|"
          r"ouvidor[ae]?|procurador[ae]?|secret[áa]ri[ae]")
# [artigo] <cargo> <conector d..> <NOME>, no uso de suas atribui
PAT = re.compile(
    r"\b[oa]s?\s+(" + CARGOS + r")\s+"
    r"(d[aeo]s?\s+|d[oa]\s+)?(.{4,90}?)\s*,?\s+no\s+uso\s+de\s+suas\s+atribui", re.I)
DELEG = re.compile(r"delegad[ao]s?\s+pel[oa]\s+(?:magn[ií]fico\s+)?(?:vice-?)?reitor", re.I)

nome_por_sig = defaultdict(Counter)
cargo_por_sig = defaultdict(Counter)
deleg_por_sig = Counter()
tot_por_sig = Counter()

alvo="INSERT INTO `ato_corpo`";capt=False;buf=[];visto=0
with open(DUMP,encoding="utf-8",errors="replace") as fp:
    for l in fp:
        if not capt:
            if l.startswith(alvo):capt=True;i=l.find("VALUES");buf=[l[i+6:]] if i>=0 else [l]
        else:
            buf.append(l)
            if l.rstrip().endswith(";"):
                for t in parse_tuples("".join(buf)):
                    if len(t)<2: continue
                    sg = sig_de.get(t[0])
                    if not sg: continue
                    tot_por_sig[sg]+=1
                    txt = t[1]
                    m = PAT.search(txt)
                    if m:
                        cargo = re.sub(r"\s+"," ",m.group(1)).strip().lower()
                        nome = re.sub(r"\s+"," ",m.group(3)).strip(" .,-").lower()
                        # limpa: corta em conectores tardios
                        nome = re.split(r"\b(?:no uso|delegad|conforme|nos termos|em exerc)", nome)[0].strip(" .,-")
                        if 4 <= len(nome) <= 80:
                            nome_por_sig[sg][nome]+=1
                            cargo_por_sig[sg][cargo]+=1
                        if DELEG.search(txt): deleg_por_sig[sg]+=1
                    visto+=1
                capt=False;buf=[]

# monta CSV por sigla (top nome derivado)
import csv
os.makedirs(OUT, exist_ok=True)
CSVP=os.path.join(OUT,"orgao_nomes_derivados.csv")
rows=[]
for sg in sorted(tot_por_sig, key=lambda s:-tot_por_sig[s]):
    nm = nome_por_sig[sg].most_common(1)
    cg = cargo_por_sig[sg].most_common(1)
    cobertura = (nm[0][1]/tot_por_sig[sg]) if nm else 0
    rows.append({
        "sigla":sg, "atos":tot_por_sig[sg],
        "nome_derivado": nm[0][0] if nm else "",
        "nome_freq": nm[0][1] if nm else 0,
        "cobertura_nome": round(cobertura,2),
        "cargo_signatario": cg[0][0] if cg else "",
        "delegado_reitor": deleg_por_sig[sg],
    })
with open(CSVP,"w",encoding="utf-8-sig",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

# stats
com_nome = sum(1 for r in rows if r["nome_derivado"])
atos_com_nome = sum(r["atos"] for r in rows if r["nome_derivado"])
tot_atos = sum(r["atos"] for r in rows)
print(f"corpos lidos: {visto}")
print(f"siglas: {len(rows)} | com nome derivado: {com_nome} ({100*atos_com_nome//tot_atos}% dos atos)")
print(f"\nAmostra (top 30 siglas):")
for r in rows[:30]:
    print(f"  {r['atos']:5d} {r['sigla']:20s} -> {r['nome_derivado'][:50]!r} [{r['cargo_signatario']}] deleg={r['delegado_reitor']}")
print(f"\nCSV: {CSVP}")
