# -*- coding: utf-8 -*-
"""gerar_seed_politicas.py -- emite o catalogo CANDIDATO de politicas.

Gera dois artefatos a partir de dados/propostas.json (ver baixar_propostas.py):

  backend/db/seed_politica.sql   catalogo + aliases + vinculos ato<->politica
  dados/curadoria_politicas.csv  a mesma coisa em planilha, para revisar

O catalogo (nome, descricao, categoria, termos) e CURADORIA e mora neste
arquivo -- fonte unica, como o registro_comissoes.py. O que a maquina faz e
ligar ato a politica e propor o papel; o mantenedor confirma pelo CSV.

Regra herdada da METODOLOGIA-ODS e valida aqui igual: PRECISAO acima de
cobertura. Ato que nao casa NAO recebe rotulo -- vira residuo para curadoria.
Falso-negativo se conserta com um termo novo; falso-positivo estraga o dossie.

Uso:  python tools/gerar_seed_politicas.py
"""
import csv, io, json, os, re, sys, unicodedata
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DADOS = os.path.join(RAIZ, '..', 'dados')


def norm(s):
    s = unicodedata.normalize('NFD', (s or '').lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s)


# ---------------------------------------------------------------------------
# O CATALOGO -- curadoria. (slug, nome, categoria, descricao, termos, emissores)
#
# `termos` casam por FRASE ESTRITA na ementa. `emissores` e o segundo sinal:
# a sigla do orgao que assina. Medido: 24 dos 37 atos de assistencia estudantil
# entram SO pelo emissor -- "Fixa as diretrizes para execucao do Programa
# Auxilio Alimentacao" nao tem frase que identifique a politica.
#
# `assedio` nao veio da camada ODS (tinha 1 ato la). Veio de varredura da
# ementa no acervo inteiro: 16 atos, dos quais 1 central (o Plano do CGIRC,
# 2025) e 10 comissoes LOCAIS de unidade, de 2018 a 2026. As 3 sindicancias
# ficam de fora -- apuram caso concreto, tem efeito individual.
# ---------------------------------------------------------------------------
CATALOGO = [
    ('assistencia-estudantil', 'Assistência estudantil', 'Estudantes',
     'Programas de auxílio, moradia, alimentação e permanência destinados a estudantes da UFF.',
     ['assistencia estudantil', 'apoio estudantil', 'auxilio moradia',
      'auxilio alimentacao', 'auxilio acolhimento', 'auxilio creche',
      'auxilio permanencia', 'permanencia estudantil', 'moradia universitaria'],
     ['PROAES']),
    ('acessibilidade', 'Acessibilidade e inclusão', 'Direitos',
     'Condições de acessibilidade e inclusão para pessoas com deficiência na UFF.',
     ['acessibilidade', 'uff acessivel', 'pessoa com deficiencia',
      'pessoas com deficiencia'],
     []),
    ('acoes-afirmativas', 'Ações afirmativas, diversidade e equidade', 'Direitos',
     'Reserva de vagas, heteroidentificação e políticas para grupos historicamente excluídos.',
     ['acoes afirmativas', 'politicas afirmativas', 'heteroidentificacao',
      'indigenas e quilombolas', 'reserva de vagas', 'equidade de genero',
      'nome social'],
     []),
    ('assedio', 'Prevenção e enfrentamento ao assédio', 'Direitos',
     'Prevenção, enfrentamento e tratamento do assédio moral e sexual no âmbito da UFF.',
     ['assedio'],
     []),
    ('integridade-riscos', 'Integridade, riscos e controles', 'Governança',
     'Programa de integridade, gestão de riscos e controles internos da UFF.',
     ['plano de integridade', 'programa de integridade', 'politica de integridade',
      'gestao de riscos', 'gestao de risco', 'mapa de riscos', 'controles internos'],
     []),
    ('seguranca-informacao', 'Segurança da informação e proteção de dados', 'Governança',
     'Política de segurança da informação, privacidade e proteção de dados pessoais.',
     ['seguranca da informacao', 'protecao de dados', 'lgpd', 'privacidade',
      'governanca digital', 'governanca de dados'],
     []),
    ('sustentabilidade', 'Sustentabilidade', 'Governança',
     'Agenda ambiental, logística sustentável e gestão socioambiental da UFF.',
     ['sustentabilidade', 'sustentavel', 'agenda ambiental', 'a3p',
      'gestao socioambiental', 'logistica sustentavel'],
     []),
]

