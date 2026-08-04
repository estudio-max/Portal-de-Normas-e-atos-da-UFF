# -*- coding: utf-8 -*-
"""analisar_politicas.py -- mede o catalogo CANDIDATO de politicas.

Le os atos com `ato_ods.vinculo='proposta'` (o ato fundador de politica, na
definicao que a curadoria ODS ja usa) e mede quantos caem em cada politica do
piloto. NAO grava nada: o catalogo de politicas e curado, e este arquivo existe
para que a curadoria comece de um numero, nao de um chute.

Uso:
    python tools/baixar_propostas.py          # puxa /api/ods?n=1..17
    python tools/analisar_politicas.py

Duas guardas e um segundo sinal, todos MEDIDOS contra o acervo -- ver o
cabecalho de cada um. Sem eles a primeira passada casava 65 dos 136 atos e
levava junto quatro falsos positivos do CGIRC.
"""
import io, json, os, re, sys, unicodedata
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
AQUI = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'dados')

def norm(s):
    """Minuscula e sem acento -- o LIKE do utf8mb4_unicode_ci ja faz isso."""
    s = unicodedata.normalize('NFD', (s or '').lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    # O OCR do BS espaca letras ("C o n s t i t u i"): colapsa espaco multiplo.
    return re.sub(r'\s+', ' ', s)

# ---------------------------------------------------------------------------
# GUARDA 1 — a ementa e utilizavel?
#
# Parte do acervo nao tem ementa aproveitavel: boletim sem ementa formal,
# recorte que pegou rodape ("BS - - SECAO II, pags. 121 a 134"), e o OCR que
# espaca letra a letra ("C o n s t i t u i a C o m i s s a o"). Casar frase
# nesses e loteria. Vao para curadoria, nao para o catalogo automatico.
# ---------------------------------------------------------------------------
def ementa_inutilizavel(e):
    t = (e or '').strip()
    if not t or 'sem ementa formal' in t.lower():
        return 'sem ementa'
    if re.match(r'^[a-z\)\]•§]', t):        # fragmento: abre minusculo/orfao
        return 'fragmento'
    if t.lower().startswith('bs -'):
        return 'rodape'
    # OCR espacado: muitos tokens de 1 letra
    toks = t.split()
    if len(toks) >= 12 and sum(1 for x in toks if len(x) == 1) / len(toks) > 0.4:
        return 'ocr espacado'
    return None

# ---------------------------------------------------------------------------
# GUARDA 2 — o termo esta no NOME DO EMISSOR, nao no dispositivo?
#
# A armadilha-mae da metodologia ODS, de novo: o CGIRC assina "O COMITE DE
# GOVERNANCA, INTEGRIDADE, RISCOS E CONTROLES...", e essa clausula de abertura
# entra na ementa capturada. Medido: 'integridade' casava o Plano Socioambiental,
# o Programa Bem Viver e o relatorio do PDI -- tres atos que nao sao de
# integridade, so foram assinados por quem tem a palavra no nome.
# ---------------------------------------------------------------------------
CLAUSULA_EMISSOR = re.compile(
    r'\bo (comite|conselho|colegiado|comissao) d[eoa][^.]{0,120}', re.I)

def sem_clausula_emissor(e):
    return CLAUSULA_EMISSOR.sub(' ', e)

# ---------------------------------------------------------------------------
# SINAL 2 — o ORGAO EMISSOR e a politica.
#
# Mesma licao do `comissoes_do_orgao`: quando a ementa nao nomeia a politica,
# quem a nomeia e quem assina. A PROAES e a Pro-Reitoria de Assuntos
# Estudantis; "Fixa as diretrizes para execucao do Programa X" assinado por ela
# e assistencia estudantil, mesmo sem a frase aparecer.
# ---------------------------------------------------------------------------
EMISSOR_POLITICA = {
    'PROAES': 'assistencia-estudantil',
}

# (slug, nome, termos de FRASE ESTRITA)
PILOTO = [
    ('assistencia-estudantil', 'Assistência estudantil', [
        'assistencia estudantil', 'apoio estudantil', 'auxilio moradia',
        'auxilio alimentacao', 'auxilio acolhimento', 'auxilio creche',
        'bolsa de desenvolvimento academico', 'programa de bolsas',
    ]),
    ('acessibilidade', 'Acessibilidade e inclusão', [
        'acessibilidade', 'uff acessivel', 'pessoa com deficiencia',
        'pessoas com deficiencia',
    ]),
    ('acoes-afirmativas', 'Ações afirmativas, diversidade e equidade', [
        'acoes afirmativas', 'politicas afirmativas', 'heteroidentificacao',
        'indigenas e quilombolas', 'reserva de vagas', 'cotas',
    ]),
    ('assedio', 'Prevenção e enfrentamento ao assédio', [
        'assedio',
    ]),
    # 'integridade' solto foi medido e REPROVADO: casa o nome do CGIRC. Exige
    # o dispositivo -- plano, programa, politica DE integridade.
    ('integridade-riscos', 'Integridade, riscos e controles', [
        'plano de integridade', 'programa de integridade',
        'politica de integridade', 'gestao de riscos', 'gestao de risco',
        'mapa de riscos', 'controles internos',
    ]),
    ('seguranca-informacao', 'Segurança da informação e proteção de dados', [
        'seguranca da informacao', 'protecao de dados', 'lgpd',
        'privacidade', 'governanca digital',
    ]),
    ('sustentabilidade', 'Sustentabilidade', [
        'sustentabilidade', 'sustentavel', 'agenda ambiental', 'a3p',
        'residuos', 'meio ambiente',
    ]),
    ('pgd', 'Programa de Gestão e Desempenho', [
        'programa de gestao e desempenho', 'gestao e desempenho',
        'teletrabalho', 'jornada flexibilizada', 'flexibilizacao da jornada',
    ]),
]

with io.open(os.path.join(AQUI, 'propostas.json'), encoding='utf-8') as fh:
    atos = json.load(fh)

casados = defaultdict(list)
sem_cluster = []
descartados = defaultdict(list)
for a in atos:
    motivo = ementa_inutilizavel(a.get('ementa', ''))
    if motivo:
        descartados[motivo].append(a)
        continue
    alvo = norm(sem_clausula_emissor(a.get('ementa', '')))
    achou = False
    for slug, _nome, termos in PILOTO:
        for t in termos:
            if t in alvo:
                casados[slug].append((a, t))
                achou = True
                break
    pol = EMISSOR_POLITICA.get((a.get('sigla') or '').upper())
    if pol and not any(x['id'] == a['id'] for x, _ in casados[pol]):
        casados[pol].append((a, f"emissor {a['sigla']}"))
        achou = True
    if not achou:
        sem_cluster.append(a)

print(f'{len(atos)} atos com vinculo=proposta\n')
total_casados = len({a['id'] for lst in casados.values() for a, _ in lst})
for slug, nome, _ in PILOTO:
    lst = casados[slug]
    anos = sorted(a['ano'] for a, _ in lst)
    faixa = f'{anos[0]}–{anos[-1]}' if anos else '—'
    por_emissor = sum(1 for _, t in lst if t.startswith('emissor'))
    marca = f' ({por_emissor} por emissor)' if por_emissor else ''
    print(f'  {slug:24} {len(lst):3}  {faixa:11} {nome}{marca}')
print(f'\n  {"casados (distintos)":24} {total_casados:3}')
print(f'  {"sem cluster":24} {len(sem_cluster):3}')
print(f'  {"ementa inutilizavel":24} {sum(len(v) for v in descartados.values()):3}'
      f'  {dict((k, len(v)) for k, v in descartados.items())}')

print('\n--- ATOS SEM CLUSTER (o que o piloto de 8 deixa de fora) ---')
for a in sorted(sem_cluster, key=lambda x: x['ano'], reverse=True):
    print(f"  {a['ano']} {a['sigla']:12} {a['numero']:>10}  {a['ementa'][:88]}")

print('\n--- QUAL TERMO CASOU, POR POLITICA (auditoria de precisao) ---')
for slug, nome, _ in PILOTO:
    if not casados[slug]:
        continue
    print(f'\n### {slug} — {nome}')
    for a, t in sorted(casados[slug], key=lambda x: x[0]['ano'], reverse=True)[:6]:
        print(f"   [{t}] {a['ano']} {a['sigla']} {a['numero']}: {a['ementa'][:78]}")
