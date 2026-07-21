# -*- coding: utf-8 -*-
"""Gera os 5 diagramas SVG da documentacao visual do Portal.
Autocontidos: sem fonte externa, sem script, sem imagem embutida."""
import io, os, math

SAIDA = r'C:\Users\estud\OneDrive\Imagens\RAW\portal-normas-uff\repo\docs\figuras'
os.makedirs(SAIDA, exist_ok=True)

AZUL, AMAR, CINZA = '#003366', '#EAB308', '#64748B'
VERDE, VERM, CLARO = '#059669', '#DC2626', '#E2E8F0'
FONTE = "font-family='Segoe UI, Helvetica, Arial, sans-serif'"


def salvar(nome, corpo, w, h, titulo):
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {w} {h}' "
           f"width='100%' role='img' aria-label='{titulo}'>"
           f"<title>{titulo}</title>"
           f"<rect width='{w}' height='{h}' fill='#ffffff'/>"
           f"{corpo}</svg>")
    io.open(os.path.join(SAIDA, nome), 'w', encoding='utf-8').write(svg)
    print(f'  {nome}  ({len(svg)//1024} KB)')


def texto(x, y, s, tam=13, cor='#0f172a', peso='400', anchor='start', extra=''):
    return (f"<text x='{x}' y='{y}' {FONTE} font-size='{tam}' fill='{cor}' "
            f"font-weight='{peso}' text-anchor='{anchor}' {extra}>{s}</text>")


def quebra(x, y, linhas, tam=11, cor=CINZA, dy=14, anchor='middle'):
    return ''.join(texto(x, y + i * dy, l, tam, cor, '400', anchor)
                   for i, l in enumerate(linhas))


