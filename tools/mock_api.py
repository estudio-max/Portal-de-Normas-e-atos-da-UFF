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


# Mesma sintaxe da busca principal: o PHP passa este campo por booleanize(),
# entao sem busca_casa() aqui os modos discordariam -- "frase exata" valeria
# no banco e nao aqui.
def casa_nome(a, nome):
    blob = " ".join([a.get("textoBusca", "") or "", a.get("ementa", "") or "",
                     a.get("orgaoEmissor", "") or ""])
    return busca_casa(blob, nome)


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


# ---- /dossie: atos que citam um SIAPE --------------------------------------
# Espelha dossie() do index_v2.php. A chave é o SIAPE SEM zeros à esquerda: o
# corpus traz o mesmo servidor como '0307221' e '307221', e sem normalizar o
# dossiê sai pela metade. Aqui é lstrip('0'); no PHP, TRIM(LEADING '0' FROM ...)
# — não LPAD, que trunca no MySQL e fundiria matrículas diferentes.
def _dossie_ato(a):
    bs = re.search(r"(\d{1,3})\s*/\s*(\d{4})", a.get("boletimNumero") or "")
    return {"id": a.get("id"), "tipo": a.get("tipoAto"), "numero": a.get("numero", ""),
            "ano": a.get("ano"), "sigla": a.get("orgaoEmissor", ""),
            "dataAto": a.get("dataAssinatura"), "ementa": a.get("ementa", ""),
            "status": a.get("status", "Ativo"), "secao": a.get("secao") or "",
            "pagina": str(a.get("pagina") or ""),
            "bsNumero": int(bs.group(1)) if bs else None,
            "bsAno": int(bs.group(2)) if bs else None,
            "linkBoletim": a.get("linkBoletim")}


def dossie_payload(siape, nome):
    chave = re.sub(r"\D", "", siape).lstrip("0")
    if not chave:
        return {"erro": "siape ausente"}, 400

    def norm(s):
        return (s or "").strip().lstrip("0")

    pessoas, atos, funcoes = {}, [], []
    for a in ATOS:
        casou = False
        for p in (a.get("pessoas") or []):
            if norm(p.get("siape")) == chave:
                # Reproduz pessoa_id() do importar_v2.php: a dimensão pessoa é
                # chaveada por "s:<siape exato>", e pessoa.siape é UNIQUE. Logo
                # cada GRAFIA do siape ('0307221' vs '307221') é UMA linha, com
                # UM nome — o primeiro que apareceu. Sem isso o mock inventaria
                # uma linha por grafia de nome, que produção não tem.
                s = (p.get("siape") or "").strip()
                pessoas.setdefault(s, p.get("nome") or "")
                casou = True
        for f in (a.get("funcoes") or []):
            if norm(f.get("siape")) == chave:
                funcoes.append({
                    "acao": f.get("acao"), "cargo": f.get("cargo") or "",
                    "unidade": f.get("unidade") or "", "prazoMeses": f.get("prazo_meses"),
                    "dataInicio": f.get("data_inicio"), "inicioOrigem": f.get("inicio_origem"),
                    "atoId": a.get("id"),
                    "atoLabel": f"{a.get('tipoAto')} nº {a.get('numero')}/{a.get('ano')}",
                    "sigla": a.get("orgaoEmissor", ""), "dataAto": a.get("dataAssinatura"),
                    "status": a.get("status", "Ativo"), "linkBoletim": a.get("linkBoletim")})
        if casou:
            atos.append(_dossie_ato(a))

    atos.sort(key=lambda x: (x["dataAto"] or ""), reverse=True)
    funcoes.sort(key=lambda x: (x["dataAto"] or ""), reverse=True)
    lst = [{"siape": s, "nome": n} for s, n in pessoas.items()]

    # Nomes para exibir, deduplicados SEM acento/caixa — espelha o mesmo bloco
    # em dossie() do index_v2.php (nome_ascii). "João Marcel" e "Joao Marcel"
    # são a mesma pessoa; contá-los como dois faria o aviso de nome divergente
    # disparar pra quase todo mundo e virar ruído. Fica a variante com acento.
    import unicodedata

    def _ascii(s):
        return "".join(c for c in unicodedata.normalize("NFD", s or "")
                       if unicodedata.category(c) != "Mn")

    por_chave = {}
    for p in lst:
        n = (p["nome"] or "").strip()
        if not n:
            continue
        k = re.sub(r"\s+", " ", _ascii(n).lower().strip())
        if k not in por_chave or len(n.encode()) > len(_ascii(n)):
            por_chave[k] = n
    nomes = list(por_chave.values())

    # Recall por nome: FULLTEXT no CORPO do ato, via casa_nome() — o mesmo
    # caminho do filtro `nome` de listar(). Não adianta procurar em pessoa: o
    # extrator só cria pessoa quando acha um siape, então quem não tem matrícula
    # no ato existe só no texto. Exclui os atos já achados pelo siape.
    por_nome = None
    nome = (nome or "").strip()
    if len(nome) >= 4:
        ja = {a["id"] for a in atos}
        vistos = [_dossie_ato(a) for a in ATOS
                  if a.get("id") not in ja and casa_nome(a, nome)]
        vistos.sort(key=lambda x: (x["dataAto"] or ""), reverse=True)
        por_nome = {"termo": nome, "total": len(vistos), "atos": vistos[:300]}

    return {"siape": re.sub(r"\D", "", siape), "chave": chave, "pessoas": lst,
            "nomes": nomes, "nomesDistintos": len(nomes),
            "linhasPessoa": len(lst), "totalAtos": len(atos),
            "funcoes": funcoes, "atos": atos, "porNome": por_nome}, 200


