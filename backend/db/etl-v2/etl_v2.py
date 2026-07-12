# -*- coding: utf-8 -*-
"""ETL v1 -> v2 (Fase A: reformatar os dados existentes no schema normalizado).
Le o dump v1 e emite out_v2/v2_dados.sql (INSERTs) + relatorio de validacao.
Nao toca em producao. Sem perda: dedup so colapsa chave natural, mantendo a
linha mais rica; slugs dos perdedores tambem mapeiam pro vencedor (links nao quebram).
"""
import os, re, sys, unicodedata, gzip, json
from collections import defaultdict, Counter
from parse_dump import extrair_tabela, parse_tuples

DUMP = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out/fanara87_uffnormas.sql"
OUT  = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2"
os.makedirs(OUT, exist_ok=True)

def log(m): print(m, flush=True)

# ---------- helpers ----------
def strip_acentos(s):
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")

def norm_busca(s):
    return re.sub(r"\s+", " ", strip_acentos(s).lower()).strip()

def normkey(dest):
    d = strip_acentos(dest).lower()
    d = re.sub(r"\b\d{4}\b", "", d)   # tira ano
    d = re.sub(r"[^a-z0-9]", "", d)   # so alfanumerico
    return d

def orgao_key(sigla):
    """CHAVE de agrupamento (caixa alta, sem pontuacao de borda, barra normalizada).
    Preserva '/' (siglas compostas sao orgaos reais). Usada so p/ agrupar variantes;
    a grafia EXIBIDA e escolhida a parte (a mais frequente do grupo)."""
    if not sigla or sigla == "NULL":
        return "N/D"
    s = sigla.upper().strip()
    s = re.sub(r"\s+", " ", s)
    s = s.strip(" .,;-")
    s = re.sub(r"\s*/\s*", "/", s)   # normaliza espacos ao redor da barra
    return s or "N/D"

SIGLA_TIPO = {"Determinação de Serviço":"DTS","Portaria":"PORT","Resolução":"RES",
              "Decisão":"DEC","Resumo de Despachos":"RD","Edital":"ED",
              "Instrução Normativa":"IN","Comunicado":"COM","Norma de Serviço":"NS",
              "Ordem de Serviço":"OS"}

def slugify(s):
    s = strip_acentos(s).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

def esc_data(s):
    """Data 'zerada' (0000-00-00, herdada de PDF sem data parseavel) nao e
    uma data real -- vira NULL, senao MIN()/MAX() e comparacoes de vigencia
    quebram (achado 12/07: 5 atos com data_ato='0000-00-00' distorcendo
    dataMin do /api/insights)."""
    if s is None or s in ("", "NULL") or re.match(r"^0000-00-00", str(s)):
        return "NULL"
    return esc(s)

def esc(s):
    if s is None or s == "" or s == "NULL":
        return "NULL"
    return "'" + str(s).replace("\\","\\\\").replace("'","''") + "'"

def num_or_null(s):
    if s is None or s in ("","NULL"): return "NULL"
    d = re.sub(r"\D","", str(s))
    return d if d else "NULL"

def digits(s):
    return re.sub(r"\D","", str(s or ""))

# =====================================================================
log("== 1/6 parse tabelas v1 ==")
atos = extrair_tabela(DUMP, "atos")          # 0 id .. 28 desloc_setor
boletins = extrair_tabela(DUMP, "boletins")  # 0 id 1 arq 2 num 3 ano 4 data 5 url 6 pag
funcoes = extrair_tabela(DUMP, "ato_funcoes")# 0 id 1 ato 2 acao 3 cargo 4 unid 5 chave 6 siape 7 nome
siapes  = extrair_tabela(DUMP, "ato_siapes") # 0 id 1 ato 2 siape 3 nome
rels    = extrair_tabela(DUMP, "ato_relacoes")# 0 id 1 ato 2 tipo 3 dest_txt 4 dest_id 5 ext 6 det
log(f"   atos={len(atos)} boletins={len(boletins)} funcoes={len(funcoes)} siapes={len(siapes)} rel={len(rels)}")

# ---------- DIM tipo_ato ----------
tipos = []
for r in atos:
    if r[2] not in tipos: tipos.append(r[2])
tipo_id = {t:i+1 for i,t in enumerate(tipos)}