# ---------------------------------------------------------------------------
# PAPEL -- o que o ato FAZ pela politica. Ordem importa: a primeira que casa
# vence, da acao mais forte para a mais fraca.
#
# "Designa comissao" e GOVERNANCA, nao execucao: montar colegiado nao e
# executar a politica. A regra esta no projeto e o indicador depende dela --
# sem separar, muitas designacoes viram "politica em execucao" sozinhas.
# ---------------------------------------------------------------------------
PAPEL = [
    ('revogacao',      [r'\brevoga']),
    ('alteracao',      [r'\baltera', r'\bmodifica', r'\bretifica']),
    ('governanca',     [r'\bdesigna', r'\bconstitui (a )?comiss', r'\binstitui (a|o) comit',
                        r'\binstitui (a )?comiss', r'\bcria (e designa )?(a )?comiss',
                        r'\bcomissao (interna|local|permanente|temporaria)',
                        r'\bgrupo de trabalho', r'\bcomite local', r'\binclui novo membro']),
    ('execucao',       [r'\bfixa(r)? as diretrizes', r'\bexecucao do programa']),
    ('regulamentacao', [r'\bregulamenta', r'\bregimento interno', r'\bnormatiza',
                        r'\bdispoe sobre (o|a|os|as)']),
    # `relatorio`/`prestacao de contas` sao monitoramento. PLANO nao e: o
    # "Plano de Enfrentamento ao Assedio" aprovado pelo CGIRC em 2025 e o ato
    # que FUNDA aquela politica na UFF, nao o acompanhamento dela. Medido: com
    # `plano de` aqui, a politica de assedio nascia sem ato fundador nenhum.
    ('monitoramento',  [r'\brelatorio', r'\bprestacao de contas', r'\bacompanhamento e avaliacao']),
    ('fundador',       [r'\binstitui', r'\bcria\b', r'\baprova (e institui )?(o|a)',
                        r'\bplano de', r'\bpolitica de', r'\bprograma\b']),
]

# Sindicancia apura caso concreto: efeito estritamente individual, fora do
# catalogo publico por regra de privacidade.
# Casa contra a ementa NORMALIZADA (sem acento) -- `\bsindicanc` nao pega
# "Sindicância" no texto cru, e as tres sindicancias de assedio passavam.
EXCLUI = re.compile(r'\bsindicanc|\bapurar denuncia|\bprocesso administrativo disciplinar')


def papel_do(ementa):
    e = norm(ementa)
    for nome, padroes in PAPEL:
        for p in padroes:
            if re.search(p, e):
                return nome
    return 'referencia'


def esc(s):
    return (s or '').replace("'", "''")


