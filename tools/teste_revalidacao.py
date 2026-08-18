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
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extrair_boletim import extrai_revalidacao, extrai_revalidacoes  # noqa: E402

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

# Exceção autorizada pelo mantenedor: não há contraexemplo publicado no acervo.
# Cada trecho abaixo deriva literalmente de um positivo real (#6095, #8910 e
# #10848); só é removido o cabeçalho decisório e acrescentado "que " para
# simular a oração relativa de citação que a guarda precisa recusar.
LEGADOS_CITADOS = [
    ("indeferimento substantivado", "que " + LEGADO_INDEFERIMENTO.removeprefix("decide ")),
    ("parecer homologado", "que homologar" + LEGADO_GERUNDIO.split("homologar", 1)[1]),
    ("revalidacao de titulo", "que " + LEGADO_TITULO.removeprefix("decide ")),
]

MULTIPLAS_5792 = """o conselho de ensino e pesquisa da universidade federal
fluminense, no uso de suas atribuições, através das decisões n.ºs 018 e
019/2008, pronuncia-se, em face do que dispõe a legislação em vigor, pela
homologação da revalidação do diploma, obtido por: decisão nº. 018/08. julius
césar barreto leite, diploma de “doctor of philosophy” junto à the victoria
university of manchester, institute of science and technology, departament of
eletrical engineering and electronics, inglaterra, como doutorado em ciência
da computação. (processo nº 23069.054576/07-82); e decisão nº. 019/08. orlando
gomes loques filho, diploma de “doctor of philosophy” junto à university of
london, imperial college of science and technology, inglaterra, como doutorado
em ciência da computação. (processo nº. 23069.054577/07-27). sala das reuniões,
16 de janeiro de 2008."""

BLOCO_MULTIPLAS_5792 = "pela " + MULTIPLAS_5792.split("pela", 1)[1].lstrip()
MULTIPLAS_CITADAS_5792 = "a decisão anterior, que " + BLOCO_MULTIPLAS_5792

ESPERADO_5792 = [
    {"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Doutorado",
     "curso": "doctor of philosophy",
     "instituicao": "the victoria university of manchester, institute of science and technology, departament of eletrical engineering and electronics",
     "pais": "Reino Unido"},
    {"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Doutorado",
     "curso": "doctor of philosophy",
     "instituicao": "university of london, imperial college of science and technology",
     "pais": "Reino Unido"},
]

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

CASOS += [(f"legado citado por oracao relativa: {rotulo}", texto, None)
          for rotulo, texto in LEGADOS_CITADOS]


# A redacao do DEFERIMENTO que faltava por completo. O acervo tem 511 atos
# assim entre 2010 e 2022, e nenhum padrao os via -- o painel publicava 0% de
# deferimento em anos inteiros por causa disto.
APROVAR = """DECIDE: 1- Aprovar a revalidacao do Diploma, nivel de Graduacao em
Antropologia, obtido por LUCRECIA RAQUEL GRECO, junto a Universidad de Buenos
Aires, Argentina, nos termos do processo."""

# Sem "nivel": o curso vem direto depois de "Diploma de".
SEM_NIVEL_INDEFERIDO = """DECIDE: 1- Indeferir o pedido de revalidacao do Diploma
de Licenciado em Informatica de Gestao, obtido por EVANDRO SILVA GUIMARAES,
junto ao Instituto Politecnico de Coimbra, Portugal, nos termos do processo."""

CASOS += [
    ("aprovar a revalidacao (deferimento do CEPEx)", APROVAR,
     {"via": "Graduação", "decisao": "Deferido"}),
    ("indeferimento sem nivel declarado", SEM_NIVEL_INDEFERIDO,
     {"via": "Graduação", "decisao": "Indeferido"}),
]

