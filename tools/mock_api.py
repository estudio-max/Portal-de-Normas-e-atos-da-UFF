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

# Caminho da base: PORTAL_DATA permite apontar para outra safra (backfill,
# lote reprocessado) sem mexer no app/ — útil para conferir uma aba nova antes
# de a carga entrar em produção.
BASE = os.environ.get("PORTAL_DATA") or os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "app", "portal-data.json")
ATOS = json.load(open(BASE, encoding="utf-8"))
POR_ID = {a["id"]: a for a in ATOS}

# ---- /mandatos: setores sem chefia formalmente constituída ------------------
# Espelha mandatos() do index.php e getMandatos() do dataSource.ts. A regra de
# mandato da UFF (confirmada em 5.555 designações do BS): o CARGO decide o
# prazo. Pró-Reitor/Superintendente/Gerente ficam fora: servem a gestão, não a
# mandato fixo (181 designações, nenhuma com prazo).
REGRA_MANDATO = {"chefe": 24, "subchefe": 24, "coordenador": 48,
                 "vice-coordenador": 48, "diretor": 48, "vice-diretor": 48}


def _soma_meses(iso, m):
    import datetime
    a, mes, d = (int(x) for x in iso[:10].split("-"))
    a2, m2 = a + (mes - 1 + m) // 12, (mes - 1 + m) % 12 + 1
    try:
        return datetime.date(a2, m2, d).isoformat()
    except ValueError:                       # 29/02 -> último dia de fevereiro
        return datetime.date(a2, m2, 28).isoformat()


def mandatos_payload():
    import datetime, collections
    hoje = datetime.date.today().isoformat()

    # Cobertura: a numeração do BS é sequencial no ano, então o MAIOR número do
    # ano diz quantos existiram — auto-calibra, sem constante mágica. Sem este
    # guarda o painel acusaria de acefalia setores que só estão mal indexados.
    bol = collections.defaultdict(lambda: {"arq": set(), "ult": 0})
    for a in ATOS:
        m = re.search(r"(\d{1,3})\s*/\s*(\d{4})", a.get("boletimNumero") or "")
        if not m:
            continue
        ano, num = int(m.group(2)), int(m.group(1))
        if not (2001 <= ano <= datetime.date.today().year) or not (1 <= num <= 300):
            continue
        bol[ano]["arq"].add(a.get("arquivo") or str(num))
        bol[ano]["ult"] = max(bol[ano]["ult"], num)
    cobertura, ok_ano = [], {}
    for ano in sorted(bol):
        v = bol[ano]
        conf = (v["ult"] >= 100 or ano >= datetime.date.today().year) and len(v["arq"]) >= 0.9 * v["ult"]
        ok_ano[ano] = conf
        cobertura.append({"ano": ano, "carregados": len(v["arq"]), "publicados": v["ult"],
                          "pct": round(100 * len(v["arq"]) / v["ult"]) if v["ult"] else 0,
                          "confiavel": conf})

    def janela_ok(desde):
        return all(ok_ano.get(a) for a in range(int(desde[:4]), datetime.date.today().year + 1))

    ev = []
    for a in ATOS:
        data = a.get("dataAssinatura") or ""
        if not data:
            continue
        for f in (a.get("funcoes") or []):
            chave = f.get("unidade_chave") or ""
            if not chave:
                continue
            nome = f.get("nome") or ""
            if not nome and f.get("siape"):
                nome = next((p.get("nome") for p in (a.get("pessoas") or [])
                             if p.get("siape") == f.get("siape")), "") or ""
            ev.append(dict(acao=f.get("acao"), cargo=(f.get("cargo") or "").strip(), chave=chave,
                           unidade=f.get("unidade") or "", nome=nome, siape=(f.get("siape") or "").strip(),
                           data=data, prazo=f.get("prazo_meses"), inicio=f.get("data_inicio") or data,
                           org=f.get("inicio_origem") or "data_ato", atoId=a.get("id"),
                           atoLabel=f"{a.get('tipoAto')} nº {a.get('numero')}/{a.get('ano')}",
                           link=a.get("linkBoletim")))

    # Vale a designação MAIS RECENTE de cada (unidade_chave, cargo). Sem o corte
    # de 4 anos da aba Chefias: lá ele evita titular fantasma, aqui a posição
    # vencida é justamente o que se procura.
    por_pos = {}
    for e in ev:
        if e["acao"] != "designar" or e["cargo"].lower() not in REGRA_MANDATO:
            continue
        k = f"{e['chave']}|{e['cargo'].lower()}"
        c = por_pos.get(k)
        if not c or e["data"] > c["data"] or (e["data"] == c["data"] and (e["atoId"] or "") > (c["atoId"] or "")):
            por_pos[k] = e
    # Só permanece se o ÚLTIMO evento da pessoa for exatamente esta designação.
    ult = {}
    for e in ev:
        if not e["siape"]:
            continue
        m = ult.get(e["siape"])
        if not m or e["data"] > m["data"] or (e["data"] == m["data"] and e["acao"] == "designar"):
            ult[e["siape"]] = e

    setores = []
    for k, e in por_pos.items():
        u = ult.get(e["siape"]) if e["siape"] else None
        if u and (u["acao"] != "designar" or f"{u['chave']}|{u['cargo'].lower()}" != k):
            continue
        declarado = e["prazo"] or 0
        prazo = declarado or REGRA_MANDATO[e["cargo"].lower()]
        fim = _soma_meses(e["inicio"], prazo)
        sit = "em_dia" if fim >= hoje else ("sem_cobertura" if not janela_ok(fim) else "sem_chefia")
        setores.append({
            "unidade": e["unidade"], "cargo": e["cargo"], "nome": e["nome"] or None,
            "siape": e["siape"] or None, "inicio": e["inicio"], "inicioOrigem": e["org"],
            "prazoMeses": prazo,
            # lei x dedução, na linha
            "prazoOrigem": "declarado" if declarado else "presumido_cargo",
            "fim": fim, "situacao": sit,
            "diasVago": (datetime.date.fromisoformat(hoje) - datetime.date.fromisoformat(fim)).days
                        if sit == "sem_chefia" else 0,
            "atoId": e["atoId"], "atoLabel": e["atoLabel"], "linkBoletim": e["link"],
        })
    setores.sort(key=lambda s: s["fim"])
    c = collections.Counter(s["situacao"] for s in setores)
    return {"total": len(setores), "atualizadoEm": hoje,
            "resumo": {"semChefia": c["sem_chefia"], "emDia": c["em_dia"],
                       "semCobertura": c["sem_cobertura"]},
            "cobertura": cobertura, "setores": setores}


