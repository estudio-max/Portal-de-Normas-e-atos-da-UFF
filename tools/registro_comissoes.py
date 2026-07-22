# -*- coding: utf-8 -*-
"""Registro CURADO dos comites/comissoes permanentes centrais da UFF.

(slug, sigla, nome, tipo, termos, obrig)
  termos: uma ou MAIS frases distintivas separadas por '|' (o corpo mudou de
          nome ao longo dos anos -- ex.: CEP e "em pesquisa" hoje mas ja foi
          "na pesquisa"). Casado por LIKE estrito na ementa (nao FULLTEXT).
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
    ('biosseg',   '',      'Comissão Interna de Biossegurança',                  'Comissão', 'interna de biossegurança', 'lei'),
    ('etica',     '',      'Comissão de Ética da UFF',                           'Comissão', 'ética da uff|ética pública', 'lei'),
    ('cep',       'CEP',   'Comitê de Ética em Pesquisa',                        'Comitê',   'ética em pesquisa|ética na pesquisa', 'lei'),
    ('cis',       'CIS',   'Comissão Interna de Supervisão do Plano de Carreira (PCCTAE)', 'Comissão', 'interna de supervisão', 'lei'),
    # --- exigidas por ORGAOS DE CONTROLE ------------------------------------
    ('gov-dig',   '',      'Comitê de Governança Digital',                       'Comitê',   'governança digital', 'controle'),
    ('cgirc',     'CGIRC', 'Comitê de Governança, Integridade, Riscos e Controles', 'Comitê', 'governança, integridade|comitê de governança da uff', 'controle'),
    ('cgi',       '',      'Comitê de Gestão da Integridade',                    'Comitê',   'gestão da integridade', 'controle'),
    ('cgestao-inf', '',    'Comitê de Gestão da Informação',                     'Comitê',   'comitê de gestão da informação', 'controle'),
    ('acessib',   '',      'Comissão de Acessibilidade e Inclusão (UFF Acessível)', 'Comissão', 'acessibilidade e inclusão', 'controle'),
    ('cipa',      '',      'Comissão Interna de Prevenção de Acidentes e de Assédio', 'Comissão', 'prevenção de acidentes', 'controle'),
    # --- permanentes/centrais, sem obrigatoriedade formal -------------------
    ('cppta',     'CPPTA', 'Comissão Permanente de Pessoal Técnico-Administrativo', 'Comissão', 'permanente de pessoal técnico', ''),
    ('csi',       'CSI',   'Comitê de Segurança da Informação',                  'Comitê',   'segurança da informação', ''),
    ('cti',       '',      'Comitê de Tecnologia da Informação',                 'Comitê',   'comitê de tecnologia da informação', ''),
    ('assessor-pesq', '',  'Comitê Assessor de Pesquisa',                        'Comitê',   'assessor de pesquisa', ''),
    ('multi-pesq', '',     'Comitê Multidisciplinar de Pesquisa',                'Comitê',   'multidisciplinar de pesquisa', ''),
    ('patrim-gen', '',     'Comitê de Acesso ao Patrimônio Genético',            'Comitê',   'acesso ao patrimônio genético', ''),
    ('afide',     'AFIDE', 'Comissão Permanente de Ações Afirmativas, Diversidade e Equidade', 'Comissão', 'ações afirmativas', ''),
    ('cppiq',     'CPPIQ', 'Comissão Permanente de Políticas para Indígenas e Quilombolas', 'Comissão', 'indígenas e quilombolas', ''),
    ('cps',       'CPS',   'Comissão Permanente de Sustentabilidade',            'Comissão', 'permanente de sustentabilidade', ''),
    ('cpt',       'CPT',   'Comissão Permanente de Telefonia',                   'Comissão', 'permanente de telefonia', ''),
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


if __name__ == '__main__':
    import io, sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    slugs = [r[0] for r in REGISTRO]
    assert len(slugs) == len(set(slugs)), 'slug duplicado!'
    from collections import Counter
    c = Counter(r[5] for r in REGISTRO)
    print(f'{len(REGISTRO)} corpos | lei={c["lei"]} controle={c["controle"]} sem={c[""]}')
    print()
    print('--- registro (index_v2.php) ---')
    print(emite_php_registro())
    print()
    print('--- termos (comissoes_match.php) ---')
    print(emite_php_termos())