# 18/08/2026: usuario reportou pos-graduacao "muito baixa" no painel (146
# pedidos). Achado: "revalidacao do TITULO" (nao "diploma") estava caindo no
# padrao de graduacao (_REVAL_APROVACAO_RE aceitava "titulo" tambem) e perdia
# o pais por completo -- 71 atos reclassificados incorretamente como
# Graduacao no acervo real, medidos diretamente. Caso abaixo e ato real
# (BS 148/2010, decisao 247/10).
TITULO_HOMOLOGAR_EQUIVALENTE = """DECIDE: Homologar a revalidação do Título de
“Doutor em Filosofia”, obtido por FULANO DE TAL, junto à State University of
New York at Stony Brook, nos Estados Unidos da América, como equivalente ao
de Doutor em Comunicação, nos termos estabelecidos na Resolução 97/1996,
deste Conselho."""

# Mesma investigacao: "Aprovar O reconhecimento" (substantivo masculino) nao
# batia porque o padrao so aceitava o artigo feminino "a" (para "revalidacao").
# Ato real (BS 065/2013, decisao 137/2013).
APROVAR_O_RECONHECIMENTO = """DECIDE 1- Aprovar o reconhecimento do Título de
Doutorado em Matemática, obtido por FULANA DE TAL, junto a Universidad de
Granada, Espanha, como equivalente ao de Doutor em Matemática, nos termos
estabelecidos na Resolução 188/2012, deste Conselho."""

CASOS += [
    ("titulo (nao diploma) homologado como equivalente: pos-graduacao, nao graduacao",
     TITULO_HOMOLOGAR_EQUIVALENTE,
     {"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Doutorado",
      "curso": "Doutor em Filosofia",
      "instituicao": "State University of New York at Stony Brook",
      "pais": "Estados Unidos"}),
    ("'aprovar O reconhecimento' (artigo masculino) tambem bate o padrao",
     APROVAR_O_RECONHECIMENTO,
     {"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Doutorado",
      "curso": "Doutorado em Matemática",
      "instituicao": "Universidad de Granada", "pais": "Espanha"}),
]

# 18/08/2026, mesma investigacao: "como equivalente AO TÍTULO DE Mestre em X"
# (com a palavra "Título" repetida no meio) dava ZERO match -- nao so perdia
# o pais, o ato inteiro sumia. Achado com atos reais do mesmo boletim
# (BS 065/2013, decisoes 275 e 276/2013). Pais vazio aqui e correto: a fonte
# nao menciona o pais da instituicao nesses dois atos.
EQUIVALENTE_AO_TITULO_DE = """DECIDE 1- Aprovar o reconhecimento do Título de
Mestre em Linguistica Germânica, obtido por FULANA DE TAL, junto a Eberhard
Karls Universität Tübingen, como equivalente ao Título de Mestre em Estudos
de Linguagem (Letras/Linguistica), nos termos estabelecidos na Resolução
188/2012, deste Conselho."""

CASOS += [
    ("'equivalente ao TÍTULO DE Mestre' (nao so 'equivalente ao de')",
     EQUIVALENTE_AO_TITULO_DE,
     {"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Mestrado",
      "curso": "Mestre em Linguistica Germânica",
      "instituicao": "Eberhard Karls Universität Tübingen", "pais": ""}),
]

# 18/08/2026: pais=NULL em producao quando ele vem entre parenteses COLADO ao
# nome da instituicao ("(Pais)"), em vez de separado por virgula. Achado via
# consulta direta em `ato_revalidacao` (via='Pos-graduacao'): "Universidad de
# la Empresa (Uruguai)", "Universidad Complutense de Madrid (Espanha)",
# "Universidad de Buenos Aires (Argentina)" -- todos com pais=NULL. Um quarto
# caso partia o parenteses ao meio quando cidade e pais vinham juntos:
# "Kth - Kungliga Tekniska Högskolan (Estocolmo" virava instituicao (com
# parenteses aberto sobrando) e "Suécia)" virava pais (com parenteses
# fechando sobrando).
PARENTESES_URUGUAI = """DECIDE: 1- Aprovar a revalidação do Diploma, nível de
Graduação em Administração, obtido por FULANO DE TAL, junto a Universidad de
la Empresa (Uruguai), nos termos do processo."""

