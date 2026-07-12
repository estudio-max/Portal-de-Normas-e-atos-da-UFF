# -*- coding: utf-8 -*-
"""Backfill INSERT-only de `relacao` sobre a base v2 ja importada e limpa.
Roda o extrator CORRIGIDO (Nº maiusculo + formato compacto SIGLA NN/AAAA) sobre
ementa+corpo de TODOS os atos, detecta relacoes que ainda nao estao na tabela
`relacao`, e gera SQL so de INSERT (destino_ato_id fica NULL -- quem resolve o
link e o resolver_relacoes.php, ja adaptado ao v2, rodado depois).
"""
import os, re, sys, json, importlib.util, unicodedata
from collections import Counter
from parse_dump import extrair_tabela, parse_tuples

DAD = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2/v2_dados.sql"
TXT = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2/v2_texto.sql"
REPO = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/repo"
OUT  = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2"

spec = importlib.util.spec_from_file_location("eb", os.path.join(REPO,"tools","extrair_boletim.py"))
E = importlib.util.module_from_spec(spec); spec.loader.exec_module(E)

REL_MAP = {"ALTERA":"Altera","RETIFICA":"Altera","REPUBLICA":"Altera","PRORROGA":"Altera",
           "REVOGA":"Revoga","TORNA SEM EFEITO":"Revoga","ANULA":"Revoga","SUBSTITUI":"Revoga",
           "CITA":"Complementa"}

# Conectores curtos (<=4 letras) que o regex de numero engole por engano quando
# o corpo esta forcado em MAIUSCULO p/ o backfill (no PDF original ficam em
# minuscula e o padrao [A-Z]{1,4}, case-sensitive, nao os capturaria). So
# acontece nesta rodada de backfill upper-case; nao mexe no regex compartilhado.
STOP = {"DE","DO","DA","DOS","DAS","EM","NO","NA","NOS","NAS","E","QUE","POR",
        "COM","A","O","OS","AS","AO","AOS","SE","SOB","UM","UMA"}
SUFIXO_LIXO_RE = re.compile(r"\s+(?:" + "|".join(STOP) + r")\.?$")
def limpa_sufixo(dest):
    while True:
        novo = SUFIXO_LIXO_RE.sub("", dest)
        if novo == dest: return dest
        dest = novo

# tipos como monta_ref() os produz (Title Case; DTS via ACRONIMOS), maior 1o p/
# nao casar prefixo errado.
TIPOS_ORDENADOS = sorted(["Determinação De Serviço","Norma De Serviço","Instrução Normativa",
                          "Ordem De Serviço","Resolução","Portaria","Decisão","Edital",
                          "Deliberação","DTS"], key=len, reverse=True)
# monta_ref() SEMPRE emite o marcador como "nº " literal (minusculo, º real) --
# match exato, sem alternancia [ºo]/case-insensitive, senao "NO" (conector,
# maiusculo por causa do corpo forcado em upper) falso-casa como marcador.
NUM_MARCA_RE = re.compile(r"nº\s")
def limpa_dest(dest):
    """Remove conectores curtos (DE/NO/DA/...) que o regex, rodando sobre corpo
    forcado em MAIUSCULO, engoliu como se fossem parte do orgao ou cauda apos o
    numero. So mexe no orgao (entre tipo e 'nº'); preserva siglas reais como
    'VCE' em 'DTS VCE NO nº 07/2012' -> 'DTS VCE nº 07/2012'."""
    tipo_usado = next((t for t in TIPOS_ORDENADOS if dest == t or dest.startswith(t + " ")), None)
    if not tipo_usado:
        return limpa_sufixo(dest)
    resto = dest[len(tipo_usado):].strip()
    m = NUM_MARCA_RE.search(resto)
    if not m:
        return limpa_sufixo(dest)
    tokens = resto[:m.start()].split()
    while tokens and tokens[-1].upper() in STOP:
        tokens.pop()
    orgao_limpo = " ".join(tokens)
    novo = (tipo_usado + (" " + orgao_limpo if orgao_limpo else "") + " " + resto[m.start():])
    novo = re.sub(r"\s+"," ", novo).strip()
    return limpa_sufixo(novo)

