# -*- coding: utf-8 -*-
"""Resolve o órgão emissor POR ATO, ancorado no backbone + derivação do texto.
Produz out_v2/orgao_resolucao.json:
  - registry: [{sigla,nome,tipo,parent}]  (órgãos canônicos, índice = ordem)
  - sigla_to_canon: {sigla_corpus: idx}
  - ato_orgao: {ato_id: [idx, origem, cargo]}   origem: texto|cabecalho
Elegância: siglas que derivam o MESMO nome colapsam no mesmo canônico
(EEIMVR≡VEI); atos catch-all (UFF que é DAP no texto) vão pro órgão certo.
"""
import os, re, json, unicodedata
from collections import Counter, defaultdict
from parse_dump import extrair_tabela, parse_tuples

DUMP = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out/fanara87_uffnormas.sql"
BACK = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/repo/backend/db/orgaos_backbone.json"
OUT  = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2"
os.makedirs(OUT, exist_ok=True)

# Variantes textuais CONHECIDAS do mesmo orgao (nome completo mudou/varia ao
# longo dos anos ou por informalidade na redacao, mas e o MESMO orgao real).
# Achado 12/07/2026: 13.971 atos citavam o CEPEx como "Conselho de Ensino e
# Pesquisa" (sem "e Extensao") -- normalizava diferente e virava um orgao
# canonico separado por engano ("CEP", rotulo colidindo por coincidencia com
# a sigla real do Comite de Etica em Pesquisa, que e outro orgao totalmente
# diferente -- NAO confundir). Corrigido aqui p/ nao se repetir num rerun.
NOME_EQUIVALENTE = {
    "conselho de ensino e pesquisa": "conselho de ensino pesquisa e extensao",
}

def strip_ac(s): return "".join(c for c in unicodedata.normalize("NFD",s) if unicodedata.category(c)!="Mn")
def norm_nome(s):
    s = strip_ac(s).lower()
    s = re.sub(r"\(.*?\)","",s)                       # tira (sigla)
    s = re.sub(r"\bd[aeo]s?\s+universidade federal fluminense\b","",s)
    s = re.sub(r"\bd[aeo]s?\s+uff\b","",s)
    s = re.sub(r"\buff\b","",s)
    s = re.sub(r"[^a-z0-9 ]"," ",s)
    s = re.sub(r"\s+"," ",s).strip()
    s = NOME_EQUIVALENTE.get(s, s)
    return s
CONECTORES_MINUSCULOS = {"de","da","do","das","dos","e","em","no","na","nos","nas",
                          "a","o","as","os","para","com","ao","aos","à","às"}
def titulo(s):
    """Title Case de verdade (cada palavra), preservando conectores em
    minusculo (de/da/e/em...) exceto quando sao a 1a palavra. Entrada e
    sempre minuscula (nome vem de .lower() antes de chamar titulo())."""
    s = re.sub(r"-\s+","-",s)                # "técnico- administrativo" -> "técnico-administrativo"
    s = re.sub(r"\s+"," ",s).strip(" .,-")
    if not s: return s
    def cap(w):
        return "-".join(p[:1].upper()+p[1:] if p else p for p in w.split("-"))
    palavras = s.split(" ")
    out = [cap(palavras[0])]
    for p in palavras[1:]:
        out.append(p.lower() if p.lower() in CONECTORES_MINUSCULOS else cap(p))
    return " ".join(out)

def is_reitor(cargo):
    return bool(cargo) and re.search(r"reitor", cargo) and "pro" not in cargo and "pró" not in cargo

def infer_tipo(nome):
    n = strip_ac(nome).lower()
    if "conselho" in n: return "deliberacao"
    if "pro-reitor" in n or "pró-reitor" in n or "pro reitor" in n: return "pro_reitoria"
    if "superintend" in n: return "suplementar"
    if any(w in n for w in ("instituto","escola","faculdade","colegio")): return "unidade"
    if any(w in n for w in ("departamento","coordenacao","divisao","secao","setor","nucleo")): return "departamento"
    if "comiss" in n or "comite" in n: return "comite_comissao"
    if "hospital" in n: return "suplementar"
    if "gabinete" in n or "reitoria" in n: return "reitoria"
    if "procuradoria" in n: return "assessoramento"
    if "ouvidoria" in n: return "assessoramento"
    return "outro"

