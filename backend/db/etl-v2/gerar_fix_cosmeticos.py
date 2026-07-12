# -*- coding: utf-8 -*-
"""Gera SQL de correcao p/ producao (fanara87_governanca) dos 2 achados
cosmeticos (12/07): (1) orgao.nome com Title Case quebrado (so 1o char
maiusculo, resto minusculo -- bug no titulo() antigo, ja corrigido no
resolver_orgaos.py p/ futuras rodadas); (2) 5 atos com data_ato='0000-00-00'
(nao e data real, distorcia MIN() no /api/insights).

Fix 1 e REVERSIVEL: o bug antigo so capitalizava a 1a letra, entao
nome.lower() recupera o texto original derivado, e aplicamos o titulo() NOVO
por cima. Roda sobre o snapshot local (out_v2/v2_dados.sql), que reflete o
estado atual de producao (unica mudanca desde a importacao foi o merge
CEP->CEPEx, que so mexeu em orgao_id de atos + removeu a linha 243 -- nao
alterou nenhum outro `nome`).
"""
import re, json
from parse_dump import extrair_tabela

DAD = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2/v2_dados.sql"
OUT = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out_v2/fix_cosmeticos.sql"
BACKBONE = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/repo/backend/db/orgaos_backbone.json"

# siglas do backbone (curadas a mao, ex.: "Centro de Artes da UFF") NUNCA
# passaram pelo titulo() antigo -- reprocessa-las corromperia nomes corretos
# (ex.: "da UFF"->"da Uff", "(Campos..."->"(campos..."). So corrige o que veio
# de DERIVACAO DO TEXTO (siglas fora do backbone).
backbone_siglas = set(json.load(open(BACKBONE, encoding="utf-8"))["orgaos"].keys())
print(f"siglas no backbone (excluidas da correcao): {len(backbone_siglas)}")

CONECTORES_MINUSCULOS = {"de","da","do","das","dos","e","em","no","na","nos","nas",
                          "a","o","as","os","para","com","ao","aos","à","às"}
def cap(w):
    """Capitaliza a 1a LETRA de cada sub-palavra (separada por '-'), preservando
    pontuacao de abertura colada (ex.: '(campos' -> '(Campos')."""
    def cap_sub(p):
        m = re.match(r"^(\W*)(\w)(.*)$", p, re.UNICODE)
        return (m.group(1) + m.group(2).upper() + m.group(3)) if m else p
    return "-".join(cap_sub(p) for p in w.split("-"))

def titulo(s):
    s = re.sub(r"-\s+", "-", s)
    s = re.sub(r"\s+", " ", s).strip(" .,-")
    if not s: return s
    palavras = s.split(" ")
    out = [cap(palavras[0])]
    for p in palavras[1:]:
        out.append(p.lower() if p.lower() in CONECTORES_MINUSCULOS else cap(p))
    return " ".join(out)

def esc(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "''") + "'"

print("carregando orgao...")
orgao = extrair_tabela(DAD, "orgao")   # id, sigla, nome, tipo, parent_id
linhas_nome = []
pulados_backbone = 0
for o in orgao:
    oid, sigla, nome = o[0], o[1], o[2]
    if nome == "NULL" or not nome:
        continue
    if sigla in backbone_siglas:
        pulados_backbone += 1
        continue
    corrigido = titulo(nome.lower())
    if corrigido != nome:
        linhas_nome.append((oid, nome, corrigido))

print(f"orgaos do backbone pulados (ja corretos, curados a mao): {pulados_backbone}")

print(f"nomes a corrigir: {len(linhas_nome)} de {len(orgao)} orgaos")
for oid, antes, depois in linhas_nome[:10]:
    print(f"  id={oid}: {antes!r} -> {depois!r}")

print("\nato: checando data_ato zerada...")
ato = extrair_tabela(DAD, "ato")
zeradas = [t[0] for t in ato if t[9] not in ("NULL",) and t[9].startswith("0000")]
print(f"atos com data_ato zerada: {len(zeradas)} -> ids {zeradas}")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("-- Correcao dos 2 achados cosmeticos (12/07/2026):\n")
    f.write("-- (1) orgao.nome com Title Case quebrado (so a 1a letra maiuscula)\n")
    f.write("-- (2) ato.data_ato = '0000-00-00' (nao e data real; distorcia MIN() no insights)\n\n")
    f.write("START TRANSACTION;\n\n")

    f.write(f"-- Fix 1: {len(linhas_nome)} nomes de orgao re-titlecased\n")
    for oid, antes, depois in linhas_nome:
        f.write(f"UPDATE `orgao` SET `nome` = {esc(depois)} WHERE `id` = {oid};\n")

    f.write(f"\n-- Fix 2: {len(zeradas)} atos com data_ato zerada -> NULL\n")
    f.write("UPDATE `ato` SET `data_ato` = NULL WHERE `data_ato` = '0000-00-00';\n")

    f.write("\nCOMMIT;\n")

print(f"\nSQL gerado: {OUT}")
