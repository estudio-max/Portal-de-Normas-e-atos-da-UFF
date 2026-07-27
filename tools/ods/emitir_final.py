# -*- coding: utf-8 -*-
"""Emite a carga final: backfill 'ia' (sem os pares ja curados) + copia os
arquivos de auditoria para backfill-ods/."""
import json, io, os
from collections import Counter

import os as _os

# Caminhos resolvidos a partir da localizacao DESTE arquivo (repo/tools/ods/),
# para o script rodar de qualquer diretorio.
#   root = a pasta que contem o repo (portal-normas-uff/)
#   SCR  = pasta de trabalho dos JSONs intermediarios. Eles NAO entram no repo
#          (sao grandes e regeraveis); o padrao e backfill-ods/trabalho/.
#          Sobrescreva com a variavel de ambiente ODS_TRABALHO.
_AQUI = _os.path.dirname(_os.path.abspath(__file__))
root = _os.path.dirname(_os.path.dirname(_os.path.dirname(_AQUI)))
SCR = _os.environ.get("ODS_TRABALHO", _os.path.join(root, "backfill-ods", "trabalho"))
_os.makedirs(SCR, exist_ok=True)
DEST = _os.path.join(root, "backfill-ods")


res = json.load(io.open(os.path.join(SCR, "resolvidos.json"), encoding="utf-8"))
cur = json.load(io.open(os.path.join(DEST, "ato_ods_curadoria.json"), encoding="utf-8"))
cur_pairs = {(l["uid"], l["ods"]) for l in cur}

rank = {"alta": 3, "media": 2, "baixa": 1}
best = {}
for r in res:
    for o in r["ods"]:
        k = (r["uid"], o)
        if k in cur_pairs:            # a curadoria manda; nao duplicar a linha
            continue
        row = {"uid": r["uid"], "ods": o, "vinculo": r["vinculo"],
               "confianca": r["confianca"], "meta": r["meta"],
               "justificativa": r["justificativa"], "metodo": "ia",
               "cluster": r.get("cluster", "")}
        if k not in best or rank[row["confianca"]] > rank[best[k]["confianca"]]:
            best[k] = row

linhas = sorted(best.values(), key=lambda x: (x["ods"], x["uid"]))
io.open(os.path.join(DEST, "ato_ods_backfill.json"), "w", encoding="utf-8").write(
    json.dumps(linhas, ensure_ascii=False, indent=1))

for f in ("nao_resolvidos.json", "descartados.json", "residuo_descartado.json"):
    src = os.path.join(SCR, f)
    if os.path.isfile(src):
        io.open(os.path.join(DEST, f), "w", encoding="utf-8").write(
            json.dumps(json.load(io.open(src, encoding="utf-8")), ensure_ascii=False, indent=1))

tot = Counter(l["ods"] for l in linhas) + Counter(l["ods"] for l in cur)
print("=== CARGA FINAL ===")
print("ia: %d linhas | curadoria: %d | TOTAL: %d" % (len(linhas), len(cur), len(linhas) + len(cur)))
print("por vinculo (ia):", dict(Counter(l["vinculo"] for l in linhas)))
print("por ODS (ia+curadoria):", dict(sorted(tot.items())))
print("atos distintos:", len({l["uid"] for l in linhas} | {l["uid"] for l in cur}))
