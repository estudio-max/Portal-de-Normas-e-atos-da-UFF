# -*- coding: utf-8 -*-
"""Regressao da guarda de ANEXO COM FOLHA DE ROSTO (descarta_anexo_de_folha_rosto).

    python teste_folha_rosto.py

Existe porque um documento ANEXO publicado logo depois do ato que o institui
(Plano de Desenvolvimento de Unidade, Manual de Atos) abre repetindo o titulo
do ato e, em seguida, a FOLHA DE ROSTO da UFF -- a lista de dirigentes (Reitor,
Vice-Reitor, Chefe de Gabinete, Pro-Reitorias, Superintendencias). Esse segundo
bloco virava "ato" com a MESMA chave natural do ato real, e como a chave e a
mesma o importador COLAPSA os dois.

O estrago nao e ruido, e PERDA: em producao sobrou o ANEXO e o ato real sumiu.
`res-cmb-1-2022` esta no ar com a folha de rosto como ementa ("UFF INSTITUTO
BIOMEDICO PLANO DE DESENVOLVIMENTO... REITOR Antonio Claudio Lucas da Nobrega
VICE-REITOR..."), enquanto a ementa verdadeira -- "Apresenta o Plano de
Desenvolvimento da Unidade Instituto Biomedico da UFF - PDU-CMB" -- nao esta
em lugar nenhum.

COMO O DEFEITO APARECEU: um servidor que foi Superintendente de Comunicacao
Social encontrou o proprio nome como "citado" num plano de unidade que nunca o
mencionou. A folha de rosto entra no indice de busca, entao TODO ocupante de
cargo de direcao casa em qualquer busca por nome nesses atos.

MEDIDO em 2 anos completos: 2022 (245 PDFs / 6.437 atos) e 2025 (153 / 8.678)
-> 3 ocorrencias, sempre com a mesma forma: ato real primeiro, com ementa de
verdade; anexo depois, abrindo pela folha de rosto.

AS TRES CONDICOES SAO CUMULATIVAS de proposito. Sem irmao de mesma chave, nao
descarta nada -- perder o unico registro de um ato seria pior que o ruido que
a guarda evita. E se o PRIMEIRO da chave ja for folha de rosto, tambem nao
mexe: ai nao da para saber qual e o real, e este projeto ja pagou caro por
regra automatica que apagou a copia certa (curadoria de duplicatas do CEPEx,
em CLAUDE.md -- em 2 grupos a copia verdadeira NAO era a primeira).

REGRESSAO DE CORPUS (rodada em 28/07/2026, comparando extrator com e sem a
guarda): 2001 e 2005 -> 3.747 atos antes, 3.747 depois, ZERO removidos. O
boletim de 2001 e digitalizado e publica backlog real de 1998-2000; ele nao
pode perder nada, e nao perdeu.
"""
import sys
import extrair_boletim as E

# Marcadores de folha de rosto: contagem de padroes DISTINTOS, nao ocorrencias.
CASOS_CONTAGEM = [
    ("folha de rosto real (3 marcadores distintos)",
     "UFF INSTITUTO BIOMEDICO PLANO DE DESENVOLVIMENTO NITEROI - RJ. UFF "
     "REITOR Antonio Claudio Lucas da Nobrega VICE-REITOR Fabio Barboza Passos "
     "CHEFE DE GABINETE Rita Leal Paixao PRO-REITORIA DE ADMINISTRACAO Vera "
     "Lucia SUPERINTENDENCIA DE COMUNICACAO SOCIAL Joao Marcel", 4),

    # Um ato legitimo PODE citar uma superintendencia sem ser folha de rosto.
    # Por isso o corte e >= 3 marcadores DISTINTOS, nao >= 1.
    ("ato legitimo que cita uma superintendencia (1 marcador)",
     "Designa os servidores abaixo para compor a comissao de avaliacao da "
     "SUPERINTENDENCIA DE OPERACOES E MANUTENCAO, no ambito do processo "
     "23069.000000/2026-00, com efeitos a partir desta data.", 1),

    ("ato que cita duas instancias (2 marcadores, ainda abaixo do corte)",
     "Institui grupo de trabalho conjunto entre a PRO-REITORIA DE GRADUACAO e a "
     "SUPERINTENDENCIA DE TECNOLOGIA DA INFORMACAO para revisao do sistema.", 2),

    ("texto vazio", "", 0),
]

