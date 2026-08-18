# -*- coding: utf-8 -*-
"""Audita a COBERTURA de um extrator: o que está no texto e ele não vê.

    python tools/auditar_cobertura.py --campo revalidacao --assunto revalida
    python tools/auditar_cobertura.py --campo aposentadoria --assunto aposent

Existe porque a mesma falha aconteceu duas vezes em 17/08/2026, nos dois casos
por falta de UM VERBO no padrão: `Aprovar a revalidação` (511 deferimentos
invisíveis, painel publicando 0% em anos inteiros) e `Aposentar por invalidez`
(`invalidez = 0` em toda a série). Nas duas, a medição que denunciou foi a
mesma — e eu a reescrevi do zero as duas vezes.

O QUE ELE PROCURA, e por que cada coisa:

  1. COBERTURA POR ANO. Atos que falam do assunto contra atos que o extrator
     marcou. Queda brusca num período é troca de redação, não de política.

  2. VERBO ÓRFÃO — o achado que resolve. Verbo que aparece muito no texto e
     NUNCA num ato marcado é candidato a ponto cego. Foi assim que `Aprovar`
     apareceu: 511 ocorrências, zero atos marcados.

  3. ZERO ABSOLUTO. Ano com atos do assunto e nenhum marcado; e categoria que é
     zero em TODOS os anos. Processo humano com centenas de casos não dá zero.

Método completo em docs/VIES-DE-EXTRACAO.md; as redações conhecidas em
docs/EQUIVALENCIAS-DE-TERMOS.md. NÃO substitui ler o texto: ele aponta onde
olhar, quem decide é quem lê o ato.
"""
import argparse
import collections
import glob
import io
import json
import os
import re
import sys

# Verbos decisórios do Boletim. A lista é LARGA de propósito — o objetivo é
# achar o que NÃO se espera, então filtrar pela hipótese destruiria o método.
VERBOS = re.compile(
    r'\b(aprov\w+|defer\w+|indefer\w+|homolog\w+|conced\w+|autoriz\w+|reconhec\w+'
    r'|declar\w+|instaur\w+|constitu\w+|institu\w+|design\w+|nome\w+|exoner\w+'
    r'|dispens\w+|revog\w+|retific\w+|torna\w*|anul\w+|aposentar\w*|revert\w+'
    r'|revers\w+|cancel\w+|suspend\w+|prorrog\w+)\b', re.I)

# ⚠️ SUBSTANTIVO E ADJETIVO QUE O PREFIXO ARRASTA. Sem esta lista o relatório
# apontava "institucional", "constitucional" e "instituto" como verbos órfãos —
# e mandava procurar padrão para palavra que não decide nada. Achado rodando a
# própria ferramenta na aposentadoria, o que é o teste que ela merece.
#
# `aprovação`, `concessão` e `indeferimento` NÃO entram aqui: são substantivo do
# ato, e às vezes é neles que a redação se apoia.
NAO_VERBO = {
    'instituto', 'institutos', 'instituição', 'instituições', 'institucional',
    'institucionais', 'constitucional', 'constitucionais', 'constituição',
    'constituinte', 'nome', 'nomes', 'declaração', 'declarações',
}

# Janela em volta do assunto. Generosa para achar, e por isso mesmo contamina:
# ver a armadilha da proximidade em docs/VIES-DE-EXTRACAO.md.
JANELA = 160


