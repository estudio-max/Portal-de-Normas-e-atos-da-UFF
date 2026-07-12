# -*- coding: utf-8 -*-
"""Gera out_v2/prazo_backfill.sql: ALTER TABLE prazo (add colunas) + repopula
a tabela `prazo` com todos os prazos extraidos do corpus v2 (via extrair_prazos.py).
Idempotente (DELETE antes). O importador PHP mantem os atos novos daí em diante.
"""
import datetime, os
from parse_dump import extrair_tabela, parse_tuples
from extrair_prazos import extrair_prazos, inferir_publico

DAD = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2/v2_dados.sql"
TXT = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2/v2_texto.sql"
OUT = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2/prazo_backfill.sql"

def esc(s):
    if s is None: return "NULL"
    return "'" + str(s).replace("\\","\\\\").replace("'","''") + "'"

ato = extrair_tabela(DAD, "ato")
meta = {t[0]: {"data_ato": None if t[9]=="NULL" else t[9], "ementa": "" if t[10]=="NULL" else t[10]} for t in ato}

linhas = []
alvo="INSERT INTO `ato_texto`"; capt=False; buf=[]
with open(TXT, encoding="utf-8", errors="replace") as f:
    for l in f:
        if not capt:
            if l.startswith(alvo): capt=True; i=l.find("VALUES"); buf=[l[i+6:]] if i>=0 else [l]
        else:
            buf.append(l)
            if l.rstrip().endswith(";"):
                for tup in parse_tuples("".join(buf)):
                    if len(tup)<2: continue
                    aid, orig = tup[0], tup[1]
                    m = meta.get(aid)
                    if not m: continue
                    texto = (m["ementa"] or "") + " . " + (orig or "")[:12000]
                    for p in extrair_prazos(texto, m["data_ato"]):
                        publico = inferir_publico(m["ementa"], p["ctx"])
                        linhas.append((aid, p["tipo"][:30], p["dataLimite"], p["conf"][:10],
                                       p["base"][:20], publico[:60], p["origem"][:255]))
                capt=False; buf=[]

print(f"prazos a inserir: {len(linhas)}")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("-- Backfill da tabela `prazo` (v2): extracao server-side de datas-limite.\n")
    f.write("-- Espelha extrairPrazos/inferirPublico do frontend (repo/src/dataSource.ts).\n")
    f.write("-- Idempotente. O importador diario mantem os atos novos.\n\n")
    # ALTER idempotente: adiciona colunas se ainda nao existem (banco ja criado sem elas)
    f.write("-- Colunas de exibicao (add se a tabela foi criada antes desta versao):\n")
    for col, ddl in [("conf","VARCHAR(10) NULL"),("base","VARCHAR(20) NULL"),("publico","VARCHAR(60) NULL")]:
        f.write(f"SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='prazo' AND COLUMN_NAME='{col}');\n")
        f.write(f"SET @s = IF(@c=0, 'ALTER TABLE `prazo` ADD COLUMN `{col}` {ddl}', 'SELECT 1');\n")
        f.write("PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;\n")
    f.write("\nSTART TRANSACTION;\n")
    f.write("DELETE FROM `prazo`;\n")
    BATCH=400
    for i in range(0,len(linhas),BATCH):
        ch=linhas[i:i+BATCH]
        f.write("INSERT INTO `prazo` (`ato_id`,`tipo`,`data_limite`,`conf`,`base`,`publico`,`trecho`) VALUES\n")
        f.write(",\n".join(f"({aid},{esc(tp)},{esc(dl)},{esc(cf)},{esc(bs)},{esc(pb)},{esc(tr)})"
                           for aid,tp,dl,cf,bs,pb,tr in ch) + ";\n")
    f.write("COMMIT;\n")

print(f"SQL: {OUT} ({os.path.getsize(OUT)/1024:.0f} KB)")
