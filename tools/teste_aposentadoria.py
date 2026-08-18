# -*- coding: utf-8 -*-
"""Regressão da aposentadoria: as redações que o Boletim usa para o mesmo fato.

Nasceu em 17/08/2026 de uma pergunta do mantenedor — "o gráfico de aposentadoria
está sendo atualizado?" — feita logo depois de descobrirmos que a revalidação
publicava taxa falsa por falta de UM VERBO no padrão. A intuição estava certa:
faltava o mesmo aqui.

`Aposentar por invalidez FULANO` não era visto por padrão nenhum, e o painel
publicava `invalidez = 0` em TODOS os anos da série — o zero absoluto que
docs/VIES-DE-EXTRACAO.md manda desconfiar. Medido no acervo local: 64 atos.

Cada caso aqui é uma REDAÇÃO, não um exemplo. Redação nova do Boletim para o
mesmo fato entra nesta lista e em docs/EQUIVALENCIAS-DE-TERMOS.md.
"""
import sys

sys.path.insert(0, 'tools')
from extrair_boletim import extrai_aposentadoria  # noqa: E402

CASOS = [
    # (rótulo, texto, tipo esperado ou None para "não é aposentadoria")
    ("conceder aposentadoria voluntária",
     "RESOLVE: Conceder aposentadoria voluntária a FULANO DE TAL, matrícula "
     "SIAPE nº 1234567, no cargo de Professor, nos termos do artigo 40.",
     "Voluntária"),

    ("aposentar por invalidez (Art. 1º)",
     "RESOLVE: Art. 1º Aposentar por invalidez IVAN MANSUR GUIMARAES, matrícula "
     "SIAPE nº 2185936, ocupante do cargo Técnico de Laboratório.",
     "Invalidez"),

    ("aposentar compulsoriamente",
     "RESOLVE: Art. 1º Aposentar compulsoriamente FULANA DE TAL, matrícula SIAPE "
     "nº 307226, ocupante do cargo Enfermeiro.",
     "Compulsória"),

    # O INCISO do art. 40 § 1º classifica sozinho: I invalidez, II compulsória,
    # III voluntária. Escrevi este caso esperando "Indefinida" e o extrator
    # devolveu "Voluntária" — ele estava certo, e a expectativa é que estava
    # errada. Fica como caso porque essa inferência é fácil de quebrar sem
    # ninguém notar: ela é a única fonte do tipo quando o ato não o escreve.
    ("declarar aposentado com inciso III (voluntária pelo dispositivo legal)",
     "RESOLVE: Declarar aposentado o servidor FULANO DE TAL, matrícula SIAPE "
     "nº 1122334, com fundamento no artigo 40, § 1º, inciso III.",
     "Voluntária"),

    ("declarar aposentado sem dizer o tipo",
     "RESOLVE: Declarar aposentado o servidor FULANO DE TAL, matrícula SIAPE "
     "nº 1122334, a partir de 1º de março.",
     "Indefinida"),

    # ⚠️ A GUARDA. Sem o qualificador obrigatório depois do verbo, esta cláusula
    # de REGIMENTO viraria um ato de aposentadoria. Ela é real: apareceu na
    # varredura de 2019 junto com os casos legítimos.
    ("cláusula de regimento não é ato de aposentadoria",
     "Art. 40 - O docente desta Universidade, uma vez credenciado para lecionar "
     "nos Cursos de Pós-Graduação, ao se aposentar poderá, ouvido o Colegiado do "
     "Curso, orientar dissertações, sem ônus para a Universidade.",
     None),

    # Classificar pelo DISPOSITIVO, não por menção — a regra do CLAUDE.md.
    ("retificação que CITA concessão anterior não concede",
     "RESOLVE: Retificar a Portaria nº 12.345, de 03/04/2019, que concedeu "
     "aposentadoria voluntária a FULANO DE TAL, matrícula SIAPE nº 1234567.",
     None),
]

falhas = 0
for rotulo, texto, esperado in CASOS:
    achado = extrai_aposentadoria(texto)
    tipo = achado.get("tipo") if achado else None
    if esperado is None:
        if achado:
            falhas += 1
            print(f"FALHA: '{rotulo}' NAO devia virar aposentadoria, veio {tipo!r}")
        else:
            print(f"ok   : {rotulo}")
        continue
    if not achado:
        falhas += 1
        print(f"FALHA: '{rotulo}' nao foi reconhecido (esperado {esperado!r})")
    elif tipo != esperado:
        falhas += 1
        print(f"FALHA: '{rotulo}' deu {tipo!r}, esperado {esperado!r}")
    else:
        print(f"ok   : {rotulo}")

print(f"\n{len(CASOS)} caso(s), {falhas} falha(s).")
sys.exit(1 if falhas else 0)
