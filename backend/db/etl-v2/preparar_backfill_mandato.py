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

    # ---- 1. fatia o portal-data.json em lotes ------------------------------
    # Tamanho do lote = o do feed DIÁRIO (~3,2k atos / 11 MB), que a produção
    # processa todo dia por HTTP sem reclamar. Não há SSH: o importador roda
    # pelo navegador, sujeito a max_execution_time/memory_limit da hospedagem
    # compartilhada. Fatiar por ANO daria lotes de até 8k atos / 29 MB (2,5× o
    # provado) — não vale arriscar meio import estourado.
    LOTE = 3000
    dados = json.load(open(pdata, encoding="utf-8"))
    por_ano = collections.defaultdict(list)
    for a in dados:
        m = re.search(r"/(\d{4})$", a.get("boletimNumero") or "")
        if m:
            por_ano[m.group(1)].append(a)

    # Não misturar anos num lote: se um falhar, o usuário sabe exatamente o que
    # refazer, e pode conferir a aba ano a ano.
    lotes = []
    for ano in sorted(por_ano):
        atos = por_ano[ano]
        partes = (len(atos) + LOTE - 1) // LOTE
        for i in range(partes):
            nome = (f"portal-data-{ano}.json" if partes == 1
                    else f"portal-data-{ano}-{i+1}de{partes}.json")
            lotes.append((nome, atos[i * LOTE:(i + 1) * LOTE]))

    print(f"portal-data.json: {len(dados)} atos -> {len(lotes)} lotes "
          f"(<= {LOTE} atos cada)\n")
    print(f"{'arquivo':34}{'atos':>7}{'MB':>7}")
    total = 0
    for nome, atos in lotes:
        p = os.path.join(saida, nome)
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(atos, fh, ensure_ascii=False)
        mb = os.path.getsize(p) / 1048576
        total += mb
        print(f"{nome:34}{len(atos):7}{mb:7.1f}")
    print(f"{'':34}{sum(len(a) for _, a in lotes):7}{total:7.1f}")

    # lista de URLs prontas p/ colar no navegador (sem SSH, é o caminho)
    p3 = os.path.join(saida, "URLS-IMPORTAR.txt")
    with open(p3, "w", encoding="utf-8") as fh:
        fh.write("# Rodar UMA POR VEZ, na ordem, esperando cada uma terminar.\n"
                 "# Troque SEU_TOKEN pelo import_token de backend/api/config.php.\n"
                 "# Cada uma deve terminar com 'Banco com NNNNN atos'.\n"
                 "# Os arquivos precisam estar em /importar/ no servidor.\n\n")
        for nome, atos in lotes:
            fh.write(f"# {len(atos)} atos\n"
                     f"https://inteligencia.fanara.com.br/importar/importar_v2.php"
                     f"?token=SEU_TOKEN&arquivo={nome}\n")
    print(f"\n  -> {p3}  ({len(lotes)} URLs)")

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