MANDATOS = mandatos_payload()   # calculado uma vez no start (base é imutável)

# resolve o destino das relações de saída (igual ao importador PHP):
# para cada ato A, cada referenciadoPor {porId, relacao} => porId --relacao--> A
DEST = {}  # (porId, relacao) -> [destIds]
for a in ATOS:
    for ref in a.get("referenciadoPor", []):
        DEST.setdefault((ref["porId"], ref["relacao"]), []).append(a["id"])


def tokens_busca(s):
    return [t for t in re.split(r"\s+", s.strip()) if len(re.sub(r"\W", "", t)) >= 2]


# Espelha booleanize() do PHP e buscaCasa() do dataSource.ts -- os tres tem
# que concordar. "frase exata" = substring literal adjacente; +palavra ou
# palavra solta = obrigatoria (o "+" nao muda o resultado, so e' aceito).
def busca_casa(blob, busca):
    q = busca.strip()
    if not q:
        return True
    b = blob.lower()
    frases = []

    def _tira_frase(m):
        frases.append(m.group(1).strip().lower())
        return " "

    sem_aspas = re.sub(r'"([^"]+)"', _tira_frase, q)
    frases_ok = [f for f in frases if f]
    palavras = [re.sub(r'[+\-><()~*"@]', "", t) for t in re.split(r"\s+", sem_aspas.strip())]
    palavras = [t for t in palavras if len(t) >= 3]
    if not frases_ok and not palavras:
        return q.lower() in b
    for f in frases_ok:
        if f not in b:
            return False
    for t in palavras:
        if t.lower() not in b:
            return False
    return True


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
                             a.get("conteudoResumido", "")])
            if not busca_casa(blob, busca):
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

    def _mandatos(self):
        self._send(MANDATOS)

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
        elif recurso == "mandatos":
            self._mandatos()
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
