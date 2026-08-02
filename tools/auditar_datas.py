# -*- coding: utf-8 -*-
"""Audita a DATA dos atos contra o boletim que os publicou, lendo o dump.

Existe porque um ato com data errada nao se denuncia sozinho na tela: o que
denunciou o defeito de marco/2017 foi um olho humano notando que duas colunas
da MESMA LINHA se contradiziam ("Data 2007" ao lado de "BS nº 51/2017").
Este script procura essa contradicao no acervo inteiro.

DUAS AUDITORIAS INDEPENDENTES

  1. DESLOCAMENTO DE ANO (nivel do boletim). Quando a ancora de data do
     extrator erra, TODOS os atos daquele boletim erram JUNTOS e pelo mesmo
     tanto. Entao a unidade de analise e o boletim, nao o ato: que fracao dos
     seus atos esta deslocada em relacao ao ano do arquivo?

  2. NUMERO IMPOSSIVEL (nivel do ato). A serie principal de Portaria da
     Reitoria nunca passou de ~69 mil. Numero muito acima disso e erro de
     digitacao -- em geral do PROPRIO Boletim, nao da extracao.

O QUE ESTE SCRIPT NAO FAZ: concluir. Ele estreita o acervo a um punhado de
boletins; quem adjudica e o PDF. Isso nao e timidez, e o resultado de duas
tentativas que falharam justamente por decidir sozinhas -- veja abaixo.

TENTATIVAS DESCARTADAS (nao repetir)

  a) Mediana do ano dos VIZINHOS POR NUMERO. Recall de 11% e, pior, acusava
     atos CORRETOS. Os erros vem em bloco, viram maioria na vizinhanca local,
     e o estimador passa a tratar o erro como referencia.
  b) So a banda de numeracao por ano. Precisao boa, recall 47%: alcanca so
     Portaria da serie grande. Determinacao de Servico e Resolucao reiniciam
     a numeracao todo ano e ficam invisiveis.

O FALSO POSITIVO QUE IMPORTA

  Um boletim que republica o backlog de UM UNICO ano produz deslocamento
  uniforme e imita o defeito perfeitamente. Caso real: `028-2015.pdf`, 116
  atos com -2 anos, que e o Conselho Universitario publicando em marco/2015
  um lote de resolucoes de 2013 -- esta impresso "RESOLUCAO Nº 063/2013" no
  papel. Legitimo. O discriminador e sempre o mesmo: o que o PDF IMPRIME. No
  defeito, o PDF diz 2017 e o banco diz 2007. No backlog, os dois dizem 2013.

USO

    python tools/auditar_datas.py <dump.sql|dump.sql.zip>
    python tools/auditar_datas.py <dump> --tsv atos.tsv   # guarda o extrato

Sai 1 se houver boletim suspeito, 0 se limpo.

MEDIDO em 27/07/2026 sobre o dump de producao (133 mil atos, 4.822 boletins):
2 boletins acusados, AMBOS verificados como legitimos contra o PDF. A base
esta limpa desta classe de defeito.
"""
import argparse
import io
import os
import re
import sys
import zipfile
from collections import Counter, defaultdict

# --- serie principal de Portaria da Reitoria -------------------------------
SERIE_MIN, SERIE_MAX = 20000, 75000
# --- deslocamento de ano ---------------------------------------------------
MIN_ATOS = 5      # boletim pequeno nao sustenta conclusao
FRACAO = 0.60     # fracao dos atos que precisa compartilhar o desvio
GAP_MIN = 2       # anos

# ato: (id, 'uid', boletim_id, tipo_id, orgao_id, 'numero', numero_norm, ano,
#       'sigla_orig', 'data_ato', ...)
RE_ATO = re.compile(
    r"\((\d+),\s*'([a-z0-9\-]+)',\s*(\d+|NULL),\s*(\d+),\s*(\d+),\s*'([^']*)',"
    r"\s*(\d+|NULL),\s*(\d{4}),\s*('(?:[^'\\]|\\.)*'|NULL),\s*('[^']*'|NULL)")
RE_TIPO = re.compile(r"INSERT INTO `tipo_ato`[^;]*?VALUES\s*(.+?);", re.S)
RE_BOL = re.compile(r"INSERT INTO `boletim`[^;]*?VALUES\s*(.+?);", re.S)


