# -*- coding: utf-8 -*-
"""Valida a integridade do SQL v2 gerado (sem precisar de MySQL):
unicidade (uid, chave natural), e FKs (orgao/tipo/boletim/ato/destino/texto).
"""
import re
from collections import Counter
from parse_dump import extrair_tabela

OUT = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2"
DAD = OUT + "/v2_dados.sql"
TXT = OUT + "/v2_texto.sql"

def col(tab, idx, arq=DAD):
    return [t[idx] for t in extrair_tabela(arq, tab) if len(t) > idx]

print("parseando tabelas...")
orgao_ids   = set(col("orgao", 0))
orgao_parent= [(t[0], t[4]) for t in extrair_tabela(DAD,"orgao") if len(t)>4]
tipo_ids    = set(col("tipo_ato", 0))
bol_ids     = set(col("boletim", 0))
pes_ids     = set(col("pessoa", 0))
ato = extrair_tabela(DAD, "ato")
ato_ids     = set(t[0] for t in ato)
rel = extrair_tabela(DAD, "relacao")
func= extrair_tabela(DAD, "ato_funcao")
apes= extrair_tabela(DAD, "ato_pessoa")

erros = []
def check(nome, cond, detalhe=""):
    print(f"  [{'OK ' if cond else 'FALHA'}] {nome} {detalhe}")
    if not cond: erros.append(nome)

print(f"\norgao={len(orgao_ids)} tipo={len(tipo_ids)} boletim={len(bol_ids)} pessoa={len(pes_ids)} ato={len(ato_ids)} relacao={len(rel)}")

# 1. unicidade ato id
check("ato.id único", len(ato_ids)==len(ato), f"({len(ato)} linhas)")
# 2. uid único
uids = [t[1] for t in ato]
dup_uid = [u for u,c in Counter(uids).items() if c>1]
check("ato.uid único", len(dup_uid)==0, f"(dups: {len(dup_uid)})")
# 3. chave natural única (boletim2, tipo3, sigla_orig8, numero_norm6, ano7).
# numero_norm é INT no schema -> MySQL compara '001'=='01'=='1'; precisa comparar
# como inteiro aqui também, senão a checagem não reflete a unicidade real do banco.
def as_int(s): return int(s) if s and s != "NULL" else None
nat = [(t[2],t[3],t[8],as_int(t[6]),t[7]) for t in ato]
dup_nat = [k for k,c in Counter(nat).items() if c>1]
check("uq_natural única (numero_norm como INT)", len(dup_nat)==0, f"(dups: {len(dup_nat)})")
# 4. FKs do ato
check("ato.boletim_id ∈ boletim", all(t[2] in bol_ids for t in ato))
check("ato.tipo_id ∈ tipo_ato", all(t[3] in tipo_ids for t in ato))
check("ato.orgao_id ∈ orgao", all(t[4] in orgao_ids for t in ato))
# 5. orgao.parent_id ∈ orgao ou NULL
bad_par = [(i,p) for i,p in orgao_parent if p!="NULL" and p not in orgao_ids]
check("orgao.parent_id ∈ orgao/NULL", len(bad_par)==0, f"(órfãos: {len(bad_par)})")
# 6. relacao FKs
bad_ro = [t for t in rel if t[0] not in ato_ids]
bad_rd = [t for t in rel if len(t)>2 and t[2]!="NULL" and t[2] not in ato_ids]
check("relacao.ato_id ∈ ato", len(bad_ro)==0, f"(órfãos: {len(bad_ro)})")
check("relacao.destino_ato_id ∈ ato/NULL", len(bad_rd)==0, f"(órfãos: {len(bad_rd)})")
# 7. ato_funcao / ato_pessoa FKs
check("ato_funcao.ato_id ∈ ato", all(t[0] in ato_ids for t in func))
check("ato_pessoa.ato_id ∈ ato", all(t[0] in ato_ids for t in apes))
check("ato_pessoa.pessoa_id ∈ pessoa", all(t[1] in pes_ids for t in apes))

# 8. ato_texto (arquivo grande): só o ato_id inicial por linha
print("  validando ato_texto (streaming)...")
txt_ids=set(); n_txt=0
pat = re.compile(r"VALUES \((\d+),")
with open(TXT, encoding="utf-8", errors="replace") as f:
    for l in f:
        m = pat.search(l)
        if m: txt_ids.add(m.group(1)); n_txt+=1
check("ato_texto.ato_id ∈ ato", txt_ids <= ato_ids, f"({n_txt} linhas; órfãos={len(txt_ids-ato_ids)})")
check("ato_texto sem duplicata", len(txt_ids)==n_txt)

print("\n" + ("✓ TUDO ÍNTEGRO — pronto p/ importar" if not erros else f"✗ {len(erros)} FALHAS: {erros}"))
