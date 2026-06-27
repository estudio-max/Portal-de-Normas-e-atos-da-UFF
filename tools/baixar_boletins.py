# -*- coding: utf-8 -*-
"""
Baixa os PDFs do Boletim de Serviço da UFF.

Varre a página de um ano (ex.: https://boletimdeservico.uff.br/boletins/bs-2026/)
e baixa todos os PDFs listados para a pasta ./boletins, pulando os que já existem.

Uso:
    python baixar_boletins.py                       # ano corrente (2026)
    python baixar_boletins.py --ano 2025
    python baixar_boletins.py --url https://boletimdeservico.uff.br/boletins/bs-2026/

Depois rode:  python extrair_boletim.py   (processa a pasta ./boletins)

Só usa biblioteca padrão (urllib).
"""
import os
import re
import ssl
import argparse
import urllib.request
from datetime import datetime

UA = {"User-Agent": "Mozilla/5.0 (compatible; UFF-Indexador/1.0)"}


def baixar_html(url):
    req = urllib.request.Request(url, headers=UA)
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
        return r.read().decode("utf-8", "ignore")


def extrair_links(html, base):
    # qualquer href para .pdf (inclui _RETIFICADO)
    hrefs = re.findall(r'href=["\']([^"\']+\.pdf)["\']', html, re.I)
    out = []
    for h in hrefs:
        if h.startswith("//"):
            h = "https:" + h
        elif h.startswith("/"):
            h = "https://boletimdeservico.uff.br" + h
        elif not h.startswith("http"):
            h = base.rstrip("/") + "/" + h
        if h not in out:
            out.append(h)
    return out


def baixar(url, destino):
    req = urllib.request.Request(url, headers=UA)
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=120) as r, \
         open(destino, "wb") as f:
        f.write(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ano", default=str(datetime.now().year))
    ap.add_argument("--url", default=None)
    ap.add_argument("--pasta", default=os.path.join(os.path.dirname(__file__), "boletins"))
    args = ap.parse_args()

    url = args.url or f"https://boletimdeservico.uff.br/boletins/bs-{args.ano}/"
    os.makedirs(args.pasta, exist_ok=True)
    print("Lendo índice:", url)
    html = baixar_html(url)
    links = extrair_links(html, url)
    print(f"{len(links)} PDFs encontrados.")

    # Manifesto nome->URL oficial na UFF (para o portal linkar o PDF de origem,
    # sem precisar hospedar/duplicar o arquivo).
    import json as _json
    manifesto = {h.split("/")[-1]: h for h in links}
    with open(os.path.join(args.pasta, "_urls.json"), "w", encoding="utf-8") as f:
        _json.dump(manifesto, f, ensure_ascii=False, indent=1)

    novos = 0
    for h in links:
        nome = h.split("/")[-1]
        destino = os.path.join(args.pasta, nome)
        if os.path.exists(destino):
            continue
        try:
            print("  baixando", nome, "...", flush=True)
            baixar(h, destino)
            novos += 1
        except Exception as e:
            print("    ERRO:", e)
    print(f"Concluído. {novos} novo(s) arquivo(s) em {args.pasta}")
    if novos:
        print("Agora rode:  python extrair_boletim.py")


if __name__ == "__main__":
    main()