def limpa(v):
    return "" if v in (None, "NULL") else v.strip("'").replace("\\'", "'")


def ano_do_arquivo(nome):
    """Ano pelo NOME do arquivo do boletim. Mesma regra do extrair_boletim."""
    m = re.fullmatch(r"(\d{1,4})-(\d{4})\.pdf", nome or "", re.I)
    if m:
        return int(m.group(2))
    m = re.fullmatch(r"(\d{1,4})-(\d{2})\.pdf", nome or "", re.I)
    if m:
        return 2000 + int(m.group(2))
    return None


def _uma_edicao(candidato, impresso):
    """O candidato vira o impresso com UMA edicao de digito?

    Cobre as duas formas medidas no acervo:
      - INSERCAO: '44.4991' impresso para 44.991 -- o candidato e subsequencia
        do impresso, que tem um digito a mais.
      - SUBSTITUICAO: '81.875' impresso para 51.875 -- mesmo comprimento,
        diferindo em uma unica posicao.
    """
    if len(impresso) == len(candidato) + 1:
        i = 0
        for ch in impresso:
            if i < len(candidato) and candidato[i] == ch:
                i += 1
        return i == len(candidato)
    if len(impresso) == len(candidato):
        return sum(1 for a, b in zip(candidato, impresso) if a != b) == 1
    return False


def ler_dump(caminho):
    """Streaming do dump -> lista de dicts. Aceita .sql e .sql.zip."""
    tipos, boletins, atos = {}, {}, []
    if caminho.lower().endswith(".zip"):
        z = zipfile.ZipFile(caminho)
        abrir = lambda: z.open(z.namelist()[0])
    else:
        abrir = lambda: io.open(caminho, "rb")

    with abrir() as f:
        cauda = ""
        while True:
            bloco = f.read(16 * 1024 * 1024)
            if not bloco:
                break
            texto = cauda + bloco.decode("utf-8", "replace")
            cauda = texto[-8192:]

            if not tipos:
                m = RE_TIPO.search(texto)
                if m:
                    for t in re.finditer(r"\((\d+),\s*'([^']+)'", m.group(1)):
                        tipos[int(t.group(1))] = t.group(2)
            for mb in RE_BOL.finditer(texto):
                for b in re.finditer(
                        r"\((\d+),\s*(\d+),\s*(\d+),\s*('[^']*'|NULL),\s*('[^']*'|NULL)",
                        mb.group(1)):
                    boletins[int(b.group(1))] = limpa(b.group(5))

            corpo = texto[:-8192] if len(texto) > 8192 else texto
            for m in RE_ATO.finditer(corpo):
                nn = m.group(7)
                if nn == "NULL":
                    d = re.sub(r"\D", "", m.group(6))
                    nn = d if d else ""
                atos.append({
                    "uid": m.group(2), "tipo_id": int(m.group(4)),
                    "numero": nn, "ano": int(m.group(8)),
                    "data": limpa(m.group(10)),
                    "boletim_id": m.group(3),
                })

    for a in atos:
        a["tipo"] = tipos.get(a["tipo_id"], "?")
        a["boletim_arquivo"] = (boletins.get(int(a["boletim_id"]), "")
                                if a["boletim_id"] != "NULL" else "")
    return atos


def auditar_deslocamento(atos):
    """Boletins cujos atos estao deslocados em bloco. -> lista de dicts."""
    porbol = defaultdict(list)
    for a in atos:
        ano_arq = ano_do_arquivo(a["boletim_arquivo"])
        if ano_arq is None:
            continue
        a["ano_arq"] = ano_arq
        porbol[a["boletim_arquivo"]].append(a)

    achados = []
    for bol, lista in porbol.items():
        if len(lista) < MIN_ATOS:
            continue
        desvios = Counter(a["ano"] - a["ano_arq"] for a in lista)
        modal, _ = desvios.most_common(1)[0]
        if modal == 0 or abs(modal) < GAP_MIN:
            continue
        # Conta TODOS os deslocados, nao so o grupo modal: em marco/2017 os
        # atos assinados no fim de 2016 viraram 2006 (desvio -11) enquanto a
        # maioria virou -10. Mesmo defeito; olhar so o modal perdia 6 atos.
        quantos = sum(q for d, q in desvios.items() if abs(d) >= GAP_MIN)
        frac = quantos / float(len(lista))
        if frac >= FRACAO:
            achados.append({"boletim": bol, "n": len(lista), "afetados": quantos,
                            "fracao": frac, "desvio": modal,
                            "desvios": dict(desvios)})
    achados.sort(key=lambda x: -x["afetados"])
    return achados


