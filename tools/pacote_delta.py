# -*- coding: utf-8 -*-
"""pacote_delta.py -- monta o pacote de deploy so com o que o servidor NAO tem.

    python tools/pacote_delta.py                                  # modo ssh (padrao)
    python tools/pacote_delta.py --modo http                      # sem SSH, por HTTP
    python tools/pacote_delta.py --saida ../enviar-hostgator-AAAA-MM-DD

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

MODO SSH (padrao desde 18/08/2026, quando o acesso foi liberado)
------------------------------------------------------------------
Um `find | sha256sum` so no servidor, uma unica conexao, contra
`~/<raiz-remota>` -- ve CADA arquivo, inclusive `.htaccess` (a comparacao por
HTTP nao alcancava: o Apache responde 403 ao proprio arquivo, corretamente).
De bonus, ve tambem o que esta no servidor e NAO esta no `dist/` local: e
exatamente a pergunta que, em 17/08/2026, foi respondida a mao (367 assets no
servidor contra 28 no build atual). Aqui vira relatorio, nao ainda automacao —
o script LISTA orfaos, nao apaga: mover para quarentena continua decisao de
quem opera. Ver `CLAUDE.md` § "Acesso SSH ao servidor de producao".

`api/` e `importar/` ficam de fora do escopo de proposito: sao o backend, e
sobem por um caminho proprio (ver a tabela "O que mudou -> o que fazer" da
skill de deploy) -- este script cobre so o que `npm run build` produz.

MODO HTTP (fallback -- sem SSH, ou depois da migracao com outra chave)
------------------------------------------------------------------------
Compara cada arquivo do `dist/` com o que o servidor responde por HTTP. Nao
cobre `.htaccess` pelo motivo acima, e nao ve orfaos (HTTP nao lista
diretorio). Script avisa os dois limites e deixa a decisao com voce.
"""
import argparse, hashlib, io, os, shutil, subprocess, sys, urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
# `sys.exit(str)` escreve em STDERR, não em stdout — sem envolver os dois, as
# mensagens de erro (que têm acento) saíam corrompidas no console do Windows,
# cujo codepage padrão não é UTF-8. Achado testando o caminho de falha do SSH
# de propósito: "código" virava "c�digo". Mesma família da armadilha do
# `curl | python` já documentada no CLAUDE.md.
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DIST = os.path.join(RAIZ, 'dist')


def hashes_locais(algo):
    """{caminho relativo (/-separado): hash} de tudo em dist/."""
    saida = {}
    for base, _dirs, arqs in os.walk(DIST):
        for nome in arqs:
            caminho = os.path.join(base, nome)
            rel = os.path.relpath(caminho, DIST).replace('\\', '/')
            h = hashlib.new(algo)
            with io.open(caminho, 'rb') as f:
                h.update(f.read())
            saida[rel] = h.hexdigest()
    return saida


# --------------------------------------------------------------------- SSH
def hashes_remotos_ssh(host, raiz_remota, timeout=45):
    """{caminho relativo: sha256} de tudo em ~/<raiz_remota> no servidor,
    numa unica conexao. Levanta RuntimeError com a saida de erro em caso de
    falha -- inclusive timeout/host indisponivel, para nao confundir "SSH
    fora do ar" com "nada mudou"."""
    comando = (
        f"cd ~/{raiz_remota} && "
        "find . -type f -not -path './api/*' -not -path './importar/*' "
        "-exec sha256sum {} +"
    )
    r = subprocess.run(['ssh', '-o', 'ConnectTimeout=10', host, comando],
                        capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f'ssh {host} falhou (código {r.returncode}): '
                            f'{r.stderr.strip() or "(sem stderr)"}')
    saida = {}
    for linha in r.stdout.splitlines():
        linha = linha.strip()
        if not linha:
            continue
        h, _, caminho = linha.partition('  ')  # sha256sum: hash, DOIS espaços, caminho
        caminho = caminho.strip()
        # ⚠️ NÃO use .lstrip('./') aqui: lstrip remove QUALQUER combinação dos
        # caracteres dados, não o prefixo literal — './.htaccess'.lstrip('./')
        # devolve 'htaccess', comendo o ponto do nome do arquivo. Achado
        # rodando contra a produção real: '.htaccess' aparecia como órfão
        # (sob o nome errado) E como "ausente" no pacote ao mesmo tempo.
        if caminho.startswith('./'):
            caminho = caminho[2:]
        if h and caminho:
            saida[caminho] = h
    return saida