def strip_ac(s): return "".join(c for c in unicodedata.normalize("NFD",s) if unicodedata.category(c)!="Mn")
def normkey(dest):
    d = strip_ac(dest).lower()
    d = re.sub(r"\b\d{4}\b","",d)
    d = re.sub(r"[^a-z0-9]","",d)
    return d
def esc(s):
    if s is None: return "NULL"
    return "'" + str(s).replace("\\","\\\\").replace("'","''") + "'"

print("carregando tipo_ato...", flush=True)
tipo_ato = extrair_tabela(DAD, "tipo_ato")   # id, nome, sigla, ordem
tipo_nome = {t[0]: t[1] for t in tipo_ato}
def norm_tipo(s):
    s = strip_ac(s).lower().strip()
    s = re.sub(r"\s+"," ",s)
    if s == "dts": s = "determinacao de servico"
    return s
NORM2ID = {norm_tipo(n): i for i,n in tipo_nome.items()}
DEST_NUM_RE = re.compile(r"^(.*?)\s+nº\s*(\d[\d.]*)(?:\s*/\s*(\d{4}))?\s*$")

print("carregando ato (metadados)...", flush=True)
ato = extrair_tabela(DAD, "ato")
# 0 id,1 uid,2 boletim_id,3 tipo_id,4 orgao_id,5 numero,6 numero_norm,7 ano,8 sigla_orig,9 data_ato,10 ementa,...
meta = {t[0]: {"sigla": t[8] if t[8]!="NULL" else "", "numero": t[5], "ementa": t[10] if t[10]!="NULL" else "",
               "tipo_id": t[3], "numero_norm": t[6], "ano": t[7]} for t in ato}

def eh_autorreferencia(m_ato, dest):
    """2a camada, alem da do extrator: compara tipo+numero+ano NORMALIZADOS
    (v2, sem o erro de parsing de sigla/numero que existe em alguns atos legados
    do v1) em vez de string crua de sigla. Pega casos que a checagem original
    (por sigla) deixa passar quando o cabecalho do proprio ato foi mal-parseado."""
    dm = DEST_NUM_RE.match(dest)
    if not dm: return False
    tipo_txt, num_txt, ano_txt = dm.groups()
    tid_cit = NORM2ID.get(norm_tipo(tipo_txt))
    if tid_cit is None or tid_cit != m_ato["tipo_id"]:
        return False
    try:
        num_cit = int(re.sub(r"\D","",num_txt))
        num_prop = int(m_ato["numero_norm"]) if m_ato["numero_norm"] not in ("","NULL") else None
    except ValueError:
        return False
    if num_prop is None or num_cit != num_prop:
        return False
    if ano_txt and m_ato["ano"] not in ("","NULL") and ano_txt != m_ato["ano"]:
        return False
    return True
print(f"  atos: {len(meta)}")

print("carregando relacoes existentes (dedup)...", flush=True)
rel = extrair_tabela(DAD, "relacao")
existentes = set()
for r in rel:
    existentes.add((r[0], r[1], r[4]))   # ato_id, tipo, destino_norm
print(f"  relacoes existentes: {len(rel)}")

