# -*- coding: utf-8 -*-
"""Gera o backfill de MANDATO para a base v2 em produção, como UPDATEs.

    python gerar_backfill_mandato.py <portal-data.json> <dump_v2.sql> <saida/>

Emite:
  - backfill_mandato_v2.sql    UPDATE de ato_funcao: unidade_chave, prazo_meses,
                               data_inicio, inicio_origem  (~8,4k linhas)
  - fix_boletim_numero_v2.sql  UPDATE de boletim.numero onde o número lido do
                               cabeçalho do PDF contradiz o nome do arquivo

Por que UPDATE, e não reimportar o histórico
--------------------------------------------
O que muda são 4 colunas em ~8,5 mil linhas de ato_funcao. Reimportar os 128 mil
atos inteiros (texto, relações, tags, prazos) para popular isso seria mover
405 MB — e, sem SSH, em requisições web sujeitas a memory_limit/max_execution_time
da hospedagem compartilhada, o que obrigaria a fatiar em ~56 lotes e 56 chamadas
manuais. O UPDATE é um arquivo pequeno que roda de uma vez no phpMyAdmin.

Como as linhas casam (o `uid` NÃO serve)
----------------------------------------
O `uid` v2 é recalculado pela ETL (slug de tipo-sigla-numero-ano) e não tem
relação com o `id` do portal-data.json (slug estilo v1). A chave natural do v2
(boletim_id, tipo_id, sigla_orig, numero_norm, ano) usa a SIGLA CRUA, que o
portal-data.json não carrega (traz a normalizada). Mas os dois lados têm, em
comum, atributos que bastam:

    (boletim.arquivo, ato.numero, ato.ano, funcao.acao, funcao.cargo, funcao.unidade)

`arquivo` é a identidade do boletim (o número IMPRESSO no BS diverge do número
do arquivo — ex.: '57-26.pdf' traz "BS nº 113" — e o ano do boletim ≠ ano do
ato). Casamento medido: 99,4% (8.451/8.500).

Os ~49 sem par são atos que existem na produção e não no reprocesso local
(128.427 × 127.999). Ficam com prazo_meses NULL e caem na regra do cargo na
projeção — não quebram o painel, só não ganham o prazo/início declarado.
"""
import sys, os, re, json, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_dump import extrair_tabela

_N_ARQ = re.compile(r"^(\d{1,3})\s*[-%]")
_SO_DIG = re.compile(r"[^0-9]")


def numero_do_arquivo(arq):
    """'60-26.pdf' -> 60 ; '132%20-2008.pdf' -> 132. None se não der."""
    m = _N_ARQ.match((arq or "").strip())
    return int(m.group(1)) if m else None


def norm_num(n):
    """'68.021' -> '68021' (separador de milhar diverge entre as safras)."""
    return _SO_DIG.sub("", str(n or ""))


def esc(v):
    if v is None or v == "":
        return "NULL"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 1
    pdata, dump, saida = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(saida, exist_ok=True)

    # --- lado do JSON reprocessado (traz os campos de mandato) --------------
    alvo = {}
    for a in json.load(open(pdata, encoding="utf-8")):
        for f in (a.get("funcoes") or []):
            k = ((a.get("arquivo") or "").strip(), norm_num(a.get("numero")),
                 str(a.get("ano") or "").strip(), f.get("acao"),
                 (f.get("cargo") or "")[:60], (f.get("unidade") or "")[:180])
            alvo[k] = f

    # --- lado da produção ---------------------------------------------------
    bol = {r[0]: r[4] for r in extrair_tabela(dump, "boletim")}          # id -> arquivo
    ato = {r[0]: (bol.get(r[2]), norm_num(r[5]), str(r[7]).strip())
           for r in extrair_tabela(dump, "ato")}                         # id -> (arquivo,num,ano)
    func = extrair_tabela(dump, "ato_funcao")                            # id,ato_id,acao,cargo,unidade,...

    ups, casou, faltou = [], 0, collections.Counter()
    for r in func:
        fid, ato_id, acao, cargo, unidade = r[0], r[1], r[2], r[3], r[4]
        ak = ato.get(ato_id)
        f = alvo.get((ak[0], ak[1], ak[2], acao, cargo, unidade)) if ak else None
        if not f:
            faltou[ak[2] if ak else "?"] += 1
            continue
        casou += 1
        # Mandato só na designação: a dispensa encerra o mandato de OUTRO ato.
        d = acao == "designar"
        pm = f.get("prazo_meses") if d else None
        di = f.get("data_inicio") if d else None
        io = f.get("inicio_origem") if d else None
        ups.append(
            f"UPDATE `ato_funcao` SET "
            f"`unidade_chave`={esc((f.get('unidade_chave') or '')[:180])},"
            f"`prazo_meses`={esc(int(pm) if pm else None)},"
            f"`data_inicio`={esc(di if di and re.match(r'^\d{4}-\d{2}-\d{2}$', di) else None)},"
            f"`inicio_origem`={esc(io if io in ('declarado', 'tampao', 'data_ato') else None)} "
            f"WHERE `id`={fid};")

    p = os.path.join(saida, "backfill_mandato_v2.sql")
    with open(p, "w", encoding="utf-8") as fh:
        fh.write("-- Backfill de mandato em ato_funcao (base v2 fanara87_governanca).\n"
                 "-- Rodar DEPOIS de migracao_mandato_v2.sql, que cria as colunas.\n"
                 "-- Idempotente: sao UPDATEs por id, podem rodar duas vezes.\n"
                 "SET autocommit=0;\nSTART TRANSACTION;\n")
        fh.write("\n".join(ups))
        fh.write("\nCOMMIT;\nSET autocommit=1;\n")

    com_prazo = sum(1 for u in ups if "`prazo_meses`=NULL" not in u)
    mb = os.path.getsize(p) / 1048576
    print(f"ato_funcao na producao : {len(func)}")
    print(f"  casados              : {casou}  ({100*casou/len(func):.1f}%)")
    print(f"  sem par              : {sum(faltou.values())}  -> por ano: {dict(sorted(faltou.items()))}")
    print(f"  UPDATEs gerados      : {len(ups)}  ({com_prazo} com prazo declarado)")
    print(f"  -> {p}  ({mb:.1f} MB)")

    # --- fix dos números de boletim contraditos pelo nome do arquivo -------
    fixes = []
    for r in extrair_tabela(dump, "boletim"):
        bid, num, arq = r[0], int(r[1]), r[4]
        real = numero_do_arquivo(arq)
        if real is not None and real != num:
            fixes.append((bid, num, real, arq))
    p2 = os.path.join(saida, "fix_boletim_numero_v2.sql")
    with open(p2, "w", encoding="utf-8") as fh:
        fh.write("-- boletim.numero contradito pelo nome do arquivo.\n"
                 "-- bs_numero vem de OCR do cabecalho do PDF e erra; o nome do\n"
                 "-- arquivo e o que a UFF controla. Sem isto o guarda de cobertura\n"
                 "-- do painel de mandatos se calibra por um numero inventado\n"
                 "-- (hoje: '60-26.pdf' gravado como no 291 -> 2026 marca 20%).\n")
        for bid, num, real, arq in fixes:
            fh.write(f"UPDATE `boletim` SET `numero`={real} WHERE `id`={bid};"
                     f"  -- {arq}: {num} -> {real}\n")
    print(f"\nboletim.numero errado : {len(fixes)}")
    for bid, num, real, arq in fixes:
        print(f"   {arq:24} {num} -> {real}")
    print(f"  -> {p2}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
