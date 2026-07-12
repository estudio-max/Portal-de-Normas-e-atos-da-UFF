# -*- coding: utf-8 -*-
"""Simula a logica de identidade do importar_v2.php contra o snapshot real do
v2 (out_v2/v2_dados.sql), SEM PHP/MySQL. Confirma antes de rodar em producao:
 - quantos atos do JSON casam a chave natural de um ato JA existente (UPDATE)
   vs. sao novos (INSERT);
 - se a geracao de uid p/ os novos colide com uid existente (precisaria sufixo);
 - se ha ambiguidade (2 atos v2 na mesma chave natural -> SELECT devolveria 2).
"""
import re, json, unicodedata
from collections import defaultdict, Counter
from parse_dump import extrair_tabela

DAD = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2/v2_dados.sql"
JSON = r"portal-data.json"

def strip_ac(s): return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
def slugify(s):
    s = strip_ac(s).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")
def digits(s): return re.sub(r"\D", "", str(s or ""))

SIGLA_TIPO = {"Determinação de Serviço":"dts","Portaria":"port","Resolução":"res","Decisão":"dec",
              "Ordem de Serviço":"os","Resumo de Despachos":"rd","Edital":"ed","Comunicado":"com",
              "Norma de Serviço":"ns","Instrução Normativa":"in"}

# --- carrega v2: tipo_ato, orgao(sigla+alias), boletim, ato ---
tipo_ato = extrair_tabela(DAD, "tipo_ato")
tipo_id = {t[1]: int(t[0]) for t in tipo_ato}

orgao = extrair_tabela(DAD, "orgao")
sigla2org = {o[1]: int(o[0]) for o in orgao}
alias = extrair_tabela(DAD, "orgao_alias")
for al in alias:
    sigla2org.setdefault(al[1], int(al[0]))

boletim = extrair_tabela(DAD, "boletim")
bkey = {(int(b[1]), int(b[2])): int(b[0]) for b in boletim}  # (numero,ano)->id
barq = {b[4]: int(b[0]) for b in boletim if b[4] not in ("","NULL")}  # arquivo->id (identidade estável)

ato = extrair_tabela(DAD, "ato")
# 0 id,1 uid,2 boletim_id,3 tipo_id,4 orgao_id,5 numero,6 numero_norm,7 ano,8 sigla_orig
natural = defaultdict(list)   # (bol,tipo,sigla_norm,numnorm,ano) -> [ato_id]
uids = set()
for t in ato:
    sig = None if t[8]=="NULL" else t[8]
    nn = None if t[6]=="NULL" else int(t[6])
    natural[(int(t[2]), int(t[3]), sig, nn, int(t[7]))].append(int(t[0]))
    uids.add(t[1])

# ambiguidade na base v2 (mesma chave natural com 2+ atos)
ambiguos = {k:v for k,v in natural.items() if len(v)>1}
print(f"chaves naturais no v2 com 2+ atos (SELECT devolveria multiplos): {len(ambiguos)}")
for k,v in list(ambiguos.items())[:5]:
    print(f"   {k}: {v}")

# --- simula cada ato do JSON ---
dados = json.load(open(JSON, encoding="utf-8"))
n_update = n_insert = n_sem_boletim = n_sem_tipo = 0
uid_colisoes = 0
uids_lote = set(uids)
novas_siglas = Counter()
for a in dados:
    tnome = a.get("tipoAto","")
    tid = tipo_id.get(tnome)
    if tid is None: n_sem_tipo += 1; continue
    ano = int(a.get("ano") or 0)
    sigla = (a.get("orgaoEmissor") or a.get("sigla") or "").strip()[:60] or "N/D"
    if sigla not in sigla2org:
        novas_siglas[sigla]+=1
    # boletim: identidade = ARQUIVO (estável); fallback (numero,ano) só p/ novo
    arq = (a.get("arquivo") or "").strip()
    bid = barq.get(arq)
    if bid is None:
        m = re.search(r"(\d+)\s*/\s*(\d{4})", str(a.get("boletimNumero") or ""))
        if m: bnum, anobol = int(m.group(1)), int(m.group(2))
        else:
            m2 = re.search(r"(\d+)\s*-\s*(\d{2,4})", arq)
            if not m2: n_sem_boletim += 1; continue
            bnum = int(m2.group(1)); y=int(m2.group(2)); anobol = 2000+y if y<100 else y
        bid = bkey.get((bnum, anobol))
    # se o boletim ainda nao existe no v2, o importador cria -> conta como novo caminho
    sig_sql = None if sigla in ("N/D","") else sigla
    nn = digits(a.get("numero"))
    nnv = int(nn) if nn else None
    key = (bid, tid, sig_sql, nnv, ano)
    if bid is not None and key in natural:
        n_update += 1
    else:
        n_insert += 1
        # uid do novo
        base = slugify(f"{SIGLA_TIPO.get(tnome,'ato')}-{sigla}-{nn or 'sn'}-{ano}")
        if base in uids_lote:
            uid_colisoes += 1
            u=base; k=1
            while u in uids_lote: k+=1; u=f"{base}-{k}"
            uids_lote.add(u)
        else:
            uids_lote.add(base)

print(f"\n=== SIMULACAO ({len(dados)} atos do JSON) ===")
print(f"casam ato existente (UPDATE): {n_update}")
print(f"novos (INSERT):               {n_insert}")
print(f"  -> destes, uid-base colide c/ existente e precisa sufixo: {uid_colisoes}")
print(f"ignorados (sem tipo):         {n_sem_tipo}")
print(f"ignorados (sem boletim):      {n_sem_boletim}")
print(f"\nsiglas do JSON ainda nao no v2 (orgao novo sera criado): {len(novas_siglas)}")
for s,c in novas_siglas.most_common(15):
    print(f"   {s!r}: {c} atos")
