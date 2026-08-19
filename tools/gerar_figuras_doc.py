# -*- coding: utf-8 -*-
"""Gera os diagramas SVG da documentacao visual do Portal (aba Sobre).
Autocontidos: sem fonte externa, sem script, sem imagem embutida.

    python tools/gerar_figuras_doc.py
    python tools/gerar_figuras_doc.py --coop cooperacao.json   # sem rede

⚠️ AS FIGURAS DERIVAM DO APP, NAO DE LISTAS ESCRITAS AQUI.

Em 17/08/2026 o mantenedor abriu a aba Sobre e viu duas coisas erradas: o mapa
era o desenho ESQUEMATICO antigo, que o portal ja tinha trocado por geografia
real, e o quadro "o que tem em cada aba" mostrava doze paineis quando o portal
tem quinze — faltava a Revalidacao, que existe desde 16/08. A legenda dizia
1.467 acordos em 59 paises quando ja eram 1.524 em 63.

Nenhum desses erros da aviso: a figura continua bonita, so passa a mostrar um
portal que nao existe mais. Por isso agora:

  - o contorno dos continentes vem de `src/components/ui/mapaTerras.ts`, o
    MESMO arquivo que o mapa da tela usa;
  - a lista de abas vem de `src/components/help/ajudaConteudo.tsx`, que o
    `test_redesign_integrity.mjs` ja obriga a cobrir TODA aba de `ABAS_VALIDAS`
    — aba nova sem entrada la reprova o CI, e agora tambem aparece aqui;
  - os numeros de cooperacao vem da API, nao da memoria de quem escreveu.

O texto alternativo tambem e montado a partir dos dados. Alt escrito a mao
envelhece igual, e ele e o que o leitor de tela anuncia."""
import argparse, io, json, os, math, re, sys, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'public', 'figuras')      # o que a aba Sobre serve
SAIDA_DOCS = os.path.join(RAIZ, 'docs', 'figuras')   # copia para a documentacao
os.makedirs(SAIDA, exist_ok=True)
os.makedirs(SAIDA_DOCS, exist_ok=True)


def carrega_terras():
    """Contorno das massas de terra, do mesmo modulo que o app usa."""
    caminho = os.path.join(RAIZ, 'src', 'components', 'ui', 'mapaTerras.ts')
    with io.open(caminho, encoding='utf-8') as f:
        txt = f.read()
    corpo = txt[txt.index('= ['):]
    return [[(float(a), float(b)) for a, b in re.findall(r'\[(-?[\d.]+),(-?[\d.]+)\]', poly)]
            for poly in re.findall(r'\[(\[[^\]]*\](?:,\[[^\]]*\])*)\]', corpo)]