# ---- regex de derivação (cláusula de abertura) ----
CARGOS = (r"(?:magn[ií]fico\s+)?(?:vice-?)?reitor[ae]?|chefe|coordenador[ae]?|"
          r"diretor[ae]?|presidente|pr[óo]-?reitor[ae]?|superintendente|decano|"
          r"ouvidor[ae]?|procurador[ae]?|secret[áa]ri[ae]|pr[óo]-?reitor")
PAT = re.compile(r"\b[oa]s?\s+("+CARGOS+r")\s+(d[aeo]s?\s+|d[oa]\s+)?(.{4,90}?)\s*,?\s+no\s+uso\s+de\s+suas\s+atribui", re.I)
# colegiado que se AUTONOMEIA: "O COMITÊ ... , no uso de suas atribuições"
PAT2 = re.compile(r"\bo\s+((?:conselho|comit[êe]|comiss[ãa]o|c[âa]mara|colegiado|plen[áa]rio|congrega[çc][ãa]o)\b.{0,80}?)\s*,?\s+no\s+uso\s+de\s+suas\s+atribui", re.I)

# ---- backbone ----
back = json.load(open(BACK,encoding="utf-8"))["orgaos"]
ALIAS = {"GAR":"Reitoria","GAR/RET":"Reitoria","GARRETUFF":"Reitoria","RET":"Reitoria",
         "GABR":"Reitoria","GAB":"Reitoria","GABVR":"Reitoria","EEIMVR":"VEI",
         "CIÊNCIA DE ELIMINAÇÃO DE DOCUMENTOS":"CPAD"}

# registry inicial = backbone
registry = []            # lista de dicts {sigla,nome,tipo,parent}
canon_idx = {}           # sigla canonica -> idx
name_index = {}          # norm_nome -> idx
sigla_index = {}         # sigla corpus -> idx
def add_canon(sigla,nome,tipo,parent):
    idx = len(registry)
    registry.append({"sigla":sigla,"nome":nome,"tipo":tipo,"parent":parent})
    canon_idx[sigla]=idx
    if nome: name_index.setdefault(norm_nome(nome),idx)
    return idx
for sg,info in back.items():
    add_canon(sg, info.get("nome"), info.get("tipo"), info.get("parent"))
# aliases do backbone -> apontam pro canônico
for a,c in ALIAS.items():
    if c in canon_idx: sigla_index[a]=canon_idx[c]
# siglas do backbone apontam pra si
for sg in back: sigla_index[sg]=canon_idx[sg]
# parent por sigla (resolve nome->idx depois)
for i,r in enumerate(registry):
    p = r["parent"]
    r["parent_idx"] = canon_idx.get(p) if p else None

# ---- passa 1: deriva nome/cargo por ato ----
atos = extrair_tabela(DUMP,"atos")
sig_de = {r[0]: r[3] for r in atos}
deriv = {}   # ato_id -> (nome_norm, nome_raw, cargo)
alvo="INSERT INTO `ato_corpo`";capt=False;buf=[]
for r in atos: pass
with open(DUMP,encoding="utf-8",errors="replace") as fp:
    for l in fp:
        if not capt:
            if l.startswith(alvo):capt=True;i=l.find("VALUES");buf=[l[i+6:]] if i>=0 else [l]
        else:
            buf.append(l)
            if l.rstrip().endswith(";"):
                for t in parse_tuples("".join(buf)):
                    if len(t)<2: continue
                    m = PAT.search(t[1])
                    if m:
                        cargo = re.sub(r"\s+"," ",m.group(1)).strip().lower()
                        nome = m.group(3)
                    else:
                        m2 = PAT2.search(t[1])
                        if not m2: continue
                        cargo = None                     # colegiado se autonomeia
                        nome = m2.group(1)
                    nome = re.sub(r"\s+"," ",nome).strip(" .,-").lower()
                    nome = re.split(r"\b(?:no uso|delegad|conforme|nos termos|em exerc)",nome)[0].strip(" .,-")
                    if 4<=len(nome)<=80:
                        deriv[t[0]] = (norm_nome(nome), titulo(nome), cargo)
                capt=False;buf=[]

