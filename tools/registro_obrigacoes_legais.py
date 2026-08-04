# -*- coding: utf-8 -*-
"""registro_obrigacoes_legais.py -- as obrigações dos colegiados, vindas da LEI.

POR QUE ESTE ARQUIVO EXISTE
---------------------------
O Radar de Obrigações foi medido duas vezes e reprovado nas duas:

  1. Varrendo o acervo inteiro (`tools/medir_obrigacoes.py`): o `deverá` do
     corpus é edital dirigido a uma pessoa. 556 sujeitos-pessoa contra 19
     sujeitos-órgão no top 45.
  2. Varrendo só o catálogo (`tools/medir_obrigacoes_catalogo.py`): de 494 atos
     de política e comissão, **470 não têm modal nenhum** e sobra UMA obrigação
     acompanhável. O motivo aparece no verbo dispositivo: **58% desses atos são
     DESIGNAÇÕES**. Designar não cria obrigação; nomeia gente.

A conclusão que as duas medições apontam junto é a mesma, e ela não é sobre
regex: **a obrigação de um colegiado permanente não está no ato que o designa.
Está na norma que o exige.** A CPA não deve relatório porque alguma portaria da
UFF mandou; deve porque a Lei 10.861/2004 instituiu o SINAES. Nenhum detector de
texto acharia isso no Boletim, porque não está lá.

E há um segundo achado, que muda o que o portal deve DIZER: parte dessas
obrigações é cumprida FORA do Boletim. O relatório de autoavaliação da CPA vai
ao MEC/INEP e é publicado em cpa.uff.br; o relatório da CEUA vai ao CONCEA.
Procurar essa evidência no Boletim e não achar não é sinal de descumprimento —
é o lugar errado de procurar. Por isso cada linha aqui declara ONDE a evidência
vive.

COMO USAR
---------
    python tools/registro_obrigacoes_legais.py          # confere e resume
    python tools/registro_obrigacoes_legais.py --sql    # grava o seed

CONFIANÇA
---------
`fonte` traz a norma. `conf` diz o que eu de fato confirmei:

  'verificada'  — norma e obrigação confirmadas em fonte primária ou oficial
  'a_confirmar' — a existência do colegiado e da norma é conhecida, mas o
                  dispositivo exato da periodicidade não foi lido na fonte.
                  NÃO publicar como fato até alguém abrir a norma.

Linha com `conf='a_confirmar'` entra no banco como rascunho e não vai ao ar.
Isto não é excesso de zelo: afirmar que um colegiado deve relatório anual,
citando lei errada, é pior do que não afirmar nada.
"""
import io, os, sys