# ---------- DIM orgao (do resolvedor: backbone + derivacao do texto) ----------
log("== 2/6 dimensao orgao (resolucao por ato) ==")
RES = json.load(open(os.path.join(OUT, "orgao_resolucao.json"), encoding="utf-8"))
registry = RES["registry"]                 # idx -> {sigla,nome,tipo,parent_idx}
sigla_to_canon = RES["sigla_to_canon"]     # sigla corpus -> idx
ato_orgao = RES["ato_orgao"]               # ato_id v1 -> [idx, origem, cargo]
# id do orgao = idx+1
log(f"   orgaos canonicos: {len(registry)} | atos resolvidos: {len(ato_orgao)}")

# ---------- DIM boletim ----------
log("== 3/6 dimensao boletim ==")
bol_meta = {int(b[0]): b for b in boletins if b[0] not in ("","NULL")}  # old_id -> row
bkey_id = {}     # (num,ano) -> new id
old2bol = {}     # old boletim_id -> new id
for r in atos:
    obid = r[1]
    if obid in ("","NULL"): continue
    obid = int(obid)
    num = obid % 1000
    ano = obid // 1000
    k = (num, ano)
    if k not in bkey_id:
        bkey_id[k] = len(bkey_id)+1
    old2bol[obid] = bkey_id[k]
log(f"   boletins distintos: {len(bkey_id)}")

# ---------- DIM pessoa ----------
log("== 4/6 dimensao pessoa ==")
pessoa_id = {}         # chave -> id ; chave = ('s',siape) ou ('n',nome_norm)
pessoa_row = {}        # id -> (siape,nome)
def add_pessoa(siape, nome):
    siape = digits(siape) if siape not in (None,"","NULL") else ""
    nome = (nome or "").strip()
    if siape:
        k = ("s", siape)
    elif nome:
        k = ("n", norm_busca(nome))
    else:
        return None
    if k not in pessoa_id:
        pid = len(pessoa_id)+1
        pessoa_id[k] = pid
        pessoa_row[pid] = (siape or None, nome or None)
    else:
        pid = pessoa_id[k]
        # completa nome se faltava
        if nome and not pessoa_row[pid][1]:
            pessoa_row[pid] = (pessoa_row[pid][0], nome)
    return pid
for r in funcoes:
    add_pessoa(r[6] if len(r)>6 else "", r[7] if len(r)>7 else "")
for r in siapes:
    add_pessoa(r[2] if len(r)>2 else "", r[3] if len(r)>3 else "")
log(f"   pessoas: {len(pessoa_id)}")

def pid_de(siape, nome):
    siape = digits(siape) if siape not in (None,"","NULL") else ""
    if siape and ("s",siape) in pessoa_id: return pessoa_id[("s",siape)]
    if nome and ("n",norm_busca(nome)) in pessoa_id: return pessoa_id[("n",norm_busca(nome))]
    return None

# ---------- NUCLEO ato (dedup por chave natural, mantem mais rico) ----------
log("== 5/6 nucleo ato (dedup natural) ==")
def riqueza(r):
    sc = 0
    if r[6] not in ("","NULL"): sc += 1          # data_ato
    if r[14] not in ("","NULL"): sc += 1         # processo_sei
    if len(r)>19 and r[19] not in ("","NULL"): sc += 1  # secao
    sc = sc*1000 + len(r[9] or "")               # tiebreak: ementa mais longa
    return sc

# IDENTIDADE do ato = sigla IMPRESSA (cabeçalho), nao o orgao derivado.
grupos = defaultdict(list)
for r in atos:
    obid = int(r[1]) if r[1] not in ("","NULL") else 0
    bid = old2bol.get(obid, 0)
    tid = tipo_id[r[2]]
    sig_orig = (r[3] or "").strip() or "N/D"
    # numero_norm e coluna INT no schema -> MySQL compara '001'=='01'=='1' (mesmo
    # inteiro). Agrupar pela forma numerica (sem zeros a esquerda), senao o dedup
    # Python nao bate com a unicidade real que o banco vai aplicar no import.
    nn_raw = digits(r[4])
    nn = str(int(nn_raw)) if nn_raw else ""
    ano = r[5] if r[5] not in ("","NULL") else "0"
    natkey = (bid, tid, sig_orig, nn, ano)
    grupos[natkey].append(r)

