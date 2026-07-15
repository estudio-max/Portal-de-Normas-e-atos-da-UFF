# -*- coding: utf-8 -*-
"""Regressao da captura de CARGO DE DIRECAO/ASSESSORAMENTO em extrai_funcoes().

    python teste_funcoes_cd.py

Existe porque a whitelist de cargos e o verbo do dispositivo sao duas listas
faceis de deixar incompletas, e o erro e silencioso: a funcao simplesmente nao
aparece, ou aparece invertida.

Motivador: a Portaria 108/2022 nomeou um servidor Assessor do Gabinete do
Reitor (CD-4) e nao gerava linha nenhuma — 'Assessor' nao estava na whitelist.
Isso importa para o Decreto 13.048/2026 (RSC do PCCTAE), cujo Anexo V pontua
'exercicio de funcao no cargo de direcao OU DE ASSESSORAMENTO institucional'.

Os negativos sao os que doem:
  - cargo EFETIVO ('cargo de Professor do Magisterio Superior') nao pode virar
    funcao. E por isso que professor/assistente/tecnico/secretario ficam FORA
    da whitelist, mesmo casando o gatilho: sao o emprego da pessoa, nao posicao
    de direcao. 'secretario' solto traria 60 eliminacoes de concurso publico.
  - 'dispensar ... em virtude de sua nomeacao para diretor do Centro' e uma
    DISPENSA. O substantivo 'nomeacao' explica o motivo; o dispositivo e
    'dispensar'. Casar o substantivo invertia 34 dispensas reais em designacoes
    (medido no corpus). Classifique pelo dispositivo, nao por mencao.
"""
import sys
import extrair_boletim as E

CASOS = [
    # (nome, texto, [(acao, cargo, siape), ...] esperado)
    ("nomeacao em cargo de direcao (Portaria 108/2022, real)",
     "PORTARIA No 108 de 26 de janeiro de 2022. O REITOR da UNIVERSIDADE FEDERAL FLUMINENSE, no uso "
     "de suas atribuicoes, tendo em vista a Lei no 9.640 de 25 de maio de 1998 e o que consta do "
     "Processo no 23069.170802/2021-20, resolve: Art.1o- Nomear JOAO MARCEL FANARA CORREA, Operador "
     "de Radio Telecomunicacoes, codigo 701.456, Matricula SIAPE no 1076836, para exercer o cargo de "
     "direcao de Assessor do Gabinete do Reitor - Codigo CD-4.",
     [("designar", "Assessor", "1076836")]),

    ("exoneracao do mesmo cargo (Portaria 106/2022, real)",
     "PORTARIA No 106 de 26 de janeiro de 2022. O REITOR resolve: Exonerar JOAO MARCEL FANARA CORREA, "
     "Matricula SIAPE no 1076836, do cargo de direcao de Assessor do Gabinete do Reitor - Codigo CD-4.",
     [("dispensar", "Assessor", "1076836")]),

    # O caso que o verbo faltando quebrava: sem 'nomea' em _VERBO_FUNC, a janela
    # de 300 chars achava o 'Exonerar' do Art. 1o e o NOMEADO virava dispensado.
    ("exonera um E nomeia outro no mesmo ato",
     "O REITOR resolve: Art. 1o - Exonerar MARIA DA SILVA, Matricula SIAPE no 1111111, do cargo de "
     "direcao de Assessor do Gabinete do Reitor - Codigo CD-4. Art. 2o - Nomear PEDRO SOUZA, "
     "Matricula SIAPE no 2222222, para exercer o cargo de direcao de Assessor do Gabinete do "
     "Reitor - Codigo CD-4.",
     [("dispensar", "Assessor", "1111111"), ("designar", "Assessor", "2222222")]),

    ("Prefeito Universitario",
     "O REITOR resolve: Nomear ANTONIO PEREIRA, Matricula SIAPE no 5555555, para exercer o cargo de "
     "direcao de Prefeito do Campus da Praia Vermelha - Codigo CD-3.",
     [("designar", "Prefeito", "5555555")]),

    ("chefia comum: nao pode regredir",
     "O Diretor resolve: Designar CARLOS LIMA, Matricula SIAPE no 3333333, para a funcao de Chefe do "
     "Departamento de Enfermagem, com mandato de 02 (dois) anos.",
     [("designar", "Chefe", "3333333")]),

    # ---- negativos ----
    ("NEGATIVO: cargo efetivo nao e funcao de direcao",
     "O REITOR resolve: Nomear ANA COSTA, Matricula SIAPE no 4444444, para exercer o cargo de "
     "Professor do Magisterio Superior, em virtude de concurso publico.",
     []),

    ("NEGATIVO: secretario executivo e cargo efetivo (eliminacao em concurso)",
     "Torna sem efeito a convocacao da candidata, inscrita sob o no 00039-7, Matricula SIAPE no "
     "6666666, para o cargo de secretario executivo, por nao apresentar documentacao que comprove "
     "os requisitos.",
     []),

    ("NEGATIVO: 'dispensar ... em virtude de sua nomeacao' e DISPENSA",
     "O REITOR resolve: 1- dispensar, em virtude de sua nomeacao para diretor do Centro de Ciencias "
     "Medicas, a partir de 02 de janeiro de 2007, o professor JOSE ALVES, Matricula SIAPE no 7777777, "
     "da funcao de Chefe do Departamento de Patologia.",
     [("dispensar", "Chefe", "7777777")]),
]


def main():
    falhas = 0
    for nome, texto, esperado in CASOS:
        obtido = sorted((f["acao"], f["cargo"], f["siape"]) for f in E.extrai_funcoes(texto, "2022-01-26"))
        if obtido != sorted(esperado):
            falhas += 1
            print("FALHOU:", nome)
            print("   esperado:", sorted(esperado))
            print("   obtido  :", obtido)
        else:
            print("ok:", nome)
    print()
    print("%d/%d casos ok" % (len(CASOS) - falhas, len(CASOS)))
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
