# -*- coding: utf-8 -*-
"""Registro CURADO dos comites/comissoes permanentes centrais da UFF.

(slug, sigla, nome, tipo, termos, obrig)
  termos: uma ou MAIS frases distintivas separadas por '|' (o corpo mudou de
          nome ao longo dos anos -- ex.: CEP e "em pesquisa" hoje mas ja foi
          "na pesquisa"). Casado por LIKE estrito na ementa (nao FULLTEXT).
          Dois prefixos, os dois criados para o CPFJ e validos para qualquer
          corpo (racional completo no comissoes_match.php):
            '!'  EXCLUSAO -- a frase veta o casamento. Recurso para o homonimo
                 de UNIDADE que nenhum qualificador positivo separa.
            '+'  TERMO FORTE -- dispensa a guarda de colegiado, para a frase
                 que nomeia o INSTRUMENTO que o corpo produz e nao o corpo.
                 So com frase medida a 100% de precisao.
  obrig:  'lei'      -> obrigatoria por lei
          'controle' -> exigida por orgao de controle (CGU, TCU...)
          ''         -> permanente/central, mas nao numa das duas listas.

Fonte unica; emite o array PHP para index_v2.php e os termos para
comissoes_match.php.
"""
REGISTRO = [
    # --- obrigatorias por LEI ------------------------------------------------
    ('cpa',       'CPA',   'Comissão Própria de Avaliação',                      'Comissão', 'própria de avaliação', 'lei'),
    ('cppd',      'CPPD',  'Comissão Permanente de Pessoal Docente',             'Comissão', 'permanente de pessoal docente', 'lei'),
    ('ceua',      'CEUA',  'Comissão de Ética no Uso de Animais',                'Comissão', 'ética no uso de animais', 'lei'),
    # CBio: o corpo CENTRAL. Cada unidade tem a sua — o acervo tem 145 atos
    # citando biossegurança, espalhados por 15 órgãos. E os dois nomes são
    # usados dos dois lados: há 'CBio/IQ/UFF' que é do Instituto de Química, e
    # há 'Comissão INTERNA de Biossegurança da Pró Reitoria' que é a central.
    # O discriminador não é interna×não-interna: é o QUALIFICADOR — 'da UFF'
    # ou 'da Pró-Reitoria'. Mesmo recurso que 'ética da uff' já usa aqui.
    # Medido: o termo antigo ('interna de biossegurança') trazia 7 comissões
    # de unidade e PERDIA 2 dos 3 atos centrais, entre eles o Regimento
    # (RESOLUÇÃO CUV 443/2024). O termo novo casa 3 de 145, os três centrais.
    ('biosseg',   'CBio',  'Comissão de Biossegurança da UFF',                   'Comissão', 'biossegurança da uff|biossegurança da pró reitoria|biossegurança da pró-reitoria', 'lei'),
    ('etica',     '',      'Comissão de Ética da UFF',                           'Comissão', 'ética da uff|ética pública', 'lei'),
    ('cep',       'CEP',   'Comitê de Ética em Pesquisa',                        'Comitê',   'ética em pesquisa|ética na pesquisa', 'lei'),
    ('cis',       'CIS',   'Comissão Interna de Supervisão do Plano de Carreira (PCCTAE)', 'Comissão', 'interna de supervisão', 'lei'),
    # --- exigidas por ORGAOS DE CONTROLE ------------------------------------
    ('gov-dig',   '',      'Comitê de Governança Digital',                       'Comitê',   'governança digital', 'controle'),
    ('cgirc',     'CGIRC', 'Comitê de Governança, Integridade, Riscos e Controles', 'Comitê', 'governança, integridade|comitê de governança da uff', 'controle'),
    ('cgi',       '',      'Comitê de Gestão da Integridade',                    'Comitê',   'gestão da integridade', 'controle'),
    ('cgestao-inf', '',    'Comitê de Gestão da Informação',                     'Comitê',   'comitê de gestão da informação', 'controle'),
    # Cada unidade tem a sua comissão de acessibilidade (curso de Jornalismo,
    # GAG, MIP, SDC...). Medido: 'acessibilidade e inclusão' casava 23 atos,
    # 18 deles de unidade. O qualificador 'da UFF' e o apelido 'UFF Acessível'
    # isolam os 5 do corpo central.
    ('acessib',   '',      'Comissão de Acessibilidade e Inclusão (UFF Acessível)', 'Comissão', 'acessibilidade e inclusão da uff|uff acessível', 'controle'),
    ('cipa',      '',      'Comissão Interna de Prevenção de Acidentes e de Assédio', 'Comissão', 'prevenção de acidentes e de assédio', 'controle'),
    # --- permanentes/centrais, sem obrigatoriedade formal -------------------
    ('cppta',     'CPPTA', 'Comissão Permanente de Pessoal Técnico-Administrativo', 'Comissão', 'permanente de pessoal técnico', ''),
    ('csi',       'CSI',   'Comitê de Segurança da Informação',                  'Comitê',   'segurança da informação', ''),
    ('cti',       '',      'Comitê de Tecnologia da Informação',                 'Comitê',   'comitê de tecnologia da informação', ''),
    # Departamentos têm o seu próprio comitê assessor ('Comitê Assessor de
    # Pesquisa e Extensão do Departamento de Nutrição'). Medido: o termo solto
    # casava 36, sendo 22 de unidade. O radical 'da pró' foi escolhido em vez
    # de 'da pró-reitoria' porque o acervo tem 'Pró- Reitoria' com espaço
    # depois do hífen — um ato se perdia por isso.
    ('assessor-pesq', '',  'Comitê Assessor de Pesquisa',                        'Comitê',   'assessor de pesquisa da pró', ''),
    ('multi-pesq', '',     'Comitê Multidisciplinar de Pesquisa',                'Comitê',   'multidisciplinar de pesquisa', ''),
    ('patrim-gen', '',     'Comitê de Acesso ao Patrimônio Genético',            'Comitê',   'acesso ao patrimônio genético', ''),
    # 'ações afirmativas' casava o TEMA, não o corpo: dos 48 atos, 33 eram
    # editais de verificação de identidade para estudantes ingressantes, GTs
    # de pós-graduação e até a constituição de OUTRAS comissões (a CPPIQ e a
    # Permanente de Políticas Afirmativas Transvestigêneres). O nome completo
    # do corpo é o discriminador — e ele também exclui a Assessoria homônima,
    # que é cargo, não colegiado.
    ('afide',     'AFIDE', 'Comissão Permanente de Ações Afirmativas, Diversidade e Equidade', 'Comissão', 'permanente de ações afirmativas, diversidade e equidade', ''),
    ('cppiq',     'CPPIQ', 'Comissão Permanente de Políticas para Indígenas e Quilombolas', 'Comissão', 'indígenas e quilombolas', ''),
    ('cps',       'CPS',   'Comissão Permanente de Sustentabilidade',            'Comissão', 'permanente de sustentabilidade', ''),
    ('cpt',       'CPT',   'Comissão Permanente de Telefonia',                   'Comissão', 'permanente de telefonia', ''),
    # CPFJ: o unico corpo que se apura por dois tipos de frase, porque quase
    # nunca se nomeia na ementa. 'permanente de flexibilizacao' pega a vida do
    # colegiado (constituicao, retificacoes de composicao, ato que as torna sem
    # efeito) -- o HUAP tem a sua homonima, dai o '!do hospital'. As tres frases
    # '+' pegam o que a comissao PRODUZ: as ~54 portarias de plano de UORG, os
    # atos normativos do rito (57.302/2016, 62.111/2018, NS 672/2019) e a
    # 68.403/2022. A ementa desses nomeia o INSTRUMENTO e e o preambulo que
    # registra a CPFJ, entao a guarda de colegiado derrubava todos. Sao tres por
    # causa do OCR ("d o p l ano d e", "t r a b a l h o") e da alternancia
    # "da jornada"/"de jornada". Medido no acervo cheio (128.426 atos): 71
    # atos, zero falso positivo. Racional completo em comissoes_match.php.
    # A tupla fica numa LINHA SO, por mais longa que seja: o
    # tools/teste_schema_inteligencia.mjs le este arquivo com um regex de linha
    # unica, e tupla quebrada some da contagem sem dar erro nenhum aqui.
    ('cpfj',      'CPFJ',  'Comissão Permanente de Flexibilização da Jornada',   'Comissão', 'permanente de flexibilização|+plano de flexibilização da jornada|+flexibilização da jornada de trabalho|+flexibilização de jornada|!do hospital|!comissão de implantação', ''),
    ('pgd',       '',      'Comissão Permanente do Programa de Gestão e Desempenho', 'Comissão', 'permanente do programa de gestão', ''),
    ('doc-sig',   '',      'Comissão Permanente de Acesso aos Documentos Públicos de Natureza Sigilosa', 'Comissão', 'documentos públicos de natureza sigilosa', ''),
    ('rsc',       'RSC',   'Comissão Especial de Reconhecimento de Saberes e Competências (RSC)', 'Comissão', 'reconhecimento de saberes', ''),
]