# /jornada: espelha jornada() do index_v2.php. Flex usa a forma
# entrada/saida/ativos (validada contra planilha de RH, 17/07/2026); PGD segue
# por menção, como antes. Números de brinquedo, só pra forma do painel renderizar.
def jornada_payload():
    def linha_flex(ano, entradas, saidas):
        return {"ano": ano, "entradas": entradas, "saidas": saidas}
    def ref(numero, ano, data, link):
        return {"numero": numero, "ano": ano, "data": data, "link": link}
    def alt(numero, ano, data, link, tipo):
        return {"numero": numero, "ano": ano, "data": data, "link": link, "tipo": tipo}
    def setor_flex(setor, status, entrada, saida, aprovacao, alteracoes, revogacao):
        return {"setor": setor, "status": status, "entrada": entrada, "saida": saida,
                "aprovacao": aprovacao, "alteracoes": alteracoes, "revogacao": revogacao}
    def linha_pgd(ano, atos, setores, servidores):
        return {"ano": ano, "atos": atos, "setores": setores, "servidores": servidores}
    def setor_pgd(sigla, atos, primeiro, ultimo, servidores):
        return {"sigla": sigla, "atos": atos, "primeiro": primeiro, "ultimo": ultimo,
                "servidores": servidores}

    flex_serie_bruta = [linha_flex(2019, 45, 0), linha_flex(2020, 57, 2),
                         linha_flex(2021, 5, 3), linha_flex(2022, 20, 10),
                         linha_flex(2023, 12, 25), linha_flex(2024, 3, 15)]
    acumulado = 0
    flex_serie = []
    for l in flex_serie_bruta:
        acumulado += l["entradas"] - l["saidas"]
        flex_serie.append({**l, "ativos": acumulado})

    return {
        "flex": {
            "serie": flex_serie,
            "setores": [
                # setor revogado com aprovação + manutenções + retificação + revogação
                # (caso real: Biblioteca da Escola de Enfermagem, agrupada por processo).
                setor_flex("Biblioteca da Escola de Enfermagem - CBI/SDC", "Revogado",
                           "2019-10-23", "2024-12-17",
                           ref("65.397", 2019, "2019-10-23", None),
                           [alt("68.365", 2022, "2022-06-02",
                                "https://boletimdeservico.uff.br/wp-content/uploads/e1.pdf", "Retificação"),
                            alt("68.622", 2023, "2023-11-29",
                                "https://boletimdeservico.uff.br/wp-content/uploads/e2.pdf", "Manutenção")],
                           ref("68.754", 2024, "2024-12-17",
                               "https://boletimdeservico.uff.br/wp-content/uploads/e3.pdf")),
                # setor ativo simples (adesão só, sem alterações nem revogação)
                setor_flex("Biblioteca da Faculdade de Nova Friburgo - BNF/CBI/SDC", "Ativo",
                           "2019-12-16", None,
                           ref("65.987", 2019, "2019-12-16", None),
                           [alt("68.644", 2023, "2023-12-21",
                                "https://boletimdeservico.uff.br/wp-content/uploads/e4.pdf", "Manutenção")],
                           None),
                # setor genérico de 2019 (setor veio do corpo), revogado
                setor_flex("Secretaria Administrativa do Instituto de Estudos Estratégicos", "Revogado",
                           "2019-10-09", "2022-10-05",
                           ref("65.294", 2019, "2019-10-09", None), [],
                           ref("68.438", 2022, "2022-10-05", None)),
            ],
        },
        "pgd": {
            "serie": [linha_pgd(2022, 150, 40, 800), linha_pgd(2023, 283, 62, 1400),
                      linha_pgd(2024, 184, 55, 1100), linha_pgd(2025, 67, 30, 500),
                      linha_pgd(2026, 17, 12, 150)],
            "setores": [setor_pgd("ESD", 22, "2022-06-07", "2026-05-01", 120),
                        setor_pgd("ESS", 19, "2022-07-01", "2025-11-01", 95),
                        setor_pgd("PROGRAD", 15, "2022-09-01", "2026-02-01", 70)],
        },
    }