print("streaming ato_texto...", flush=True)
novos = []
tipo_cnt = Counter()
atos_afetados = set()
vistos_lote = set()
autorref_evitadas = [0]
alvo = "INSERT INTO `ato_texto`"; capt=False; buf=[]; n=0
with open(TXT, encoding="utf-8", errors="replace") as f:
    for linha in f:
        if not capt:
            if linha.startswith(alvo):
                capt=True; i=linha.find("VALUES"); buf=[linha[i+6:]] if i>=0 else [linha]
        else:
            buf.append(linha)
            if linha.rstrip().endswith(";"):
                for t in parse_tuples("".join(buf)):
                    if len(t)<2: continue
                    aid, orig = t[0], t[1]
                    m = meta.get(aid)
                    if not m: continue
                    n+=1
                    if n % 20000 == 0:
                        print(f"  {n}/{len(meta)} | novos={len(novos)}", flush=True)
                    corpo_up = (orig or "").upper()
                    rels = E.detecta_relacoes(m["ementa"], corpo_up, m["sigla"], m["numero"])
                    for rr in rels:
                        tipo = REL_MAP.get(rr["relacao"], "Complementa")
                        dest = limpa_dest(rr["ato_citado"])
                        if eh_autorreferencia(m, dest):
                            autorref_evitadas[0] += 1
                            continue
                        # exclusao pontual: ato 52359 tem cabecalho de PDF com
                        # ordem atipica (sigla DEPOIS do numero: "...Nº 01 COC,
                        # 03 de junho..."), o que faz a sigla colar dentro do
                        # proprio grupo "numero" do regex -> autorreferencia que
                        # a checagem por tipo+numero+ano nao pega (formato sujo
                        # demais p/ o match exigir string limpa). 1 caso em 8921
                        # (0,01%); nao compensa generalizar regra p/ isso.
                        if aid == "52359" and dest == "Determinação De Serviço nº 01 COC":
                            autorref_evitadas[0] += 1
                            continue
                        dnorm = normkey(dest)[:200]
                        k = (aid, tipo, dnorm)
                        if k in existentes or k in vistos_lote: continue
                        vistos_lote.add(k)
                        det = (rr.get("trecho") or "")[:255]
                        novos.append((aid, tipo, dest[:200], dnorm, det))
                        tipo_cnt[tipo]+=1
                        atos_afetados.add(aid)
                capt=False; buf=[]
print(f"  corpos processados: {n}")

print(f"\n===== RESULTADO =====")
print(f"Relacoes NOVAS a inserir: {len(novos)}")
print(f"Atos afetados: {len(atos_afetados)}")
print(f"Por tipo: {dict(tipo_cnt)}")
print(f"Autorreferencias evitadas (2a camada): {autorref_evitadas[0]}")
print("\nAmostra (15):")
for aid,tipo,dest,dnorm,det in novos[:15]:
    print(f"  [{tipo}] ato={aid} -> {dest}   :: {det[:70]}")

SQLP = os.path.join(OUT, "v2_backfill_relacoes.sql")
with open(SQLP, "w", encoding="utf-8") as f:
    f.write("-- Backfill INSERT-only de `relacao` sobre a base v2 (extrator corrigido).\n")
    f.write("-- destino_ato_id fica NULL; rode resolver_relacoes.php (v2) depois p/ ligar.\n\n")
    f.write("INSERT INTO `extracao` (`versao`,`escopo`,`n_atos`,`observacao`) VALUES "
            f"('backfill-relacoes','ementa+corpo (extrator corrigido)',{len(atos_afetados)},"
            f"'Nº maiusculo + formato compacto SIGLA NN/AAAA');\n")
    f.write("SET @extracao_id = LAST_INSERT_ID();\n\n")
    BATCH=500
    for i in range(0, len(novos), BATCH):
        ch = novos[i:i+BATCH]
        f.write("INSERT INTO `relacao` (`ato_id`,`tipo`,`destino_ato_id`,`destino_texto`,"
                "`destino_norm`,`externo`,`trecho`,`metodo`,`extracao_id`) VALUES\n")
        linhas = [f"({aid},{esc(tipo)},NULL,{esc(dest)},{esc(dnorm)},0,{esc(det)},'backfill-v2',@extracao_id)"
                  for aid,tipo,dest,dnorm,det in ch]
        f.write(",\n".join(linhas) + ";\n")
print(f"\nSQL: {SQLP}")
