# -*- coding: utf-8 -*-
"""baixar_propostas.py -- puxa da API os atos fundadores de politica.

`/api/ods?n=1..17` e a unica porta publica para a curadoria ODS ja feita. Os
atos com `vinculo='proposta'` sao, por definicao da metodologia, o ato fundador
de politica/programa/plano -- exatamente a semente do catalogo de politicas.

Grava dados/propostas.json (fora do repo) para o analisar_politicas.py ler.

Duas armadilhas ja pagas neste projeto, e as duas mordem aqui:
  - a API devolve 406 para user-agent de script (mod_security da HostGator);
    por isso o header de User-Agent.
  - `curl | python` no Windows le stdin como cp1252 e mastiga todo acento;
    por isso grava em ARQUIVO e le com encoding explicito.

Uso:  python tools/baixar_propostas.py [--base https://outro.host]
"""
import io, json, os, sys, urllib.request
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = 'https://inteligencia.fanara.com.br'
if '--base' in sys.argv:
    BASE = sys.argv[sys.argv.index('--base') + 1]

DESTINO = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       '..', '..', 'dados', 'propostas.json')


def busca(n):
    req = urllib.request.Request(f'{BASE}/api/ods?n={n}',
                                 headers={'User-Agent': 'curl/8.0'})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode('utf-8'))


def main():
    por_uid = {}
    linhas = 0
    for n in range(1, 18):
        d = busca(n)
        if d.get('indisponivel'):
            print(f'ODS {n}: {d.get("motivo")}')
            continue
        for a in d.get('atos', []):
            if a.get('vinculo') != 'proposta':
                continue
            linhas += 1
            u = a['id']
            # Um ato ancora em mais de uma ODS: agrupa por uid e guarda todas.
            if u not in por_uid:
                por_uid[u] = dict(a, ods_list=[])
            por_uid[u]['ods_list'].append(n)
        print(f'ODS {n:2}: {len(d.get("atos", []))} atos, '
              f'{sum(1 for a in d.get("atos", []) if a.get("vinculo") == "proposta")} proposta')

    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    with io.open(DESTINO, 'w', encoding='utf-8') as fh:
        json.dump(list(por_uid.values()), fh, ensure_ascii=False, indent=1)

    print(f'\n{linhas} linhas proposta | {len(por_uid)} atos distintos')
    print('por status:', dict(Counter(a['status'] for a in por_uid.values())))

    # Duplicata por citacao: a pendencia viva do extrator fora do CEPEx
    # 2021-2024. Aqui ela aparece como duas uids para a mesma chave natural.
    c = Counter((a['sigla'], a['numero'], a['ano']) for a in por_uid.values())
    dups = {k: v for k, v in c.items() if v > 1}
    if dups:
        print(f'\n⚠ {len(dups)} chave(s) com mais de um uid — duplicata de acervo:')
        for (sigla, numero, ano), v in sorted(dups.items(), key=lambda x: -x[1]):
            uids = [a['id'] for a in por_uid.values()
                    if (a['sigla'], a['numero'], a['ano']) == (sigla, numero, ano)]
            print(f'   {sigla} {numero}/{ano} ({v}x): {", ".join(uids)}')

    print(f'\ngravado {os.path.normpath(DESTINO)}')


if __name__ == '__main__':
    main()