# (slug, tipo, descricao, periodicidade_meses, responsavel, fonte, onde_vive, conf)
#
# `onde_vive`:
#   'boletim'  — o cumprimento gera ato no Boletim de Serviço (designação,
#                recomposição, prorrogação). O portal consegue evidenciar.
#   'externo'  — o cumprimento acontece fora: relatório a órgão federal, sistema
#                próprio, site da comissão. O portal NÃO consegue evidenciar, e
#                tem que dizer isso em vez de exibir lacuna.
#   'misto'    — parte no Boletim, parte fora.
REGISTRO = [
    # ---------------------------------------------------------------- POR LEI
    ('cpa', 'relatorio',
     'Relatório de autoavaliação institucional, coordenado pela CPA e enviado ao INEP/MEC.',
     12, 'Comissão Própria de Avaliação',
     'Lei 10.861/2004, art. 11 (SINAES)',
     'externo', 'verificada'),

    ('ceua', 'relatorio',
     'Relatório anual de atividades da CEUA ao CONCEA.',
     12, 'Comissão de Ética no Uso de Animais',
     'Lei 11.794/2008 (Lei Arouca) e Resoluções Normativas do CONCEA',
     'externo', 'verificada'),

    # REPROVADA na conferência: o Decreto 6.029/2007 estrutura o Sistema de
    # Gestão da Ética e as competências das comissões setoriais (orientar,
    # apurar, aconselhar), mas NÃO fixa periodicidade de relatório para elas.
    # Eu tinha suposto uma prestação de contas anual à CEP/PR. Não existe no
    # texto. A linha sai do registro em vez de virar afirmação sem base.
    #
    # ('etica', 'relatorio', ..., 12, ...)  <- removida em 04/08/2026

    # CONFIRMADA na própria página institucional da UFF, que a lista entre as
    # atribuições da comissão: "Elaboração de relatório anual de acessibilidade
    # e inclusão (Raai)".
    ('acessib', 'relatorio',
     'Relatório Anual de Acessibilidade e Inclusão (RAAI).',
     12, 'Comissão Permanente de Acessibilidade e Inclusão (UFF Acessível)',
     'uff.br/sobre/comites-e-comissoes/ — atribuição declarada; base legal na Lei 13.146/2015',
     'externo', 'verificada'),

    ('cpa', 'constituicao',
     'Designação e recomposição dos membros da CPA, com mandato.',
     None, 'Reitoria',
     'Lei 10.861/2004, art. 11',
     'boletim', 'verificada'),

    ('cppd', 'constituicao',
     'Designação e recomposição da CPPD, que assessora sobre a carreira docente.',
     None, 'Reitoria',
     'Lei 12.772/2012',
     'boletim', 'a_confirmar'),

    # CONFIRMADA: criada em caráter permanente pelo §3º do art. 22 da Lei
    # 11.091/2005, com mandato de TRÊS ANOS e membros eleitos diretamente pelos
    # técnico-administrativos. O mandato é o dado que interessa ao Observatório:
    # é ele que sustenta "recomposição possivelmente necessária".
    ('cis', 'recomposicao',
     'Eleição e designação da CIS a cada mandato de três anos.',
     36, 'Comissão Interna de Supervisão do PCCTAE',
     'Lei 11.091/2005, art. 22, §3º',
     'boletim', 'verificada'),

    ('cep', 'constituicao',
     'Designação e recomposição do Comitê de Ética em Pesquisa, registrado na CONEP.',
     None, 'Reitoria',
     'Resolução CNS 466/2012 e normas da CONEP',
     'misto', 'a_confirmar'),

    ('biosseg', 'constituicao',
     'Designação e recomposição da Comissão Interna de Biossegurança (CIBio).',
     None, 'Reitoria',
     'Lei 11.105/2005 e normas da CTNBio',
     'misto', 'a_confirmar'),

    ('cipa', 'constituicao',
     'Constituição da CIPA, com processo eleitoral e mandato.',
     None, 'Reitoria',
     'Lei 14.457/2022 e NR-5',
     'boletim', 'a_confirmar'),

    # ------------------------------------------------- EXIGIDAS POR CONTROLE
    # A suposição de um relatório ANUAL de riscos pela IN Conjunta MP/CGU
    # 01/2016 foi substituída pelo que a UFF de fato publica: relatório
    # SEMESTRAL de integridade (ver a linha verificada mais abaixo). Preferir o
    # artefato à norma que eu não li é o critério deste registro inteiro.

    ('cgi', 'plano',
     'Plano de Integridade, com revisão periódica.',
     24, 'Comitê de Gestão da Integridade',
     'Decreto 9.203/2017 e Portaria CGU 1.089/2018',
     'misto', 'a_confirmar'),

    ('gov-dig', 'plano',
     'Plano Diretor de Tecnologia da Informação e Comunicação (PDTIC).',
     None, 'Comitê de Governança Digital',
     'Decreto 10.332/2020 (Estratégia de Governo Digital)',
     'misto', 'a_confirmar'),

    ('acessib', 'constituicao',
     'Designação e recomposição da comissão de acessibilidade.',
     None, 'Reitoria',
     'Lei 13.146/2015 (Estatuto da Pessoa com Deficiência)',
     'boletim', 'a_confirmar'),

    # CONFIRMADA pela existência dos próprios relatórios publicados em uff.br:
    # "Relatório Semestral de Integridade 1/2023" e o do 2º semestre de 2023.
    # A periodicidade está no título do documento, não numa norma que eu tenha
    # lido — por isso a fonte é o artefato, e é o que a linha declara.
    ('cgirc', 'relatorio',
     'Relatório semestral de integridade.',
     6, 'Comitê de Governança, Integridade, Riscos e Controles',
     'Relatórios semestrais publicados em uff.br (1º e 2º semestres de 2023)',
     'externo', 'verificada'),
]


