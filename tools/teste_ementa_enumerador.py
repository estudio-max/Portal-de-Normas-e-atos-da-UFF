# -*- coding: utf-8 -*-
r"""Regressão do enumerador ÓRFÃO na ementa (extrai_ementa / sintetiza_ementa).

    python tools/teste_ementa_enumerador.py

Nasceu em 14/09/2026 de uma medição em produção: 67 atos do tipo "Resolução ad
referendum" tinham como ementa o literal "1." — 66 de 2021 e 1 de 2022, todos
com `ementaInferida=false`, ou seja, o portal exibia "1." COMO SE fosse a
ementa oficial do boletim. Reproduzido local nos 12 boletins que os contêm:
exatamente os mesmos 67.

A causa NÃO é o tipo "AD REFERENDUM", e sim a limpeza final do `extrai_ementa()`.
Essas resoluções são o único formato do acervo que abre direto na lista numerada
de considerandos, sem bloco de ementa:

    RESOLUÇÃO AD REFERENDUM CEPEx/UFF Nº 011, DE 21 DE JUNHO DE 2021
    1. Considerando o constante do processo nº 23069.156017/2021-64;

O corte do dispositivo casa em `\bConsiderando\b`, que vem IMEDIATAMENTE depois
do "1." — sobra a string "1." e mais nada. A regex que tira enumerador da frente
exigia espaço DEPOIS da pontuação (`\s+`), então não casava no fim da string e o
"1." sobrevivia como ementa. Com `(?:\s+|$)` a string zera, o ato passa a contar
como "sem ementa formal" e `sintetiza_ementa()` assume — que é o comportamento
que o resto do acervo já tem.

Medido depois do fix: 67/67 corrigidos (66 ganham resumo do dispositivo, 1 fica
sem — ver LIMITAÇÃO abaixo) e ZERO diferença numa amostra aleatória de 60
boletins / 1.361 atos. Todo texto daqui é trecho REAL do acervo.

LIMITAÇÃO CONHECIDA, fora do escopo deste fix: a Resolução Ad Referendum CEPEx
nº 066/2021 (BS 240-21) não ganha resumo porque o CORPO dela é truncado antes do
"RESOLVE" — ela cita "PORTARIA ME Nº 14.817, DE 20 DE DEZEMBRO DE 2021" no
considerando 3, o `TITULO_RE` casa nessa citação e abre um ato fantasma ali
(`port-me-14817-2021` e `-2` existem em produção). É a família "fantasma de
citação" já documentada no CLAUDE.md, e precisa da medição própria dela.
"""
import sys

sys.path.insert(0, 'tools')
from extrair_boletim import extrai_ementa, sintetiza_ementa  # noqa: E402

