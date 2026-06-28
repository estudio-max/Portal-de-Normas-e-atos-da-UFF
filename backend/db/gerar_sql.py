# -*- coding: utf-8 -*-
"""
Gera um dump SQL a partir de um portal-data.json, para importar no phpMyAdmin.

Dois modos:
  - FULL (padrão): limpa tudo e recarrega. Use na carga inicial (ex.: 2026).
  - APPEND (--append): ACRESCENTA um ano sem apagar os demais. Use no backfill
    do legado (2025, 2024, ...). Idempotente por ano.

Uso:
    python gerar_sql.py                                   # full, app/portal-data.json
    python gerar_sql.py --entrada out/portal-data.json --saida out/carga_2025.sql --append

Saída: o .sql e o .sql.gz (use o .gz no phpMyAdmin: aba Importar).
"""
import json, os, re, gzip, argparse

ap = argparse.ArgumentParser()
ap.add_argument("--entrada", default=os.path.join(os.path.dirname(__file__), "..", "..", "app", "portal-data.json"))
ap.add_argument("--saida", default=os.path.join(os.path.dirname(__file__), "carga_inicial.sql"))
ap.add_argument("--append", action="store_true", help="acrescenta um ano sem apagar os outros (legado)")
args = ap.parse_args()

dados = json.load(open(args.entrada, encoding="utf-8"))
OUT = args.saida


def esc(v):
    if v is None or v == "":
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("\\", "\\\\").replace("'", "\\'")
    return "'" + s.replace("\n", " ").replace("\r", " ") + "'"


def data_iso(s):
    return s if (s and re.match(r"^\d{4}-\d{2}-\d{2}$", s)) else None


# id do boletim: determinístico e global (ano*1000+numero) no modo append;
# sequencial no modo full (compatível com a carga inicial de 2026 já feita).
bol_id, bol_rows = {}, []
for a in dados:
    arq = a.get("arquivo", "")
    if arq and arq not in bol_id:
        # número e ANO vêm do nome do boletim ("NN-YY.pdf"), não do ato
        # (um boletim de 2026 pode conter atos datados de 2025).
        mb = re.match(r"(\d+)-(\d{2})", arq)
        bnum = int(mb.group(1)) if mb else None
        bano = 2000 + int(mb.group(2)) if mb else (a.get("ano") or 0)
        if args.append and bnum is not None:
            bid = bano * 1000 + bnum            # global e estável (ex.: 2025153)
        else:
            bid = len(bol_id) + 1               # sequencial no modo full (2026 inicial)
        bol_id[arq] = bid
        bol_rows.append((bid, arq, bnum, bano, a.get("linkBoletim")))

# resolve destino das relações DENTRO deste lote (cross-ano fica p/ o resolvedor)
dest = {}
for a in dados:
    for r in a.get("referenciadoPor", []):
        dest.setdefault((r["porId"], r["relacao"]), a["id"])

# sufixo de ano dos ids (ex.: "25") para limpeza idempotente no modo append
sufixos = {}
for a in dados:
    m = re.match(r"^\d+-(\d{2})-", a["id"])
    if m:
        sufixos[m.group(1)] = sufixos.get(m.group(1), 0) + 1
suf_ano = max(sufixos, key=sufixos.get) if sufixos else None


def insere(f, tabela, colunas, linhas, lote=200, upsert_em=None):
    if not linhas:
        return
    cols = "(" + ",".join("`%s`" % c for c in colunas) + ")"
    tail = ""
    if upsert_em:
        sets = ",".join(f"`{c}`=VALUES(`{c}`)" for c in colunas if c not in upsert_em)
        tail = " ON DUPLICATE KEY UPDATE " + sets
    for i in range(0, len(linhas), lote):
        vals = ",\n".join("(" + ",".join(r) + ")" for r in linhas[i:i + lote])
        f.write(f"INSERT INTO `{tabela}` {cols} VALUES\n{vals}{tail};\n")