slug2new = {}     # slug v1 -> id ato v2 (inclui perdedores do dedup)
ato_final = []    # (new_id, natkey, row_vencedora, uid, orgao_id, origem, cargo)
uid_uso = Counter()
nid = 0
for natkey, rows in grupos.items():
    vencedora = max(rows, key=riqueza)
    nid += 1
    for r in rows:
        slug2new[r[0]] = nid
    bid, tid, sig_orig, nn, ano = natkey
    # orgao DERIVADO (do resolvedor) para o ato vencedor
    res = ato_orgao.get(vencedora[0]) or [sigla_to_canon.get(sig_orig, 0), "cabecalho", None]
    oid_v2 = res[0] + 1
    origem = res[1]
    cargo = res[2]
    can_sig = registry[res[0]]["sigla"]
    base_uid = slugify(f"{SIGLA_TIPO.get(vencedora[2],'ato')}-{sig_orig}-{nn or 'sn'}-{ano}")
    uid_uso[base_uid]+=1
    uid = base_uid if uid_uso[base_uid]==1 else f"{base_uid}-{uid_uso[base_uid]}"
    ato_final.append((nid, natkey, vencedora, uid, oid_v2, origem, cargo))
log(f"   grupos naturais (atos v2): {len(ato_final)}  | colapsados: {len(atos)-len(ato_final)}")

# =====================================================================
log("== 6/6 emitindo SQL ==")
SQLP = os.path.join(OUT, "v2_dados.sql")
f = open(SQLP, "w", encoding="utf-8")
f.write("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET autocommit=0;\nSTART TRANSACTION;\n\n")

def emit(tabela, cols, linhas, batch=400):
    if not linhas: return
    for i in range(0, len(linhas), batch):
        ch = linhas[i:i+batch]
        f.write(f"INSERT INTO `{tabela}` ({','.join('`'+c+'`' for c in cols)}) VALUES\n")
        f.write(",\n".join(ch) + ";\n")

# tipo_ato
emit("tipo_ato", ["id","nome","sigla","ordem"],
     [f"({tipo_id[t]},{esc(t)},{esc(SIGLA_TIPO.get(t))},{i})" for i,t in enumerate(tipos)])
# orgao (do registry: id=idx+1, sigla, nome, tipo, parent_id)
emit("orgao", ["id","sigla","nome","tipo","parent_id"],
     [f"({i+1},{esc(o['sigla'][:60])},{esc(o['nome'])},{esc(o['tipo'])},"
      f"{(o['parent_idx']+1) if o.get('parent_idx') is not None else 'NULL'})"
      for i,o in enumerate(registry)])
# orgao_alias: sigla do corpus que difere da sigla canonica do seu orgao.
# Dedup sob a MESMA regra do MySQL (utf8mb4_unicode_ci = case+acento-insensitive:
# "DECISOES"=="DECISÕES"), senão o uq_alias rejeita no import mesmo com strings
# Python distintas. Mantem 1 grafia por chave (a com acento, se houver).
def ci_key(s):
    s2 = unicodedata.normalize("NFD", s)
    s2 = "".join(c for c in s2 if unicodedata.category(c) != "Mn")
    return s2.upper()
al_bruto = [(a, idx) for a, idx in sigla_to_canon.items()
            if a and a != registry[idx]["sigla"]]
al_por_chave = {}
for a, idx in al_bruto:
    k = (ci_key(a), idx)   # mesma chave só se for mesmo orgao (conflito real fica evidente)
    if k not in al_por_chave or len(a) > len(al_por_chave[k][0]):
        al_por_chave[k] = (a, idx)
al = list(al_por_chave.values())
log(f"   orgao_alias: {len(al_bruto)} brutos -> {len(al)} apos dedup collation-aware")
emit("orgao_alias", ["orgao_id","alias"],
     [f"({idx+1},{esc(a[:80])})" for a,idx in al])
# pessoa
emit("pessoa", ["id","siape","nome"],
     [f"({pid},{esc(sp)},{esc(nm)})" for pid,(sp,nm) in sorted(pessoa_row.items())])
# boletim
bol_linhas = []
for (num,ano),bid in sorted(bkey_id.items(), key=lambda x:x[1]):
    # acha url/arquivo pelo old_id calculado
    oldid = ano*1000+num
    meta = bol_meta.get(oldid)
    arq = meta[1] if meta else None
    url = meta[5] if meta and len(meta)>5 else None
    pag = meta[6] if meta and len(meta)>6 and meta[6] not in ("","NULL") else "NULL"
    bol_linhas.append(f"({bid},{num},{ano},NULL,{esc(arq)},{esc(url)},{pag})")