# ---------------------------------------------------------------- PECA 2
def peca2():
    W, H = 1000, 420
    p = []
    p.append(texto(40, 42, 'Como um ato do Boletim vira um registro pesquisável',
                   19, AZUL, '700'))
    p.append(texto(40, 66, 'Do PDF publicado pela UFF até a busca no portal', 12.5, CINZA))

    etapas = [
        ('A UFF publica',   ['Boletim de Serviço em PDF,', 'quase todo dia útil']),
        ('Um robô baixa',   ['Todo dia às 19h10,', 'sem ninguém apertar botão']),
        ('O texto é recortado', ['Cada ato vira um registro:', 'tipo, número, órgão, data, ementa']),
        ('Vai para a base', ['133 mil atos,', 'de 2001 a hoje']),
        ('Você pesquisa',   ['Por palavra, número, órgão,', 'ano ou nome de pessoa']),
    ]
    x0, larg, alt, y = 40, 168, 118, 110
    vao = (W - 80 - larg * 5) / 4

    icones = [
        # 1 predio
        "<path d='M-16 12 h32 M-13 12 v-20 h26 v20 M-8 -4 h4 M0 -4 h4 M-8 3 h4 M0 3 h4 "
        "M-13 -8 l13 -9 l13 9' fill='none' stroke='%s' stroke-width='2' "
        "stroke-linecap='round' stroke-linejoin='round'/>",
        # 2 robo
        "<rect x='-13' y='-8' width='26' height='20' rx='4' fill='none' stroke='%s' "
        "stroke-width='2'/><circle cx='-5' cy='0' r='2.4' fill='%s'/>"
        "<circle cx='5' cy='0' r='2.4' fill='%s'/><path d='M-6 7 h12 M0 -8 v-7 "
        "M-18 2 h5 M18 2 h-5' stroke='%s' stroke-width='2' stroke-linecap='round' "
        "fill='none'/><circle cx='0' cy='-16' r='2.5' fill='%s'/>",
        # 3 documento recortado
        "<path d='M-11 -14 h16 l7 7 v21 h-23 z' fill='none' stroke='%s' stroke-width='2' "
        "stroke-linejoin='round'/><path d='M-6 -6 h12 M-6 -1 h12' stroke='%s' "
        "stroke-width='2' stroke-linecap='round'/><path d='M-9 5 h18' stroke='%s' "
        "stroke-width='2' stroke-dasharray='3 3' stroke-linecap='round'/>"
        "<path d='M-6 10 h12' stroke='%s' stroke-width='2' stroke-linecap='round'/>",
        # 4 banco de dados
        "<ellipse cx='0' cy='-10' rx='15' ry='5.5' fill='none' stroke='%s' stroke-width='2'/>"
        "<path d='M-15 -10 v20 a15 5.5 0 0 0 30 0 v-20' fill='none' stroke='%s' "
        "stroke-width='2'/><path d='M-15 0 a15 5.5 0 0 0 30 0' fill='none' stroke='%s' "
        "stroke-width='2'/>",
        # 5 lupa sobre tela
        "<rect x='-16' y='-13' width='32' height='23' rx='3' fill='none' stroke='%s' "
        "stroke-width='2'/><path d='M-6 14 h12' stroke='%s' stroke-width='2' "
        "stroke-linecap='round'/><circle cx='1' cy='-3' r='6' fill='none' stroke='%s' "
        "stroke-width='2'/><path d='M5.5 1.5 l6 6' stroke='%s' stroke-width='2' "
        "stroke-linecap='round'/>",
    ]
    conta_cor = [1, 5, 4, 3, 4]

    for i, (tit, sub) in enumerate(etapas):
        x = x0 + i * (larg + vao)
        cx = x + larg / 2
        p.append(f"<rect x='{x}' y='{y}' width='{larg}' height='{alt}' rx='9' "
                 f"fill='#ffffff' stroke='{AZUL}' stroke-width='1.6'/>")
        p.append(f"<g transform='translate({cx},{y + 34})'>"
                 + (icones[i] % tuple([AZUL] * conta_cor[i])) + "</g>")
        p.append(texto(cx, y + 68, tit, 13.5, AZUL, '700', 'middle'))
        p.append(quebra(cx, y + 87, sub, 10.5, CINZA, 13))
        if i < 4:
            xa = x + larg + 8
            p.append(f"<path d='M{xa} {y + alt/2} h{vao - 16}' stroke='{CINZA}' "
                     f"stroke-width='1.8' marker-end='url(#seta)'/>")

    # caixa de alerta sob a etapa 3
    cx3 = x0 + 2 * (larg + vao) + larg / 2
    ytop = y + alt + 46
    p.append(f"<path d='M{cx3} {y + alt} v{46 - 8}' stroke={chr(39)}{AMAR}{chr(39)} "
             f"stroke-width='1.6' stroke-dasharray='4 4'/>")
    bw, bh = 470, 62
    p.append(f"<rect x='{cx3 - bw/2}' y='{ytop}' width='{bw}' height='{bh}' rx='8' "
             f"fill='#FEFCE8' stroke='{AMAR}' stroke-width='1.6' stroke-dasharray='6 4'/>")
    p.append(texto(cx3, ytop + 25, 'É aqui que mora a dificuldade.', 13, '#854D0E', '700', 'middle'))
    p.append(texto(cx3, ytop + 44, 'O PDF não diz onde um ato termina e o outro começa.',
                   12.5, '#854D0E', '400', 'middle'))

    defs = (f"<defs><marker id='seta' viewBox='0 0 10 10' refX='9' refY='5' "
            f"markerWidth='6' markerHeight='6' orient='auto-start-reverse'>"
            f"<path d='M0 0 L10 5 L0 10 z' fill='{CINZA}'/></marker></defs>")
    salvar('2-jornada-do-ato.svg', defs + ''.join(p), W, H,
           'Fluxo em cinco etapas: a UFF publica o PDF, um robô baixa, o texto é '
           'recortado em atos, os atos vão para a base e o usuário pesquisa.')


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
CONTINENTES = [
    [(-168,65),(-160,71),(-140,70),(-125,70),(-110,68),(-95,70),(-85,70),(-75,68),(-60,58),
     (-55,50),(-65,45),(-70,42),(-75,35),(-81,25),(-90,29),(-97,26),(-105,20),(-115,30),
     (-125,40),(-125,48),(-135,58),(-150,60)],
    [(-92,17),(-84,15),(-78,9),(-77,8),(-83,9),(-88,15)],
    [(-81,-4),(-75,10),(-60,12),(-52,5),(-35,-5),(-38,-13),(-48,-25),(-58,-34),(-62,-40),
     (-65,-45),(-68,-53),(-75,-50),(-73,-40),(-71,-30),(-70,-18),(-77,-12)],
    [(-17,15),(-10,28),(0,35),(10,37),(25,32),(35,31),(43,12),(51,12),(42,-2),(40,-15),
     (35,-25),(25,-34),(18,-34),(12,-18),(9,4),(-8,5)],
    [(-10,36),(-9,44),(-2,49),(2,51),(8,54),(12,55),(18,55),(30,60),(30,70),(20,70),
     (10,63),(5,58),(-5,50),(-10,43)],
    [(30,70),(60,72),(100,77),(140,72),(160,68),(170,60),(145,45),(135,35),(122,30),
     (120,22),(105,10),(95,5),(80,8),(70,20),(60,25),(50,28),(45,40),(40,42),(30,45),(28,55)],
    [(113,-22),(130,-12),(142,-11),(150,-25),(153,-28),(147,-38),(140,-38),(135,-35),
     (125,-33),(115,-34)],
]
GRANDES = [('França',89,2.3,46.6),('Portugal',86,-8.2,39.4),('Espanha',67,-3.7,40.4),
           ('Itália',47,12.5,41.9),('Alemanha',38,10.4,51.2),('Colômbia',37,-74.3,4.6),
           ('Argentina',35,-63.6,-38.4),('Estados Unidos',25,-98.6,39.8)]
