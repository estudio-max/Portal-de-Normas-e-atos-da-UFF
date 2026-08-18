# -*- coding: utf-8 -*-
"""Reaplica funções do extrator sobre o `corpo_texto` já extraído.

    python tools/rederivar_campos.py --corpus ../dados/reprocessamento-2026-08-17 \
        --saida ../dados/rederivado-2026-08-17

Existe para não reprocessar 12 GB de PDF quando o que mudou foi um REGEX. O
`corpo_texto` já está no `atos.json`; reaplicar as funções sobre ele leva
minutos em vez de horas.

⚠️ A RE-DERIVAÇÃO NÃO É IDÊNTICA À EXTRAÇÃO ORIGINAL, e isso precisa ser
conferido, não suposto: `corpo_texto` é `limpar(corpo)[:40000]`, enquanto a
extração roda sobre o texto CRU e inteiro. Antes de gerar dado de produção com
isto, rode `--conferir`: ele exige que o resultado seja SUPERCONJUNTO do que já
está salvo. Achar mais é o conserto; achar menos seria regressão silenciosa em
produção, que é o defeito que este trabalho todo veio consertar.

Medido em 17/08/2026 sobre o acervo inteiro: zero perdas, 1.342 atos novos em
revalidação e 318 em aposentadoria.
"""
import argparse
import glob
import io
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extrair_boletim  # noqa: E402

# campo do ato -> função do extrator. `revalidacoes` é lista; `revalidacao`
# permanece como alias do primeiro item, que é o contrato que o importador e o
# `gerar_dados_portal.py` esperam.
CAMPOS = {
    'aposentadoria': extrair_boletim.extrai_aposentadoria,
    'revalidacoes': extrair_boletim.extrai_revalidacoes,
}


def anos_de(corpus):
    for p in sorted(glob.glob(os.path.join(corpus, '[12][0-9][0-9][0-9]'))):
        nome = os.path.basename(p)
        if nome.isdigit() and os.path.exists(os.path.join(p, 'atos.json')):
            yield int(nome), p


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--corpus', required=True, help='pasta com <ano>/atos.json')
    ap.add_argument('--saida', default='', help='pasta de destino (vazio = só confere)')
    ap.add_argument('--conferir', action='store_true',
                    help='exige que o resultado seja superconjunto do salvo')
    ap.add_argument('--anos', default='', help='faixa, ex.: 2010-2022')
    args = ap.parse_args()

    faixa = None
    if args.anos:
        de, _, ate = args.anos.partition('-')
        faixa = (int(de), int(ate or de))

    ganhos = {c: 0 for c in CAMPOS}
    perdas = []
    escritos = 0

    for ano, pasta in anos_de(args.corpus):
        if faixa and not (faixa[0] <= ano <= faixa[1]):
            continue
        origem = os.path.join(pasta, 'atos.json')
        with io.open(origem, encoding='utf-8') as fh:
            doc = json.load(fh)

        for a in doc.get('atos', []):
            txt = a.get('corpo_texto') or ''
            for campo, fn in CAMPOS.items():
                antes = a.get(campo)
                if campo == 'revalidacoes' and not antes:
                    antes = [a['revalidacao']] if a.get('revalidacao') else []
                depois = fn(txt)
                if antes and not depois:
                    perdas.append((ano, campo, a.get('identificador')))
                elif depois and not antes:
                    ganhos[campo] += 1
                a[campo] = depois

            # `revalidacao` é o alias do primeiro item — contrato do importador.
            lista = a.get('revalidacoes') or []
            a['revalidacao'] = lista[0] if lista else None
            if len(lista) < 2:
                a.pop('revalidacoes', None)

        if args.saida:
            destino = os.path.join(args.saida, str(ano))
            os.makedirs(destino, exist_ok=True)
            with io.open(os.path.join(destino, 'atos.json'), 'w',
                         encoding='utf-8', newline='') as fh:
                json.dump(doc, fh, ensure_ascii=False)
            # o gerador procura o manifesto de URLs ao lado do atos.json
            urls = os.path.join(pasta, '_urls.json')
            if os.path.exists(urls):
                shutil.copy2(urls, os.path.join(destino, '_urls.json'))
            escritos += 1
        print(f'  {ano}: {len(doc.get("atos", []))} atos')

    print()
    for campo, n in ganhos.items():
        print(f'ganho em {campo}: {n} ato(s) que a extração anterior não via')
    if perdas:
        print(f'\n⚠ {len(perdas)} PERDA(S) — a re-derivação NÃO é superconjunto:')
        for ano, campo, ident in perdas[:10]:
            print(f'   [{ano}] {campo} {ident}')
        if args.conferir:
            print('\nAbortado. Nao gere dado de producao com perda.')
            return 1
    else:
        print('sem perdas: superconjunto do que ja estava salvo')
    if escritos:
        print(f'\n{escritos} ano(s) escritos em {args.saida}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
