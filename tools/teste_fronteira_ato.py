# -*- coding: utf-8 -*-
"""Regressao da FRONTEIRA do ato em parse_pdf() (BOUNDARY_NAO_ATO_RE).

    python teste_fronteira_ato.py

Existe porque um ato sem cabecalho reconhecido logo depois dele "engole" o
texto seguinte ate o proximo titulo REAL. Medido no corpus: 2.414 atos (3,1%)
absorviam uma secao sem cabecalho de ato propro ("Resumo de Despachos e
Decisoes", "Alteracao de Carga Horaria", "Auxilio Funeral").

Caso-prova: a Portaria 64.814/2019 (Comissao Interna de Conservacao de
Energia) nomeia 9 servidores; o extrator lhe atribuia 22 — os 13 extras eram
so alteracoes de carga horaria publicadas na sequencia do mesmo boletim.

O fix acrescenta "RESUMO DE DESPACHOS E DECISOES" a BOUNDARY_NAO_ATO_RE —
mesma mecanica ja usada para Extrato de Instrumento Convenial (557 atos,
achado em 12/07/2026). So essa frase entrou: "Auxilio Funeral" e "Alteracao
de Carga Horaria" foram cogitadas e descartadas (ver docs/GUIA-EXTRACAO-BS.md)
porque cada uma tem um caso real onde apareceria DENTRO do dispositivo de um
ato legitimo, o que faria o boundary cortar informacao real.

O match e OBRIGATORIAMENTE case-sensitive (caixa alta pura). O motivo esta no
teste negativo abaixo: e um caso REAL do corpus (2015), nao hipotetico.

LIMITACAO CONHECIDA, documentada e nao coberta por este fix: cada entrada
"Resumo de Despachos e Decisoes" individual (uma decisao por interessado,
repetida varias vezes seguidas no boletim) NAO vira seu proprio ato — ela so
deixa de contaminar o ato anterior. Essas pessoas ficam sem registro proprio.
Medido: DTS PROEX no 06/2005 tinha 24.600 caracteres (11 decisoes de terceiros
coladas nela); com o fix, ela para no primeiro marcador, e as outras 10
decisoes somem (antes elas eram atribuidas, erradas, a DTS PROEX). E melhoria
liquida (sem falsa atribuicao) as custas de uma lacuna preexistente
(elas nunca foram capturadas como atos proprios antes tambem — so estavam mal
atribuidas). Fixar isso por completo exige extrair CADA entrada como um "RDD"
proprio, o que esbarra em pelo menos 3 formatos distintos do numero/data entre
2005, 2019 e 2023 — fica para outra rodada.
"""
import sys
import extrair_boletim as E

CASOS_REGEX = [
    # (nome, texto, deve_casar)
    ("cabecalho de secao, forma basica",
     "RESUMO DE DESPACHOS E DECISÕES", True),
    ("cabecalho com orgao colado (formato 2005/2023)",
     "RESUMO DE DESPACHOS E DECISÕES DP/DCA SERVIÇO DE CADASTRO", True),
    ("variante OCR de DECISÕES (Õ->O)",
     "RESUMO DE DESPACHOS E DECISOES", True),
    # NEGATIVO real: ato de 2015 que CITA um RDD anterior em prosa normal,
    # Title Case — "Autorizo o cancelamento dos efeitos do Resumo de
    # Despachos e Decisões n° 62/2012, no que se refere...". Se o match fosse
    # case-insensitive, este ato real teria sido cortado no meio da propria
    # frase. Achado direto no PDF 011-2015.pdf.
    ("NEGATIVO: citacao em Title Case dentro de um ato real (2015, real)",
     "Autorizo o cancelamento dos efeitos do Resumo de Despachos e Decisões "
     "n° 62/2012, no que se refere à situação funcional do servidor.", False),
    ("NEGATIVO: mencao em minusculas dentro de prosa",
     "conforme consta do resumo de despachos e decisões anexo.", False),
]


def main():
    falhas = 0
    for nome, texto, esperado in CASOS_REGEX:
        casou = bool(E.BOUNDARY_NAO_ATO_RE.search(texto))
        if casou != esperado:
            falhas += 1
            print("FALHOU:", nome, "| esperado casar =", esperado, "| obtido =", casou)
        else:
            print("ok:", nome)

    # Integração mínima: o mecanismo real de parse_pdf() corta o TRECHO do
    # ato anterior na posição do boundary. Testa isso sem precisar de PDF,
    # replicando a MESMA lógica de titulos[]/trecho usada em parse_pdf()
    # (ver tools/extrair_boletim.py, função parse_pdf).
    texto_sintetico = (
        "PORTARIA Nº 999 de 1 de janeiro de 2019\n\n"
        "Cria Comissão de Teste.\n\n"
        "O REITOR resolve: Art. 1º Designar FULANO DE TAL, SIAPE 1234567, "
        "para compor a comissão.\n\n"
        "ANTONIO CLAUDIO LUCAS DA NOBREGA\nReitor\n\n"
        "RESUMO DE DESPACHOS E DECISÕES\n\n"
        "Nº 1/2019\nDATA: 01/01/2019\nINTERESSADO: FULANA DE TAL, SIAPE 7654321\n"
        "ASSUNTO: ALTERAÇÃO DE CARGA HORÁRIA\n"
    )
    m_titulo = E.TITULO_RE.search(texto_sintetico)
    m_boundary = E.BOUNDARY_NAO_ATO_RE.search(texto_sintetico, m_titulo.end())
    trecho = texto_sintetico[m_titulo.start():m_boundary.start()] if m_boundary else texto_sintetico[m_titulo.start():]
    ok_corte = "7654321" not in trecho and "1234567" in trecho
    print("ok:" if ok_corte else "FALHOU:", "integração — trecho do ato para no boundary, sem vazar a pessoa seguinte")
    if not ok_corte:
        falhas += 1
        print("   trecho obtido:", repr(trecho))

    print()
    print("%d/%d casos ok" % (len(CASOS_REGEX) + 1 - falhas, len(CASOS_REGEX) + 1))
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
