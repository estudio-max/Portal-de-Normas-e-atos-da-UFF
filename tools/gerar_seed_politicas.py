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
# A CATEGORIA SAI DO PDI DA UFF, NAO DE NOS.
#
# Ate 04/08/2026 a categoria era 'Direitos' | 'Governanca' | 'Estudantes' --
# tres rotulos que eu escrevi e que NUNCA tiveram ancora. Pior: nao respondiam
# a mesma pergunta ("Direitos" e a natureza do que se protege, "Estudantes" e o
# destinatario, "Governanca" e a funcao), e "Estudantes" era prateleira de UM
# item, criada porque a assistencia estudantil nao cabia nas outras duas.
#
# O PDI 2023-2027 (aprovado pelo CGIRC em 21/08/2023) declara 5 eixos
# mobilizadores e, dentro deles, SUBTEMAS que nomeiam cinco destas sete
# politicas quase literalmente. E a taxonomia da propria universidade. Mesmo
# principio das ODS (ancoradas em THE/IPEA) e das obrigacoes (na legislacao):
# quando existe classificacao oficial, nao se inventa uma.
#
# `base` diz de ONDE veio o encaixe -- e o que impede a classificacao de
# afirmar mais do que o PDI diz:
#   'nome'      o PDI tem subtema com este nome;
#   'conteudo'  o PDI nao usa a palavra, mas o subtema DESCREVE o tema;
#   'afinidade' atribuicao nossa, o PDI nao cobre.
#
# O caso do ASSEDIO merece registro, porque foi um erro de metodo meu. Procurei
# a palavra "assedio" nas 175 paginas do PDI, achei zero, e conclui que o tema
# nao estava la. Estava: "Equidade, Diversidade e Inclusao" (p.58-59) preve
# "protocolo geral de atendimento e encaminhamento voltado para mulheres em
# situacao de violencia de genero", o mesmo para pessoas LGBTQIAP+, protocolo
# para "denuncias de racismo e discriminacoes", e poe a CPEG (Comissao
# Permanente de Equidade de Genero) e a AFIDE como responsaveis. E o mesmo
# objeto institucional, com outro vocabulario. Buscar o TERMO e concluir
# ausencia do TEMA e a armadilha-mae da METODOLOGIA-ODS.
#
# SEGURANCA DA INFORMACAO e o unico 'afinidade': o CGIRC emite os atos e o tema
# e de risco, mas o subtema "Gestao de Riscos e Integridade" fala de processo
# critico, Plano de Integridade e TCU (area: PROPLAN), e "Governanca Digital"
# fala de digitalizar servico e publicar no gov.br (area: STI). O PDI nao
# escreve "seguranca da informacao", "protecao de dados" nem "LGPD" em pagina
# nenhuma. E o melhor destino disponivel, e continua sendo atribuicao nossa.
#
# A ANCORA E DATADA: PDI_VERSAO viaja junto para o banco.
# ---------------------------------------------------------------------------
PDI_VERSAO = '2023-2027'