# --------------------------------------------------------------------- HTTP
def hash_remoto_http(url):
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


def rodar_modo_ssh(args):
    print(f'servidor: ssh {args.host}:~/{args.raiz_remota}  (modo ssh)\n')
    try:
        remotos = hashes_remotos_ssh(args.host, args.raiz_remota)
    except (RuntimeError, subprocess.TimeoutExpired) as e:
        sys.exit(f'SSH falhou: {e}\n'
                 f'Use --modo http se a chave não estiver disponível aqui, '
                 f'ou confira `ssh {args.host}` manualmente antes de repetir '
                 f'-- não presuma "nada mudou" a partir de um erro de conexão.')

    locais = hashes_locais('sha256')

    entram = [(rel, 'ausente' if rel not in remotos else 'diferente')
              for rel in locais if remotos.get(rel) != locais[rel]]
    ficam = [rel for rel in locais if remotos.get(rel) == locais[rel]]
    orfaos = sorted(set(remotos) - set(locais))
    return entram, ficam, [], orfaos


def rodar_modo_http(args):
    print(f'servidor: {args.base}  (modo http -- sem SSH)\n')
    locais = hashes_locais('md5')
    entram, ficam, indecisos = [], [], []
    for rel, local in locais.items():
        if rel == '.htaccess':
            indecisos.append(rel)
            continue
        status, remoto = hash_remoto_http(f'{args.base}/{rel}')
        if status != 200 or remoto != local:
            entram.append((rel, 'ausente' if status != 200 else 'diferente'))
        else:
            ficam.append(rel)
    return entram, ficam, indecisos, []


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--modo', choices=['ssh', 'http'], default='ssh')
    ap.add_argument('--host', default='hostgator-fanara',
                    help='alias do ~/.ssh/config (modo ssh)')
    ap.add_argument('--raiz-remota', default='inteligencia.fanara.com.br',
                    help='pasta do domínio no $HOME do servidor (modo ssh)')
    ap.add_argument('--base', default='https://inteligencia.fanara.com.br',
                    help='URL pública (modo http)')
    ap.add_argument('--saida', default=None)
    args = ap.parse_args()

    if not os.path.isdir(DIST):
        sys.exit('dist/ não existe — rode `npm run build` antes.')

    saida = args.saida or os.path.join(RAIZ, '..', 'enviar-hostgator-delta')
    saida = os.path.abspath(saida)

    if args.modo == 'ssh':
        entram, ficam, indecisos, orfaos = rodar_modo_ssh(args)
    else:
        entram, ficam, indecisos, orfaos = rodar_modo_http(args)

    if os.path.isdir(saida):
        shutil.rmtree(saida)
    for rel, _motivo in entram:
        destino = os.path.join(saida, 'dist', rel.replace('/', os.sep))
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        shutil.copy2(os.path.join(DIST, rel.replace('/', os.sep)), destino)

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
    if orfaos:
        print(f'\nÓRFÃOS NO SERVIDOR — não estão no dist/ local ({len(orfaos)}):')
        for rel in orfaos:
            print(f'  {rel}')
        print('  Não apagados automaticamente. Confira se algo ainda referencia\n'
              '  cada um antes de mover para quarentena (ver CLAUDE.md § "Acesso SSH").')

    print(f'\ngravado em {saida}')
    print('Falta acrescentar: api/index.php (se a API mudou) e o LEIA-ME.')
    if not entram:
        print('\nNADA a subir: o dist/ local é idêntico ao que está no ar.')


if __name__ == '__main__':
    main()