with open(OUT, "w", encoding="utf-8") as f:
    f.write("-- Carga do Portal de Normas e Atos da UFF "
            f"({'APPEND ano ' + str(suf_ano) if args.append else 'FULL'})\n")
    f.write("SET NAMES utf8mb4;\nSET foreign_key_checks=0;\n")

    # Garante ato_siapes.nome (idempotente). O backfill é importado pelo phpMyAdmin,
    # não pelo importar.php, então a coluna precisa ser criada aqui em bases antigas.
    f.write(
        "SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ato_siapes' AND COLUMN_NAME='nome');\n"
        "SET @ddl := IF(@c=0, "
        "'ALTER TABLE `ato_siapes` ADD COLUMN `nome` VARCHAR(120) NULL AFTER `siape`', 'DO 0');\n"
        "PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;\n")

    if args.append and suf_ano:
        # limpa só ESTE ano (idempotente), via padrão do id
        pad = f"'^[0-9]+-{suf_ano}-'"
        for t in ["ato_tags", "ato_relacoes", "ato_siapes", "ato_corpo"]:
            f.write(f"DELETE FROM `{t}` WHERE ato_id REGEXP {pad};\n")
        f.write(f"DELETE FROM `atos` WHERE id REGEXP {pad};\n")
    elif not args.append:
        for t in ["ato_tags", "ato_relacoes", "ato_siapes", "ato_corpo", "atos", "boletins"]:
            f.write(f"DELETE FROM `{t}`;\n")

    insere(f, "boletins", ["id", "arquivo", "numero", "ano", "url_pdf"],
           [[esc(b[0]), esc(b[1]), esc(b[2]), esc(b[3]), esc(b[4])] for b in bol_rows],
           upsert_em=("id",) if args.append else None)

    atos_rows, corpo_rows, siape_rows, rel_rows, tag_rows = [], [], [], [], []
    sv, tv = set(), set()
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
        nome_de = {}
        for pz in a.get("pessoas", []):
            sp = pz.get("siape", "")
            if sp:
                nome_de[sp] = pz.get("nome") or None
        for s in dict.fromkeys(list(a.get("siapes", [])) + list(nome_de.keys())):
            if (aid, s) not in sv:
                sv.add((aid, s)); siape_rows.append([esc(aid), esc(s), esc(nome_de.get(s))])
        for r in a.get("relacoes", []):
            rel_rows.append([esc(aid), esc(r.get("tipoRelacao", "")), esc(r.get("atoDestino", "")),
                             esc(dest.get((aid, r.get("tipoRelacao")))), esc(r.get("detalhes"))])
        for tg in a.get("tags", []):
            if (aid, tg) not in tv:
                tv.add((aid, tg)); tag_rows.append([esc(aid), esc(tg)])

    insere(f, "atos", ["id", "boletim_id", "tipo", "sigla", "numero", "ano", "data_ato",
                       "identificador", "tipo_acao", "ementa", "conteudo_resumido", "signatario",
                       "status", "processo_sei", "sei_documento", "link_sei_processo",
                       "link_sei_documento", "link_boletim", "secao", "pagina"], atos_rows, 100,
           upsert_em=("id",) if args.append else None)
    insere(f, "ato_corpo", ["ato_id", "texto"], corpo_rows, 50,
           upsert_em=("ato_id",) if args.append else None)
    insere(f, "ato_siapes", ["ato_id", "siape", "nome"], siape_rows)
    insere(f, "ato_relacoes", ["ato_id", "tipo_relacao", "ato_destino_texto", "ato_destino_id", "detalhes"], rel_rows)
    insere(f, "ato_tags", ["ato_id", "tag"], tag_rows)
    f.write("SET foreign_key_checks=1;\n")

with open(OUT, "rb") as fi, gzip.open(OUT + ".gz", "wb") as fo:
    fo.writelines(fi)

print(f"Gerado ({'APPEND ' + str(suf_ano) if args.append else 'FULL'}): "
      f"{os.path.getsize(OUT)//1024} KB | {os.path.getsize(OUT + '.gz')//1024} KB (gz)")
print(f"  boletins={len(bol_rows)} atos={len(atos_rows)} corpo={len(corpo_rows)} "
      f"siapes={len(siape_rows)} relacoes={len(rel_rows)} tags={len(tag_rows)}")