def main():
    with io.open(os.path.join(DADOS, 'propostas.json'), encoding='utf-8') as fh:
        atos = json.load(fh)
    extra = os.path.join(DADOS, 'assedio.json')
    if os.path.exists(extra):
        with io.open(extra, encoding='utf-8') as fh:
            for a in json.load(fh).get('atos', []):
                if not any(x['id'] == a['id'] for x in atos):
                    atos.append(a)

    # Duplicata de acervo: mesma chave natural com dois uid. Nao entra no seed
    # automatico -- duplicaria o ato na linha do tempo, e a curadoria do CEPEx
    # ja provou que a copia verdadeira nem sempre e a primeira.
    chaves = defaultdict(list)
    for a in atos:
        chaves[(a.get('sigla'), a.get('numero'), a.get('ano'))].append(a['id'])
    duplicados = {u for uids in chaves.values() if len(uids) > 1 for u in uids}

    vinculos, residuo = [], []
    for a in atos:
        ementa = a.get('ementa') or ''
        if a['id'] in duplicados:
            residuo.append((a, 'duplicata de acervo'))
            continue
        if EXCLUI.search(norm(ementa)):
            residuo.append((a, 'efeito individual (sindicância)'))
            continue
        alvo = norm(ementa)
        achou = False
        for slug, _n, _c, _d, termos, emissores in CATALOGO:
            sinal = next((t for t in termos if t in alvo), None)
            if sinal:
                vinculos.append((slug, a, papel_do(ementa), 'alta', f'frase: {sinal}'))
                achou = True
            elif (a.get('sigla') or '').upper() in emissores:
                vinculos.append((slug, a, papel_do(ementa), 'media', f"emissor: {a['sigla']}"))
                achou = True
        if not achou:
            residuo.append((a, 'sem cluster'))

    # ---- SQL ----------------------------------------------------------------
    L = []
    L.append('-- ' + '=' * 74)
    L.append('--  seed_politica.sql — GERADO por tools/gerar_seed_politicas.py.')
    L.append('--  Nao edite aqui. Regenerar: python tools/gerar_seed_politicas.py')
    L.append('--')
    L.append(f'--  {len(CATALOGO)} politicas do piloto, {len(vinculos)} vinculos ato<->politica.')
    L.append(f'--  {len(residuo)} atos ficaram de fora e estao em dados/curadoria_politicas.csv.')
    L.append('--')
    L.append('--  Os vinculos entram como `metodo=regra`. A curadoria e soberana: uma')
    L.append("--  repassagem automatica so pode apagar metodo NOT IN ('curadoria',")
    L.append("--  'regra+curadoria','ia+curadoria').")
    L.append('--')
    L.append('--  `status_curadoria` nasce RASCUNHO de proposito: a politica so aparece')
    L.append('--  no portal depois que alguem confirmar o catalogo.')
    L.append('--')
    L.append('--  No phpMyAdmin: aba Importar (e DML, nao tem saida para exibir).')
    L.append('-- ' + '=' * 74)
    L.append('')
    L.append('INSERT INTO `politica` (`slug`, `nome`, `descricao`, `categoria`, `status_curadoria`)')
    L.append('VALUES')
    for slug, nome, cat, desc, _t, _e in CATALOGO:
        L.append(f"  ('{slug}', '{esc(nome)}', '{esc(desc)}', '{esc(cat)}', 'rascunho'),")
    L[-1] = L[-1].rstrip(',')
    L.append('ON DUPLICATE KEY UPDATE')
    L.append('  `nome` = VALUES(`nome`), `descricao` = VALUES(`descricao`),')
    L.append('  `categoria` = VALUES(`categoria`);')
    L.append('')
    L.append('INSERT IGNORE INTO `politica_alias` (`politica_id`, `termo`, `tipo`)')
    L.append('VALUES')
    linhas = []
    for slug, _n, _c, _d, termos, _e in CATALOGO:
        for t in termos:
            linhas.append(f"  ((SELECT id FROM politica WHERE slug='{slug}'), '{esc(t)}', 'frase_estrita'),")
    linhas[-1] = linhas[-1].rstrip(',') + ';'
    L.extend(linhas)
    L.append('')
    L.append('INSERT INTO `ato_politica`')
    L.append('  (`ato_id`, `politica_id`, `papel`, `confianca`, `metodo`, `justificativa`)')
    L.append('VALUES')
    linhas = []
    for slug, a, papel, conf, just in vinculos:
        linhas.append(
            f"  ((SELECT id FROM ato WHERE uid='{esc(a['id'])}'),"
            f" (SELECT id FROM politica WHERE slug='{slug}'),"
            f" '{papel}', '{conf}', 'regra', '{esc(just)}'),")
    linhas[-1] = linhas[-1].rstrip(',')
    L.extend(linhas)
    L.append('ON DUPLICATE KEY UPDATE')
    L.append('  `confianca` = VALUES(`confianca`), `justificativa` = VALUES(`justificativa`);')

    destino = os.path.join(RAIZ, 'backend', 'db', 'seed_politica.sql')
    with io.open(destino, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(L) + '\n')

    # ---- CSV de curadoria ---------------------------------------------------
    csv_path = os.path.join(DADOS, 'curadoria_politicas.csv')
    with io.open(csv_path, 'w', encoding='utf-8-sig', newline='') as fh:
        w = csv.writer(fh, delimiter=';')
        w.writerow(['decisao', 'politica', 'papel', 'confianca', 'sinal',
                    'uid', 'ano', 'orgao', 'numero', 'status', 'ementa'])
        for slug, a, papel, conf, just in sorted(vinculos, key=lambda x: (x[0], -x[1]['ano'])):
            w.writerow(['', slug, papel, conf, just, a['id'], a['ano'],
                        a.get('sigla', ''), a.get('numero', ''), a.get('status', ''),
                        (a.get('ementa') or '')[:300]])
        for a, motivo in sorted(residuo, key=lambda x: -x[0]['ano']):
            w.writerow(['', '(fora)', '', '', motivo, a['id'], a['ano'],
                        a.get('sigla', ''), a.get('numero', ''), a.get('status', ''),
                        (a.get('ementa') or '')[:300]])

    print(f'{len(CATALOGO)} políticas | {len(vinculos)} vínculos | {len(residuo)} fora')
    por_pol = defaultdict(list)
    for slug, a, papel, conf, _j in vinculos:
        por_pol[slug].append((a, papel, conf))
    for slug, nome, *_ in CATALOGO:
        v = por_pol[slug]
        papeis = defaultdict(int)
        for _a, p, _c in v:
            papeis[p] += 1
        anos = sorted(a['ano'] for a, _p, _c in v)
        faixa = f'{anos[0]}–{anos[-1]}' if anos else '—'
        print(f'  {slug:24} {len(v):3}  {faixa:11} {dict(papeis)}')
    print(f'\n  fora: {dict((m, sum(1 for _a, mm in residuo if mm == m)) for _a, m in residuo)}')
    print(f'\ngravado {os.path.normpath(destino)}')
    print(f'gravado {os.path.normpath(csv_path)}')


if __name__ == '__main__':
    main()