def emite_php_registro():
    linhas = []
    for slug, sigla, nome, tipo, termos, obrig in REGISTRO:
        n = nome.replace("'", "\\'")
        linhas.append(f"        ['{slug}', '{sigla}', '{n}', '{tipo}', '{obrig}'],")
    return '\n'.join(linhas)


def emite_php_termos():
    linhas = []
    for slug, _, _, _, termos, _ in REGISTRO:
        t = termos.replace("'", "\\'")
        linhas.append(f"            '{slug}' => '{t}',")
    return '\n'.join(linhas)


def emite_sql_comissao():
    """Seed da tabela `comissao` (backend/db/inteligencia_institucional.sql).

    TERCEIRA projecao do registro, e a regra e a mesma das outras duas: sai
    daqui, nunca da mao. `tipo` e `termos` ficam de fora de proposito -- quem
    os consome e o painel atual, que segue lendo o registro PHP; a tabela
    guarda so o que os modulos novos precisam (alvo de FK para
    comissao_evento e obrigacao.comissao_slug).

    O UPDATE do upsert refresca so o que ESTE arquivo manda. `ato_fundador_id`,
    `orgao_id` e `fundamento_texto` sao campos de curadoria humana e ficam
    fora dele de proposito: reaplicar o seed nao pode desfazer curadoria.
    """
    linhas = []
    for slug, sigla, nome, _tipo, _termos, obrig in REGISTRO:
        n = nome.replace("'", "''")
        s = f"'{sigla}'" if sigla else 'NULL'
        o = obrig if obrig else 'nao_classificada'
        linhas.append(f"  ('{slug}', '{n}', {s}, '{o}', 'central', 1),")
    # Sem `;` aqui: o statement so fecha depois do ON DUPLICATE KEY UPDATE.
    corpo = '\n'.join(linhas).rstrip(',')
    return f"""-- ============================================================================
--  seed_comissao.sql — GERADO por tools/registro_comissoes.py. Nao edite aqui.
--
--  Regenerar:  python tools/registro_comissoes.py --sql
--
--  Popular a `comissao` com os {len(REGISTRO)} colegiados permanentes centrais do
--  registro curado. Depois disto, o bloco 7 do verificar_inteligencia.sql tem
--  que devolver {len(REGISTRO)} no catalogo e ZERO slugs sem catalogo -- e esse zero e a
--  prova de que os slugs batem com os que a `ato_comissao` ja usa.
--
--  Idempotente: reaplicar refresca nome/sigla/obrigatoriedade a partir do
--  gerador e preserva os campos de curadoria (ato_fundador_id, orgao_id,
--  fundamento_texto), que ninguem gera automaticamente.
--
--  No phpMyAdmin: aba Importar (e DML, nao tem saida para exibir).
-- ============================================================================
INSERT INTO `comissao` (`slug`, `nome`, `sigla`, `obrigatoriedade`, `escopo`, `ativa_catalogo`)
VALUES
{corpo}

ON DUPLICATE KEY UPDATE
  `nome`            = VALUES(`nome`),
  `sigla`           = VALUES(`sigla`),
  `obrigatoriedade` = VALUES(`obrigatoriedade`),
  `escopo`          = VALUES(`escopo`),
  `ativa_catalogo`  = VALUES(`ativa_catalogo`);
"""


if __name__ == '__main__':
    import io, os, sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    slugs = [r[0] for r in REGISTRO]
    assert len(slugs) == len(set(slugs)), 'slug duplicado!'
    assert all(len(s) <= 32 for s in slugs), 'slug maior que o VARCHAR(32) da tabela!'
    from collections import Counter
    c = Counter(r[5] for r in REGISTRO)

    if '--sql' in sys.argv:
        destino = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               '..', 'backend', 'db', 'seed_comissao.sql')
        with io.open(destino, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(emite_sql_comissao())
        print(f'gravado {os.path.normpath(destino)} com {len(REGISTRO)} corpos')
        sys.exit(0)

    print(f'{len(REGISTRO)} corpos | lei={c["lei"]} controle={c["controle"]} sem={c[""]}')
    print()
    print('--- registro (index_v2.php) ---')
    print(emite_php_registro())
    print()
    print('--- termos (comissoes_match.php) ---')
    print(emite_php_termos())
    print()
    print('--- seed SQL: rode com --sql para gravar backend/db/seed_comissao.sql ---')