# So conta o INICIO do texto (1200 chars): a folha de rosto abre o documento.
# Uma mencao tardia a dirigentes no meio de um ato longo nao pode disparar.
CASOS_JANELA = [
    ("marcadores APOS a janela de 1200 chars nao contam",
     ("x" * 1300) + " REITOR VICE-REITOR CHEFE DE GABINETE PRO-REITORIA "
                    "SUPERINTENDENCIA", 0),
]


def ato(tipo, sigla, numero, ano, corpo, pagina=""):
    return {"tipo": tipo, "sigla": sigla, "numero": numero, "ano": ano,
            "corpo_busca": corpo, "pagina": pagina}


MASTRO = ("PLANO DE DESENVOLVIMENTO UFF REITOR Fulano VICE-REITOR Beltrano "
          "CHEFE DE GABINETE Sicrano PRO-REITORIA DE ADMINISTRACAO Zeca "
          "SUPERINTENDENCIA DE COMUNICACAO SOCIAL Joao")
REAL = "Apresenta o Plano de Desenvolvimento da Unidade. RESOLVE: Art. 1o ..."

CASOS_DESCARTE = [
    ("caso real: ato real + anexo com folha de rosto -> fica so o ato real",
     [ato("RESOLUCAO", "CMB", "01", "2022", REAL, "39"),
      ato("RESOLUCAO", "CMB", "01", "2022", MASTRO, "41")],
     1, "39"),

    # Sem irmao, nao descarta: perder o unico registro e pior que o ruido.
    ("anexo SOZINHO (sem irmao de mesma chave) -> nao descarta",
     [ato("RESOLUCAO", "CMB", "01", "2022", MASTRO, "41")],
     1, "41"),

    # Se o primeiro ja e folha de rosto, nao da pra saber qual e o real.
    ("primeiro ja e folha de rosto -> nao mexe (indecidivel)",
     [ato("RESOLUCAO", "CMB", "01", "2022", MASTRO, "41"),
      ato("RESOLUCAO", "CMB", "01", "2022", MASTRO, "42")],
     2, "41"),

    ("chaves DIFERENTES nao interagem",
     [ato("RESOLUCAO", "CMB", "01", "2022", REAL, "39"),
      ato("RESOLUCAO", "CMB", "02", "2022", MASTRO, "50")],
     2, "39"),

    ("dois atos legitimos de mesma chave (republicacao) -> nao descarta",
     [ato("PORTARIA", "GAR", "10", "2022", REAL, "3"),
      ato("PORTARIA", "GAR", "10", "2022", REAL, "8")],
     2, "3"),
]


def main():
    falhas = 0
    print("-- contagem de marcadores de folha de rosto --")
    for nome, texto, esperado in CASOS_CONTAGEM + CASOS_JANELA:
        r = E.folha_de_rosto(texto)
        ok = r == esperado
        falhas += not ok
        print(f"  {'OK  ' if ok else 'FALHA'} {nome:58} {r} (esperado {esperado})")

    print("\n-- descarte do anexo --")
    for nome, atos, n_esperado, pg_primeira in CASOS_DESCARTE:
        r = E.descarta_anexo_de_folha_rosto(atos)
        ok = len(r) == n_esperado and (not r or r[0]["pagina"] == pg_primeira)
        falhas += not ok
        print(f"  {'OK  ' if ok else 'FALHA'} {nome:58} sobrou {len(r)}"
              f" (esperado {n_esperado})")

    print()
    print("TODOS OK" if not falhas else f"{falhas} FALHA(S)")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
