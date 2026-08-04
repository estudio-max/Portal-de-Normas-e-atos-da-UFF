# -*- coding: utf-8 -*-
"""medir_obrigacoes_catalogo.py -- obrigação DENTRO das políticas e comissões.

O Radar varrendo o acervo inteiro foi medido e reprovado
(`tools/medir_obrigacoes.py`): o `deverá` do corpus é edital dirigido a uma
pessoa. Este script mede o recorte que sobrou -- os atos que já estão ligados a
uma política ou a um colegiado, onde o universo é pequeno e o RESPONSÁVEL já é
conhecido pelo vínculo.

Fonte: dados/dispositivo_catalogo.csv, exportado do phpMyAdmin com
`backend/db/extrair_dispositivo_catalogo.sql`.

Uso:  python tools/medir_obrigacoes_catalogo.py
"""
import csv, io, os, re, sys
from collections import Counter, defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
csv.field_size_limit(10_000_000)
FONTE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     '..', '..', 'dados', 'dispositivo_catalogo.csv')

# ---------------------------------------------------------------------------
# O SUJEITO decide. Reaproveita a lição da medição do acervo: obrigação de
# candidato não é obrigação institucional. Aqui, porém, há um sujeito novo e
# forte -- o PRÓPRIO COLEGIADO ou a política, que o vínculo já identifica.
# ---------------------------------------------------------------------------
PESSOA = r'(?:candidat[oa]|estudante|alun[oa]|interessad[oa]|discente|requerente|inscrit[oa]|proponente|bolsista|monitor|usuári[oa]|classificad[oa])'
COLEGIADO = r'(?:comiss[ãa]o|comit[êe]|conselho|colegiado|c[âa]mara|grupo de trabalho|banca)'
ORGAO = r'(?:pró-?reitoria|reitoria|superintend[êe]ncia|coordena[çc][ãa]o|diretoria|departamento|unidade|divis[ãa]o|secretaria|n[úu]cleo|gabinete|universidade|uff)'

MODAL = r'dever[áa][oã]?|caber[áa][oã]?|compete|fica(?:m)? (?:obrigad|respons[áa]vel|incumbid)'

RX_OBRIG = re.compile(
    rf'\b(?:o|a|os|as)\s+({COLEGIADO}|{ORGAO}|{PESSOA})[^.;]{{0,80}}?\b({MODAL})\b([^.;]{{0,120}})',
    re.I)

# O que a obrigação PRODUZ. Sem objeto entregável, não há o que acompanhar.
ENTREGAVEL = re.compile(
    r'\b(relat[óo]rio|plano|parecer|proposta|regimento|regulamento|'
    r'presta[çc][ãa]o de contas|balan[çc]o|calend[áa]rio|edital|'
    r'programa|diretrizes|manifesta[çc][ãa]o|resultado)\b', re.I)

PERIODICO = re.compile(
    r'\b(anualmente|semestralmente|bienalmente|trimestralmente|mensalmente|'
    r'a cada \d+ ?\(?[a-zà-ú]*\)? ?(?:anos?|meses))\b', re.I)

PRAZO = re.compile(r'\b(no prazo de \d+|at[ée] o dia \d|at[ée] \d{1,2}/\d{1,2}|'
                   r'\d+ ?\(?[a-zà-ú]*\)? dias)\b', re.I)


def classe_sujeito(s):
    s = s.lower()
    if re.match(PESSOA, s):
        return 'pessoa'
    if re.match(COLEGIADO, s):
        return 'colegiado'
    return 'órgão'


def main():
    if not os.path.exists(FONTE):
        sys.exit(f'não achei {os.path.normpath(FONTE)} — exporte com '
                 'backend/db/extrair_dispositivo_catalogo.sql')

    linhas = list(csv.DictReader(io.open(FONTE, encoding='utf-8-sig')))
    atos = {}
    for r in linhas:
        atos.setdefault(r['uid'], r)
    print(f'{len(linhas)} linhas | {len(atos)} atos distintos no catálogo')
    print('  por origem:', dict(Counter(r['origem'] for r in linhas)))
    print()

    achados = []
    por_classe = Counter()
    sem_modal = 0
    for r in atos.values():
        disp = (r.get('dispositivo') or '')
        if not disp or disp == 'NULL':
            continue
        ms = list(RX_OBRIG.finditer(disp))
        if not ms:
            sem_modal += 1
            continue
        for m in ms:
            sujeito, modal, resto = m.group(1), m.group(2), m.group(3)
            c = classe_sujeito(sujeito)
            por_classe[c] += 1
            if c == 'pessoa':
                continue
            ent = ENTREGAVEL.search(resto)
            achados.append({
                'uid': r['uid'], 'origem': r['origem'], 'entidade': r['entidade'],
                'ano': r['ano'], 'sujeito': sujeito.lower(), 'classe': c,
                'entregavel': ent.group(1).lower() if ent else None,
                'periodico': bool(PERIODICO.search(resto)),
                'prazo': bool(PRAZO.search(resto)),
                'trecho': re.sub(r'\s+', ' ', m.group(0))[:190],
            })

    print('--- SUJEITO do modal, dentro do catálogo ---')
    for c, n in por_classe.most_common():
        print(f'  {c:10} {n:5}')
    print(f'  {"(atos sem modal)":10} {sem_modal:5}')

    inst = [a for a in achados]
    com_ent = [a for a in inst if a['entregavel']]
    acomp = [a for a in com_ent if a['periodico'] or a['prazo']]
    print(f'\n--- FUNIL ---')
    print(f'  modal com sujeito institucional      {len(inst):5}')
    print(f'  ... e com objeto entregável          {len(com_ent):5}')
    print(f'  ... e com periodicidade ou prazo     {len(acomp):5}   <- acompanhável')
    print(f'  atos distintos no topo do funil      {len({a["uid"] for a in acomp}):5}')

    print('\n--- por entidade (só o acompanhável) ---')
    for (org, ent), n in Counter((a['origem'], a['entidade']) for a in acomp).most_common(12):
        print(f'  {org:9} {ent:24} {n}')

    print('\n--- AMOSTRA do que é acompanhável ---')
    for a in acomp[:14]:
        marca = ('periódica' if a['periodico'] else '') + (' prazo' if a['prazo'] else '')
        print(f"\n  [{a['entidade']} · {a['ano']} · {a['entregavel']} · {marca.strip()}]")
        print(f"   {a['uid']}")
        print(f"   …{a['trecho']}…")


if __name__ == '__main__':
    main()
