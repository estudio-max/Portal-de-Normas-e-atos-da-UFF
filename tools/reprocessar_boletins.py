# -*- coding: utf-8 -*-
"""Reprocessa boletins especificos e gera o portal-data.json so deles.

    python reprocessar_boletins.py <saida.json> <pdf> [pdf...]

Serve para consertar em producao um defeito que ja foi corrigido no extrator:
o importar_v2.php e idempotente por CHAVE NATURAL, entao reimportar os
boletins afetados faz UPDATE dos atos existentes (ementa, texto de busca,
pessoas, relacoes) sem duplicar nada e sem tocar no resto do acervo.

Caminho de producao (sem SSH, via navegador):
  1. sobe o JSON para /importar/ pelo cPanel File Manager
  2. abre /importar/importar_v2.php?token=SEU_TOKEN&arquivo=<nome>.json
"""
import sys, os, io, json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extrair_boletim as E
import gerar_dados_portal as gdp


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    saida, pdfs = sys.argv[1], sys.argv[2:]

    atos, boletins = [], []
    for pdf in pdfs:
        a, meta = E.parse_pdf(pdf)
        atos += a
        boletins.append(meta)
        print(f"  {os.path.basename(pdf):28} {len(a):5} atos")

    regs = gdp.converter({"gerado_em": "", "boletins": boletins,
                          "total": len(atos), "atos": atos}, {})
    # UTF-8 explicito: o default do Windows e cp1252 e o importador le UTF-8.
    with io.open(saida, "w", encoding="utf-8") as f:
        json.dump(regs, f, ensure_ascii=False)
    mb = os.path.getsize(saida) / 1048576
    print(f"\n{len(regs)} atos -> {saida}  ({mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