MENORES = [(-56,-32),(-70,-16),(-77,-9),(-90,15),(-99,23),(-52,-14),(-8,53),(4,50),
           (7,46),(14,50),(19,52),(23,47),(15,49),(26,58),(24,42),(20,44),(28,-26),
           (32,-1),(37,0),(-1,8),(-6,14),(3,12),(-15,14),(30,31),(35,34),(51,25),
           (55,24),(45,24),(77,21),(80,7),(100,15),(105,20),(114,4),(121,14),(127,37),
           (139,36),(116,40),(103,36),(35,39),(9,34),(10,-2),(29,-13),(47,-19),(24,-30),
           (-58,-16),(-64,-19),(-88,13),(-84,10),(133,-25),(174,-41),(20,-22)]


def peca5():
    W, H = 1000, 520
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

    for poly in CONTINENTES:
        pts = ' '.join(f'{px(a):.1f},{py(b):.1f}' for a, b in poly)
        p.append(f"<polygon points='{pts}' fill='{CLARO}' stroke='#CBD5E1' stroke-width='0.8'/>")

    for lon, lat in MENORES:
        p.append(f"<circle cx='{px(lon):.1f}' cy='{py(lat):.1f}' r='2.6' fill='{AZUL}' "
                 f"opacity='0.4'/>")

    bx, by = px(-47), py(-15)
    for _, _, lon, lat in GRANDES:
        p.append(f"<path d='M{bx:.1f} {by:.1f} Q {(bx+px(lon))/2:.1f} "
                 f"{min(by,py(lat))-46:.1f} {px(lon):.1f} {py(lat):.1f}' fill='none' "
                 f"stroke='{AMAR}' stroke-width='1' opacity='0.65'/>")

    for nome, n, lon, lat in GRANDES:
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
    for i, (v, r) in enumerate([('1.467', 'acordos'), ('59', 'países'),
                                ('2001 a 2026', 'período')]):
        p.append(texto(PX_ + 16, PY_ + 26 + i*22, v, 13.5, AZUL, '700'))
        p.append(texto(PX_ + 16 + (54 if i < 2 else 82), PY_ + 26 + i*22, r, 10.5, CINZA))

    p.append(texto(PX_, PY_ + 116, 'OS OITO MAIORES', 10.5, CINZA, '700'))
    ymax = max(n for _, n, _, _ in GRANDES)
    for i, (nome, n, _, _) in enumerate(GRANDES):
        yy = PY_ + 138 + i * 26
        bw = (n / ymax) * 118
        p.append(f"<rect x='{PX_}' y='{yy - 9}' width='{bw:.1f}' height='13' rx='3' "
                 f"fill='{AZUL}' opacity='0.22'/>")
        p.append(texto(PX_ + 4, yy + 1, nome, 11, '#0f172a'))
        p.append(texto(PX_ + PW, yy + 1, str(n), 11.5, AZUL, '700', 'end'))

    p.append(texto(24, H - 16, 'São acordos aprovados por ato do Boletim, não '
                   'necessariamente parcerias ativas hoje: o Boletim não registra '
                   'o encerramento de um convênio.', 10.5, CINZA))
    salvar('5-mapa-cooperacao.svg', ''.join(p), W, H,
           'Mapa-múndi com círculos proporcionais marcando os países com acordos de '
           'cooperação da UFF, e ao lado o ranking dos oito maiores: França 89, '
           'Portugal 86, Espanha 67, Itália 47, Alemanha 38, Colômbia 37, '
           'Argentina 35 e Estados Unidos 25.')