def resumo():
    from collections import Counter
    onde = Counter(r[6] for r in REGISTRO)
    conf = Counter(r[7] for r in REGISTRO)
    periodicas = [r for r in REGISTRO if r[3]]
    print(f'{len(REGISTRO)} obrigações legais em {len({r[0] for r in REGISTRO})} colegiados\n')
    print('  onde a evidência vive:', dict(onde))
    print('  confiança:            ', dict(conf))
    print(f'  periódicas:            {len(periodicas)}')
    print()
    print('--- as que o portal NÃO consegue evidenciar (evidência fora do Boletim) ---')
    for slug, tipo, desc, per, resp, fonte, onde_v, c in REGISTRO:
        if onde_v == 'externo':
            p = f'{per}m' if per else '—'
            print(f'  {slug:12} {tipo:14} {p:4} {fonte}')
    print()
    print('--- a confirmar antes de publicar ---')
    for slug, tipo, desc, per, resp, fonte, onde_v, c in REGISTRO:
        if c == 'a_confirmar':
            print(f'  {slug:12} {tipo:14} {fonte}')


def esc(s):
    return (s or '').replace("'", "''")


def emite_sql():
    linhas = []
    for i, (slug, tipo, desc, per, resp, fonte, onde_v, c) in enumerate(REGISTRO, 1):
        uid = f'obl-{slug}-{tipo}'
        periodo = str(per) if per else 'NULL'
        # `trecho_origem` é a NORMA, não um recorte do Boletim: esta obrigação
        # não nasce de um ato da UFF. É a diferença que o módulo inteiro
        # descobriu, e ela fica explícita no dado.
        linhas.append(
            f"  ('{uid}', NULL, '{slug}', '{tipo}', '{esc(desc)}', '{esc(resp)}',\n"
            f"   {periodo}, '{esc(fonte)}', '{esc(fonte)}', 'sem_data', 'media',\n"
            f"   'curadoria', NULL),")
    corpo = '\n'.join(linhas).rstrip(',')
    return f"""-- ============================================================================
--  seed_obrigacao_legal.sql — GERADO por tools/registro_obrigacoes_legais.py.
--  Não edite aqui. Regenerar: python tools/registro_obrigacoes_legais.py --sql
--
--  {len(REGISTRO)} obrigações que NÃO vêm do Boletim: vêm da norma que exige o
--  colegiado. A CPA não deve relatório porque uma portaria mandou — deve porque
--  a Lei 10.861/2004 instituiu o SINAES.
--
--  `ato_origem_id` é NULL de propósito, e é a diferença que o módulo descobriu:
--  esta obrigação não nasce de um ato da UFF. `trecho_origem` guarda a NORMA.
--
--  `metodo='curadoria'`: nenhuma linha aqui saiu de detector. Todas foram
--  levantadas à mão a partir da legislação, e por isso sobrevivem a qualquer
--  passada automática.
--
--  ⚠️ PARTE DELAS AINDA NÃO FOI CONFIRMADA EM FONTE PRIMÁRIA. Confira o campo
--  `conf` no gerador antes de publicar qualquer uma: afirmar que um colegiado
--  deve relatório anual citando a lei errada é pior que não afirmar nada.
--
--  No phpMyAdmin: aba Importar (é DML, não tem saída para exibir).
-- ============================================================================
INSERT INTO `obrigacao`
  (`uid`, `ato_origem_id`, `comissao_slug`, `tipo`, `descricao`, `responsavel_texto`,
   `periodicidade_meses`, `condicao_texto`, `trecho_origem`, `data_base_origem`,
   `confianca`, `metodo`, `estado_curado`)
VALUES
{corpo}

ON DUPLICATE KEY UPDATE
  `descricao`           = VALUES(`descricao`),
  `responsavel_texto`   = VALUES(`responsavel_texto`),
  `periodicidade_meses` = VALUES(`periodicidade_meses`),
  `condicao_texto`      = VALUES(`condicao_texto`),
  `trecho_origem`       = VALUES(`trecho_origem`);
"""


if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    uids = [f'{r[0]}-{r[1]}' for r in REGISTRO]
    assert len(uids) == len(set(uids)), 'obrigação duplicada (slug+tipo)!'
    if '--sql' in sys.argv:
        destino = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               '..', 'backend', 'db', 'seed_obrigacao_legal.sql')
        with io.open(destino, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(emite_sql())
        print(f'gravado {os.path.normpath(destino)} com {len(REGISTRO)} obrigações')
    else:
        resumo()