PARENTESES_ESPANHA = """DECIDE: 1- Aprovar a revalidação do Diploma, nível de
Mestrado em Direito, obtido por FULANA DE TAL, junto a Universidad
Complutense de Madrid (Espanha), nos termos do processo."""

PARENTESES_ARGENTINA = """DECIDE: 1- Aprovar a revalidação do Diploma, nível de
Doutorado em Economia, obtido por CICRANO DE TAL, junto a Universidad de
Buenos Aires (Argentina), nos termos do processo."""

PARENTESES_CIDADE_PAIS = """DECIDE: 1- Aprovar a revalidação do Diploma, nível
de Mestrado em Engenharia, obtido por BELTRANO DE TAL, junto a Kth -
Kungliga Tekniska Högskolan (Estocolmo, Suécia), nos termos do processo."""

CASOS += [
    ("pais entre parenteses colado ao nome, sem cidade", PARENTESES_URUGUAI,
     {"via": "Graduação", "decisao": "Deferido",
      "instituicao": "Universidad de la Empresa", "pais": "Uruguai"}),

    ("pais entre parenteses, mestrado", PARENTESES_ESPANHA,
     {"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Mestrado",
      "instituicao": "Universidad Complutense de Madrid", "pais": "Espanha"}),

    ("pais entre parenteses, doutorado", PARENTESES_ARGENTINA,
     {"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Doutorado",
      "instituicao": "Universidad de Buenos Aires", "pais": "Argentina"}),

    ("cidade e pais juntos entre parenteses: parenteses NAO pode partir ao meio",
     PARENTESES_CIDADE_PAIS,
     {"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Mestrado",
      "instituicao": "Kth - Kungliga Tekniska Högskolan", "pais": "Suécia"}),
]

# 18/08/2026: reportado que a aba listava "École de Hautes Études En Sciences
# Sociales" (sem o "s") ao lado da grafia correta, como se fossem duas
# instituicoes. Sao a EHESS, e o nome oficial leva "des". Tabela CURADA, nao
# fusao por similaridade -- o ultimo caso trava justamente isso: nome parecido
# que NAO esta na tabela tem de passar intacto.
EHESS_SEM_S = """Art. 1º - Deferir a solicitação de Revalidação do Diploma, nível
Graduação de Sociologia, obtido por Fulano de Tal, junto a Ecole de Hautes
Études en Sciences Sociales, França, nos termos da Resolução 3.790/2024."""

# Nome PARECIDO com um da tabela, mas ausente dela: tem de sair como veio.
OUTRA_INSTITUICAO = """Art. 1º - Deferir a solicitação de Revalidação do Diploma, nível
Graduação de Sociologia, obtido por Fulano de Tal, junto a Universidad de
Aquino, Bolívia, nos termos da Resolução 3.790/2024."""

CASOS += [
    ("EHESS sem o 's' vira a grafia oficial", EHESS_SEM_S,
     {"instituicao": "École des Hautes Études en Sciences Sociales", "pais": "França"}),
    ("instituicao fora da tabela passa INTACTA (nao e fusao por similaridade)",
     OUTRA_INSTITUICAO, {"instituicao": "Universidad de Aquino"}),
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

obtidas_5792 = extrai_revalidacoes(MULTIPLAS_5792)
if obtidas_5792 != ESPERADO_5792:
    falhas += 1
    print(f"FALHA: ato 5792 deveria produzir duas decisões\n   {obtidas_5792}")
else:
    print("ok   : ato 5792 produz duas decisões na ordem documental")
if extrai_revalidacao(MULTIPLAS_5792) != ESPERADO_5792[0]:
    falhas += 1
    print("FALHA: wrapper singular não devolve o primeiro item")
if extrai_revalidacoes(MULTIPLAS_CITADAS_5792) != []:
    falhas += 1
    print("FALHA: bloco coletivo de ato citado não deveria produzir decisões")
else:
    print("ok   : bloco coletivo de ato citado não produz decisões")

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
    (MULTIPLAS_5792, ["julius", "césar", "barreto", "leite", "orlando", "gomes", "loques", "filho"]),
]
for texto, pedacos in NOMES:
    tudo = " | ".join(
        str(valor)
        for resultado in extrai_revalidacoes(texto)
        for valor in resultado.values())
    vazou = [p for p in pedacos if p.lower() in tudo.lower()]
    if vazou:
        falhas += 1
        print(f"FALHA: nome da pessoa vazou na saida: {vazou}\n   -> {tudo}")
