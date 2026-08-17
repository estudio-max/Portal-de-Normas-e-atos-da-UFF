# -*- coding: utf-8 -*-
"""Regressao do CONTRATO do portal-data.json quanto ao corpo do ato.

    python teste_dados_portal.py

POR QUE EXISTE: em 17/08/2026 o extrator passou a emitir o corpo em duas formas
-- `corpo_texto` (caixa preservada) e `corpo_busca` (minuscula) -- e o gerador
publicava as DUAS. Medido nos 15 boletins de teste: 3,71 MB -> 6,70 MB, quase o
dobro, para republicar a mesma informacao. Extrapolado ao indice completo sao
~24 MB trafegando por Git todo dia e baixados pelo NAVEGADOR do visitante no
modo de contingencia.

A correcao foi publicar SO `textoOriginal` e derivar a minuscula em quem
consome. Isso so e seguro por causa de UM invariante, e e ele que este arquivo
prende: mascarar o CPF e rebaixar a caixa COMUTAM -- mascarar depois de rebaixar
da o mesmo texto que rebaixar depois de mascarar. Se alguem mexer no
`mascarar_cpfs()` e a comutacao quebrar (uma mascara com letra maiuscula, por
exemplo), o campo derivado deixa de ser identico ao que se publicava antes e a
busca muda de resultado sem ninguem notar.

O segundo bloco confere a CAIXA em si contra a amostra compartilhada
(`dados_referencia/caixa-texto.json`), que PHP e JavaScript conferem tambem --
os tres precisam rebaixar a caixa exatamente igual, senao a mesma busca da
resultado diferente no modo banco e no modo estatico.
"""
import io
import json
import os
import sys

import gerar_dados_portal as G

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "dados_referencia", "caixa-texto.json")

# Corpo com CPF em DUAS formas (pontuado e rotulado), nome proprio e caixa alta
# -- e o formato que o Boletim publica.
CORPO = (
    "PORTARIA Nº 68.440/2022 - A REITORA DA UNIVERSIDADE FEDERAL FLUMINENSE, "
    "no uso de suas atribuicoes, RESOLVE: Homologar a revalidacao do titulo de "
    "'Doctor of Philosophy in Computer Science' obtido na Universidad de Los "
    "Andes, Bogota - Colombia, por MARIA DA SILVA, CPF 123.456.789-09, "
    "conforme CPF nº 98765432100 constante do processo 23069.154690/2019-45."
)


def _ato(corpo_texto, revalidacoes=None, incluir_revalidacao=True):
    """Ato no formato do extrator (out/atos.json), com o minimo que o
    conversor exige. `corpo_busca` e o que o extrator emite hoje."""
    ato = {
        "arquivo": "001-26.pdf", "bs_numero": "1", "bs_data": "05/01/2026",
        "tipo": "PORTARIA", "sigla": "GAR", "numero": "68440", "ano": "2022",
        "data_ato": "2022-03-14", "ementa": "Homologa revalidacao de diploma.",
        "corpo_texto": corpo_texto, "corpo_busca": corpo_texto.lower(),
    }
    if incluir_revalidacao:
        ato["revalidacao"] = revalidacoes[0] if revalidacoes else None
    if revalidacoes and len(revalidacoes) > 1:
        ato["revalidacoes"] = revalidacoes
    return ato


def converter_um(corpo_texto, revalidacoes=None, incluir_revalidacao=True):
    return G.converter({"atos": [_ato(corpo_texto, revalidacoes, incluir_revalidacao)],
                        "boletins": []})[0]


