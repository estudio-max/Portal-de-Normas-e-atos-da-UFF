# -*- coding: utf-8 -*-
"""medir_local_vs_central.py -- o corpo curado está absorvendo comissões de UNIDADE?

O registro de comissões é, por desenho, dos colegiados PERMANENTES CENTRAIS.
Mas o casamento é por frase, e frase não distingue a comissão da Reitoria da
comissão homônima de uma faculdade. "Comissão Interna de Biossegurança" casa a
CBio da PROPPI e as CIBios do Instituto de Química, da Faculdade de Nutrição,
da Escola de Enfermagem...

É a mesma armadilha do CIPA×COPAMA que o CLAUDE.md já registra, e da mesma
família do CEP×CEPEx: nome parecido, corpo diferente. Lá o discriminador cabia
no termo (`e de assédio`). Aqui não cabe — o ato central muitas vezes não diz
nada que o distinga:

    "Revoga a Portaria nº 44.171 e designa Comissão Interna de Biossegurança."

Não há frase nesse ato que diga "central". O que denuncia o LOCAL é o
qualificador de unidade, e nem sempre ele existe em forma reconhecível.

Uso:  python tools/medir_local_vs_central.py

Lê dados/dispositivo_catalogo.csv (ver backend/db/extrair_dispositivo_catalogo.sql).
"""
import csv, io, os, re, sys, unicodedata
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
csv.field_size_limit(10_000_000)
FONTE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     '..', '..', 'dados', 'dispositivo_catalogo.csv')


def norm(s):
    s = unicodedata.normalize('NFD', (s or '').lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s)


# Marcador de LOCALIDADE por extenso. Pró-Reitoria e Reitoria ficam de fora de
# propósito: são o nível central.
LOCAL = re.compile(
    r'\b(d[oa]s?)\s+(instituto|faculdade|escola|departamento|hospital|campus|'
    r'polo|colegio|centro de|programa de pos)')


def main():
    if not os.path.exists(FONTE):
        sys.exit(f'não achei {os.path.normpath(FONTE)} — exporte com '
                 'backend/db/extrair_dispositivo_catalogo.sql')

    por_slug = defaultdict(list)
    for r in csv.DictReader(io.open(FONTE, encoding='utf-8-sig')):
        if r['origem'] == 'comissao':
            por_slug[r['entidade']].append(r)

    print(f'{"slug":14} {"atos":>5} {"órgãos":>7} {"c/ marca local":>15}')
    print('-' * 52)
    suspeitos = []
    for slug, rs in sorted(por_slug.items(), key=lambda x: -len(x[1])):
        orgs = len({r['orgao'] for r in rs})
        loc = sum(1 for r in rs if LOCAL.search(norm(r['ementa'])))
        pct = 100 * loc / len(rs)
        marca = ''
        if pct >= 40 or orgs >= 6:
            marca = '  <- mistura'
            suspeitos.append((slug, len(rs), loc))
        elif pct >= 15:
            marca = '  <- parcial'
            suspeitos.append((slug, len(rs), loc))
        print(f'{slug:14} {len(rs):5} {orgs:7} {loc:9} ({pct:3.0f}%){marca}')

    print(f'\n{len(suspeitos)} de {len(por_slug)} corpos com sinal de mistura.')
    print("""
--- POR QUE A GUARDA POR REGEX NÃO BASTA ---

Aplicar o marcador de localidade como filtro derruba os vínculos dos oito
suspeitos de 222 para 110 — metade. E mesmo assim erra dos dois lados:

  FALSO NEGATIVO (local que passa): a unidade aparece por SIGLA, não por
  extenso — "CIBio do ISC", "Dts Eeimvr nº 12". O regex procura "do Instituto",
  e a sigla não casa.

  FALSO POSITIVO (central que cai): a CIPA tem UM ato no acervo, e é o da
  Faculdade de Medicina. Filtrar deixa o corpo vazio — o que é tecnicamente
  correto para um registro central, mas some com a única evidência de CIPA que
  existe.

A conclusão é a mesma de sempre neste projeto: consolidar órgão é CURADORIA,
não regex. O que o dado sustenta é distinguir, não adivinhar.
""")


if __name__ == '__main__':
    main()