emit("boletim", ["id","numero","ano","data_pub","arquivo","url_pdf","paginas"], bol_linhas)
# extracao
f.write("INSERT INTO `extracao` (`id`,`versao`,`escopo`,`n_atos`,`observacao`) VALUES "
        f"(1,'v2-etl','migracao-faseA',{len(ato_final)},'Reformatacao v1->v2 sem perda');\n")

# ato
ato_linhas = []
for nid, natkey, r, uid, oid_v2, origem, cargo in ato_final:
    bid, tid, sig_orig, nn, ano = natkey
    ementa = (r[9] or "")[:600]
    status = r[13] if len(r)>13 and r[13] in ("Ativo","Alterado","Revogado") else "Ativo"
    einf = r[10] if len(r)>10 and r[10] in ("0","1") else "0"
    ato_linhas.append(
        f"({nid},{esc(uid)},{bid},{tid},{oid_v2},{esc(r[4])},{num_or_null(r[4])},{ano},"
        f"{esc(sig_orig[:60]) if sig_orig!='N/D' else 'NULL'},"
        f"{esc_data(r[6])},{esc(ementa)},{einf},"
        f"{esc(status)},{esc(r[14]) if len(r)>14 else 'NULL'},"
        f"{esc(r[15]) if len(r)>15 and r[15] not in ('','NULL') else 'NULL'},"
        f"{esc(r[19]) if len(r)>19 and r[19] not in ('','NULL') else 'NULL'},"
        f"{esc(r[20]) if len(r)>20 and r[20] not in ('','NULL') else 'NULL'},"
        f"{esc(cargo[:80]) if cargo else 'NULL'},{esc(origem)},1)")
emit("ato", ["id","uid","boletim_id","tipo_id","orgao_id","numero","numero_norm","ano",
             "sigla_orig","data_ato","ementa","ementa_inferida","status","processo_sei",
             "sei_documento","secao","pagina","signatario_cargo","orgao_origem","extracao_id"], ato_linhas)

# aposentadoria / deslocamento (dos vencedores)
apos, desl = [], []
for nid, natkey, r, uid, oid_v2, origem, cargo in ato_final:
    if len(r)>21 and r[21] not in ("","NULL"):
        apos.append(f"({nid},{esc(r[21])},{esc(r[22]) if len(r)>22 and r[22] not in ('','NULL') else 'NULL'})")
    if len(r)>25 and r[25] not in ("","NULL"):
        desl.append(f"({nid},{esc(r[25])},"
                    f"{esc(r[26]) if len(r)>26 and r[26] not in ('','NULL') else 'NULL'},"
                    f"{esc(r[27]) if len(r)>27 and r[27] not in ('','NULL') else 'NULL'},"
                    f"{esc(r[28]) if len(r)>28 and r[28] not in ('','NULL') else 'NULL'})")
emit("ato_aposentadoria", ["ato_id","tipo","base_legal"], apos)
emit("ato_deslocamento", ["ato_id","tipo","direcao","motivo","setor"], desl)

# relacao (dedup por ato+tipo+destino_norm)
TIPOS_OK = {"Revoga","Altera","Complementa"}
rel_linhas = []
vis_rel = set()
for r in rels:
    aid = slug2new.get(r[1])
    if not aid: continue
    tipo = r[2]
    if tipo not in TIPOS_OK: continue
    dtxt = (r[3] or "")[:200]
    dnorm = normkey(dtxt)[:200]
    k = (aid, tipo, dnorm)
    if k in vis_rel: continue
    vis_rel.add(k)
    dest_id = slug2new.get(r[4]) if len(r)>4 and r[4] not in ("","NULL") else None
    ext = r[5] if len(r)>5 and r[5] in ("0","1") else "0"
    trecho = (r[6] or "")[:255] if len(r)>6 else ""
    rel_linhas.append(
        f"({aid},{esc(tipo)},{dest_id if dest_id else 'NULL'},{esc(dtxt)},{esc(dnorm)},"
        f"{ext},{esc(trecho)},'v1',1)")
