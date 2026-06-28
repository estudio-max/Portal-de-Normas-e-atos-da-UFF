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
import sys
import ssl
import argparse
import urllib.request
from urllib.parse import urlsplit, urlunsplit, quote
from datetime import datetime


def _url_segura(url):
    """Reescreve a URL com caminho/query escapados (espaço -> %20 etc.).
    O servidor da UFF às vezes lista PDFs com espaço no nome
    (ex.: '60-22 RETIFICADO.pdf'); sem escapar, o urllib recusa a requisição
    com 'URL can't contain control characters'."""
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, quote(p.path, safe="/%"),
                       quote(p.query, safe="=&%"), p.fragment))

# User-Agent identificável e com contato (boa etiqueta de robô).
UA = {"User-Agent": "UFF-Indexador/1.0 (indexacao do Boletim de Servico; "
                    "contato estudio@fanara.com.br)"}


def baixar_html(url):
    req = urllib.request.Request(_url_segura(url), headers=UA)
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


def baixar(url, destino, tentativas=4):
    """Baixa com retentativas (o servidor da UFF às vezes responde devagar/cai).
    Escreve em arquivo temporário e só renomeia se baixou por completo."""
    import time
    ctx = ssl.create_default_context()
    ultimo_erro = None
    for n in range(1, tentativas + 1):
        try:
            req = urllib.request.Request(_url_segura(url), headers=UA)
            tmp = destino + ".part"
            with urllib.request.urlopen(req, context=ctx, timeout=180) as r, \
                 open(tmp, "wb") as f:
                f.write(r.read())
            os.replace(tmp, destino)
            return
        except Exception as e:
            ultimo_erro = e
            try:
                os.remove(destino + ".part")
            except OSError:
                pass
            if n < tentativas:
                time.sleep(3 * n)  # backoff progressivo
    raise ultimo_erro


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ano", default=str(datetime.now().year))
    ap.add_argument("--url", default=None)
    ap.add_argument("--pasta", default=os.path.join(os.path.dirname(__file__), "boletins"))
    ap.add_argument("--pausa", type=float, default=4.0,
                    help="segundos de espera entre downloads (gentileza com o servidor da UFF)")
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
    manifesto = {h.split("/")[-1]: _url_segura(h) for h in links}
    with open(os.path.join(args.pasta, "_urls.json"), "w", encoding="utf-8") as f:
        _json.dump(manifesto, f, ensure_ascii=False, indent=1)

    import time
    novos = 0
    falhas = []
    # baixa SEMPRE 1 de cada vez (nunca em paralelo) e com pausa entre cada um,
    # para não sobrecarregar o servidor da UFF. No dia a dia, com o cache, isso
    # significa baixar só 1-2 boletins novos — carga mínima.
    pendentes = [h for h in links
                 if not os.path.exists(os.path.join(args.pasta, h.split("/")[-1]))]
    for i, h in enumerate(pendentes):
        nome = h.split("/")[-1]
        destino = os.path.join(args.pasta, nome)
        try:
            print("  baixando", nome, "...", flush=True)
            baixar(h, destino)
            novos += 1
        except Exception as e:
            print("    ERRO (após retentativas):", e)
            falhas.append(nome)
        if i < len(pendentes) - 1:        # pausa entre downloads (não após o último)
            time.sleep(args.pausa)

    presentes = sum(1 for h in links if os.path.exists(
        os.path.join(args.pasta, h.split("/")[-1])))
    completo = presentes == len(links)
    print(f"Concluído. {novos} novo(s) | {presentes}/{len(links)} boletins na pasta "
          f"| {'COMPLETO' if completo else 'INCOMPLETO: faltam ' + ', '.join(falhas)}")
    if novos:
        print("Agora rode:  python extrair_boletim.py")
    # código de saída 2 sinaliza download incompleto (a workflow trata isso)
    if not completo:
        sys.exit(2)


if __name__ == "__main__":
    main()
