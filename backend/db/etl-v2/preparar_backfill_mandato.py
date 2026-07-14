# -*- coding: utf-8 -*-
"""Prepara o backfill de MANDATO na base v2 em produção.

    python preparar_backfill_mandato.py <portal-data.json> <dump_v2.sql> <saida/>

Emite:
  - portal-data-<ano>.json     o histórico fatiado por ano, para o importar_v2
  - fix_boletim_numero_v2.sql  corrige boletim.numero contradito pelo arquivo
  - LEIA-ME.md                 a ordem de execução

Por que fatiar por ano, e não gerar UPDATEs
------------------------------------------
Tentei primeiro casar as linhas de ato_funcao por fora e emitir UPDATEs. Não
dá: o `uid` do v2 é recalculado pela ETL (slug de tipo-sigla-numero-ano) e não
tem relação com o `id` do JSON, e a chave natural real
(boletim_id, tipo_id, sigla_orig, numero_norm, ano) usa a SIGLA CRUA, que o
portal-data.json não carrega (ele traz a normalizada). Reconstruir isso por
fora é frágil e silenciosamente erra.

O importar_v2.php já resolve exatamente esse casamento — é idempotente por
chave natural, é o caminho de produção e roda todo dia. O único motivo de não
se jogar o histórico inteiro nele é memória: ele faz json_decode do arquivo
todo, e o histórico completo tem ~405 MB (contra os ~11 MB do JSON diário do
ano corrente). Fatiado por ano, cada pedaço fica no tamanho que ele já engole
hoje.

Por que o fix de boletim.numero
-------------------------------
O guarda de cobertura do painel de mandatos se calibra pelo MAIOR número de
boletim do ano — a numeração do BS é sequencial, então ela mesma diz quantos
existiram, sem constante mágica. Isso quebra com um número errado: em produção
o '60-26.pdf' está gravado como nº 291, e 2026 marca 20% de cobertura. Como
TODA janela de vigência termina no ano corrente, um 2026 "não confiável"
jogaria TODAS as posições vencidas para "não sei" e o painel nasceria vazio.
bs_numero vem de OCR do cabeçalho e erra; o nome do arquivo é o que a UFF
controla.
"""
import sys, os, re, json, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_dump import extrair_tabela

_N_ARQ = re.compile(r"^(\d{1,3})\s*[-%]")


def numero_do_arquivo(arq):
    """'60-26.pdf' -> 60 ; '132%20-2008.pdf' -> 132. None se não der."""
    m = _N_ARQ.match((arq or "").strip())
    return int(m.group(1)) if m else None


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 1
    pdata, dump, saida = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(saida, exist_ok=True)

    # ---- 1. fatia o portal-data.json por ano do boletim --------------------
    dados = json.load(open(pdata, encoding="utf-8"))
    por_ano = collections.defaultdict(list)
    for a in dados:
        m = re.search(r"/(\d{4})$", a.get("boletimNumero") or "")
        if m:
            por_ano[m.group(1)].append(a)
    print(f"portal-data.json: {len(dados)} atos -> {len(por_ano)} anos")
    print(f"{'ano':6}{'atos':>7}{'MB':>8}")
    total = 0
    for ano in sorted(por_ano):
        p = os.path.join(saida, f"portal-data-{ano}.json")
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(por_ano[ano], fh, ensure_ascii=False)
        mb = os.path.getsize(p) / 1048576
        total += mb
        print(f"{ano:6}{len(por_ano[ano]):7}{mb:8.1f}")
    print(f"{'':6}{sum(len(v) for v in por_ano.values()):7}{total:8.1f}")

    # ---- 2. fix dos números de boletim ------------------------------------
    bol = extrair_tabela(dump, "boletim")   # (id, numero, ano, data_pub, arquivo, ...)
    fixes = []
    for r in bol:
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
    print(f"\nboletim.numero errado: {len(fixes)}")
    for bid, num, real, arq in fixes:
        print(f"   {arq:24} {num} -> {real}")
    print(f"  -> {p2}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