def carrega(corpus, anos):
    for pasta in sorted(glob.glob(os.path.join(corpus, '[12][0-9][0-9][0-9]'))):
        ano = os.path.basename(pasta)
        if not ano.isdigit():
            continue
        ano = int(ano)
        if anos and not (anos[0] <= ano <= anos[1]):
            continue
        caminho = os.path.join(pasta, 'atos.json')
        if not os.path.exists(caminho):
            continue
        with io.open(caminho, encoding='utf-8') as fh:
            yield ano, json.load(fh).get('atos', [])


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--campo', required=True,
                    help='campo que o extrator escreve no ato (revalidacao, aposentadoria…)')
    ap.add_argument('--assunto', required=True,
                    help='regex do assunto no corpo do ato (revalida, aposent…)')
    ap.add_argument('--corpus', default='../dados/reprocessamento-2026-08-17',
                    help='pasta com <ano>/atos.json')
    ap.add_argument('--anos', default='', help='faixa, ex.: 2010-2022')
    # ⚠️ SEM ISTO A MEDIÇÃO É DO JSON, NÃO DO CÓDIGO. O `atos.json` guarda o que
    # a extração de então enxergou; consertar o padrão hoje não muda uma linha
    # dele. Rodar sem `--vivo` depois de um conserto mede o problema antigo e dá
    # a impressão de que o conserto não funcionou.
    ap.add_argument('--vivo', metavar='FUNCAO', default='',
                    help='roda o extrator ATUAL em vez de ler o campo do JSON, '
                         'ex.: --vivo extrai_aposentadoria')
    args = ap.parse_args()

    extrator = None
    if args.vivo:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import extrair_boletim
        extrator = getattr(extrair_boletim, args.vivo, None)
        if not callable(extrator):
            print(f'extrair_boletim nao tem `{args.vivo}`.', file=sys.stderr)
            return 2

    faixa = None
    if args.anos:
        de, _, ate = args.anos.partition('-')
        faixa = (int(de), int(ate or de))
    assunto = re.compile(args.assunto, re.I)

    porAno = []
    verbosTexto = collections.Counter()
    verbosMarcados = collections.Counter()
    vistos = 0

    for ano, atos in carrega(args.corpus, faixa):
        cita = marcados = 0
        for a in atos:
            texto = re.sub(r'\s+', ' ', (a.get('corpo_texto') or ''))
            if not assunto.search(texto):
                continue
            cita += 1
            temCampo = bool(extrator(texto)) if extrator else bool(a.get(args.campo))
            if temCampo:
                marcados += 1
            for m in VERBOS.finditer(texto):
                jan = texto[max(0, m.start() - JANELA):m.start() + JANELA]
                if not assunto.search(jan):
                    continue
                verbo = m.group(0).lower()
                if verbo in NAO_VERBO:
                    continue
                verbosTexto[verbo] += 1
                if temCampo:
                    verbosMarcados[verbo] += 1
        if cita:
            porAno.append((ano, cita, marcados))
            vistos += 1

    if not vistos:
        print(f'Nenhum ato cita /{args.assunto}/ em {args.corpus}.', file=sys.stderr)
        print('Confira o caminho do corpus e o regex do assunto.', file=sys.stderr)
        return 2

    print(f'\nCOBERTURA — campo `{args.campo}`, assunto /{args.assunto}/\n')
    print(f"{'ano':>6} {'citam':>7} {'marcados':>9} {'cobertura':>10}")
    alarmes = []
    for ano, cita, marcados in porAno:
        pct = round(100 * marcados / cita)
        alerta = ''
        if marcados == 0:
            alerta = '  <-- ZERO ABSOLUTO'
            alarmes.append(f'{ano}: {cita} atos citam o assunto e NENHUM foi marcado')
        elif pct < 40:
            alerta = '  <-- cobertura baixa'
        print(f'{ano:>6} {cita:>7} {marcados:>9} {pct:>9}%{alerta}')

    # O achado que resolve: verbo que o texto usa e nenhum ato marcado tem.
    print('\nVERBOS PERTO DO ASSUNTO  (texto / em atos marcados)\n')
    orfaos = []
    for verbo, n in verbosTexto.most_common(18):
        k = verbosMarcados[verbo]
        marca = ''
        if n >= 10 and k == 0:
            marca = '  <-- ORFAO: aparece no texto e em ato marcado NENHUM'
            orfaos.append((verbo, n))
        print(f'  {verbo:<18} {n:>6} {k:>8}{marca}')

    print()
    if orfaos:
        print('SUSPEITAS DE PADRAO FALTANDO:')
        for verbo, n in sorted(orfaos, key=lambda x: -x[1]):
            print(f'  · "{verbo}" — {n} ocorrencias perto do assunto, zero atos marcados')
        print('  Leia alguns desses atos no corpo_texto ANTES de escrever padrao:')
        print('  proximidade contamina, e parte deles vai ser de outro assunto.')
    else:
        print('Nenhum verbo orfao acima do limiar.')

    if alarmes:
        print('\nZERO ABSOLUTO:')
        for a in alarmes:
            print(f'  · {a}')
        print('  Processo humano com centenas de casos nao da zero. Ver')
        print('  docs/VIES-DE-EXTRACAO.md.')

    print('\nDepois de corrigir: acrescente a redacao em')
    print('docs/EQUIVALENCIAS-DE-TERMOS.md E um caso no teste do dominio.')
    return 1 if (orfaos or alarmes) else 0


if __name__ == '__main__':
    sys.exit(main())
