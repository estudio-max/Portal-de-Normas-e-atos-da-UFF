# -*- coding: utf-8 -*-
"""Regressao de extrai_revalidacao() — revalidacao/reconhecimento de diploma
obtido no exterior.

    python teste_revalidacao.py

Existe por tres motivos, nesta ordem de gravidade:

1. PRIVACIDADE. O painel e agregado por decisao do mantenedor (16/08/2026):
   nao expoe quem pediu revalidacao, porque sao pessoas privadas e um
   indeferimento nominal e diferente de um PDF de 177 paginas. O ultimo teste
   deste arquivo trava isso: nenhum campo da saida pode conter o nome. Se
   alguem "melhorar" a regex e capturar a pessoa sem querer, o teste reprova.

2. SAO DUAS FAMILIAS, nao uma. Graduacao ("Revalidacao do Diploma", junto a
   INST, PAIS) e pos-graduacao ("Reconhecimento do Titulo", na INST (CIDADE,
   PAIS), como equivalente ao de NIVEL) tem redacoes incompativeis. Um padrao
   so parecia funcionar e devolvia ZERO para a pos inteira -- medido.

3. O NOME DO PAIS VARIA, e a fonte erra. "EUA" e "Estados Unidos da America"
   sao o mesmo pais e viravam duas fatias no grafico; "Austria" apareceu com
   acento trocado no proprio boletim.

Casos extraidos de boletins reais (BS 130/2025, 26/2026, 72/2026).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extrair_boletim import extrai_revalidacao  # noqa: E402

GRAD_VENEZUELA = """Art. 1º - Deferir a solicitação de Revalidação do Diploma, nível
Graduação de Ingeniero Agrícola, obtido por Juan Vicente Liendro Moncada,
junto a Universidad de los Andes, Venezuela, nos termos estabelecidos na
Resolução 3.790/2024, deste Conselho."""

GRAD_ARGENTINA = """Art. 1º - Deferir a solicitação de Revalidação do Diploma, nível
Graduação de Ingeniero Electromecánico, obtido por Guillermo Santiago
Penalva, junto a Universidad Nacional del Centro de la Província de Buenos
Aires, Argentina, nos termos estabelecidos na Resolução 3.790/2024, deste
Conselho."""

GRAD_INDEFERIDO = """Art. 1º - Indeferir a solicitação de Revalidação do Diploma, nível
Graduação de Medicina, obtido por Maria da Silva Santos, junto a Universidad
de Ciencias Médicas de Villa Clara, Cuba, nos termos estabelecidos na
Resolução 3.790/2024, deste Conselho."""

POS_ALEMANHA = """Art. 1º - Indeferir a solicitação de Reconhecimento do Título de
Doktor der Philosophie (Dr. phil.), obtido por Rodrigo Gomes Ferrari Cesar, na
Universität zu Köln (Colônia, Alemanha), como equivalente ao de Doutorado em
Filosofia, nos termos estabelecidos na Resolução n.º 583/2017, deste Conselho."""

POS_MESTRADO = """Art. 1º - Deferir a solicitação de Reconhecimento do Título de
Master of Science - Communication, obtido por Pedro Mendonça Renaux Wanderley,
na University of Amsterdam (Amsterdã, Holanda), como equivalente ao de Mestrado
em Comunicação, nos termos estabelecidos na Resolução n.º 583/2017."""

LEGADO_INDEFERIMENTO = """decide manifestar-se pelo indeferimento do pedido de
revalidação do diploma de tatiane costa dos santos, em nível de graduação em
bioquímica, realizado na universidade de suffolk, boston, estados unidos da
américa."""

LEGADO_GERUNDIO = """decide 1-homologar o parecer da comissão de equivalência
do colegiado do curso de medicina, indeferindo a solicitação de revalidação de
diploma de tito victor martinez carrasco, em nível de graduação em medicina,
realizado na universidad mayor real y pontifícia de san francisco xavier de
chuquisaca."""

LEGADO_TITULO = """decide homologar a revalidação do título de “doctor of
philosophy in computer science”, obtido por bianca zadrozny, junto a university
of california, san diego, estados unidos da américa, como doutor em ciência da
computação, nos termos estabelecidos na resolução 97/1996, deste conselho."""

REGIMENTO_REVALIDACAO = """cabe ao colegiado aprovar a comissão de validação e
revalidação de diplomas, indicados pela coordenação do programa, bem como os
respectivos pareceres; homologar os relatórios das comissões examinadoras;
julgar as decisões do coordenador do programa a respeito de recursos."""

RECURSO_INDEFERIMENTO = """resolve: art. 1º conhecer o pedido de recurso
relativo ao indeferimento do pedido de reconhecimento de diploma de
pós-graduação obtido no exterior, e dar-lhe provimento."""

# --- casos ----------------------------------------------------------------
# (rotulo, texto, esperado | None)
CASOS = [
    ("graduacao deferida, Venezuela", GRAD_VENEZUELA, {
        "via": "Graduação", "decisao": "Deferido", "nivel": "Graduação",
        "curso": "Ingeniero Agrícola",
        "instituicao": "Universidad de los Andes", "pais": "Venezuela"}),

    ("graduacao com virgula no nome da instituicao", GRAD_ARGENTINA, {
        "via": "Graduação", "decisao": "Deferido", "nivel": "Graduação",
        "curso": "Ingeniero Electromecánico",
        "instituicao": "Universidad Nacional del Centro de la Província de Buenos Aires",
        "pais": "Argentina"}),

    ("graduacao INDEFERIDA", GRAD_INDEFERIDO, {
        "via": "Graduação", "decisao": "Indeferido", "nivel": "Graduação",
        "curso": "Medicina",
        "instituicao": "Universidad de Ciencias Médicas de Villa Clara",
        "pais": "Cuba"}),

    ("pos-graduacao, doutorado, pais entre parenteses", POS_ALEMANHA, {
        "via": "Pós-graduação", "decisao": "Indeferido", "nivel": "Doutorado",
        "curso": "Doktor der Philosophie (Dr. phil.)",
        "instituicao": "Universität zu Köln", "pais": "Alemanha"}),

    ("pos-graduacao, mestrado, 'Holanda' canonizada", POS_MESTRADO, {
        "via": "Pós-graduação", "decisao": "Deferido", "nivel": "Mestrado",
        "curso": "Master of Science - Communication",
        "instituicao": "University of Amsterdam", "pais": "Países Baixos"}),

    # --- canonizacao de pais ---
    ("EUA vira Estados Unidos",
     GRAD_VENEZUELA.replace("Venezuela", "EUA"), {"pais": "Estados Unidos"}),
    ("'Estados Unidos da América' vira Estados Unidos",
     GRAD_VENEZUELA.replace("Venezuela", "Estados Unidos da América"),
     {"pais": "Estados Unidos"}),
    ("erro de digitacao da fonte: 'Aústria'",
     GRAD_VENEZUELA.replace("Venezuela", "Aústria"), {"pais": "Áustria"}),
    ("'Reino Unido da Grã Bretanha' encurta",
     GRAD_VENEZUELA.replace("Venezuela", "Reino Unido da Grã Bretanha"),
     {"pais": "Reino Unido"}),

    # --- armadilhas: NAO pode extrair ---
    ("oracao relativa descreve ato CITADO, nao este",
     "Art. 1º - Retificar a Resolução CEPEx 4.100/2024, que Deferir a solicitação "
     "de Revalidação do Diploma, nível Graduação de Medicina, obtido por Fulano "
     "de Tal, junto a Universidad X, Cuba, nos termos da norma.", None),

    ("ato que so MENCIONA revalidacao nao entra",
     "Art. 1º - Designar os docentes abaixo para compor o Comitê Ad hoc de "
     "Revalidação de Diplomas do Curso de Graduação em Engenharia Civil.", None),

    ("ato sem nada a ver",
     "Art. 1º - Conceder aposentadoria voluntária a Fulano de Tal, matrícula "
     "SIAPE 1234567, nos termos do art. 40 da Constituição.", None),

    ("legado: indeferimento substantivado, ato 6095", LEGADO_INDEFERIMENTO, {
        "via": "Graduação", "decisao": "Indeferido", "nivel": "Graduação",
        "curso": "bioquímica", "instituicao": "universidade de suffolk, boston",
        "pais": "Estados Unidos"}),

    ("legado: indeferindo em parecer homologado, ato 8910", LEGADO_GERUNDIO, {
        "via": "Graduação", "decisao": "Indeferido", "nivel": "Graduação",
        "curso": "medicina",
        "instituicao": "universidad mayor real y pontifícia de san francisco xavier de chuquisaca",
        "pais": ""}),

    ("legado: revalidacao de titulo como doutor, ato 10848", LEGADO_TITULO, {
        "via": "Pós-graduação", "decisao": "Deferido", "nivel": "Doutorado",
        "curso": "doctor of philosophy in computer science",
        "instituicao": "university of california, san diego",
        "pais": "Estados Unidos"}),

    ("regimento apenas define competencia sobre revalidacao",
     REGIMENTO_REVALIDACAO, None),

    ("recurso menciona indeferimento anterior, mas decide dar provimento",
     RECURSO_INDEFERIMENTO, None),
]

falhas = 0
for rotulo, texto, esperado in CASOS:
    obtido = extrai_revalidacao(texto)
    if esperado is None:
        if obtido is not None:
            falhas += 1
            print(f"FALHA: {rotulo}\n   esperava None, veio {obtido}")
        else:
            print(f"ok   : {rotulo}")
        continue
    if obtido is None:
        falhas += 1
        print(f"FALHA: {rotulo}\n   esperava {esperado}, veio None")
        continue
    ruim = {k: (v, obtido.get(k)) for k, v in esperado.items() if obtido.get(k) != v}
    if ruim:
        falhas += 1
        print(f"FALHA: {rotulo}")
        for k, (esp, got) in ruim.items():
            print(f"   {k}: esperava {esp!r}, veio {got!r}")
    else:
        print(f"ok   : {rotulo}")

# --- invariante de PRIVACIDADE -------------------------------------------
# Vale mais que qualquer caso acima: nenhum campo da saida pode conter o nome
# da pessoa. E o que sustenta a decisao de o painel ser agregado.
NOMES = [
    (GRAD_VENEZUELA, ["Juan", "Vicente", "Liendro", "Moncada"]),
    (GRAD_ARGENTINA, ["Guillermo", "Santiago", "Penalva"]),
    (GRAD_INDEFERIDO, ["Maria", "Silva", "Santos"]),
    (POS_ALEMANHA, ["Rodrigo", "Gomes", "Ferrari", "Cesar"]),
    (POS_MESTRADO, ["Pedro", "Mendonça", "Renaux", "Wanderley"]),
    (LEGADO_INDEFERIMENTO, ["tatiane", "costa", "santos"]),
    (LEGADO_GERUNDIO, ["tito", "victor", "martinez", "carrasco"]),
    (LEGADO_TITULO, ["bianca", "zadrozny"]),
]
for texto, pedacos in NOMES:
    r = extrai_revalidacao(texto) or {}
    tudo = " | ".join(str(v) for v in r.values())
    vazou = [p for p in pedacos if p.lower() in tudo.lower()]
    if vazou:
        falhas += 1
        print(f"FALHA: nome da pessoa vazou na saida: {vazou}\n   -> {tudo}")
if not any(p.lower() in " ".join(str(v) for v in (extrai_revalidacao(t) or {}).values()).lower()
           for t, ps in NOMES for p in ps):
    print("ok   : nenhum nome de pessoa aparece na saida (invariante de privacidade)")

print(f"\n{len(CASOS)} caso(s), {falhas} falha(s).")
sys.exit(1 if falhas else 0)