# ---------------------------------------------------------------- PECA 7
def peca7():
    W, H = 960, 500
    p = []
    p.append(texto(40, 42, 'O que tem em cada aba do portal', 19, AZUL, '700'))
    p.append(texto(40, 66, 'Dez painéis, cada um respondendo uma pergunta diferente', 12.5, CINZA))

    abas = [
        ('Planilha', ['Todos os atos, com filtro por', 'tipo, órgão, ano e palavra']),
        ('Relações', ['Quem revoga ou', 'altera quem']),
        ('Chefias', ['Quem ocupa qual função,', 'e desde quando']),
        ('Meu SIAPE', ['Os atos que citam', 'a sua matrícula']),
        ('Insights', ['Padrões do acervo: aposentadorias,', 'deslocamentos, volume']),
        ('Mandatos', ['Prazos de designação', 'e o que já venceu']),
        ('Prazos', ['O que tem data', 'para acabar']),
        ('Jornada', ['Setores em trabalho flexível', 'ou programa de gestão']),
        ('Cooperação', ['Acordos com instituições, com', 'mapa e filtro por país']),
        ('Analisar Ato', ['Cole o texto de um ato e', 'veja os campos separados']),
    ]
    cw, ch, gx, gy = 282, 92, 14, 14
    x0, y0 = 40, 96
    for i, (nome, desc) in enumerate(abas):
        c, l = i % 3, i // 3
        x, y = x0 + c * (cw + gx), y0 + l * (ch + gy)
        p.append(f"<rect x='{x}' y='{y}' width='{cw}' height='{ch}' rx='9' fill='#F8FAFC' "
                 f"stroke='#CBD5E1' stroke-width='1.2'/>")
        p.append(f"<rect x='{x}' y='{y}' width='4' height='{ch}' rx='2' fill='{AZUL}'/>")
        p.append(texto(x + 20, y + 32, nome, 14, AZUL, '700'))
        for j, d in enumerate(desc):
            p.append(texto(x + 20, y + 54 + j * 15, d, 10.5, CINZA))

    p.append(texto(40, H - 22, 'A aba "Analisar Ato" separa os campos com expressões '
                   'regulares, não com inteligência artificial.', 10.5, CINZA))
    salvar('7-abas-do-portal.svg', ''.join(p), W, H,
           'Grade com os dez painéis do portal e uma linha explicando o que cada um faz.')


print('Gerando SVGs em docs/figuras/')
peca2(); peca3(); peca4(); peca5(); peca7()
