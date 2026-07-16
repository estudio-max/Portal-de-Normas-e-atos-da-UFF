# -*- coding: utf-8 -*-
"""Re-OCR dos boletins de 2001 (o unico ano digitalizado do corpus).

    python reocr_2001.py --entrada <pasta_pdfs> --saida <pasta_pdfs_corrigidos>
    python reocr_2001.py --entrada ... --saida ... --so 002-2001.pdf   (teste)

POR QUE ISSO EXISTE
-------------------
2001 e o unico ano em que o BS e digitalizado (medido: 186 dos 190 PDFs tem
1 imagem de pagina inteira; de 2002 em diante e texto nativo). A camada de OCR
embutida naqueles PDFs foi feita por um OCR de epoca e e ruim de um jeito que
sabota o extrator:

  - troca caracteres: "UNIVERSIDADE FEDERAL ELUMINENSI" (Fluminense),
    "os cfeitos" (efeitos), "o mfastamentp" (afastamento), "UFE" (UFF);
  - erra DATAS: "de 02 de marco de 1908 a 01 de marco de 2001" (era 1998);
  - e o pior: destroi o separador de fim de ato. Todo "# # # # #" vira lixo
    ("HNHUA", "hehe", "hhrha"). Medido: 2001 tem ZERO "#" no texto embutido,
    contra 21.012 em 2002. Sem separador, o TITULO_CURTO_RE nao ancora e o ano
    inteiro rende 3,2 atos/boletim contra 5,7 em 2002.

O QUE ESTE SCRIPT FAZ
---------------------
Ignora a camada de OCR podre: renderiza cada pagina como imagem e reconhece do
zero com Tesseract 5 + modelo `por` (tessdata_best). Escreve um PDF novo com a
imagem original + uma camada de texto INVISIVEL nas coordenadas certas, de modo
que `parse_pdf()` funcione sem alteracao nenhuma.

O SEPARADOR
-----------
O Tesseract TAMBEM nao le "# # # # #" (o modelo de linguagem forca letra; o #
italico dessa fonte vira "H"). Nenhum --psm resolve, e --oem 1 ignora
tessedit_char_whitelist. Mas ele denuncia o que nao entendeu: o token sai
SOZINHO na linha, so com letras do conjunto {H,U,N,A,B,R} e com confianca
quase zero. Medido em 4 boletins de 2001: 19 candidatos, 19 separadores reais,
zero falso positivo (HUBABN, HHRHAR, HHUNA, HHBRAA, HHHAHH, HAHNHA, HHHHA,
HHUBUHA, HUHRHAN, HHNHH, URHHA, UNHNA, HUNUNH, UHHHA...). Esses viram
"# # # # #" no texto de saida — cinco, que e o que 2002-2003 usam e o que o
_HASH_SEP passou a aceitar.

ESTADO (16/07/2026): NAO USAR PARA PRODUCAO AINDA. Rodado no ano inteiro, este
re-OCR extrai MENOS atos que o OCR de epoca (520-558 vs 609), por DOIS defeitos
ainda abertos — nenhum e do Tesseract em si, os dois sao da reconstrucao aqui:

  1) LINHA EM BRANCO PERDIDA. insert_text por linha nao reproduz o espaco
     vertical entre paragrafos, e o get_text() do fitz nao emite a linha em
     branco. O TITULO_CURTO_RE (Decisoes/Resolucoes de colegiado) exige
     "(?=\\n[ \\t]*\\n)" depois do numero — sem a linha em branco, esses atos
     somem. Prova: 036-2001 rende 8 atos no original e 1 aqui; o texto TEM
     "DECISAO No 09/2001" mas colado no corpo, sem a linha em branco que o
     original preserva. CONSERTAR: detectar gap vertical > ~1,5x altura de
     linha entre objetos e emitir uma linha vazia (objeto de texto com espaco
     na posicao do gap).
  2) DIGITO "1" FINAL VIRA "]". "de 2001" -> "de 200]", "09/2001" -> "09/2001]"
     (1908 ocorrencias em 177 boletins). Quebra o ano no titulo. Um fix por
     regex "[\\]|] colado a digito -> 1" recupera parte (520->558). dpi=450
     conserta o glifo em caso isolado mas PIORA no conjunto (036: 1->0) e custa
     132s/boletim. Melhor caminho provavel: fix por regex + validar.

Ate os dois serem resolvidos e MEDIDO que supera 609, 2001 fica com o dado
atual. O fix do separador de 5 # (2002-2003) e independente disto e ja vale.
"""
import argparse
import multiprocessing as mp
import os
import re
import subprocess
import sys
import tempfile

import fitz

TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
DPI = 300

# Token que e, na verdade, um "# # # # #" destruido: sozinho na linha, curto,
# so com as letras em que um # italico se decompoe, e confianca no chao.
SEP_LETRAS_RE = re.compile(r"^[HUNABRhunabr]{3,9}$")
SEP_CONF_MAX = 30.0


