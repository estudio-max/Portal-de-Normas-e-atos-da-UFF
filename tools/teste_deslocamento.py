# -*- coding: utf-8 -*-
"""Regressao da classificacao de REDISTRIBUICAO (Entrada/Saida) em
classifica_redistribuicao() / extrai_deslocamento().

    python teste_deslocamento.py

Existe porque o regex antigo so reconhecia Entrada quando o texto citava
"Universidade Federal Fluminense" por extenso (ou a frase exata "para o desta
universidade") a ate 90 caracteres da palavra "redistribu" — mas a frase mais
comum no corpus usa a anafora "desta Universidade" com um departamento no
meio ("...para o Departamento de Direito Publico, desta Universidade"), ou
nem menciona destino nenhum (DTS do DAP: so cita a origem, o destino e
implicito). Medido no corpus 2001-2026: 1.029 atos mencionavam redistribuicao
de forma nao-excluida: o regex antigo classificava so 252 como Entrada; a
versao nova classifica 578 (504 Entrada + 74 Saida). Achado ao investigar por
que o grafico Insights "Remocao x Redistribuicao por ano" nao mostrava quase
nenhuma entrada, mesmo em anos recentes com casos reais.

Os negativos sao os que doem:
  - "vaga ... redistribuida pela portaria MEC no X" fala da PROVENIENCIA da
    vaga que este ato preenche, nao de um deslocamento do servidor DESTE ato
    (padrao maciço em 2009-2015: centenas de nomeacoes citam isso).
  - "redistribuicao de espaco fisico/area" e patrimonio, nao servidor.
  - "Ministerio da Educacao" no rodape padrao de TODO ato nao pode contar como
    instituicao externa (a UFF tambem e MEC) — sem essa excecao, o rodape
    dentro da janela de busca do destino derrubava casos reais (medido: 9
    atos de 2022-2024 viravam falso-negativo).
"""
import sys
import extrair_boletim as E

CASOS = [
    # (nome, texto, direcao_esperada_ou_None)
    ("Portaria de lotacao classica: 'para o desta universidade' (2010, real)",
     "otar sergio garcia magalhães, professor de 3º grau, matrícula siape nº 0379684, redistribuído "
     "do quadro permanente da universidade federal de santa maria, para o desta universidade, no "
     "departamento de física do instituto de física. publique-se, registre-se e cumpra-se.",
     "Entrada"),

    ("Resolucao CEPEX com anafora 'desta Universidade' e departamento no meio (2025, real)",
     "dispõe sobre a solicitação de redistribuição do docente alexandre pinto mendes, da universidade "
     "federal rural do rio de janeiro para o departamento de direito público, desta universidade. o "
     "conselho de ensino, pesquisa e extensão da universidade federal fluminense, no uso de suas "
     "atribuições, resolve autorizar a redistribuição.",
     "Entrada"),

    ("Decisao do CEPEX sem 'desta universidade', so nomeia o departamento (2008, real)",
     "decide: aprovar a redistribuição do docente fábio protti, da universidade federal do rio de "
     "janeiro para o departamento de ciência da computação/uff. sala das reuniões, 05 de novembro de "
     "2008.",
     "Entrada"),

    ("DTS do DAP: so cita origem, sem 'para' (destino implicito = UFF) (2001, real)",
     "redistribuida da universidade federal do rio de janeiro. rita de cássia borges de campos "
     "quintiere diretora do departamento de pessoal",
     "Entrada"),

    ("DTS do DAP com ministerio como origem (2001, real)",
     "redistribuida do ministério da saúde. rita de cássia borges de campos quintiere diretora do "
     "departamento de pessoal",
     "Entrada"),

    ("Decisao do CEPEX: Saida para universidade externa (2016, real)",
     "erando o que mais consta no processo n.º 23069.003715/2016-09, decide aprovar a redistribuição "
     "do docente thiago da silva torres, do departamento de ciências básicas (campus nova friburgo) "
     "para a universidade federal de alagoas – ufal, tendo como contrapartida vaga de professor "
     "equivalente por vacância.",
     "Saída"),

    ("Resolucao CEPEX: Saida, origem 'desta universidade' antes do para (2026, real)",
     "dispõe sobre a solicitação de redistribuição do docente carlos alberto de jesus martinhon, "
     "departamento de ciência da computação desta universidade para a universidade federal da "
     "paraíba. o conselho de ensino, pesquisa e extensão da universidade federal fluminense, no uso "
     "de suas atribuições.",
     "Saída"),

    ("Portaria 68.386/2022 (real): 'redistribuicao para universidade federal fluminense'",
     "matrícula siape 1062172, considerando a redistribuição para universidade federal fluminense. "
     "publique-se, registre-se e cumpra-se antonio claudio lucas da nobrega reitor ministério da "
     "educação universidade federal fluminense",
     "Entrada"),

    # ---- negativos ----
    ("NEGATIVO: proveniencia de vaga do MEC, nao deslocamento deste ato (2010, real)",
     "ime de 20 (vinte) horas semanais, em vaga do banco de professores equivalentes, redistribuída "
     "pela portaria mec nº 991/08, publicada no d.o.u. de 12/08/2008, código de vaga nº 0848578. "
     "publique-se, registre-se e cumpra-se.",
     None),

    ("NEGATIVO: redistribuicao de espaco fisico (2008, real)",
     "composição de comissão para reavaliação e redistribuição dos espaços físicos referentes ao "
     "primeiro e segundo pavimento do prédio edil patury monteiro.",
     None),

    ("NEGATIVO: rodape 'Ministerio da Educacao' nao conta como instituicao externa (2022, real)",
     "matrícula siape nº 2294961, redistribuído do quadro permanente da universidade federal de "
     "minas gerais, para o desta universidade, no departamento de matemática aplicada. antonio "
     "claudio lucas da nobrega reitor ministério da educação universidade federal fluminense",
     "Entrada"),

    ("NEGATIVO: definicao normativa de redistribuicao (IN PROGEPE, 2023, real)",
     "art. 2o para os fins de que trata esta instrução normativa – i.n., entende-se por "
     "redistribuição o deslocamento de cargo de provimento efetivo, ocupado ou vago, entre os "
     "quadros de pessoal das instituições federais de ensino.",
     None),

    ("NEGATIVO: redistribuicao de cargos de direcao/FG (MEC, generico)",
     "estabelece critérios para a redistribuição de cargos de direção e funções gratificadas do "
     "ministério da educação no âmbito das ifes.",
     None),
]


def main():
    falhas = 0
    for nome, texto, esperado in CASOS:
        d = E.extrai_deslocamento(texto)
        obtido = d["direcao"] if d and d.get("tipo") == "Redistribuição" else None
        if obtido != esperado:
            falhas += 1
            print("FALHOU:", nome)
            print("   esperado:", esperado)
            print("   obtido  :", obtido)
        else:
            print("ok:", nome)
    print()
    print("%d/%d casos ok" % (len(CASOS) - falhas, len(CASOS)))
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