def carrega_cooperacao(arquivo=None):
    """Numeros da aba Cooperação: da API, ou de um arquivo salvo."""
    if arquivo:
        return json.load(io.open(arquivo, encoding='utf-8'))
    req = urllib.request.Request(
        'https://inteligencia.fanara.com.br/api/cooperacao',
        headers={'User-Agent': 'UFF-Indexador/1.0 (figuras da doc; '
                               'contato estudio@fanara.com.br)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

AZUL, AMAR, CINZA = '#003366', '#EAB308', '#64748B'
VERDE, VERM, CLARO = '#059669', '#DC2626', '#E2E8F0'
FONTE = "font-family='Segoe UI, Helvetica, Arial, sans-serif'"


def salvar(nome, corpo, w, h, titulo):
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {w} {h}' "
           f"width='100%' role='img' aria-label='{titulo}'>"
           f"<title>{titulo}</title>"
           f"<rect width='{w}' height='{h}' fill='#ffffff'/>"
           f"{corpo}</svg>")
    for destino in (SAIDA, SAIDA_DOCS):
        io.open(os.path.join(destino, nome), 'w', encoding='utf-8').write(svg)
    print(f'  {nome}  ({len(svg)//1024} KB)')


def texto(x, y, s, tam=13, cor='#0f172a', peso='400', anchor='start', extra=''):
    return (f"<text x='{x}' y='{y}' {FONTE} font-size='{tam}' fill='{cor}' "
            f"font-weight='{peso}' text-anchor='{anchor}' {extra}>{s}</text>")



# ---------------------------------------------------------------- PECA 3
def peca3():
    W, H = 940, 520
    p = []
    p.append(texto(40, 42, 'O que tem dentro de um ato', 19, AZUL, '700'))
    p.append(texto(40, 66, 'Os campos que o portal separa de cada documento', 12.5, CINZA))

    fx, fy, fw, fh = 355, 96, 230, 372
    p.append(f"<rect x='{fx+3}' y='{fy+3}' width='{fw}' height='{fh}' rx='3' fill='#00000010'/>")
    p.append(f"<rect x='{fx}' y='{fy}' width='{fw}' height='{fh}' rx='3' fill='#ffffff' "
             f"stroke='#CBD5E1' stroke-width='1.4'/>")

    # blocos de "texto" na folha + rotulos alternados
    campos = [
        (128, 'TIPO', 'Portaria, Resolução,<TSPAN>Determinação de Serviço…', 'dir'),
        (186, 'NÚMERO E ANO', 'A identidade do ato dentro<TSPAN>do órgão que o assinou', 'esq'),
        (244, 'ÓRGÃO', 'Quem assinou: Reitoria, CEPEx,<TSPAN>uma pró-reitoria, uma faculdade', 'dir'),
        (312, 'EMENTA', 'A frase que resume o que o ato faz.<TSPAN>É por ela que se pesquisa.', 'esq'),
        (392, 'PROCESSO SEI', 'O número do processo administrativo<TSPAN>que originou o ato', 'dir'),
    ]
    larguras = [[110], [70, 46], [126], [186, 170, 96], [140]]

    for i, (yy, rot, desc, lado) in enumerate(campos):
        for j, lw in enumerate(larguras[i]):
            p.append(f"<rect x='{fx+22}' y='{yy - 8 + j*13}' width='{lw}' height='7' rx='3.5' "
                     f"fill='#CBD5E1'/>")
        if lado == 'dir':
            x1, x2, tx, anc = fx + fw, fx + fw + 46, fx + fw + 54, 'start'
        else:
            x1, x2, tx, anc = fx, fx - 46, fx - 54, 'end'
        p.append(f"<path d='M{x1} {yy - 4} H{x2}' stroke='{AMAR}' stroke-width='1.6'/>")
        p.append(f"<circle cx='{x1}' cy='{yy - 4}' r='3.2' fill='{AMAR}'/>")
        p.append(texto(tx, yy - 6, rot, 12.5, AZUL, '700', anc))
        l1, l2 = desc.split('<TSPAN>')
        p.append(texto(tx, yy + 9, l1, 10.5, CINZA, '400', anc))
        p.append(texto(tx, yy + 22, l2, 10.5, CINZA, '400', anc))

    p.append(f"<path d='M{fx+16} {fy+fh-46} H{fx+fw-16}' stroke='#E2E8F0' stroke-width='1'/>")
    p.append(texto(fx + fw/2, fy + fh - 28, 'Nem todo ato tem todos os campos.',
                   10, CINZA, '400', 'middle'))
    p.append(texto(fx + fw/2, fy + fh - 15, 'Boletim antigo, digitalizado, tem menos.',
                   10, CINZA, '400', 'middle'))
    salvar('3-anatomia-do-ato.svg', ''.join(p), W, H,
           'Uma folha de documento com cinco chamadas indicando os campos: tipo, '
           'número e ano, órgão, ementa e processo SEI.')


# ---------------------------------------------------------------- PECA 4
def peca4():
    W, H = 960, 510
    p = []
    p.append(texto(40, 42, 'Esta norma ainda vale?', 19, AZUL, '700'))
    p.append(texto(40, 66, 'Um ato não anuncia a própria revogação. Ela mora no ato posterior.',
                   12.5, CINZA))

    ylin = 290
    p.append(f"<path d='M70 {ylin} H700' stroke='#E2E8F0' stroke-width='2'/>")
    nos = [
        ('A', 2015, 110, VERM,  'alvo'),
        ('B', 2018, 250, AMAR,  'ok'),
        ('C', 2019, 390, VERDE, 'ok'),
        ('D', 2021, 530, AMAR,  'ok'),
        ('E', 2024, 670, VERM,  'ok'),
    ]
    pos = {n[0]: (n[2], ylin) for n in nos}

    # ligacoes primeiro (ficam atras dos nos)
    for orig, rot, grosso, cor in [('B', 'ALTERA', 1.8, CINZA), ('D', 'ALTERA', 1.8, CINZA),
                                   ('E', 'REVOGA', 3.2, VERM)]:
        x1, _ = pos[orig]
        x2, _ = pos['A']
        alt = 66 if orig != 'D' else 100
        if orig == 'E':
            alt = 134
        p.append(f"<path d='M{x1} {ylin-26} C {x1} {ylin-26-alt}, {x2} {ylin-26-alt}, "
                 f"{x2} {ylin-26}' fill='none' stroke='{cor}' stroke-width='{grosso}' "
                 f"marker-end='url(#pta{orig})'/>")
        # halo branco atras do rotulo: o arco passa por baixo dele e sem isto
        # a linha corta a palavra. paint-order faz o traco vir antes do fill.
        p.append(texto((x1+x2)/2, ylin - 30 - alt, rot, 11, cor, '700', 'middle',
                       extra="stroke='#ffffff' stroke-width='4' paint-order='stroke'"))

    for letra, ano, x, cor, papel in nos:
        p.append(f"<circle cx='{x}' cy='{ylin}' r='26' fill='{cor}' opacity='0.14'/>")
        p.append(f"<circle cx='{x}' cy='{ylin}' r='19' fill='{cor}'/>")
        p.append(texto(x, ylin + 5, letra, 15, '#ffffff', '700', 'middle'))
        p.append(texto(x, ylin + 48, str(ano), 12.5, AZUL, '700', 'middle'))
        if papel == 'alvo':
            p.append(f"<path d='M{x-30} {ylin+22} L{x+30} {ylin-22}' stroke='{VERM}' "
                     f"stroke-width='3' stroke-linecap='round'/>")
            p.append(texto(x, ylin + 66, 'REVOGADO', 10.5, VERM, '700', 'middle'))

    # legenda
    lx, ly = 96, 402
    for i, (cor, rot) in enumerate([
            (VERDE, 'Vigente. Nenhum ato posterior o atingiu'),
            (AMAR,  'Alterado. Continua valendo, mas mudou'),
            (VERM,  'Revogado. Não vale mais')]):
        p.append(f"<circle cx='{lx}' cy='{ly + i*26 - 4}' r='7' fill='{cor}'/>")
        p.append(texto(lx + 18, ly + i*26, rot, 12, '#0f172a'))

    bx, bw2 = 610, 300
    p.append(f"<rect x='{bx}' y='378' width='{bw2}' height='96' rx='9' fill='#FEFCE8' "
             f"stroke='{AMAR}' stroke-width='1.6'/>")
    p.append(texto(bx + bw2/2, 410, 'O ato de 2015 não sabe', 13.5, '#854D0E', '700', 'middle'))
    p.append(texto(bx + bw2/2, 430, 'que foi revogado em 2024.', 13.5, '#854D0E', '700', 'middle'))
    p.append(texto(bx + bw2/2, 454, 'Quem sabe é o portal.', 13.5, '#854D0E', '400', 'middle'))

    defs = '<defs>' + ''.join(
        f"<marker id='pta{n}' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='5.5' "
        f"markerHeight='5.5' orient='auto-start-reverse'><path d='M0 0 L10 5 L0 10 z' "
        f"fill='{c}'/></marker>" for n, c in [('B', CINZA), ('D', CINZA), ('E', VERM)]) + '</defs>'
    salvar('4-teia-de-relacoes.svg', defs + ''.join(p), W, H,
           'Cinco atos numa linha do tempo. Dois alteram o ato de 2015 e um o revoga '
           'em 2024, deixando-o marcado como revogado.')


# ---------------------------------------------------------------- PECA 5
TERRAS = carrega_terras()

def peca5(coop):
    W, H = 1000, 520
    paises = sorted(coop.get('paises') or [], key=lambda x: -x['n'])
    grandes = [(x['pais'], x['n'], x['lon'], x['lat']) for x in paises[:8]]
    menores = [(x['lon'], x['lat']) for x in paises[8:]]
    # DOIS numeros, e a diferenca entre eles importa: `acordos` e tudo que a
    # aba reconhece; `plotados` e o que tem pais identificado e portanto cabe no
    # mapa. Mostrar so o primeiro faria o leitor contar circulos e nao fechar a
    # conta; mostrar so o segundo esconderia um terco do acervo.
    acordos = len(coop.get('acordos') or [])
    plotados = sum(x['n'] for x in paises)
    # Mapa a esquerda, ranking a direita. Os rotulos NAO vao sobre o mapa: os
    # cinco maiores sao europeus e os circulos se sobrepoem -- numero em cima
    # de numero vira borrao ilegivel justamente na regiao mais importante.
    MW, MH, MX, MY = 690, 330, 24, 104
    px = lambda lon: MX + ((lon + 180) / 360) * MW
    py = lambda lat: MY + ((90 - lat) / 180) * MH
    p = []
    p.append(texto(40, 42, 'Onde a UFF tem acordos de cooperação', 19, AZUL, '700'))
    p.append(texto(40, 66, 'Acordos aprovados entre 2001 e 2026. O tamanho do círculo '
                           'é a quantidade.', 12.5, CINZA))

    for poly in TERRAS:
        pts = ' '.join(f'{px(a):.1f},{py(b):.1f}' for a, b in poly)
        p.append(f"<polygon points='{pts}' fill='{CLARO}' stroke='#CBD5E1' stroke-width='0.8'/>")

    for lon, lat in menores:
        p.append(f"<circle cx='{px(lon):.1f}' cy='{py(lat):.1f}' r='2.6' fill='{AZUL}' "
                 f"opacity='0.4'/>")

    bx, by = px(-47), py(-15)
    for _, _, lon, lat in grandes:
        p.append(f"<path d='M{bx:.1f} {by:.1f} Q {(bx+px(lon))/2:.1f} "
                 f"{min(by,py(lat))-46:.1f} {px(lon):.1f} {py(lat):.1f}' fill='none' "
                 f"stroke='{AMAR}' stroke-width='1' opacity='0.65'/>")

    for nome, n, lon, lat in grandes:
        r = 4 + math.sqrt(n) * 1.5
        p.append(f"<circle cx='{px(lon):.1f}' cy='{py(lat):.1f}' r='{r:.1f}' fill='{AZUL}' "
                 f"opacity='0.5' stroke='{AZUL}' stroke-width='1.1'/>")

    p.append(f"<circle cx='{bx:.1f}' cy='{by:.1f}' r='6' fill='{AMAR}' stroke='#ffffff' "
             f"stroke-width='2'/>")
    p.append(texto(bx, by + 21, 'UFF', 11.5, '#854D0E', '700', 'middle'))

    # painel lateral: numeros gerais + ranking
    PX_, PY_, PW = 752, 104, 214
    p.append(f"<rect x='{PX_}' y='{PY_}' width='{PW}' height='84' rx='8' fill='#F8FAFC' "
             f"stroke='#CBD5E1' stroke-width='1.2'/>")
    for i, (v, r) in enumerate([(f'{acordos:,}'.replace(',', '.'), 'acordos'),
                                (str(len(paises)), 'países'),
                                ('2001 a 2026', 'período')]):
        p.append(texto(PX_ + 16, PY_ + 26 + i*22, v, 13.5, AZUL, '700'))
        p.append(texto(PX_ + 16 + (54 if i < 2 else 82), PY_ + 26 + i*22, r, 10.5, CINZA))

    p.append(texto(PX_, PY_ + 116, 'OS OITO MAIORES', 10.5, CINZA, '700'))
    ymax = max(n for _, n, _, _ in grandes)
    for i, (nome, n, _, _) in enumerate(grandes):
        yy = PY_ + 138 + i * 26
        bw = (n / ymax) * 118
        p.append(f"<rect x='{PX_}' y='{yy - 9}' width='{bw:.1f}' height='13' rx='3' "
                 f"fill='{AZUL}' opacity='0.22'/>")
        p.append(texto(PX_ + 4, yy + 1, nome, 11, '#0f172a'))
        p.append(texto(PX_ + PW, yy + 1, str(n), 11.5, AZUL, '700', 'end'))

    p.append(texto(24, H - 30, f'O mapa mostra os {plotados} acordos cujo país foi '
                   f'identificado no ato; nos demais a ementa não nomeia o país.', 10.5, CINZA))
    p.append(texto(24, H - 14, 'São acordos aprovados por ato do Boletim, não '
                   'necessariamente parcerias ativas hoje: o Boletim não registra '
                   'o encerramento de um convênio.', 10.5, CINZA))
    ranking = ', '.join(f'{nome} {n}' for nome, n, _, _ in grandes)
    salvar('5-mapa-cooperacao.svg', ''.join(p), W, H,
           f'Mapa-múndi com círculos proporcionais marcando os {len(paises)} países com '
           f'acordos de cooperação da UFF. São {acordos} acordos no total, dos quais '
           f'{plotados} têm país identificado e aparecem no mapa. Ranking dos oito maiores: '
           f'{ranking}.')


print('Gerando SVGs em public/figuras/ (e copia em docs/figuras/)')
ap = argparse.ArgumentParser()
ap.add_argument('--coop', help='JSON de /api/cooperacao salvo, para rodar sem rede')
args = ap.parse_args()
coop = carrega_cooperacao(args.coop)
# ⚠️ A PEÇA 2 SAIU, e com ela o último uso de `stats`. Ela desenhava o fluxo
# "PDF → robô → recorte → base → busca" COM O TOTAL DE ATOS DENTRO DO DESENHO,
# e esse fluxo virou componente vivo (`CicloDaExtracao.tsx`) em 18/08/2026.
#
# O critério que ficou: figura estática só serve para o que NÃO tem número.
# `3-anatomia-do-ato` e `4-teia-de-relacoes` são desenhos de CONCEITO e seguem
# aqui; a peça 2 e a `5-mapa-cooperacao` carregam dado — e dado desenhado
# envelhece sem avisar, que foi o defeito da grade de abas (doze painéis num
# portal de quinze) e o do próprio mapa (1.467 acordos quando já eram 1.524).
peca3(); peca4(); peca5(coop)
