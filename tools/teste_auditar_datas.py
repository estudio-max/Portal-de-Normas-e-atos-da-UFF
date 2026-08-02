# -*- coding: utf-8 -*-
"""Regressao do auditar_datas.py.

Fixa as quatro formas que o acervo real produziu, com numeros reais medidos no
dump de producao. Nao depende do dump: monta os casos em memoria, porque um
dump de 469 MB nao entra no repositorio.

Os dois casos NEGATIVOS sao o coracao deste teste. Foram falsos positivos de
verdade durante o desenho, e sao o que um conserto ingenuo quebra primeiro.

    python tools/teste_auditar_datas.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import auditar_datas as ad  # noqa: E402


def ato(uid, tipo, numero, ano, data, boletim):
    return {"uid": uid, "tipo": tipo, "numero": str(numero), "ano": ano,
            "data": data, "boletim_arquivo": boletim, "tipo_id": 0,
            "boletim_id": "1"}


def caso_defeito_bloco():
    """051-2017.pdf: TODOS os atos deslocados -10. O defeito de marco/2017.

    Inclui os 2 atos que foram de 2016 para 2006 (desvio -11): eles sao o
    mesmo defeito e um detector que so olha o grupo modal os perde.
    """
    atos = [ato("p-%d" % n, "Portaria", 58000 + n, 2007, "2007-03-20", "051-2017.pdf")
            for n in range(27)]
    atos += [ato("q-%d" % n, "Portaria", 57900 + n, 2006, "2006-12-15", "051-2017.pdf")
             for n in range(2)]
    return atos


def caso_backlog_um_ano():
    """028-2015.pdf: 116 resolucoes de 2013 publicadas em 2015. LEGITIMO.

    Deslocamento uniforme de -2, indistinguivel do defeito olhando so o banco.
    O auditor DEVE acusar (ele nao tem como saber sozinho) -- o teste fixa que
    ele acusa, e a docstring do modulo manda adjudicar pelo PDF. O que nao pode
    e o auditor CALAR sobre ele e dar falsa sensacao de base limpa.
    """
    return [ato("r-%d" % n, "Resolução", n, 2013, "", "028-2015.pdf")
            for n in range(117)]


def caso_boletim_normal():
    """Boletim saudavel: atos do proprio ano. NAO pode ser acusado."""
    return [ato("n-%d" % n, "Portaria", 60000 + n, 2017, "2017-06-01", "100-2017.pdf")
            for n in range(40)]


def caso_citacao_esparsa():
    """122-2009.pdf: poucos atos antigos citados num BS normal. NAO acusar.

    6 de 10 e 60%, no limite. Aqui a fracao fica abaixo do corte de propósito:
    e o formato tipico de citacao, e acusar isso enterraria o sinal real em
    ruido.
    """
    atos = [ato("c-%d" % n, "Portaria", 35118 + n, 2006, "2006-05-26", "122-2009.pdf")
            for n in range(3)]
    atos += [ato("d-%d" % n, "Portaria", 39630 + n, 2009, "2009-01-28", "122-2009.pdf")
             for n in range(7)]
    return atos


def caso_numero_impossivel():
    """44.4991 e 44.4992 impressos assim no BS 103/2011 (erro da FONTE).

    Os vizinhos da mesma data formam sequencia contigua com exatamente dois
    buracos: 44991 e 44992. O auditor tem que apontar esses dois.
    """
    atos = [ato("v-%d" % n, "Portaria", n, 2011, "2011-06-20", "103-2011.pdf")
            for n in (44989, 44990, 44993)]
    atos += [ato("x1", "Portaria", 444991, 2011, "2011-06-20", "103-2011.pdf"),
             ato("x2", "Portaria", 444992, 2011, "2011-06-20", "103-2011.pdf")]
    return atos


def main():
    ok = falhou = 0

    def checa(nome, cond, detalhe=""):
        nonlocal ok, falhou
        if cond:
            ok += 1
            print("ok: %s" % nome)
        else:
            falhou += 1
            print("FALHOU: %s %s" % (nome, detalhe))

    # --- 1) deslocamento em bloco -----------------------------------------
    d = ad.auditar_deslocamento(caso_defeito_bloco())
    checa("defeito em bloco e acusado", len(d) == 1, d)
    if d:
        checa("conta TODOS os deslocados, nao so o grupo modal (29, nao 27)",
              d[0]["afetados"] == 29, d[0])

    d = ad.auditar_deslocamento(caso_backlog_um_ano())
    checa("backlog de um ano so tambem e acusado (adjudicacao e pelo PDF)",
          len(d) == 1 and d[0]["afetados"] == 117, d)

    d = ad.auditar_deslocamento(caso_boletim_normal())
    checa("NEGATIVO: boletim saudavel nao e acusado", len(d) == 0, d)

    d = ad.auditar_deslocamento(caso_citacao_esparsa())
    checa("NEGATIVO: citacao esparsa de atos antigos nao e acusada", len(d) == 0, d)

    # --- 2) numero impossivel ---------------------------------------------
    n = ad.auditar_numero(caso_numero_impossivel())
    checa("os dois numeros impossiveis sao apontados", len(n) == 2, n)
    provaveis = sorted(x["provavel"] for x in n if x["provavel"])
    checa("infere 44991 e 44992 pelos buracos da mesma data",
          provaveis == [44991, 44992], provaveis)

    n = ad.auditar_numero(caso_boletim_normal())
    checa("NEGATIVO: numeracao normal nao gera apontamento", len(n) == 0, n)

    # --- 3) ano pelo nome do arquivo --------------------------------------
    checa("ano do arquivo: 051-2017.pdf", ad.ano_do_arquivo("051-2017.pdf") == 2017)
    checa("ano do arquivo: 062-18.pdf", ad.ano_do_arquivo("062-18.pdf") == 2018)
    checa("ano do arquivo: nome atipico -> None",
          ad.ano_do_arquivo("especial_2010-05-24.pdf") is None)

    print()
    print("%d/%d casos ok" % (ok, ok + falhou))
    return 1 if falhou else 0


if __name__ == "__main__":
    sys.exit(main())
