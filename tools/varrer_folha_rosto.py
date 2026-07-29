# -*- coding: utf-8 -*-
"""Varre o corpus atras de ANEXO COM FOLHA DE ROSTO (ver teste_folha_rosto.py).

    python varrer_folha_rosto.py <saida.json> <ano> [ano...]

Roda o extrator com a guarda DESLIGADA e reporta os casos que ela removeria:
boletim, pagina, chave natural e as duas ementas (a real e a folha de rosto).

A saida vai para ARQUIVO, nunca para o stdout: o MuPDF escreve avisos dele
("MuPDF error: format error...") direto no descritor do processo, e isso
CONTAMINA um JSON redirecionado com `>` -- aconteceu de verdade aqui, o
arquivo saiu com o aviso colado antes do `[` e truncado no meio.

Existe porque a guarda no extrator so vale para reprocessamento futuro -- os
atos ja importados continuam com a folha de rosto no lugar da ementa real.
"""
import sys, os, io, json, glob, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extrair_boletim as E


def varrer(pdf):
    """[(chave, ato_real, ato_anexo)] do que a guarda removeria neste PDF."""
    orig = E.descarta_anexo_de_folha_rosto
    E.descarta_anexo_de_folha_rosto = lambda x: x          # desliga
    try:
        atos, meta = E.parse_pdf(pdf)
    except Exception as e:
        return [], {"erro": str(e)}
    finally:
        E.descarta_anexo_de_folha_rosto = orig

    por_chave = collections.OrderedDict()
    for a in atos:
        k = (a.get("tipo"), a.get("sigla"), str(a.get("numero")), str(a.get("ano")))
        por_chave.setdefault(k, []).append(a)

    achados = []
    for k, lst in por_chave.items():
        if len(lst) < 2:
            continue
        marc = [E.folha_de_rosto(a.get("corpo_busca")) for a in lst]
        if marc[0] >= 3:
            continue
        for pos in range(1, len(lst)):
            if marc[pos] >= 3:
                achados.append((k, lst[0], lst[pos], marc[pos]))
    return achados, meta


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    destino = sys.argv[1]
    saida = []
    for ano in sys.argv[2:]:
        for pdf in sorted(glob.glob(os.path.join("dados", "boletins", ano, "*.pdf"))):
            achados, meta = varrer(pdf)
            for k, real, anexo, m in achados:
                saida.append({
                    "ano": ano,
                    "arquivo": os.path.basename(pdf),
                    "bs_numero": meta.get("bs_numero"),
                    "tipo": k[0], "sigla": k[1], "numero": k[2], "ano_ato": k[3],
                    "marcadores": m,
                    "pagina_real": real.get("pagina"),
                    "pagina_anexo": anexo.get("pagina"),
                    "ementa_real": (real.get("ementa") or "")[:300],
                    "ementa_anexo": (anexo.get("ementa") or "")[:160],
                })
    # encoding EXPLICITO: o default do Windows e cp1252, e quem ler depois
    # com encoding='utf-8' quebraria no primeiro acento (mesma armadilha que
    # CLAUDE.md documenta para `curl | python`).
    with io.open(destino, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False)
    print(f"{len(saida)} caso(s) -> {destino}")
    return 0


if __name__ == "__main__":
    main()
