# -*- coding: utf-8 -*-
"""Regressao da data do boletim: a capa mente, o cabecalho interno tambem.

Fixa os 16 casos de divergencia de ANO achados varrendo os 5.797 PDFs do
acervo, mais dois controles. Roda contra os PDFs de verdade -- se a pasta
`dados/boletins` nao estiver disponivel, o caso e pulado com aviso, nao falha.

Contexto em docs/GUIA-EXTRACAO-BS.md, secao "A capa mente sobre o ano".

    python tools/teste_data_boletim.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extrair_boletim as eb  # noqa: E402

try:
    import fitz
except ImportError:
    print("PyMuPDF ausente; nada a fazer."); sys.exit(0)

BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "..", "dados", "boletins")

# (pasta, arquivo, ano_esperado_em_bs_data, motivo)
CASOS = [
    # --- CORRIGE: cabecalho interno e nome do arquivo concordam contra a capa.
    ("2001", "037-2001.pdf", "2001", "capa 2000; interno e arquivo dizem 2001"),
    ("2015", "043-2015.pdf", "2015", "capa 2014; interno e arquivo dizem 2015"),
    ("2017", "050-2017.pdf", "2017", "capa com modelo de 2007 (o defeito relatado)"),
    ("2017", "051-2017.pdf", "2017", "capa com modelo de 2007"),
    ("2017", "052-2017.pdf", "2017", "capa com modelo de 2007"),
    ("2017", "053-2017.pdf", "2017", "capa com modelo de 2007"),
    ("2017", "054-2017.pdf", "2017", "capa com modelo de 2007"),
    ("2017", "056-2017.pdf", "2017", "capa com modelo de 2007"),

    # --- NAO MEXE: aqui e a CAPA que bate com o arquivo; o interno e que erra.
    # Sem a regra das duas testemunhas, estes puxariam o ano PARA TRAS --
    # criando exatamente o defeito que este modulo conserta.
    ("2013", "021-2013.pdf", "2013", "interno diz 2012; capa e arquivo dizem 2013"),
    ("2014", "146-2014.pdf", "2014", "interno diz 2013"),
    ("2015", "057-2015.pdf", "2015", "interno diz 2014"),
    ("2017", "061-2017.pdf", "2017", "interno diz 2016"),
    ("2018", "062-18.pdf", "2018", "interno diz 2012"),
    ("2018", "129-18.pdf", "2018", "interno diz 2014"),
    ("2021", "33-21.pdf", "2021", "interno diz 2020"),
    ("2024", "25-24.pdf", "2024", "interno diz 2023"),

    # --- CONTROLES
    # Boletim digitalizado sem data nas paginas internas. Tem que ficar em 1998:
    # empurrar para 2001 faria citacao_recortada (gap >= 3 anos) descartar o
    # backlog real de 1998-2000. Criterio historico: "2001 perde ZERO".
    ("2001", "027-2001.pdf", "1998", "sem data interna; backlog real de 1998"),
    # Edicao especial com data no nome: o parser do ano nao pode ler "-24.pdf".
    ("2010", "especial_2010-05-24.pdf", "2010", "nome com data, nao numero-ano"),
]

# (nome_do_arquivo, pasta, ano_esperado) -- so o parser do nome, sem PDF.
CASOS_NOME = [
    ("051-2017.pdf", "2017", 2017),
    ("062-18.pdf", "2018", 2018),
    ("33-21.pdf", "2021", 2021),
    ("25-24.pdf", "2024", 2024),
    ("especial_2010-05-24.pdf", "2010", 2010),   # cai para a pasta
    ("027-2001.pdf", "2001", 2001),
]


def main():
    ok = falhou = pulado = 0

    for nome, pasta, esperado in CASOS_NOME:
        got = eb._ano_do_arquivo(os.path.join("x", pasta, nome))
        if got == esperado:
            ok += 1
            print("ok: nome %s -> %s" % (nome, got))
        else:
            falhou += 1
            print("FALHOU: nome %s -> %s (esperado %s)" % (nome, got, esperado))

    for pasta, arq, esperado, motivo in CASOS:
        caminho = os.path.join(BASE, pasta, arq)
        if not os.path.exists(caminho):
            pulado += 1
            print("pulado (PDF ausente): %s" % arq)
            continue
        doc = fitz.open(caminho)
        paginas = [doc[i].get_text() for i in range(doc.page_count)]
        doc.close()
        bs_data = eb.metadados_bs(paginas, caminho)[1]
        if bs_data[-4:] == esperado:
            ok += 1
            print("ok: %s -> %s (%s)" % (arq, bs_data, motivo))
        else:
            falhou += 1
            print("FALHOU: %s -> %s, esperado ano %s (%s)" % (arq, bs_data, esperado, motivo))

    print("\n%d/%d casos ok%s" % (ok, ok + falhou,
                                  ", %d pulados" % pulado if pulado else ""))
    return 1 if falhou else 0


if __name__ == "__main__":
    sys.exit(main())
