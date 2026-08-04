# -*- coding: utf-8 -*-
"""medir_obrigacoes.py -- o corpus sustenta um Radar de Obrigacoes?

Medicao feita antes de escrever o detector do modulo 4.1, e que respondeu NAO
para o desenho original. Fica no repo porque a evidencia de um "nao" vale tanto
quanto a de um "sim" -- sem ela, a proxima pessoa reescreve o mesmo regex.

Fonte: tools/portal-data-extrato-reprocessado.json (20.310 atos com `textoBusca`,
o corpo normalizado). Nao e o acervo inteiro (133 mil), mas e a maior amostra
com DISPOSITIVO disponivel fora do banco -- a API expoe ementa, nao corpo.

Uso:  python tools/medir_obrigacoes.py
"""
import io, json, os, re, sys
from collections import Counter, defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
FONTE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     'portal-data-extrato-reprocessado.json')

# ---------------------------------------------------------------------------
# 1. O MODAL. Quantos atos tem "devera"?
# ---------------------------------------------------------------------------
MODAIS = {
    'devera':         r'\bdever[áa]\b',
    'deverao':        r'\bdever[ãa]o\b',
    'podera (recusa)': r'\bpoder[áa]\b',
    'no prazo de':    r'\bno prazo de\b',
    'compete':        r'\bcompete\b',
}

# ---------------------------------------------------------------------------
# 2. O SUJEITO. Quem tem que fazer decide se a obrigacao e institucional.
#    "o candidato devera apresentar documento" e regra de edital para UMA
#    pessoa; "a PROGEPE devera publicar o relatorio" e obrigacao acompanhavel.
# ---------------------------------------------------------------------------
RX_SUJEITO = re.compile(
    r'(?:o|a|os|as)\s+([a-zà-ú]+(?:\s+de\s+[a-zà-ú]+)?)\s+dever[áa][oã]?\b')
PESSOA = {'candidato', 'candidata', 'estudante', 'aluno', 'interessado',
          'servidor', 'discente', 'requerente', 'inscrito', 'proponente',
          'orientador', 'docente', 'professor', 'coordenador', 'chefe',
          'responsavel', 'contratado', 'bolsista', 'monitor', 'autor',
          'pesquisador', 'usuario', 'classificado'}
ORGAO = {'comissao', 'comite', 'coordenacao', 'departamento', 'reitoria',
         'universidade', 'unidade', 'instituto', 'faculdade', 'escola',
         'setor', 'divisao', 'secretaria', 'superintendencia', 'colegiado',
         'conselho', 'banca', 'diretoria', 'nucleo', 'gabinete', 'uff'}

# ---------------------------------------------------------------------------
# 3. OS PADROES INSTITUCIONAIS que o projeto 4.1 lista como escopo inicial.
# ---------------------------------------------------------------------------
PADROES = {
    'periodica': r'\b(anualmente|semestralmente|bienalmente|trimestralmente|'
                 r'a cada \d+ ?\(?[a-zà-ú]*\)? ?(?:anos?|meses))\b',
    'regulamentar depois': r'\b(ser[áa] regulamentad|regulamentad[oa] (?:em|por) ato|'
                           r'ato (?:pr[óo]prio|posterior|espec[íi]fico) (?:regulamentar|dispor))',
    'entrega de plano/relatorio':
        r'\b(?:apresentar|encaminhar|elaborar|publicar|divulgar|submeter)\s+'
        r'(?:o|a|um|uma)?\s*(plano|relat[óo]rio|presta[çc][ãa]o de contas|'
        r'balan[çc]o|resultado|parecer conclusivo)\b',
    'constituir comissao': r'\b(?:dever[áa][oã]?|caber[áa])\s+(?:ser\s+)?'
                           r'(?:constitu[íi]d|design|recompo|institu[íi]d|nomead)',
    'revisao da norma': r'\b(?:ser[áa]|dever[áa])\s+(?:revis[ao]d|reavaliad|atualizad)[oa]\b',
}


def main():
    atos = json.load(io.open(FONTE, encoding='utf-8'))
    n = len(atos)
    print(f'{n} atos com dispositivo\n')

    print('--- 1. O MODAL ---')
    for nome, rx in MODAIS.items():
        c = sum(1 for a in atos if re.search(rx, a.get('textoBusca') or ''))
        print(f'  {nome:18} {c:6}  ({100*c/n:4.1f}%)')

    print('\n--- 2. O SUJEITO do "deverá" ---')
    sujeitos = Counter()
    for a in atos:
        for m in RX_SUJEITO.finditer(a.get('textoBusca') or ''):
            sujeitos[m.group(1).strip()] += 1
    classe = Counter()
    for s, c in sujeitos.most_common(45):
        nucleo = s.split()[0]
        classe['pessoa' if nucleo in PESSOA else
               'ÓRGÃO' if nucleo in ORGAO else 'outro'] += c
    for k, v in classe.most_common():
        print(f'  {k:8} {v:6}')
    print('  (no top 45 de sujeitos; "outro" é quase todo documento ou '
          'procedimento: inscrição, recurso, chapa, matrícula)')

    print('\n--- 3. OS PADRÕES INSTITUCIONAIS ---')
    uniao = set()
    for nome, rx in PADROES.items():
        hits = [a for a in atos if re.search(rx, a.get('textoBusca') or '')]
        uniao.update(a['id'] for a in hits)
        tipos = Counter(a.get('tipoAto', '?') for a in hits)
        top = ', '.join(f'{k}={v}' for k, v in tipos.most_common(3))
        print(f'  {nome:28} {len(hits):5}   {top}')
    print(f'\n  {"UNIÃO (atos distintos)":28} {len(uniao):5}  '
          f'({100*len(uniao)/n:.1f}% do corpus)')

    print("""
--- O QUE ISTO DECIDIU ---

O `deverá` do corpus é, na esmagadora maioria, texto de EDITAL e de REGIMENTO
dirigido a uma pessoa — "o candidato deverá apresentar", "o aluno deverá estar
matriculado". Obrigação de candidato não é obrigação institucional
acompanhável: não tem órgão responsável, não gera evidência posterior de
cumprimento e não interessa a controle.

Os padrões institucionais somam ~1% do corpus, e mesmo esses são, lidos um a
um, majoritariamente procedimento recorrente ("o colegiado se reunirá
anualmente") e não entrega devida. O padrão de entrega é quase todo o ato
SENDO a entrega ("divulgar o resultado do programa de gestão"), não a
obrigação de entregar.

Conclusão: o Radar de Obrigações no desenho do documento 4.1 — varrer o acervo
atrás de cláusulas obrigatórias — produziria um painel de ruído, e ruído
contamina o dossiê (a mesma lição da METODOLOGIA-ODS). O caminho que sobra é
o inverso: procurar obrigações DENTRO das políticas e comissões já catalogadas,
onde o universo é pequeno e o responsável é conhecido.

Para medir esse recorte falta um pré-requisito: a API expõe ementa, não corpo,
e este extrato não cobre os atos do catálogo (0 de 136 casam por uid).
""")


if __name__ == '__main__':
    main()
