# -*- coding: utf-8 -*-
"""Compara o acervo LOCAL de boletins com o que a UFF publica, ano a ano.

    python tools/conferir_acervo.py --pasta ../dados/boletins
    python tools/conferir_acervo.py --pasta ../dados/boletins --ano 2024
    python tools/conferir_acervo.py --pasta ../dados/boletins --json buraco.json

POR QUE EXISTE: a etapa 4 do reprocessamento é "baixar o acervo completo", e a
pergunta que ela realmente faz não é "quantos PDFs eu tenho?" — é "quantos
FALTAM, e quais?". Contar arquivo local não responde: 2024 tem 159 PDFs contra
242 de 2023, e só a página do ano na UFF diz se isso é acervo incompleto ou
ano com menos boletins.

NÃO BAIXA NADA. Só lê a página-índice de cada ano e cruza com a pasta. O
download continua sendo do `baixar_boletins.py`, que é quem tem a etiqueta de
robô e a pausa entre requisições.

A leitura dos links reaproveita `baixar_boletins.py` de propósito: se a UFF
mudar a marcação da página, os dois quebram juntos e o conserto é num lugar só
— duas cópias da mesma regex é como se descobre, meses depois, que a medição
mediu outra coisa.
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import baixar_boletins as B   # noqa: E402

ANO_PRIMEIRO = 2001


def nomes_do_ano(ano):
    """Nomes de arquivo que a UFF lista para o ano. Devolve None se a página
    não respondeu — ausência de resposta NÃO é ausência de boletim, e tratar
    as duas como a mesma coisa inventaria um buraco que não existe."""
    url = f"https://boletimdeservico.uff.br/boletins/bs-{ano}/"
    try:
        html = B.baixar_html(url)
    except Exception as e:
        print(f"  {ano}: ERRO ao ler o índice ({e})", flush=True)
        return None
    return [h.split("/")[-1] for h in B.extrair_links(html, url)]


def todos_os_nomes(raiz):
    """Todo nome de PDF presente no acervo, em qualquer subpasta. Memorizado:
    a varredura é a mesma para os 26 anos."""
    if not hasattr(todos_os_nomes, "_cache"):
        todos_os_nomes._cache = {}
    if raiz in todos_os_nomes._cache:
        return todos_os_nomes._cache[raiz]
    nomes = set()
    for pasta, _dirs, arquivos in os.walk(raiz):
        for a in arquivos:
            if a.lower().endswith(".pdf"):
                nomes.add(a)
    todos_os_nomes._cache[raiz] = nomes
    return nomes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pasta", default=os.path.join("..", "dados", "boletins"),
                    help="raiz do acervo, com uma subpasta por ano")
    ap.add_argument("--ano", type=int, default=None, help="confere só um ano")
    ap.add_argument("--ate", type=int, default=None, help="último ano (padrão: o corrente)")
    ap.add_argument("--pausa", type=float, default=2.0)
    ap.add_argument("--json", default=None, help="grava o buraco detalhado neste arquivo")
    args = ap.parse_args()

    ultimo = args.ate or time.gmtime().tm_year
    anos = [args.ano] if args.ano else list(range(ANO_PRIMEIRO, ultimo + 1))

    print(f"Acervo local: {os.path.abspath(args.pasta)}")
    print(f"{'ano':>6} {'UFF':>6} {'local':>6} {'faltam':>7}  situação")
    print("-" * 46)

    buraco, total_uff, total_local, total_falta = {}, 0, 0, 0
    sem_resposta = []
    for i, ano in enumerate(anos):
        publicados = nomes_do_ano(ano)
        if publicados is None:
            sem_resposta.append(ano)
            continue
        destino = os.path.join(args.pasta, str(ano))
        # ⚠️ Procura o arquivo NO ACERVO INTEIRO, não só na pasta do ano. A
        # página de um ano lista boletins do ano ANTERIOR: a de 2011 lista
        # `001-2010.pdf` a `004-2010.pdf`, que moram em `2010/`. Conferir só a
        # pasta do ano acusava 4 faltas que nunca existiram — e "falta" aqui
        # vira pedido de download ao servidor da UFF por arquivo que já temos.
        locais = todos_os_nomes(args.pasta)
        faltando = sorted(n for n in publicados if n not in locais)
        n_uff, n_local = len(publicados), len(set(publicados) & locais)
        total_uff += n_uff
        total_local += n_local
        total_falta += len(faltando)
        if faltando:
            buraco[str(ano)] = faltando
        situacao = "completo" if not faltando else f"faltam {len(faltando)}"
        if not os.path.isdir(destino):
            situacao = "PASTA NAO EXISTE"
        print(f"{ano:>6} {n_uff:>6} {n_local:>6} {len(faltando):>7}  {situacao}", flush=True)
        if i < len(anos) - 1:
            time.sleep(args.pausa)

    print("-" * 46)
    print(f"{'TOTAL':>6} {total_uff:>6} {total_local:>6} {total_falta:>7}")
    if sem_resposta:
        print(f"\nSEM RESPOSTA da UFF: {sem_resposta} — não conte como buraco, "
              f"repita depois.")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(buraco, f, ensure_ascii=False, indent=1)
        print(f"\nBuraco detalhado em {args.json}")
    if total_falta:
        print("\nPara fechar, ano a ano (o baixador pula o que já existe):")
        for ano in sorted(buraco, key=int):
            print(f"  python tools/baixar_boletins.py --ano {ano} "
                  f"--pasta {os.path.join(args.pasta, ano)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
