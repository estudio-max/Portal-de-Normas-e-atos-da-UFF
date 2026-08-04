# -*- coding: utf-8 -*-
"""pacote_delta.py -- monta o pacote de deploy so com o que o servidor NAO tem.

O deploy e upload manual pelo Gerenciador de Arquivos, sem SSH. Subir o `dist/`
inteiro a cada mudanca e lento; subir de menos derruba o portal. Este script
decide pelo unico criterio confiavel: comparar CADA arquivo do `dist/` com o
que o servidor responde.

    python tools/pacote_delta.py [--base https://inteligencia.fanara.com.br]
                                 [--saida ../enviar-hostgator-AAAA-MM-DD]

POR QUE ELE EXISTE
------------------
Em 03/08/2026 montei um pacote "so com o que mudou" olhando o que eu tinha
editado e o que o `index.html` referencia. O portal quebrou em TODAS as abas.

Os paineis sao carregados com `lazy()`, entao cada aba e um chunk proprio com
hash no nome (`ComissoesApi-hT10-kmb.js`). O `index.html` NAO referencia esses
chunks -- eles sao pedidos em runtime, quando o usuario clica na aba. Ficaram os
20 de fora, todos 404.

Pior: eles mudam de nome TODOS JUNTOS quando um modulo compartilhado muda. Eu
tinha editado `dataSource.ts`, que todo painel importa.

Licao: o que entra no pacote nao se deduz do que se editou. Pergunta-se ao
servidor.

O QUE ELE NAO COBRE
-------------------
`.htaccess`: o Apache responde 403 ao proprio arquivo (comportamento correto),
entao a comparacao por HTTP e impossivel. O script avisa e deixa a decisao com
voce -- consulte `git log -- public/.htaccess`.
"""
import argparse, hashlib, io, os, shutil, sys, urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DIST = os.path.join(RAIZ, 'dist')


def remoto(url):
    """(status, md5) do arquivo no servidor. User-Agent de curl porque o
    mod_security da HostGator devolve 406 para user-agent de script."""
    req = urllib.request.Request(url, headers={'User-Agent': 'curl/8.0'})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status, hashlib.md5(r.read()).hexdigest()
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return 0, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='https://inteligencia.fanara.com.br')
    ap.add_argument('--saida', default=None)
    args = ap.parse_args()

    if not os.path.isdir(DIST):
        sys.exit('dist/ não existe — rode `npm run build` antes.')

    saida = args.saida or os.path.join(RAIZ, '..', 'enviar-hostgator-delta')
    saida = os.path.abspath(saida)

    entram, ficam, indecisos = [], [], []
    for base, _dirs, arqs in os.walk(DIST):
        for nome in arqs:
            caminho = os.path.join(base, nome)
            rel = os.path.relpath(caminho, DIST).replace('\\', '/')
            if rel == '.htaccess':
                indecisos.append(rel)
                continue
            local = hashlib.md5(io.open(caminho, 'rb').read()).hexdigest()
            status, md5 = remoto(f'{args.base}/{rel}')
            if status != 200 or md5 != local:
                entram.append((rel, 'ausente' if status != 200 else 'diferente'))
            else:
                ficam.append(rel)

    if os.path.isdir(saida):
        shutil.rmtree(saida)
    for rel, _motivo in entram:
        destino = os.path.join(saida, 'dist', rel.replace('/', os.sep))
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        shutil.copy2(os.path.join(DIST, rel.replace('/', os.sep)), destino)

    print(f'servidor: {args.base}\n')
    print(f'ENTRAM no pacote ({len(entram)}):')
    for rel, motivo in sorted(entram):
        print(f'  {rel:46} {motivo}')
    print(f'\nFICAM DE FORA, idênticos ao servidor ({len(ficam)}):')
    for rel in sorted(ficam):
        print(f'  {rel}')
    if indecisos:
        print('\nDECIDA À MÃO (não dá para comparar por HTTP):')
        for rel in indecisos:
            print(f'  {rel:46} Apache responde 403 ao próprio arquivo — '
                  f'veja `git log -- public/{rel}`')

    print(f'\ngravado em {saida}')
    print('Falta acrescentar: api/index.php (se a API mudou) e o LEIA-ME.')
    if not entram:
        print('\nNADA a subir: o dist/ local é idêntico ao que está no ar.')


if __name__ == '__main__':
    main()