# ---- dominante por sigla (p/ criar canônicos de siglas fora do backbone) ----
nome_por_sig = defaultdict(Counter)
for aid,(nn,raw,cg) in deriv.items():
    sg = sig_de.get(aid)
    if sg not in ("","NULL"): nome_por_sig[sg][(nn,raw)]+=1

for sg, cnt in sorted(nome_por_sig.items(), key=lambda x:-sum(x[1].values())):
    if sg in sigla_index:
        # já mapeada (backbone): NÃO registra o nome derivado — catch-alls (UFF)
        # poluiriam o índice apontando um nome específico p/ o órgão errado.
        continue
    (nn,raw),_ = cnt.most_common(1)[0]
    if nn in name_index:
        sigla_index[sg] = name_index[nn]          # sigla nova de órgão já existente (drift!)
    else:
        idx = add_canon(sg, raw, infer_tipo(raw), None)
        sigla_index[sg] = idx
        registry[idx]["parent_idx"]=None

# siglas sem nenhuma derivação e fora do backbone -> canônico pela própria sigla
for sg in set(sig_de.values()):
    if sg in ("","NULL"): continue
    if sg not in sigla_index:
        idx = add_canon(sg, None, "outro", None)
        sigla_index[sg]=idx

# ---- passa 2: resolve órgão POR ATO ----
REITORIA_IDX = canon_idx.get("Reitoria")
ato_orgao = {}
cont_origem = Counter()
for r in atos:
    aid, sg = r[0], r[3]
    d = deriv.get(aid)
    idx=None; origem=None; cargo=None
    if d:
        nn,raw,cargo = d
        if is_reitor(cargo):
            # Reitor assina: órgão = colegiado que ele preside (se o texto nomear
            # um) OU a Reitoria. Nunca o genérico "UFF".
            j = name_index.get(nn)
            if j is not None and registry[j]["tipo"] in ("deliberacao","comite_comissao"):
                idx=j
            else:
                idx=REITORIA_IDX
            origem="texto"
        elif nn in name_index:
            idx = name_index[nn]; origem="texto"
    if idx is None:
        idx = sigla_index.get(sg)
        origem = "cabecalho"
    if idx is None:  # sem sigla e sem derivação
        idx = sigla_index.get("N/D")
        if idx is None: idx = add_canon("N/D",None,"outro",None); sigla_index["N/D"]=idx
        origem="cabecalho"
    ato_orgao[aid] = [idx, origem, cargo]
    cont_origem[origem]+=1

# ---- resolve parent_idx dos criados por backbone-nome ----
out = {
 "registry":[{"sigla":r["sigla"],"nome":r["nome"],"tipo":r["tipo"],
              "parent_idx":r.get("parent_idx")} for r in registry],
 "sigla_to_canon": sigla_index,
 "ato_orgao": ato_orgao,
}
json.dump(out, open(os.path.join(OUT,"orgao_resolucao.json"),"w",encoding="utf-8"), ensure_ascii=False)

# ---- validação ----
print(f"órgãos canônicos no registry: {len(registry)}  (backbone {len(back)} + derivados {len(registry)-len(back)})")
print(f"atos resolvidos: {len(ato_orgao)}")
print(f"origem: {dict(cont_origem)}  -> texto={100*cont_origem['texto']//len(ato_orgao)}%")
# quantos órgãos distintos realmente usados
usados = Counter(v[0] for v in ato_orgao.values())
print(f"órgãos distintos efetivamente usados: {len(usados)}")
print("\nTop 20 órgãos por nº de atos:")
for idx,c in usados.most_common(20):
    r=registry[idx]
    print(f"  {c:6d}  {r['sigla']:16s} {str(r['nome'])[:42]:42s} [{r['tipo']}]")