# (rótulo, texto após o título — como parse_pdf o entrega, ementa esperada)
CASOS = [
    # ---- REAL: o defeito. BS 113-21, Resolução Ad Referendum CEPEx nº 011/2021.
    ("REAL ad referendum 011/2021: considerando numerado colado no título",
     " \n \n \n1. Considerando o constante do processo nº 23069.156017/2021-64; \n \n"
     "2. Considerando o atendimento da diligência, solicitada pelas Câmaras "
     "Especializadas do CEPEx, em \n09/06/2021, pela Faculdade de Educação, em "
     "14/06/2021, e parecer favorável da Relatora, em \n18/06/2021; e \n",
     ""),

    # ---- REAL: mesma armadilha, outra redação do considerando. BS 240-21.
    ("REAL ad referendum 066/2021: 'Considerando o que consta no processo'",
     " \n \n \n1. Considerando o que consta no processo nº 23069.005127/2021-69; \n \n"
     "2. Considerando os termos da Lei nº 9.093, de 12 de setembro de 1995, que "
     "dispõe sobre feriados; \n",
     ""),

    # ---- NEGATIVO REAL: ementa que COMEÇA com algarismo e não pode ser mutilada.
    # IN GAR/RET nº 28/2022 — o "2.3" é numeração de seção do próprio anexo. Se a
    # limpeza passasse a aceitar qualquer coisa depois da pontuação, viraria
    # "3 TABELA DE VAGAS".
    ("NEGATIVO REAL: IN GAR/RET 28/2022 — ementa começa em '2.3 TABELA DE VAGAS'",
     "2.3 TABELA DE VAGAS UNIDADE UORG VAGAS SAEP 1192 6 CEA/SAEP 2321 1",
     "2.3 TABELA DE VAGAS UNIDADE UORG VAGAS SAEP 1192 6 CEA/SAEP 2321 1"),

    # ---- NEGATIVO REAL: ementa formal normal, do mesmo boletim 113-21
    # (Resolução CEPEx nº 106/2021), tem de sair inteira e sem inferência.
    ("NEGATIVO REAL: ementa formal do boletim não é tocada",
     " \n \nDispõe sobre o recurso administrativo interposto por Matheus Thomaz "
     "da Silva. \n \nO CONSELHO DE ENSINO, PESQUISA E EXTENSÃO, no uso de suas "
     "atribuições, \n",
     "Dispõe sobre o recurso administrativo interposto por Matheus Thomaz da Silva."),

    # ---- Comportamento PRÉ-EXISTENTE que o fix não pode quebrar: enumerador
    # seguido de texto continua sendo tirado da frente (é a razão de a regex
    # existir). Os dois exemplos são os que o próprio extrator documenta.
    ("enumerador romano com texto depois continua sendo removido",
     "II - Designar a comissão de sindicância. \n \nO REITOR resolve \n",
     "Designar a comissão de sindicância."),

    ("enumerador arábico com texto depois continua sendo removido",
     "1. No item 3.1 do edital, onde se lê 40 horas leia-se 20 horas. \n \n"
     "O PRÓ-REITOR \n",
     "No item 3.1 do edital, onde se lê 40 horas leia-se 20 horas."),
]

# Corpo REAL da Resolução Ad Referendum CEPEx nº 011/2021 (BS 113-21): com a
# ementa zerada, é ele que precisa virar o resumo mostrado no portal.
CORPO_011 = (
    "RESOLUÇÃO AD REFERENDUM CEPEx/UFF Nº 011, DE 21 DE JUNHO DE 2021 \n"
    "1. Considerando o constante do processo nº 23069.156017/2021-64; \n"
    "2. Considerando que a apresentação da defesa será em 27/06/2021. \n"
    "R  E  S  O  L  V  E : \n"
    "Art. 1º - Homologar, ad referendum, na forma do parágrafo 1º, artigo 4º, da "
    "Resolução nº 543/2014, deste Conselho, a constituição da Comissão Especial "
    "para avaliação da docente Margareth Martins de Araújo ao acesso à Classe E "
    "(Professor Titular) da Carreira do Magistério Superior."
)


def main():
    falhas = 0
    for rotulo, texto, esperado in CASOS:
        obtido = extrai_ementa(texto)
        if obtido != esperado:
            falhas += 1
            print(f"FALHA: {rotulo}\n   esperado {esperado!r}\n   obtido   {obtido!r}")
        else:
            print(f"ok   : {rotulo}")

    # Integração: replica a decisão de parse_pdf() — ementa curta demais manda o
    # ato para a síntese do dispositivo, marcada como inferida. É o passo que
    # transforma o "1." em texto útil; sem ele o fix só trocaria lixo por vazio.
    ementa = extrai_ementa(CASOS[0][1])
    resumo, inferida = ("", False)
    if len(ementa.strip()) < 12:
        resumo, inferida = sintetiza_ementa(CORPO_011)
    ok = inferida and resumo.startswith("Homologa ad referendum")
    print("ok   :" if ok else "FALHA:",
          "integração — ementa vazia cai na síntese do dispositivo, marcada como inferida")
    if not ok:
        falhas += 1
        print(f"   resumo={resumo!r} inferida={inferida}")

    total = len(CASOS) + 1
    print(f"\n{total - falhas}/{total} caso(s) ok.")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