emit("relacao", ["ato_id","tipo","destino_ato_id","destino_texto","destino_norm",
                 "externo","trecho","metodo","extracao_id"], rel_linhas)

# ato_funcao
func_linhas = []
for r in funcoes:
    aid = slug2new.get(r[1])
    if not aid: continue
    acao = r[2] if r[2] in ("designar","dispensar") else "designar"
    pid = pid_de(r[6] if len(r)>6 else "", r[7] if len(r)>7 else "")
    func_linhas.append(
        f"({aid},{esc(acao)},{esc((r[3] or '')[:60])},{esc((r[4] or '')[:180])},"
        f"NULL,{pid if pid else 'NULL'})")
emit("ato_funcao", ["ato_id","acao","cargo","unidade","orgao_id","pessoa_id"], func_linhas)

# ato_pessoa (dedup ato+pessoa)
ap_linhas = []
vis_ap = set()
for r in siapes:
    aid = slug2new.get(r[1])
    if not aid: continue
    pid = pid_de(r[2] if len(r)>2 else "", r[3] if len(r)>3 else "")
    if not pid: continue
    k = (aid, pid)
    if k in vis_ap: continue
    vis_ap.add(k)
    ap_linhas.append(f"({aid},{pid})")
emit("ato_pessoa", ["ato_id","pessoa_id"], ap_linhas)

f.write("\nCOMMIT;\nSET FOREIGN_KEY_CHECKS=1;\n")
f.close()

# ---------- ato_texto: streaming separado (arquivo grande) ----------
log("   emitindo ato_texto (streaming corpo)...")
SQLT = os.path.join(OUT, "v2_texto.sql")
ft = open(SQLT, "w", encoding="utf-8")
ft.write("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET autocommit=0;\nSTART TRANSACTION;\n")
alvo="INSERT INTO `ato_corpo`"; capt=False; buf=[]; escritos=set(); n_txt=0
with open(DUMP, encoding="utf-8", errors="replace") as fin:
    for l in fin:
        if not capt:
            if l.startswith(alvo): capt=True; i=l.find("VALUES"); buf=[l[i+6:]] if i>=0 else [l]
        else:
            buf.append(l)
            if l.rstrip().endswith(";"):
                for t in parse_tuples("".join(buf)):
                    if len(t)<2: continue
                    aid = slug2new.get(t[0])
                    if not aid or aid in escritos: continue
                    escritos.add(aid)
                    orig = t[1]
                    busca = norm_busca(orig)
                    ft.write(f"INSERT INTO `ato_texto` (`ato_id`,`texto_original`,`texto_busca`) "
                             f"VALUES ({aid},{esc(orig)},{esc(busca)});\n")
                    n_txt+=1
                capt=False; buf=[]
ft.write("\nCOMMIT;\nSET FOREIGN_KEY_CHECKS=1;\n")
ft.close()

# ---------- RELATORIO ----------
log("\n===== RELATORIO DE VALIDACAO =====")
log(f"tipo_ato:      {len(tipos)}")
org_texto = sum(1 for x in ato_final if x[5]=="texto")
log(f"orgao:         {len(registry)}  (aliases: {len(al)}) | orgao_origem=texto: {org_texto} ({100*org_texto//len(ato_final)}%)")
log(f"boletim:       {len(bkey_id)}")
log(f"pessoa:        {len(pessoa_id)}")
log(f"ato:           {len(ato_final)}  (colapsados de {len(atos)}: {len(atos)-len(ato_final)})")
log(f"ato_texto:     {n_txt}")
log(f"relacao:       {len(rel_linhas)}  (de {len(rels)} v1; dedup removeu {len(rels)-len(rel_linhas)})")
lk = sum(1 for x in rel_linhas if ',NULL,' not in x.split(',',3)[2])
log(f"ato_funcao:    {len(func_linhas)}")
log(f"ato_pessoa:    {len(ap_linhas)}")
log(f"ato_aposent.:  {len(apos)}")
log(f"ato_desloc.:   {len(desl)}")
sz1 = os.path.getsize(SQLP)/1e6; sz2 = os.path.getsize(SQLT)/1e6
log(f"\nArquivos: v2_dados.sql ({sz1:.1f}MB) + v2_texto.sql ({sz2:.1f}MB)")
log("Import: schema_v2.sql -> v2_dados.sql -> v2_texto.sql")