if not any(p.lower() in " ".join(
        str(valor)
        for resultado in extrai_revalidacoes(texto)
        for valor in resultado.values()).lower()
           for texto, pedacos in NOMES for p in pedacos):
    print("ok   : nenhum nome de pessoa aparece na saida (invariante de privacidade)")


# ---------------------------------------------------------------------------
# SIMETRIA DA DECISÃO — a trava que faltava.
#
# Dois padrões nasceram com a decisão ESCRITA DENTRO do regex ("indeferimento",
# "indeferindo"), sem alternativa para o deferimento. O extrator acertava tudo
# o que via, e o que ele não via não deixava rastro: os testes passavam, o CI
# ficava verde, e o painel publicava 0% de deferimento em 614 decisões de 2011
# a 2017 — sete anos seguidos de zero absoluto, entre 100% em 2006-2009 e 83%
# em 2025.
#
# Um caso de teste por redação não pega isso, porque o caso é escrito a partir
# do padrão: escreve-se o indeferimento porque foi o indeferimento que se
# programou. O que pega é a SIMETRIA — trocar o verbo tem de trocar a decisão,
# nunca fazer o ato sumir.
#
# Por isso o teste NÃO lista pares à mão: ele vira o verbo de cada caso real do
# arquivo e exige que o extrator continue enxergando. Redação nova entra na
# conferência sozinha.
VERBOS = [
    ('indeferimento', 'deferimento'),
    ('indeferindo', 'deferindo'),
    ('indeferir', 'deferir'),
]


def _vira_verbo(texto):
    """Troca indeferir->deferir (e volta). Devolve None se não houver verbo."""
    baixo = texto.lower()
    for neg, pos in VERBOS:
        if neg in baixo:
            return re.sub(neg, pos, texto, flags=re.I), 'Deferido'
        # `pos` sem o `neg` antes: evita casar o miolo de "indeferimento"
        if re.search(r'(?<!in)' + pos, baixo):
            return re.sub(r'(?<!in)' + pos, 'in' + pos, texto, flags=re.I), 'Indeferido'
    return None


simetria = 0
for rotulo, texto, esperado in CASOS:
    if esperado is None:
        continue  # caso de rejeição (ato citado): não tem espelho
    virado = _vira_verbo(texto)
    if not virado:
        continue
    texto_espelho, decisao_esperada = virado
    vistos = extrai_revalidacoes(texto_espelho)
    simetria += 1
    if not vistos:
        falhas += 1
        print(f"FALHA (simetria): '{rotulo}' some quando o verbo e trocado.\n"
              f"   -> o padrao tem a decisao embutida; capture o verbo em vez de escreve-lo")
    elif vistos[0]['decisao'] != decisao_esperada:
        falhas += 1
        print(f"FALHA (simetria): '{rotulo}' virado deveria dar {decisao_esperada}, "
              f"deu {vistos[0]['decisao']}")
if simetria:
    print(f"ok   : {simetria} redacao(oes) enxergam as DUAS decisoes (simetria)")

print(f"\n{len(CASOS)} caso(s), {falhas} falha(s).")
sys.exit(1 if falhas else 0)