def tsv_pagina(pg, tmpdir):
    """Roda o Tesseract na pagina renderizada; devolve as palavras com bbox."""
    png = os.path.join(tmpdir, "p.png")
    base = os.path.join(tmpdir, "p")
    pg.get_pixmap(dpi=DPI).save(png)
    subprocess.run([TESSERACT, png, base, "-l", "por", "--psm", "6", "--oem", "1", "tsv"],
                   capture_output=True, check=False)
    caminho_tsv = base + ".tsv"
    if not os.path.exists(caminho_tsv):
        return []
    palavras = []
    with open(caminho_tsv, encoding="utf-8") as f:
        for linha in f.read().splitlines()[1:]:
            c = linha.split("\t")
            if len(c) < 12 or not c[11].strip():
                continue
            palavras.append({
                "linha": (c[2], c[3], c[4]),   # (bloco, paragrafo, linha)
                "left": int(c[6]), "top": int(c[7]),
                "width": int(c[8]), "height": int(c[9]),
                "conf": float(c[10]), "txt": c[11],
            })
    return palavras


def corrige_separadores(palavras):
    """Troca o token-lixo pelo '# # # # #' que ele era. Devolve (palavras, n)."""
    por_linha = {}
    for p in palavras:
        por_linha.setdefault(p["linha"], []).append(p)
    n = 0
    for itens in por_linha.values():
        if len(itens) != 1:            # o separador esta SOZINHO na linha
            continue
        p = itens[0]
        if p["conf"] < SEP_CONF_MAX and SEP_LETRAS_RE.match(p["txt"]):
            p["txt"] = "# # # # #"
            n += 1
    return palavras, n


def escreve_pdf(origem, destino):
    """Reconstroi o PDF: imagem original + camada de texto invisivel do
    Tesseract, posicionada. Devolve (n_paginas, n_separadores).

    Insere uma LINHA inteira por objeto de texto, nao palavra por palavra: o
    get_text() do fitz reagrupa por posicao, e palavras soltas viram uma
    "linha" cada uma. Medido: com insercao por palavra, o texto sai picado
    ("BOLETIM\\nDESERVICO\\n-\\nUNIVERSIDADE\\n...") e os regexes de titulo, que
    dependem de \\n, param de casar — o extrator caiu de 17 para 9 atos no
    002-2001.pdf. Por linha, a estrutura se preserva.
    """
    src = fitz.open(origem)
    out = fitz.open()
    escala = 72.0 / DPI
    total_sep = 0
    with tempfile.TemporaryDirectory() as tmp:
        for pg in src:
            palavras = tsv_pagina(pg, tmp)
            palavras, n_sep = corrige_separadores(palavras)
            total_sep += n_sep

            nova = out.new_page(width=pg.rect.width, height=pg.rect.height)
            # imagem da pagina, para o PDF continuar legivel por humano
            nova.insert_image(nova.rect, pixmap=pg.get_pixmap(dpi=150))

            linhas = {}
            for p in palavras:
                linhas.setdefault(p["linha"], []).append(p)
            for itens in linhas.values():
                itens.sort(key=lambda p: p["left"])
                texto = " ".join(p["txt"] for p in itens)
                x = min(p["left"] for p in itens) * escala
                base = max(p["top"] + p["height"] for p in itens)
                y = base * escala
                alt = max(p["height"] for p in itens)
                corpo = max(alt * escala * 0.92, 1.0)
                try:
                    nova.insert_text((x, y), texto, fontsize=corpo,
                                     fontname="helv", render_mode=3)  # 3 = invisivel
                except Exception:
                    pass
    out.save(destino, deflate=True, garbage=3)
    n_pag = out.page_count
    out.close()
    src.close()
    return n_pag, total_sep


def _tarefa(args):
    """Um boletim. Roda em processo separado (ver --jobs)."""
    entrada, destino, nome = args
    try:
        n_pag, n_sep = escreve_pdf(entrada, destino)
        return nome, n_pag, n_sep, None
    except Exception as e:               # nao derruba o lote por causa de 1 PDF
        return nome, 0, 0, str(e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrada", required=True)
    ap.add_argument("--saida", required=True)
    ap.add_argument("--so", default=None, help="processa so este arquivo (teste)")
    ap.add_argument("--jobs", type=int, default=6,
                    help="processos em paralelo (padrao 6; medido 7,2 s/pagina "
                         "com 1 job, ~5 h para o ano — cada PDF e independente)")
    a = ap.parse_args()

    os.makedirs(a.saida, exist_ok=True)
    pdfs = sorted(f for f in os.listdir(a.entrada) if f.lower().endswith(".pdf"))
    if a.so:
        pdfs = [f for f in pdfs if f == a.so]
    if not os.path.exists(TESSERACT):
        sys.exit(f"Tesseract nao encontrado em {TESSERACT}")

    # ja feitos ficam de fora: o lote e retomavel, basta rodar de novo
    pendentes = [(os.path.join(a.entrada, n), os.path.join(a.saida, n), n)
                 for n in pdfs if not os.path.exists(os.path.join(a.saida, n))]
    print(f"{len(pdfs)} boletins, {len(pdfs) - len(pendentes)} ja prontos, "
          f"{len(pendentes)} a fazer, {a.jobs} em paralelo", flush=True)

    tot_sep = feitos = 0
    if pendentes:
        with mp.Pool(a.jobs) as pool:
            for nome, n_pag, n_sep, erro in pool.imap_unordered(_tarefa, pendentes):
                feitos += 1
                if erro:
                    print(f"[{feitos}/{len(pendentes)}] {nome}: ERRO {erro}", flush=True)
                else:
                    tot_sep += n_sep
                    print(f"[{feitos}/{len(pendentes)}] {nome}: {n_pag} pags, "
                          f"{n_sep} separadores", flush=True)
    print(f"\nFIM. {feitos} boletins processados, {tot_sep} separadores restaurados.")


if __name__ == "__main__":
    main()