# ---------------------------------------------------------------------------
# O CATALOGO -- curadoria.
# (slug, nome, eixo_pdi, subtema_pdi, base, descricao, termos, emissores)
#
# `termos` casam por FRASE ESTRITA na ementa. `emissores` e o segundo sinal:
# a sigla do orgao que assina. Medido no seed de 04/08/2026: 22 dos 38 vinculos
# de assistencia estudantil entram SO pelo emissor -- ementa como "Fixa as
# diretrizes para o Programa de Bolsa de Desenvolvimento Academico" nao tem
# termo nenhum do catalogo; quem identifica a politica e a PROAES.
#
# NAO use "Programa Auxilio Alimentacao" como exemplo do segundo sinal:
# `auxilio alimentacao` esta na lista acima, entao aquela ementa entra por FRASE
# (confianca alta). O exemplo errado virou caso de teste e deixou o CI vermelho
# por 8 commits -- ver teste_politicas_match.php.
#
# `assedio` nao veio da camada ODS (tinha 1 ato la). Veio de varredura da
# ementa no acervo inteiro: 16 atos, dos quais 1 central (o Plano do CGIRC,
# 2025) e 10 comissoes LOCAIS de unidade, de 2018 a 2026. As 3 sindicancias
# ficam de fora -- apuram caso concreto, tem efeito individual.
# ---------------------------------------------------------------------------
CATALOGO = [
    ('assistencia-estudantil', 'Assistência estudantil', 'Responsabilidade Social',
     'Assistência Estudantil', 'nome',
     'Programas de auxílio, moradia, alimentação e permanência destinados a estudantes da UFF.',
     ['assistencia estudantil', 'apoio estudantil', 'auxilio moradia',
      'auxilio alimentacao', 'auxilio acolhimento', 'auxilio creche',
      'auxilio permanencia', 'permanencia estudantil', 'moradia universitaria'],
     ['PROAES']),
    ('acessibilidade', 'Acessibilidade e inclusão', 'Responsabilidade Social',
     'Acessibilidade', 'nome',
     'Condições de acessibilidade e inclusão para pessoas com deficiência na UFF.',
     ['acessibilidade', 'uff acessivel', 'pessoa com deficiencia',
      'pessoas com deficiencia'],
     []),
    ('acoes-afirmativas', 'Ações afirmativas, diversidade e equidade', 'Responsabilidade Social',
     'Equidade, Diversidade e Inclusão', 'nome',
     'Reserva de vagas, heteroidentificação e políticas para grupos historicamente excluídos.',
     ['acoes afirmativas', 'politicas afirmativas', 'heteroidentificacao',
      'indigenas e quilombolas', 'reserva de vagas', 'equidade de genero',
      'nome social'],
     []),
    ('assedio', 'Prevenção e enfrentamento ao assédio', 'Responsabilidade Social',
     'Equidade, Diversidade e Inclusão', 'conteudo',
     'Prevenção, enfrentamento e tratamento do assédio moral e sexual no âmbito da UFF.',
     ['assedio'],
     []),
    ('integridade-riscos', 'Integridade, riscos e controles', 'Governança e Gestão',
     'Gestão de Riscos e Integridade', 'nome',
     'Programa de integridade, gestão de riscos e controles internos da UFF.',
     ['plano de integridade', 'programa de integridade', 'politica de integridade',
      'gestao de riscos', 'gestao de risco', 'mapa de riscos', 'controles internos'],
     []),
    ('seguranca-informacao', 'Segurança da informação e proteção de dados', 'Governança e Gestão',
     'Gestão de Riscos e Integridade', 'afinidade',
     'Política de segurança da informação, privacidade e proteção de dados pessoais.',
     ['seguranca da informacao', 'protecao de dados', 'lgpd', 'privacidade',
      'governanca digital', 'governanca de dados'],
     []),
    ('sustentabilidade', 'Sustentabilidade', 'Responsabilidade Social',
     'Meio Ambiente e Sustentabilidade', 'nome',
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
    # "Institui a Cartilha de acessibilidade atitudinal" casava `\binstitui` e
    # virava ATO FUNDADOR da política de acessibilidade -- foi o que a aba
    # exibiu em produção. Cartilha, manual e guia detalham COMO cumprir; não
    # fundam a política. Vêm antes de `fundador` de propósito: aqui a ordem das
    # regras é a correção.
    ('regulamentacao', [r'\binstitui (?:a |o )?(?:cartilha|manual|guia|caderno)',
                        r'\bregulamenta', r'\bregimento interno', r'\bnormatiza',
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

# ---------------------------------------------------------------------------
# ESPELHOS DAS GUARDAS DO politicas_match.php.
#
# Os dois arquivos classificam os MESMOS atos e nao podem divergir: o que entra
# pelo import ganha um rotulo, e o mesmo ato recarregado pelo seed ganharia
# outro. Ate 04/08/2026 divergiam mesmo -- o PHP tinha a limpeza da clausula do
# emissor e a guarda de ementa inutilizavel, e este arquivo nao tinha nenhuma
# das duas. Passavam despercebidas porque o seed nasce de propostas.json, um
# recorte ja curado pela camada ODS, onde essas iscas quase nao aparecem.
# ---------------------------------------------------------------------------
_CLAUSULA_EMISSOR = re.compile(
    r'\bo (comit[êe]|conselho|colegiado|comiss[ãa]o) d[eoa][^.]{0,120}', re.I)
_NOME_UNIDADE = re.compile(r'\bdepartamento\s+de\s+[^,.;:()]{0,90}', re.I)
_NOME_PARCEIRO = re.compile(r'\bcelebrad[oa]s?\s+entre\s+a\s+UFF[^.]{0,160}', re.I)

# Colegiado EFEMERO (banca, concurso, sorteio, eleitoral, mesa receptora) fica
# de fora -- mesmo escopo da aba Comissoes. Nao confundir com colegiado LOCAL
# de unidade, que CONTINUA entrando: o catalogo de assedio e 1 ato central mais
# 10 comissoes locais, e isso foi decisao de curadoria.
_EFEMERA = re.compile(
    r'\bbanca|comiss[ãa]o\s+examinadora|concurso\s+p[úu]blico|sorteio\s+p[úu]blico|'
    r'comiss[ãa]o\s+eleitoral|mesa\s+receptora|consulta\s+(eleitoral|para)', re.I)
_FRAGMENTO_INI = re.compile(r'^[a-zà-ú\)\]•§]')
_RODAPE = re.compile(r'^bs\s*-', re.I)

# O sinal do EMISSOR nao vale para designacao nem para mencao -- ver o racional
# medido em politicas_emissor_vale(), no politicas_match.php.
EMISSOR_FORA = ('governanca', 'referencia')


def ementa_inutilizavel(ementa):
    """Motivo, ou '' se a ementa serve para casar frase."""
    t = (ementa or '').strip()
    if not t or 'sem ementa formal' in norm(t):
        return 'sem ementa'
    if _FRAGMENTO_INI.match(t):
        return 'fragmento'
    if _RODAPE.match(t):
        return 'rodape'
    # Pedaco de ato, nao ato -- o extrator parte as INs longas da PROAES.
    # Medido: 30 dos 360 vinculos do backfill de 04/08/2026.
    if re.match(r'^art\.?\s*\d', t, re.I):
        return 'fragmento (artigo)'
    if re.match(r'^(cap[íi]tulo|se[çc][ãa]o|anexo|t[íi]tulo)\b', t, re.I):
        return 'fragmento (divisão)'
    if re.match(r'^PARA\s+[A-ZÀ-Ú]', t):
        return 'fragmento (anexo)'
    if re.match(r'^[AO]\s+[A-ZÀ-Ú][A-ZÀ-Ú\s,\.]{14,}', t):
        return 'preâmbulo de autoridade'
    toks = [x for x in re.split(r'\s+', t) if x]
    if len(toks) >= 12 and sum(1 for x in toks if len(x) == 1) / len(toks) > 0.4:
        return 'ocr espacado'
    return ''


# ---------------------------------------------------------------------------
# TRIAGEM -- a coluna `decisao` vem PREENCHIDA com uma proposta, para o humano
# revisar so o que e duvidoso em vez de ler 155 linhas em branco.
#
# As regras saem do que foi MEDIDO em 04/08/2026, nao de intuicao:
#
# `aceitar`  frase estrita na ementa + papel de ACAO + orgao central. Foi o
#            perfil que sobreviveu a todas as guardas sem produzir ruido.
#
# `revisar`  tres situacoes, e a ordem importa porque a primeira e a mais forte:
#            1. ATO DA REITORIA -- orientacao do mantenedor: os atos dela tem
#               mais impacto e cobrem toda a comunidade. E corta para os dois
#               lados: a Reitoria tambem e quem mais emite ato individual de
#               pessoal, e foi de onde veio 12 dos 37 falsos positivos quando
#               se tentou ler o corpo do ato. Nunca decidir sozinho aqui.
#            2. confianca `media` -- entrou pelo orgao emissor, sem a frase.
#            3. papel `governanca` ou `referencia` -- designacao e mencao foram
#               a fonte de quase todo o ruido do backfill (102 fiscais de
#               contrato entraram assim).
#
# Nada e proposto como `rejeitar`: o que as guardas rejeitam nao chega aqui, e
# rejeitar por regra o que passou seria desfazer a medicao com palpite.
# ---------------------------------------------------------------------------
PAPEL_DE_ACAO = ('fundador', 'regulamentacao', 'execucao', 'monitoramento',
                 'alteracao', 'revogacao', 'avaliacao')


def triagem(ato, papel, confianca):
    """(proposta, motivo) para a coluna `decisao`."""
    orgao = (ato.get('sigla') or '').strip().upper()
    if orgao == 'REITORIA':
        return 'revisar', 'ato da Reitoria: alcance institucional, conferir sempre'
    if confianca == 'media':
        return 'revisar', 'entrou pelo órgão emissor, sem a frase na ementa'
    if papel in ('governanca', 'referencia'):
        return 'revisar', f'papel `{papel}`: designação/menção foi a maior fonte de ruído'
    if papel in PAPEL_DE_ACAO:
        return 'aceitar', 'frase na ementa + ato age sobre a política'
    return 'revisar', 'perfil fora das regras conhecidas'


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
        motivo = ementa_inutilizavel(ementa)
        if motivo:
            residuo.append((a, f'ementa inutilizável ({motivo})'))
            continue
        if _EFEMERA.search(ementa):
            residuo.append((a, 'colegiado efêmero (banca/concurso/eleitoral)'))
            continue
        # Três limpezas antes de casar: a cláusula de quem assina, o nome do
        # departamento e o nome do parceiro. Nas três o termo está no NOME de
        # alguém, não no dispositivo.
        alvo = norm(_NOME_PARCEIRO.sub(' ', _NOME_UNIDADE.sub(
            ' ', _CLAUSULA_EMISSOR.sub(' ', ementa))))
        papel = papel_do(ementa)
        achou = False
        for slug, _n, _e, _s, _b, _d, termos, emissores in CATALOGO:
            sinal = next((t for t in termos if t in alvo), None)
            if sinal:
                vinculos.append((slug, a, papel, 'alta', f'frase: {sinal}'))
                achou = True
            elif (a.get('sigla') or '').upper() in emissores and papel not in EMISSOR_FORA:
                vinculos.append((slug, a, papel, 'media', f"emissor: {a['sigla']}"))
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
    L.append(f'--  CATEGORIA ANCORADA NO PDI {PDI_VERSAO} da UFF: `eixo_pdi` e `subtema_pdi`')
    L.append('--  saem do plano institucional, nao de rotulo nosso. `pdi_base` diz de onde')
    L.append("--  veio o encaixe -- 'nome' (o PDI o nomeia), 'conteudo' (o subtema descreve")
    L.append("--  o tema sem usar a palavra) ou 'afinidade' (atribuicao nossa).")
    L.append('--  Exige o `alterar_politica_pdi.sql` aplicado ANTES deste arquivo.')
    L.append('--')
    L.append('--  No phpMyAdmin: aba Importar (e DML, nao tem saida para exibir).')
    L.append('-- ' + '=' * 74)
    L.append('')
    # `categoria` continua sendo escrita, com o EIXO, para nao quebrar consumidor
    # que ainda a leia; os campos novos e que carregam a ancora completa.
    L.append('INSERT INTO `politica`')
    L.append('  (`slug`, `nome`, `descricao`, `categoria`,')
    L.append('   `eixo_pdi`, `subtema_pdi`, `pdi_base`, `pdi_versao`, `status_curadoria`)')
    L.append('VALUES')
    for slug, nome, eixo, subtema, base, desc, _t, _e in CATALOGO:
        L.append(f"  ('{slug}', '{esc(nome)}', '{esc(desc)}', '{esc(eixo)}',")
        L.append(f"   '{esc(eixo)}', '{esc(subtema)}', '{base}', '{PDI_VERSAO}', 'rascunho'),")
    L[-1] = L[-1].rstrip(',')
    L.append('ON DUPLICATE KEY UPDATE')
    L.append('  `nome` = VALUES(`nome`), `descricao` = VALUES(`descricao`),')
    L.append('  `categoria` = VALUES(`categoria`), `eixo_pdi` = VALUES(`eixo_pdi`),')
    L.append('  `subtema_pdi` = VALUES(`subtema_pdi`), `pdi_base` = VALUES(`pdi_base`),')
    L.append('  `pdi_versao` = VALUES(`pdi_versao`);')
    L.append('')
    L.append('INSERT IGNORE INTO `politica_alias` (`politica_id`, `termo`, `tipo`)')
    L.append('VALUES')
    linhas = []
    for slug, _n, _e, _s, _b, _d, termos, _em in CATALOGO:
        for t in termos:
            linhas.append(f"  ((SELECT id FROM politica WHERE slug='{slug}'), '{esc(t)}', 'frase_estrita'),")
    linhas[-1] = linhas[-1].rstrip(',') + ';'
    L.extend(linhas)
    L.append('')
    L.append('-- O `papel` faz parte da chave natural (ato_id, politica_id, papel).')
    L.append('-- Reclassificar um ato — que foi o caso da cartilha de acessibilidade,')
    L.append('-- de `fundador` para `regulamentacao` — não é UPDATE: o upsert enxerga')
    L.append('-- uma chave nova e INSERE, deixando a linha velha viva. O ato passaria a')
    L.append('-- aparecer duas vezes na linha do tempo, com dois papéis.')
    L.append('--')
    L.append('-- Daí o DELETE: o mesmo desenho da `ato_ods` no importador. A passada')
    L.append('-- automática apaga só o que ela mesma escreveu; qualquer linha que passou')
    L.append('-- por mão humana sobrevive.')
    L.append('DELETE ap FROM `ato_politica` ap')
    L.append(" WHERE ap.`metodo` NOT IN ('curadoria','regra+curadoria','ia+curadoria');")
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

    # ---- CSV de curadoria, com TRIAGEM automática ---------------------------
    csv_path = os.path.join(DADOS, 'curadoria_politicas.csv')
    with io.open(csv_path, 'w', encoding='utf-8-sig', newline='') as fh:
        w = csv.writer(fh, delimiter=';')
        w.writerow(['decisao', 'proposta', 'motivo', 'politica', 'papel', 'confianca',
                    'sinal', 'uid', 'ano', 'orgao', 'numero', 'status', 'ementa'])
        for slug, a, papel, conf, just in sorted(vinculos, key=lambda x: (x[0], -x[1]['ano'])):
            proposta, motivo = triagem(a, papel, conf)
            w.writerow(['', proposta, motivo, slug, papel, conf, just, a['id'], a['ano'],
                        a.get('sigla', ''), a.get('numero', ''), a.get('status', ''),
                        (a.get('ementa') or '')[:300]])
        for a, motivo in sorted(residuo, key=lambda x: -x[0]['ano']):
            # O resíduo já foi decidido por uma guarda medida. Só o "sem
            # cluster" merece olho: pode ser política que o catálogo não tem.
            prop = 'revisar' if motivo == 'sem cluster' else 'fora'
            w.writerow(['', prop, motivo, '(fora)', '', '', motivo, a['id'], a['ano'],
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