def auditar_numero(atos):
    """Portarias com numero fora da serie possivel. -> lista de dicts."""
    fora = []
    porta = [a for a in atos if a["tipo"].startswith("Portaria") and a["numero"]]
    pordata = defaultdict(set)
    for a in porta:
        try:
            n = int(a["numero"])
        except ValueError:
            continue
        a["n"] = n
        if a["data"] and SERIE_MIN < n < SERIE_MAX:
            pordata[a["data"]].add(n)
    for a in porta:
        n = a.get("n")
        if n is None or n <= SERIE_MAX:
            continue
        viz = sorted(pordata.get(a["data"], []))
        provavel = None
        if viz:
            # O numero pretendido e um BURACO na sequencia daquela data. Entre
            # os buracos, escolhe o que esta a UMA edicao de distancia do que
            # foi impresso -- que e a forma que os erros reais tem: seis dos
            # sete medidos sao um digito INSERIDO ('44.4991' para 44.991) e um
            # e uma SUBSTITUICAO ('81.875' para 51.875).
            faltando = [x for x in range(viz[0], viz[-1] + 1)
                        if x not in pordata[a["data"]]]
            cand = [x for x in faltando if _uma_edicao(str(x), str(n))]
            if len(cand) == 1:
                provavel = cand[0]
            elif len(cand) > 1:
                provavel = min(cand, key=lambda x: abs(x - viz[len(viz) // 2]))
        fora.append({"uid": a["uid"], "numero": n, "ano": a["ano"], "data": a["data"],
                     "boletim": a["boletim_arquivo"], "provavel": provavel,
                     "vizinhos": (viz[0], viz[-1]) if viz else None})
    fora.sort(key=lambda x: -x["numero"])
    return fora


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dump", help="dump .sql ou .sql.zip da producao")
    ap.add_argument("--tsv", default=None, help="grava o extrato para reanalise")
    args = ap.parse_args()

    if not os.path.exists(args.dump):
        print("nao existe: %s" % args.dump)
        return 2

    print("lendo %s ..." % os.path.basename(args.dump))
    atos = ler_dump(args.dump)
    print("atos: %d" % len(atos))

    if args.tsv:
        with io.open(args.tsv, "w", encoding="utf-8", newline="") as f:
            f.write("uid\ttipo\tnumero\tano\tdata\tboletim_arquivo\n")
            for a in atos:
                f.write("\t".join([a["uid"], a["tipo"], a["numero"], str(a["ano"]),
                                   a["data"], a["boletim_arquivo"]]) + "\n")
        print("extrato: %s" % args.tsv)
    print()

    desl = auditar_deslocamento(atos)
    print("=" * 72)
    print("1) BOLETINS COM ANO DESLOCADO EM BLOCO: %d" % len(desl))
    print("=" * 72)
    for d in desl:
        print("  %-18s %4d atos | %d (%.0f%%) deslocados | desvio modal %+d"
              % (d["boletim"], d["n"], d["afetados"], 100 * d["fracao"], d["desvio"]))
    if not desl:
        print("  nenhum.")
    else:
        print()
        print("  NAO conclua daqui. Abra o PDF de cada um e compare com o que ele")
        print("  IMPRIME: se o papel traz o ano que o banco tem, e republicacao de")
        print("  backlog (legitimo); se traz outro, e defeito de extracao.")

    print()
    num = auditar_numero(atos)
    print("=" * 72)
    print("2) PORTARIAS COM NUMERO IMPOSSIVEL (> %d): %d" % (SERIE_MAX, len(num)))
    print("=" * 72)
    for x in num:
        faixa = ("%d..%d" % x["vizinhos"]) if x["vizinhos"] else "(sem vizinhos)"
        print("  nº %-8d %s  %-16s | mesma data: %s | provavel: %s"
              % (x["numero"], x["data"] or "(sem data)", x["boletim"], faixa,
                 x["provavel"] if x["provavel"] else "?"))
    if not num:
        print("  nenhuma.")

    return 1 if (desl or num) else 0


if __name__ == "__main__":
    sys.exit(main())
