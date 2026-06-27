# -*- coding: utf-8 -*-
"""
Gera um dump SQL de carga inicial a partir do app/portal-data.json, para
importar DIRETO no phpMyAdmin (sem precisar do importador PHP).

Uso:
    python backend/db/gerar_sql.py
Saída:
    backend/db/carga_inicial.sql        (texto)
    backend/db/carga_inicial.sql.gz     (comprimido — use este no phpMyAdmin)

Depois, no phpMyAdmin: selecione o banco -> aba "Importar" -> escolha o .sql.gz
-> Executar. (O schema.sql precisa ter sido rodado antes, criando as tabelas.)
"""
import json, os, re, gzip

BASE = os.path.dirname(__file__)
JSON = os.path.join(BASE, "..", "..", "app", "portal-data.json")
OUT = os.path.join(BASE, "carga_inicial.sql")

dados = json.load(open(JSON, encoding="utf-8"))


def esc(v):
    if v is None or v == "":
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("\\", "\\\\").replace("'", "\\'")
    s = s.replace("\n", " ").replace("\r", " ")
    return "'" + s + "'"


def data_iso(s):
    return s if (s and re.match(r"^\d{4}-\d{2}-\d{2}$", s)) else None


# boletins: arquivo -> id sequencial
bol_id = {}
bol_rows = []
for a in dados:
    arq = a.get("arquivo", "")
    if arq and arq not in bol_id:
        bid = len(bol_id) + 1
        bol_id[arq] = bid
        bnum = (re.findall(r"\d+", a.get("boletimNumero", "")) or [None])[0]
        bol_rows.append((bid, arq, bnum, a.get("ano"), a.get("linkBoletim")))

# resolve destino das relações (porId,relacao) -> destId  (via referenciadoPor)
dest = {}
for a in dados:
    for r in a.get("referenciadoPor", []):
        dest.setdefault((r["porId"], r["relacao"]), a["id"])


def insere(f, tabela, colunas, linhas, lote=200):
    if not linhas:
        return
    cols = "(" + ",".join("`%s`" % c for c in colunas) + ")"
    for i in range(0, len(linhas), lote):
        bloco = linhas[i:i + lote]
        vals = ",\n".join("(" + ",".join(bloco_v) + ")" for bloco_v in bloco)
        f.write(f"INSERT INTO `{tabela}` {cols} VALUES\n{vals};\n")


with open(OUT, "w", encoding="utf-8") as f:
    f.write("-- Carga inicial do Portal de Normas e Atos da UFF\n")
    f.write("SET NAMES utf8mb4;\nSET foreign_key_checks=0;\n")
    for t in ["ato_tags", "ato_relacoes", "ato_siapes", "ato_corpo", "atos", "boletins"]:
        f.write(f"DELETE FROM `{t}`;\n")

    insere(f, "boletins", ["id", "arquivo", "numero", "ano", "url_pdf"],
           [[esc(b[0]), esc(b[1]), esc(b[2]), esc(b[3]), esc(b[4])] for b in bol_rows])

    atos_rows, corpo_rows, siape_rows, rel_rows, tag_rows = [], [], [], [], []
    siape_vistos, tag_vistos = set(), set()
    for a in dados:
        aid = a["id"]
        st = a.get("status", "Ativo")
        st = st if st in ("Ativo", "Alterado", "Revogado") else "Ativo"
        atos_rows.append([
            esc(aid), esc(bol_id.get(a.get("arquivo", ""))), esc(a.get("tipoAto", "")),
            esc(a.get("orgaoEmissor", "")), esc(a.get("numero", "")), esc(a.get("ano")),
            esc(data_iso(a.get("dataAssinatura", ""))), esc(a.get("identificador")),
            esc(a.get("tipoAcao")), esc(a.get("ementa", "")), esc(a.get("conteudoResumido", "")),
            esc(a.get("signatario")), esc(st), esc(a.get("processoSei")), esc(a.get("seiDocumento")),
            esc(a.get("linkSeiProcesso")), esc(a.get("linkSeiDocumento")), esc(a.get("linkBoletim")),
            esc(a.get("secao")), esc(a.get("pagina")),
        ])
        if a.get("textoBusca"):
            corpo_rows.append([esc(aid), esc(a["textoBusca"])])
        for s in a.get("siapes", []):
            if (aid, s) not in siape_vistos:
                siape_vistos.add((aid, s)); siape_rows.append([esc(aid), esc(s)])
        for r in a.get("relacoes", []):
            did = dest.get((aid, r.get("tipoRelacao")))
            rel_rows.append([esc(aid), esc(r.get("tipoRelacao", "")),
                             esc(r.get("atoDestino", "")), esc(did), esc(r.get("detalhes"))])
        for tg in a.get("tags", []):
            if (aid, tg) not in tag_vistos:
                tag_vistos.add((aid, tg)); tag_rows.append([esc(aid), esc(tg)])

    insere(f, "atos", ["id", "boletim_id", "tipo", "sigla", "numero", "ano", "data_ato",
                       "identificador", "tipo_acao", "ementa", "conteudo_resumido", "signatario",
                       "status", "processo_sei", "sei_documento", "link_sei_processo",
                       "link_sei_documento", "link_boletim", "secao", "pagina"], atos_rows, 100)
    insere(f, "ato_corpo", ["ato_id", "texto"], corpo_rows, 50)
    insere(f, "ato_siapes", ["ato_id", "siape"], siape_rows)
    insere(f, "ato_relacoes", ["ato_id", "tipo_relacao", "ato_destino_texto",
                               "ato_destino_id", "detalhes"], rel_rows)
    insere(f, "ato_tags", ["ato_id", "tag"], tag_rows)
    f.write("SET foreign_key_checks=1;\n")

with open(OUT, "rb") as fi, gzip.open(OUT + ".gz", "wb") as fo:
    fo.writelines(fi)

print(f"Gerado: {os.path.getsize(OUT)//1024} KB | "
      f"{os.path.getsize(OUT + '.gz')//1024} KB (gz)")
print(f"  boletins={len(bol_rows)} atos={len(atos_rows)} corpo={len(corpo_rows)} "
      f"siapes={len(siape_rows)} relacoes={len(rel_rows)} tags={len(tag_rows)}")
