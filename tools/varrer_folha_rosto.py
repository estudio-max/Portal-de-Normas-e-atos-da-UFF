# -*- coding: utf-8 -*-
"""Varre o corpus atras de ANEXO COM FOLHA DE ROSTO (ver teste_folha_rosto.py).

    python varrer_folha_rosto.py <ano> [ano...]      # ex.: 2001 2002 2003

Roda o extrator com a guarda DESLIGADA e reporta os casos que ela removeria:
boletim, pagina, chave natural e as duas ementas (a real e a folha de rosto).
Saida em JSON no stdout, para juntar as varreduras e virar SQL de correcao.

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
    saida = []
    for ano in sys.argv[1:]:
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
    # ensure_ascii=True de proposito: no Windows o stdout e cp1252, e
    # `ensure_ascii=False` grava acento em cp1252 -- o arquivo deixa de ser
    # UTF-8 valido e quem ler depois com encoding='utf-8' quebra. Mesma
    # armadilha que CLAUDE.md documenta para `curl | python`.
    json.dump(saida, sys.stdout, ensure_ascii=True)


if __name__ == "__main__":
    main()
