# -*- coding: utf-8 -*-
"""
Mock da API (apenas para DESENVOLVIMENTO/TESTE local do front-end).

Reproduz o MESMO contrato JSON da API PHP de produção, mas lendo o
app/portal-data.json em memória. Assim dá para desenvolver e testar a Fase 3
(front-end consumindo a API) sem precisar de PHP/MySQL.

Uso:
    python tools/mock_api.py            # serve em http://127.0.0.1:8900
Endpoints (iguais aos do PHP):
    /stats  /filtros  /atos?...  /atos/{id}   (também aceita ?r=...&id=...)
"""
import json, os, re, math
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app", "portal-data.json")
ATOS = json.load(open(BASE, encoding="utf-8"))
POR_ID = {a["id"]: a for a in ATOS}

# resolve o destino das relações de saída (igual ao importador PHP):
# para cada ato A, cada referenciadoPor {porId, relacao} => porId --relacao--> A
DEST = {}  # (porId, relacao) -> [destIds]
for a in ATOS:
    for ref in a.get("referenciadoPor", []):
        DEST.setdefault((ref["porId"], ref["relacao"]), []).append(a["id"])


def tokens_busca(s):
    return [t for t in re.split(r"\s+", s.strip()) if len(re.sub(r"\W", "", t)) >= 2]


def casa_nome(a, nome):
    n = nome.lower()
    return n in (a.get("textoBusca", "") or "") or n in a.get("ementa", "").lower() \
        or n in (a.get("orgaoEmissor", "") or "").lower()


def filtrar(q):
    busca = (q.get("busca", [""])[0]).lower().strip()
    tipo = q.get("tipo", [""])[0]
    orgao = q.get("orgao", [""])[0]
    ano = q.get("ano", [""])[0]
    status = q.get("status", [""])[0]
    nome = q.get("nome", [""])[0].strip()
    siape = re.sub(r"\D", "", q.get("siape", [""])[0])
    com_sei = q.get("com_sei", [""])[0]
    com_rel = q.get("com_relacoes", [""])[0]

    res = []
    for a in ATOS:
        if busca:
            blob = " ".join([a.get("numero", ""), a.get("identificador", ""),
                             a.get("ementa", ""), a.get("processoSei", "") or "",
                             a.get("conteudoResumido", "")]).lower()
            if busca not in blob:
                continue
        if tipo and tipo != "todos" and a.get("tipoAto") != tipo:
            continue
        if orgao and orgao != "todos" and a.get("orgaoEmissor") != orgao:
            continue
        if ano and ano != "todos" and str(a.get("ano")) != str(ano):
            continue
        if status and status != "todos" and a.get("status") != status:
            continue
        if nome and not casa_nome(a, nome):
            continue
        if siape and not (any(siape in s for s in a.get("siapes", []))
                          or siape in (a.get("textoBusca", "") or "")):
            continue
        if com_sei and not a.get("processoSei"):
            continue
        if com_rel and not (a.get("relacoes") or a.get("referenciadoPor")):
            continue
        res.append(a)
    return res


def lista_payload(q):
    res = filtrar(q)
    ordenar = q.get("ordenar", ["data_ato"])[0]
    chave = {"data_ato": "dataAssinatura", "ano": "ano", "tipo": "tipoAto",
             "sigla": "sigla", "numero": "numero", "status": "status"}.get(ordenar, "dataAssinatura")
    rev = q.get("dir", ["desc"])[0].lower() != "asc"
    res.sort(key=lambda a: (a.get(chave) is None, a.get(chave) or ""), reverse=rev)
    por = min(max(int(q.get("por_pagina", ["50"])[0] or 50), 1), 200)
    pag = max(int(q.get("pagina", ["1"])[0] or 1), 1)
    total = len(res)
    janela = res[(pag - 1) * por: (pag - 1) * por + por]
    atos = [{
        "id": a["id"], "tipo": a["tipoAto"], "sigla": a.get("orgaoEmissor", ""),
        "numero": a.get("numero", ""), "ano": a.get("ano"),
        "dataAssinatura": a.get("dataAssinatura", ""), "ementa": a.get("ementa", ""),
        "status": a.get("status", "Ativo"), "processoSei": a.get("processoSei"),
        "relTipos": sorted({r["tipoRelacao"] for r in a.get("relacoes", [])}),
        "refCount": len(a.get("referenciadoPor", [])),
    } for a in janela]
    return {"total": total, "pagina": pag, "por_pagina": por,
            "paginas": math.ceil(total / por) if por else 1, "atos": atos}


def ficha_payload(aid):
    a = POR_ID.get(aid)
    if not a:
        return None
    relacoes = []
    for r in a.get("relacoes", []):
        dests = DEST.get((a["id"], r["tipoRelacao"]), [])
        relacoes.append({"tipoRelacao": r["tipoRelacao"], "atoDestino": r["atoDestino"],
                         "atoDestinoId": dests[0] if dests else None,
                         "detalhes": r.get("detalhes")})
    return {**{k: a.get(k) for k in (
        "id", "ementa", "conteudoResumido", "signatario", "status", "processoSei",
        "seiDocumento", "linkSeiProcesso", "linkSeiDocumento", "linkBoletim",
        "secao", "pagina", "siapes", "tags", "referenciadoPor", "numero")},
        "tipoAto": a["tipoAto"], "sigla": a.get("orgaoEmissor", ""), "orgaoEmissor": a.get("orgaoEmissor", ""),
        "ano": a.get("ano"), "dataAssinatura": a.get("dataAssinatura", ""), "relacoes": relacoes}


def stats_payload():
    from collections import Counter
    c = Counter(a.get("status", "Ativo") for a in ATOS)
    return {"total": len(ATOS), "vigentes": c.get("Ativo", 0),
            "revogados": c.get("Revogado", 0), "alterados": c.get("Alterado", 0),
            "orgaos": len({a.get("orgaoEmissor", "") for a in ATOS}),
            "comSei": sum(1 for a in ATOS if a.get("processoSei")),
            "boletins": len({a.get("arquivo", "") for a in ATOS})}


def filtros_payload():
    return {"tipos": sorted({a["tipoAto"] for a in ATOS}),
            "orgaos": sorted({a.get("orgaoEmissor", "") for a in ATOS if a.get("orgaoEmissor")}),
            "anos": sorted({a.get("ano") for a in ATOS if a.get("ano")}, reverse=True)}


class H(BaseHTTPRequestHandler):
    def _send(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        partes = [p for p in u.path.split("/") if p]
        recurso = q.get("r", [""])[0] or (partes[0] if partes else "atos")
        aid = q.get("id", [""])[0]
        if recurso == "atos" and len(partes) >= 2:
            recurso, aid = "ato", partes[1]
        if recurso == "stats":
            self._send(stats_payload())
        elif recurso == "filtros":
            self._send(filtros_payload())
        elif recurso == "ato":
            f = ficha_payload(aid)
            self._send(f if f else {"erro": "não encontrado"}, 200 if f else 404)
        else:
            self._send(lista_payload(q))


if __name__ == "__main__":
    print("Mock API em http://127.0.0.1:8900  (/stats /filtros /atos /atos/{id})")
    ThreadingHTTPServer(("127.0.0.1", 8900), H).serve_forever()
