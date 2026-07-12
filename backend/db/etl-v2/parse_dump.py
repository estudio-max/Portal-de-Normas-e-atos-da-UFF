# -*- coding: utf-8 -*-
"""Stream-parser de INSERTs de um mysqldump. Extrai tuplas de uma tabela alvo
respeitando aspas e escapes. Retorna lista de tuplas (valores Python)."""
import sys, re

def parse_tuples(sql_text):
    """Recebe o corpo de VALUES ('(..),(..);') e devolve lista de listas."""
    out = []
    i, n = 0, len(sql_text)
    while i < n:
        if sql_text[i] != '(':
            i += 1; continue
        # parse uma tupla
        i += 1; campos = []; buf = []; in_str = False; esc = False
        while i < n:
            c = sql_text[i]
            if in_str:
                if esc:
                    buf.append(c); esc = False
                elif c == '\\':
                    esc = True
                elif c == "'":
                    in_str = False
                else:
                    buf.append(c)
            else:
                if c == "'":
                    in_str = True
                elif c == ',':
                    campos.append("".join(buf)); buf = []
                elif c == ')':
                    campos.append("".join(buf)); buf = []
                    i += 1; break
                elif c in ' \t\n\r':
                    pass
                else:
                    buf.append(c)
            i += 1
        # trata NULL / numeros (campos sem aspas viram string crua)
        out.append(campos)
    return out

def extrair_tabela(caminho, tabela):
    """Le o dump e devolve as tuplas da tabela (todas as linhas INSERT)."""
    alvo = f"INSERT INTO `{tabela}`"
    tuplas = []
    capturando = False
    buf = []
    with open(caminho, encoding="utf-8", errors="replace") as f:
        for linha in f:
            if not capturando:
                if linha.startswith(alvo):
                    capturando = True
                    # pega só a parte apos VALUES
                    idx = linha.find("VALUES")
                    buf = [linha[idx+6:]] if idx >= 0 else [linha]
            else:
                buf.append(linha)
                if linha.rstrip().endswith(";"):
                    tuplas += parse_tuples("".join(buf))
                    capturando = False; buf = []
    return tuplas

if __name__ == "__main__":
    DUMP = r"C:/Users/estud/OneDrive/Imagens/RAW/portal-normas-uff/out/fanara87_uffnormas.sql"
    rel = extrair_tabela(DUMP, "ato_relacoes")
    print("total linhas ato_relacoes:", len(rel))
    # colunas: id, ato_id, tipo_relacao, ato_destino_texto, ato_destino_id, externo, detalhes
    from collections import Counter
    tipos = Counter(r[2] for r in rel)
    print("por tipo_relacao:", dict(tipos))
    # duplicatas exatas (ato_id+tipo+destino_texto)
    ch = Counter((r[1], r[2], r[3]) for r in rel)
    dups = {k: v for k, v in ch.items() if v > 1}
    print("grupos duplicados (mesmo ato_id+tipo+destino):", len(dups), "| linhas extras:", sum(v-1 for v in dups.values()))
    # casing: algum UPPERCASE cru?
    up = [r for r in rel if r[2] in ("REVOGA","ALTERA","RETIFICA","CITA","TORNA SEM EFEITO","SUBSTITUI","PRORROGA","ANULA","REPUBLICA")]
    print("linhas com tipo UPPERCASE cru:", len(up))
    # linkados
    link = sum(1 for r in rel if r[4] and r[4] != "NULL")
    print("relacoes com destino LIGADO:", link, "/", len(rel))
    # 3 casos
    for aid in ["59-26-determina-o-de-servi-o-isnf-09-2026","100-23-determina-o-de-servi-o-vmt-eeimvr-12-2023","60-26-determina-o-de-servi-o-ght-7-2026"]:
        rs = [r for r in rel if r[1] == aid]
        print(f"  {aid}: {[(r[2], r[3]) for r in rs]}")
