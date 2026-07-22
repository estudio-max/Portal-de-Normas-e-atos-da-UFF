# -*- coding: utf-8 -*-
"""Registro CURADO dos comites/comissoes permanentes centrais da UFF.

Cada corpo: slug estavel, sigla, nome oficial, tipo e um TERMO de busca por
FRASE (casado com LIKE estrito na ementa+corpo -- nao FULLTEXT, que tokeniza e
da falso positivo). Fonte unica; o index_v2.php e o backfill leem daqui via o
array PHP emitido por este arquivo.
"""
# (slug, sigla, nome, tipo, termo_busca)
REGISTRO = [
    ('cpa',       'CPA',   'Comissão Própria de Avaliação',                      'Comissão', 'própria de avaliação'),
    ('cppd',      'CPPD',  'Comissão Permanente de Pessoal Docente',             'Comissão', 'permanente de pessoal docente'),
    ('cppta',     'CPPTA', 'Comissão Permanente de Pessoal Técnico-Administrativo', 'Comissão', 'permanente de pessoal técnico'),
    ('cis',       'CIS',   'Comissão Interna de Supervisão do Plano de Carreira (PCCTAE)', 'Comissão', 'interna de supervisão'),
    ('etica-pub', '',      'Comissão de Ética Pública',                          'Comissão', 'ética pública'),
    ('ceua',      'CEUA',  'Comissão de Ética no Uso de Animais',                'Comissão', 'ética no uso de animais'),
    ('cep',       'CEP',   'Comitê de Ética na Pesquisa',                        'Comitê',   'ética na pesquisa'),
    ('gov',       '',      'Comitê de Governança',                               'Comitê',   'comitê de governança da uff'),
    ('gov-dig',   '',      'Comitê de Governança Digital',                       'Comitê',   'governança digital'),
    ('csi',       'CSI',   'Comitê de Segurança da Informação',                  'Comitê',   'segurança da informação'),
    ('cgi',       'CGI',   'Comitê de Gestão da Integridade',                    'Comitê',   'gestão da integridade'),
    ('cti',       '',      'Comitê de Tecnologia da Informação',                 'Comitê',   'comitê de tecnologia da informação'),
    ('cgestao-inf', '',    'Comitê de Gestão da Informação',                     'Comitê',   'comitê de gestão da informação'),
    ('assessor-pesq', '',  'Comitê Assessor de Pesquisa',                        'Comitê',   'assessor de pesquisa'),
    ('multi-pesq', '',     'Comitê Multidisciplinar de Pesquisa',                'Comitê',   'multidisciplinar de pesquisa'),
    ('patrim-gen', '',     'Comitê de Acesso ao Patrimônio Genético',            'Comitê',   'acesso ao patrimônio genético'),
    ('acessib',   '',      'Comissão Permanente de Acessibilidade e Inclusão (UFF Acessível)', 'Comissão', 'acessibilidade e inclusão'),
    ('afide',     'AFIDE', 'Comissão Permanente de Ações Afirmativas, Diversidade e Equidade', 'Comissão', 'ações afirmativas'),
    ('cppiq',     'CPPIQ', 'Comissão Permanente de Políticas para Indígenas e Quilombolas', 'Comissão', 'indígenas e quilombolas'),
    ('cps',       'CPS',   'Comissão Permanente de Sustentabilidade',            'Comissão', 'permanente de sustentabilidade'),
    ('cpt',       'CPT',   'Comissão Permanente de Telefonia',                   'Comissão', 'permanente de telefonia'),
    ('pgd',       '',      'Comissão Permanente do Programa de Gestão e Desempenho', 'Comissão', 'permanente do programa de gestão'),
    ('doc-sig',   '',      'Comissão Permanente de Acesso aos Documentos Públicos de Natureza Sigilosa', 'Comissão', 'documentos públicos de natureza sigilosa'),
    ('rsc',       'RSC',   'Comissão Especial de Reconhecimento de Saberes e Competências (RSC)', 'Comissão', 'reconhecimento de saberes'),
]


def emite_php():
    """Array PHP para colar no index_v2.php (dentro de comissoes_registro())."""
    linhas = []
    for slug, sigla, nome, tipo, termo in REGISTRO:
        n = nome.replace("'", "\\'")
        t = termo.replace("'", "\\'")
        linhas.append(f"        ['{slug}', '{sigla}', '{n}', '{tipo}', '{t}'],")
    return '\n'.join(linhas)


if __name__ == '__main__':
    import io, sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    print(f'{len(REGISTRO)} corpos')
    slugs = [r[0] for r in REGISTRO]
    assert len(slugs) == len(set(slugs)), 'slug duplicado!'
    print('slugs unicos: ok')
    print()
    print(emite_php())