def cooperacao_payload():
    """Espelha a forma da rota /cooperacao: categoria, instituicao, pais e
    lat/lon ja resolvidos no servidor (o front so filtra e desenha)."""
    def ac(numero, ano, cat, inst, pais, lat, lon, sigla='CEPEx', inferido=False):
        return {"id": f"res-cepex-{numero}-{ano}", "numero": numero, "ano": ano,
                "data": f"{ano}-05-10", "link": None, "sigla": sigla,
                "categoria": cat, "instituicao": inst, "pais": pais,
                "paisInferido": inferido,
                "lat": lat, "lon": lon,
                "ementa": f"Dispõe sobre a aprovação do {cat} celebrado entre a UFF - UFF e a {inst}"
                          + (f" ({pais})." if pais else ".")}
    acordos = [
        ac("6.145", 2026, "Cooperação Internacional", "Beihang University", "China", 35.9, 104.2),
        ac("6.143", 2026, "Cooperação Internacional", "Oslo New University College", "Noruega", 60.5, 8.5),
        ac("6.144", 2026, "Cooperação Acadêmica", "Universidade Técnica do Atlântico", "Cabo Verde", 16.0, -24.0),
        ac("563", 2012, "Cooperação Acadêmica", "Universitat Autònoma de Barcelona", "Espanha", 40.5, -3.7),
        ac("512", 2013, "Cooperação Acadêmica", "Université de Rennes", "França", 46.2, 2.2),
        ac("6.148", 2026, "Termo de Cooperação", "Petróleo Brasileiro S.A. - Petrobras", "", None, None),
        ac("6.150", 2026, "Cooperação Técnica", "Município de Maricá", "", None, None),
        ac("562", 2012, "Protocolo de Intenções", "CEDERJ/CECIERJ", "", None, None),
        ac("301", 2018, "Cotutela", "Universidade do Porto", "Portugal", 39.4, -8.2),
        # país INFERIDO (curadoria — o ato não o declara): testa o asterisco
        ac("302", 2019, "Cooperação Acadêmica", "Brunel University", "Reino Unido",
           55.4, -3.4, inferido=True),
        ac("410", 2019, "Cooperação Acadêmica", "Universidad de Buenos Aires", "Argentina", -38.4, -63.6),
    ]
    serie, cats, paises = [], {}, {}
    por_ano = {}
    for a in acordos:
        por_ano.setdefault(a["ano"], {}).setdefault(a["categoria"], 0)
        por_ano[a["ano"]][a["categoria"]] += 1
        cats[a["categoria"]] = cats.get(a["categoria"], 0) + 1
        if a["pais"]:
            paises.setdefault(a["pais"], {"pais": a["pais"], "n": 0,
                                          "lat": a["lat"], "lon": a["lon"]})
            paises[a["pais"]]["n"] += 1
    for ano in sorted(por_ano):
        serie.append({"ano": ano, "total": sum(por_ano[ano].values()),
                      "categorias": por_ano[ano]})
    return {
        "serie": serie,
        "categorias": [{"categoria": k, "n": v}
                       for k, v in sorted(cats.items(), key=lambda x: -x[1])],
        "paises": sorted(paises.values(), key=lambda x: -x["n"]),
        "acordos": acordos,
    }