def main():
    falhas = 0

    def checa(nome, ok, detalhe=""):
        nonlocal falhas
        falhas += not ok
        print(f"  {'OK  ' if ok else 'FALHA'} {nome}" + (f" -- {detalhe}" if not ok and detalhe else ""))

    print("-- contrato do portal-data.json --")
    saida = converter_um(CORPO)

    checa("publica `textoOriginal`", bool(saida.get("textoOriginal")))
    checa("NAO publica `textoBusca` (era a duplicata)", "textoBusca" not in saida,
          "o campo voltou: o arquivo dobra de tamanho e ninguem percebe")
    checa("a caixa do corpo e PRESERVADA",
          "MARIA DA SILVA" in saida["textoOriginal"],
          "textoOriginal veio rebaixado -- e o defeito que a separacao corrigiu")

    # A serializacao e o que de fato viaja; conferir a chave no dict nao pega
    # quem reintroduza o campo por outro caminho (um `update()`, por exemplo).
    bruto = json.dumps([saida], ensure_ascii=False)
    checa('a chave "textoBusca" nao aparece no JSON serializado',
          '"textoBusca"' not in bruto)

    # Safra antiga (import-2002-2003, reprocessamento-*) nao tem `corpo_texto`.
    # Publicar corpo VAZIO ali seria perda silenciosa.
    velho = _ato(CORPO)
    del velho["corpo_texto"]
    antigo = G.converter({"atos": [velho], "boletins": []})[0]
    checa("atos.json SEM `corpo_texto` (safra antiga) cai em `corpo_busca`",
          antigo["textoOriginal"] == G.mascarar_cpfs(CORPO.lower()),
          "o corpo sumiu do arquivo publicado")

    print("\n-- contrato revalidacao singular/plural --")
    uma = [{"via": "Graduação", "decisao": "Deferido", "nivel": "Graduação",
            "curso": "Medicina", "instituicao": "Universidad X", "pais": "Cuba"}]
    duas = uma + [{"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Doutorado",
                   "curso": "Doctor of Philosophy", "instituicao": "University Y",
                   "pais": "Reino Unido"}]
    singular_conflitante = {"via": "Graduação", "decisao": "Indeferido",
                            "nivel": "Graduação", "curso": "Odontologia",
                            "instituicao": "Universidad Z", "pais": "Argentina"}
    saida_uma = converter_um(CORPO, uma)
    saida_duas = converter_um(CORPO, duas)
    saida_zero = converter_um(CORPO, [])
    saida_ausente = converter_um(CORPO, incluir_revalidacao=False)
    saida_legada = converter_um(CORPO, uma)
    ato_plural_vazio = _ato(CORPO, incluir_revalidacao=False)
    ato_plural_vazio["revalidacoes"] = []
    saida_plural_vazio = G.converter({"atos": [ato_plural_vazio], "boletins": []})[0]
    ato_conflitante = _ato(CORPO, duas)
    ato_conflitante["revalidacao"] = singular_conflitante
    saida_conflitante = G.converter({"atos": [ato_conflitante], "boletins": []})[0]
    checa("uma decisão mantém somente singular",
          saida_uma["revalidacao"] == uma[0] and "revalidacoes" not in saida_uma)
    checa("duas decisões publicam singular e lista completa",
          saida_duas["revalidacao"] == duas[0] and saida_duas.get("revalidacoes") == duas)
    checa("zero decisões publica null sem plural",
          "revalidacao" in saida_zero and saida_zero["revalidacao"] is None
          and "revalidacoes" not in saida_zero)
    checa("ausência das duas chaves não publica revalidação",
          "revalidacao" not in saida_ausente and "revalidacoes" not in saida_ausente)
    checa("plural vazio isolado publica null no alias singular",
          saida_plural_vazio.get("revalidacao", "ausente") is None
          and "revalidacoes" not in saida_plural_vazio)
    checa("plural conflitante prevalece e governa o alias singular",
          saida_conflitante["revalidacao"] == duas[0]
          and saida_conflitante.get("revalidacoes") == duas)
    checa("carga legada só com singular mantém decisão",
          saida_legada["revalidacao"] == uma[0] and "revalidacoes" not in saida_legada)

    print("\n-- mascara de CPF (o invariante que sustenta a derivacao) --")
    original = saida["textoOriginal"]
    checa("CPF pontuado mascarado no texto publicado",
          "***.456.789-**" in original and "123.456.789-09" not in original)
    checa("CPF rotulado sem pontuacao mascarado no texto publicado",
          "98765432100" not in original)
    # O ponto central: derivar do publicado da EXATAMENTE o que se publicava
    # antes no campo `textoBusca` (= mascarar_cpfs(corpo_texto.lower())).
    derivado = original.lower()
    como_era = G.mascarar_cpfs(CORPO.lower())
    checa("minuscula derivada == `textoBusca` de antes (mascara e caixa comutam)",
          derivado == como_era,
          "mascarar_cpfs() deixou de comutar com lower() -- a busca muda de "
          "resultado em silencio")
    checa("o derivado nao reexpoe CPF",
          "123.456.789-09" not in derivado and "98765432100" not in derivado)

    print("\n-- guarda de ano implausivel --")
    # 1771 e o caso REAL do reprocessamento de 17/08/2026 (fragmento de OCR).
    for bruto, pub, esperado, nome in [
        ("1771", "2013", 2013, "ano absurdo cai para o ano do boletim"),
        ("2013", "2013", 2013, "ano normal passa intacto"),
        ("1998", "2001", 1998, "backlog real de 1998 num BS de 2001 e PRESERVADO"),
        # +1 e ACEITO de proposito: BS de dezembro sai em janeiro, e o ato
        # assinado ja no ano novo entra no boletim do ano velho.
        ("2026", "2025", 2026, "ano do boletim + 1 e aceito (ato de virada)"),
        ("2027", "2026", 2027, "idem, um ano adiante do boletim"),
        ("2030", "2026", 2026, "ano futuro DE VERDADE cai para o boletim"),
        ("", "2013", 2013, "ano ausente cai para o ano do boletim"),
    ]:
        obtido = G.ano_do_ato(bruto, pub)
        checa(f"{nome} ({bruto or 'vazio'} / BS {pub})", obtido == esperado,
              f"obtido {obtido}, esperado {esperado}")

    print("\n-- caixa: Python contra a amostra compartilhada --")
    with io.open(FIXTURE, encoding="utf-8") as f:
        pares = json.load(f)["pares"]
    for original_, esperado in pares:
        obtido = original_.lower()
        checa(json.dumps(original_, ensure_ascii=True)[:56], obtido == esperado,
              f"obtido {json.dumps(obtido, ensure_ascii=True)}, "
              f"esperado {json.dumps(esperado, ensure_ascii=True)}")

    print()
    print("TODOS OK" if not falhas else f"{falhas} FALHA(S)")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
