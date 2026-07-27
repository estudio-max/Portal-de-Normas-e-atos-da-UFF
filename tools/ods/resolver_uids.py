# -*- coding: utf-8 -*-
"""Resolve os rotulados para o uid de producao, lendo a tabela `ato` do dump.

O dump (fanara87_governanca.sql.zip, 22/07/2026) e a verdade de producao.
Casamento: (tipo_id, numero_norm, ano [, sigla_orig quando o candidato tem]).
Ambiguo ou ausente -> nao_resolvidos (curadoria). Nunca chutar.
"""
import json, io, re, zipfile, unicodedata
from collections import defaultdict, Counter

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
ZIPF = _os.path.join(root, "fanara87_governanca.sql.zip")


def strip(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s or '') if not unicodedata.combining(c))
def nsig(s):
    return re.sub(r'[^A-Z0-9]', '', strip(s or '').upper())
def ndig(s):
    d = re.sub(r'\D', '', str(s or ''))
    return str(int(d)) if d else ''

# ---- 1) parse do dump (streaming; formato phpMyAdmin: virgula+espaco) ----
# linha de `ato`: (id, 'uid', boletim_id, tipo_id, orgao_id, 'numero', numero_norm, ano, 'sigla_orig', ...)
RE_ATO = re.compile(
    r"\((\d+),\s*'([a-z0-9\-]+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*'([^']*)',\s*(\d+|NULL),\s*(\d{4}),\s*"
    r"('(?:[^'\\]|\\.)*'|NULL),\s*('[^']*'|NULL),\s*('(?:[^'\\]|\\.)*'|NULL)")  # + data_ato, ementa
RE_TIPO = re.compile(r"INSERT INTO `tipo_ato`[^;]*?VALUES\s*(.+?);", re.S)

tipos = {}          # tipo_id -> nome
index = defaultdict(list)   # (tipo_id, numero_norm, ano) -> [(uid, sigla_norm)]
n_atos = 0
with zipfile.ZipFile(ZIPF) as z:
    name = z.namelist()[0]
    with z.open(name) as f:
        tail = ""
        while True:
            chunk = f.read(8 * 1024 * 1024)
            if not chunk:
                break
            text = tail + chunk.decode("utf-8", "replace")
            tail = text[-4096:]
            if not tipos:
                m = RE_TIPO.search(text)
                if m:
                    for t in re.finditer(r"\((\d+),\s*'([^']+)'", m.group(1)):
                        tipos[int(t.group(1))] = t.group(2)
            for m in RE_ATO.finditer(text[:-4096] if len(text) > 4096 else text):
                n_atos += 1
                uid = m.group(2)
                tipo_id = int(m.group(4))
                nn = m.group(7)
                nn = ndig(m.group(6)) if nn == "NULL" else str(int(nn))
                ano = int(m.group(8))
                sig = m.group(9)
                sig = "" if sig == "NULL" else nsig(sig.strip("'"))
                em = m.group(11)
                em = "" if em == "NULL" else strip(em.strip("'")).lower()[:120]
                index[(tipo_id, nn, ano)].append((uid, sig, em))

print("dump: atos lidos =", n_atos, "| tipos =", tipos)

# ---- 2) casar rotulados ----
TIPO_NOME = {}   # nome normalizado -> tipo_id
for tid, nome in tipos.items():
    TIPO_NOME[re.sub(r'[^A-Z]', '', strip(nome).upper())] = tid

rot = json.load(io.open(SCR + r"\rotulados_all.json", encoding="utf-8"))
resolvidos, nao = [], []
stat = Counter()
for r in rot:
    tid = TIPO_NOME.get(re.sub(r'[^A-Z]', '', strip(r["tipo"]).upper()))
    if not tid:
        r["motivo_nr"] = "tipo desconhecido"; nao.append(r); stat["tipo?"] += 1; continue
    cands = index.get((tid, ndig(r["numero"]), int(r["ano"])), [])
    sig = nsig(r.get("sigla") or "")
    if not sig:
        # fallback: primeiro token do campo orgao da carga ("CEP / UFF" -> CEP)
        sig = nsig((r.get("orgao") or "").split("/")[0])
        if sig in ("UFF", ""):  # "UFF" nao discrimina colegiado
            sig = ""
    if sig:
        hit = [c for c in cands if c[1] == sig] or \
              [c for c in cands if c[1] and (c[1].startswith(sig) or sig.startswith(c[1]))]
        if not hit:
            hit = cands if len({c[0] for c in cands}) == 1 else []
    else:
        hit = cands
    if len(hit) == 1:
        r["uid"] = hit[0][0]; resolvidos.append(r); stat["ok"] += 1
    elif len(hit) == 0:
        r["motivo_nr"] = "nao encontrado no dump"; nao.append(r); stat["ausente"] += 1
    else:
        # varios candidatos: 1º MESMO uid (duplicata benigna); 2º desempate por EMENTA —
        # o par res-uff-N/-2 e duplicata por citacao (CLAUDE.md): a copia-fantasma tem
        # ementa de fragmento, a carga traz a ementa real -> prefixo decide.
        uids = {c[0] for c in hit}
        if len(uids) == 1:
            r["uid"] = hit[0][0]; resolvidos.append(r); stat["ok"] += 1
        else:
            em_c = strip(r.get("ementa") or "").lower()[:60]
            def sim(em_db):
                if not em_c or not em_db: return 0.0
                a, b = em_c, em_db[:60]
                n = 0
                for x, y in zip(a, b):
                    if x != y: break
                    n += 1
                return n / max(len(a), 1)
            scored = sorted(((sim(c[2]), c[0]) for c in hit), reverse=True)
            if scored[0][0] >= 0.6 and (len(scored) < 2 or scored[1][0] <= scored[0][0] / 2):
                r["uid"] = scored[0][1]; resolvidos.append(r); stat["ok-ementa"] += 1
            else:
                r["motivo_nr"] = "ambiguo (%d atos com mesmo tipo+numero+ano)" % len(uids)
                r["uids_possiveis"] = sorted(uids)[:6]
                nao.append(r); stat["ambiguo"] += 1

io.open(SCR + r"\resolvidos.json", "w", encoding="utf-8").write(json.dumps(resolvidos, ensure_ascii=False, indent=1))
io.open(SCR + r"\nao_resolvidos.json", "w", encoding="utf-8").write(json.dumps(nao, ensure_ascii=False, indent=1))
print("resolucao:", dict(stat))
print("linhas ato_ods (uid x ods):", sum(len(r["ods"]) for r in resolvidos))