# Espelha /comissoes: registro curado + contagens (números medidos no acervo).
# (slug, sigla, nome, tipo, obrig, atos, anoMin, anoMax)
_COMISSOES = [
    ("cpa", "CPA", "Comissão Própria de Avaliação", "Comissão", "lei", 22, 2004, 2026),
    ("cppd", "CPPD", "Comissão Permanente de Pessoal Docente", "Comissão", "lei", 31, 2005, 2026),
    ("ceua", "CEUA", "Comissão de Ética no Uso de Animais", "Comissão", "lei", 21, 2010, 2026),
    ("biosseg", "", "Comissão Interna de Biossegurança", "Comissão", "lei", 40, 2005, 2026),
    ("etica", "", "Comissão de Ética da UFF", "Comissão", "lei", 12, 2011, 2026),
    ("cep", "CEP", "Comitê de Ética em Pesquisa", "Comitê", "lei", 58, 2010, 2026),
    ("cgirc", "CGIRC", "Comitê de Governança, Integridade, Riscos e Controles", "Comitê", "controle", 10, 2016, 2026),
    ("gov-dig", "", "Comitê de Governança Digital", "Comitê", "controle", 6, 2021, 2026),
    ("acessib", "", "Comissão de Acessibilidade e Inclusão (UFF Acessível)", "Comissão", "controle", 14, 2019, 2026),
    ("cps", "CPS", "Comissão Permanente de Sustentabilidade", "Comissão", "", 24, 2020, 2026),
    ("rsc", "RSC", "Comissão Especial de Reconhecimento de Saberes e Competências (RSC)", "Comissão", "", 20, 2021, 2026),
]


def comissoes_payload(corpo=""):
    if corpo:
        meta = next((c for c in _COMISSOES if c[0] == corpo), None)
        if not meta:
            return {"erro": "desconhecida"}
        atos = [{
            "id": f"port-reitoria-{68000 + i}-2026", "numero": str(68000 + i), "ano": 2026 - i,
            "data": f"{2026 - i}-05-1{i}", "status": ["Ativo", "Alterado", "Revogado"][i % 3],
            "sigla": "Reitoria", "link": "https://boletimdeservico.uff.br/",
            "processoSei": "23069.100000/2026-00" if i % 2 else None,
            "linkSeiProcesso": "https://sei.uff.br/" if i % 2 else None,
            "ementa": f"Designa novos membros para compor a {meta[2]}.",
        } for i in range(min(meta[5], 6))]
        return {"corpo": {"slug": meta[0], "sigla": meta[1], "nome": meta[2], "tipo": meta[3], "obrig": meta[4]}, "atos": atos}
    corpos = [{"slug": s, "sigla": sg, "nome": n, "tipo": t, "obrig": ob, "atos": a,
               "anos": max(1, (mx - mn) // 2), "anoMin": mn, "anoMax": mx}
              for (s, sg, n, t, ob, a, mn, mx) in _COMISSOES]
    return {"corpos": corpos, "total": sum(c["atos"] for c in corpos), "orfaos": []}


class H(BaseHTTPRequestHandler):
    def _send(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "X-Dossie-Token")
        self.end_headers()
        self.wfile.write(body)

    # O front manda X-Dossie-Token, que é cabeçalho não-simples: o navegador faz
    # preflight antes. Sem responder ao OPTIONS, o fetch morre no CORS e a aba
    # parece quebrada. Em produção não há preflight (mesma origem).
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "X-Dossie-Token")
        self.end_headers()

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
        elif recurso == "dossie_auth":
            # resquício da época com senha; devolve ok como a API real
            self._send({"ok": True})
        elif recurso == "dossie":
            # rota aberta desde 18/07/2026 (aba "Meu SIAPE"), como na API real
            obj, code = dossie_payload(q.get("siape", [""])[0], q.get("nome", [""])[0])
            self._send(obj, code)
        elif recurso == "jornada":
            self._send(jornada_payload())
        elif recurso == "cooperacao":
            self._send(cooperacao_payload())
        elif recurso == "comissoes":
            self._send(comissoes_payload(q.get("corpo", [""])[0]))
        elif recurso == "ato":
            f = ficha_payload(aid)
            self._send(f if f else {"erro": "não encontrado"}, 200 if f else 404)
        else:
            self._send(lista_payload(q))


if __name__ == "__main__":
    print("Mock API em http://127.0.0.1:8900  (/stats /filtros /atos /atos/{id})")
    ThreadingHTTPServer(("127.0.0.1", 8900), H).serve_forever()
