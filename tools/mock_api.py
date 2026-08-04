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
    /chefias  /mandatos  /prazos  /pad_cadeia?processo=...
    /insights?ano=...  /analitico
    /jornada  /cooperacao  /comissoes  /politicas  /ods  /dossie

O que o mock NÃO reproduz, por desenho: o cache em disco da API PHP e o
`X-Cache`. Tudo aqui é calculado a cada requisição sobre o JSON em memória.
"""
import json, os, re, math, sys, datetime
from collections import defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# O classificador PAD/SINVE é IMPORTADO do importador, não recopiado: é a mesma
# regra que roda na carga, e foi justamente a cópia divergente que fez o /stats
# do mock ficar para trás do contrato da API.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                "backend", "importar"))
from extrair_prazos_pad_sinve import (          # noqa: E402
    classifica_tipo, classifica_papel, extrai_dias, norm as _norm_pad,
)

# Caminho da base: PORTAL_DATA permite apontar para outra safra (backfill,
# lote reprocessado) — útil para conferir uma aba nova antes de a carga entrar
# em produção. O padrão é public/portal-data.json (o app/ antigo foi arquivado
# em jul/2026; o caminho velho fica como fallback para quem tiver a árvore v1).
_raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("PORTAL_DATA") or next(
    (p for p in (os.path.join(_raiz, "public", "portal-data.json"),
                 os.path.join(_raiz, "app", "portal-data.json")) if os.path.isfile(p)),
    os.path.join(_raiz, "public", "portal-data.json"))
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
    # Hifen vira espaco dos DOIS lados, espelhando booleanize() do PHP: o
    # FULLTEXT do MySQL ja separa "Vice-Reitor" em `vice`+`reitor`.
    _sem_hifen = lambda s: re.sub(r"[-‐-―]", " ", s or "")
    q = _sem_hifen(busca).strip()
    if not q:
        return True
    b = _sem_hifen(blob).lower()
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


def _chave_boletim(arq):
    """Ordena 'NN-AA.pdf' pelo ano e depois pelo número, como o ORDER BY do PHP."""
    m = re.match(r"(\d+)-(\d+)", arq or "")
    return (int(m.group(2)) * 1000 + int(m.group(1))) if m else -1


def stats_payload():
    """Espelha stats() do index_v2.php. As três últimas chaves — porAno,
    ultimaAtualizacao e ultimoBoletim — alimentam o gráfico anual, a linha de
    atualização do cabeçalho e o quadro do último boletim no Dashboard. Sem
    elas o portal desenha 26 barras zeradas e "Nenhum ato recente disponível",
    que é indistinguível de um problema de dados de verdade."""
    from collections import Counter
    c = Counter(a.get("status", "Ativo") for a in ATOS)

    # Teto = ano corrente, espelhando o BETWEEN do /api/stats. Fixar 2026 aqui
    # faria o gráfico parar de crescer em 01/01/2027 com o total ainda subindo.
    por_ano = {}
    ano_fim = datetime.date.today().year
    for a in ATOS:
        ano = a.get("ano")
        if isinstance(ano, int) and 2001 <= ano <= ano_fim:
            por_ano[ano] = por_ano.get(ano, 0) + 1

    ult_arq = max((a.get("arquivo", "") for a in ATOS), key=_chave_boletim, default="")
    do_ultimo = [a for a in ATOS if a.get("arquivo") == ult_arq] if ult_arq else []
    do_ultimo.sort(key=lambda a: ((a.get("dataAssinatura") or ""), a.get("id") or ""),
                   reverse=True)
    m = re.match(r"(\d+)-(\d+)", ult_arq or "")
    ultimo_boletim = {
        "arquivo": ult_arq,
        "numero": m.group(1) if m else ult_arq,
        "ano": 2000 + int(m.group(2)) if m else 0,
        "link": next((a.get("linkBoletim") for a in do_ultimo if a.get("linkBoletim")), None),
        "atos": [{"id": a.get("id"), "tipo": a.get("tipoAto"),
                  "sigla": a.get("orgaoEmissor", ""), "numero": a.get("numero", ""),
                  "ano": a.get("ano"), "dataAssinatura": a.get("dataAssinatura"),
                  "ementa": a.get("ementa", ""), "status": a.get("status", "Ativo"),
                  "processoSei": a.get("processoSei"),
                  "linkBoletim": a.get("linkBoletim")} for a in do_ultimo],
    } if ult_arq else None

    return {"total": len(ATOS), "vigentes": c.get("Ativo", 0),
            "revogados": c.get("Revogado", 0), "alterados": c.get("Alterado", 0),
            "orgaos": len({a.get("orgaoEmissor", "") for a in ATOS}),
            "comSei": sum(1 for a in ATOS if a.get("processoSei")),
            "boletins": len({a.get("arquivo", "") for a in ATOS}),
            "porAno": por_ano,
            # No banco esta data é o MAX(criado_em) — quando o ato NOVO entrou.
            # O JSON não guarda isso, então aqui vale a assinatura mais recente
            # do último boletim, que é a melhor aproximação disponível.
            "ultimaAtualizacao": (do_ultimo[0].get("dataAssinatura") or None) if do_ultimo else None,
            "ultimoBoletim": ultimo_boletim}


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
    # Os quatro abaixo existem para o dev VER os estados que produção tem. Sem
    # colegiado parado no mock, "sem evidência recente" e "dados insuficientes"
    # nunca aparecem no dev e o painel parece sempre verde. Números reais de
    # 03/08/2026: cgestao-inf é exigida por órgão de controle e está em 2018.
    ("cgestao-inf", "", "Comitê de Gestão da Informação", "Comitê", "controle", 2, 2016, 2018),
    ("cpt", "CPT", "Comissão Permanente de Telefonia", "Comissão", "", 6, 2007, 2011),
    ("cppta", "CPPTA", "Comissão Permanente de Pessoal Técnico-Administrativo", "Comissão", "", 5, 2001, 2005),
    ("doc-sig", "", "Comissão Permanente de Acesso aos Documentos Públicos de Natureza Sigilosa", "Comissão", "", 1, 2005, 2005),
]


_HOJE = datetime.date.today()

_COM_AVISOS = [
    "O estado é DOCUMENTAL: descreve o que o Boletim registra, não a atividade real do colegiado.",
    "Atividade pode ocorrer fora do Boletim de Serviço — ausência de ato não comprova ausência de trabalho.",
    "A composição vigente não é exibida: o dispositivo dos atos de designação ainda não é extraído em forma estruturada.",
]


def _com_estado(total, ano_max, janela):
    """Espelha comissao_estado() do index_v2.php, na forma que o mock permite:
    aqui só existe o ANO do último ato, então a janela é comparada em anos."""
    if total <= 1:
        return "insuficiente"
    if ano_max >= _HOJE.year - max(1, janela // 12):
        return "recente"
    return "sem_recente"


def comissoes_payload(corpo="", janela=""):
    janela = int(janela) if str(janela) in ("12", "24", "36") else 24
    if corpo:
        meta = next((c for c in _COMISSOES if c[0] == corpo), None)
        if not meta:
            return {"erro": "desconhecida"}
        atos = [{
            "id": f"port-reitoria-{68000 + i}-{meta[7] - i}", "numero": str(68000 + i),
            "ano": meta[7] - i,
            "data": f"{meta[7] - i}-05-1{i}", "status": ["Ativo", "Alterado", "Revogado"][i % 3],
            "sigla": "Reitoria", "link": "https://boletimdeservico.uff.br/",
            "processoSei": "23069.100000/2026-00" if i % 2 else None,
            "linkSeiProcesso": "https://sei.uff.br/" if i % 2 else None,
            "ementa": f"Designa novos membros para compor a {meta[2]}.",
        } for i in range(min(meta[5], 6))]
        return {"corpo": {"slug": meta[0], "sigla": meta[1], "nome": meta[2],
                          "tipo": meta[3], "obrig": meta[4]},
                "atos": atos,
                "ultimaData": atos[0]["data"] if atos else None,
                "eventos": {"m12": min(len(atos), 2), "m24": min(len(atos), 4),
                            "m36": len(atos)},
                "mandatos": ([{"atoId": atos[0]["id"], "fim": f"{meta[7]}-12-31",
                               "conf": "média", "trecho": "…com vigência até 31/12…"}]
                             if atos else []),
                "estado": _com_estado(meta[5], meta[7], janela),
                "janela": janela,
                "avisos": _COM_AVISOS[:1] + _COM_AVISOS[2:]}
    corpos = [{"slug": s, "sigla": sg, "nome": n, "tipo": t, "obrig": ob, "atos": a,
               "anos": max(1, (mx - mn) // 2), "anoMin": mn, "anoMax": mx,
               "ultimaData": f"{mx}-06-15",
               "ultimoAto": {"id": f"port-reitoria-{68000 + a}-{mx}",
                             "label": f"Portaria nº {68000 + a}/{mx}",
                             "data": f"{mx}-06-15", "status": "Ativo"},
               "eventos": {"m12": (1 if mx >= _HOJE.year else 0),
                           "m24": (2 if mx >= _HOJE.year - 1 else 0),
                           "m36": (3 if mx >= _HOJE.year - 2 else 0)},
               "porTipo": {"Portaria": max(1, a // 2), "Decisão": a - max(1, a // 2)},
               "mandato": ({"atoId": f"port-reitoria-{68000 + a}-{mx}",
                            "fim": f"{mx + 2}-12-31", "conf": "média",
                            "trecho": "…com vigência até 31/12…"} if a > 3 else None),
               "estado": _com_estado(a, mx, janela)}
              for (s, sg, n, t, ob, a, mn, mx) in _COMISSOES]
    return {"corpos": corpos, "total": sum(c["atos"] for c in corpos), "orfaos": [],
            "janela": janela, "avisos": _COM_AVISOS}


# Espelha /politicas: o catalogo curado e os vinculos ato<->politica. Os numeros
# sao os medidos na carga de 03/08/2026 (tools/gerar_seed_politicas.py), para o
# dev ver a mesma distribuicao desigual que a producao tem -- assistencia
# estudantil com 38 atos ao lado de integridade com 5.
# (slug, nome, categoria, estagio, atos, anoMin, anoMax, papeis)
_POLITICAS = [
    ("assistencia-estudantil", "Assistência estudantil", "Estudantes", "rascunho", 38, 2021, 2026,
     {"alteracao": 21, "execucao": 15, "regulamentacao": 1, "governanca": 1}),
    ("acessibilidade", "Acessibilidade e inclusão", "Direitos", "rascunho", 8, 2017, 2026,
     {"governanca": 4, "referencia": 1, "alteracao": 1, "execucao": 1, "fundador": 1}),
    ("acoes-afirmativas", "Ações afirmativas, diversidade e equidade", "Direitos", "rascunho", 12, 2013, 2026,
     {"governanca": 4, "execucao": 2, "regulamentacao": 2, "alteracao": 2, "referencia": 2}),
    ("assedio", "Prevenção e enfrentamento ao assédio", "Direitos", "rascunho", 12, 2018, 2026,
     {"governanca": 9, "alteracao": 2, "fundador": 1}),
    ("integridade-riscos", "Integridade, riscos e controles", "Governança", "rascunho", 5, 2021, 2025,
     {"regulamentacao": 3, "monitoramento": 1, "fundador": 1}),
    ("seguranca-informacao", "Segurança da informação e proteção de dados", "Governança", "rascunho", 7, 2020, 2025,
     {"governanca": 3, "fundador": 2, "regulamentacao": 2}),
    ("sustentabilidade", "Sustentabilidade", "Governança", "rascunho", 11, 2006, 2025,
     {"governanca": 6, "regulamentacao": 2, "fundador": 2, "referencia": 1}),
]

_POL_AVISOS = [
    "Ausência de evidência no Boletim não comprova ausência de execução — o acervo cobre o que foi publicado no Boletim de Serviço.",
    "O vínculo entre ato e política é inferido por regra (frase estrita na ementa ou órgão emissor) e revisado por curadoria.",
]


def politicas_payload(slug=""):
    if slug:
        meta = next((p for p in _POLITICAS if p[0] == slug), None)
        if not meta:
            return {"erro": "política desconhecida"}
        papeis = list(meta[7].items())
        atos = []
        for i, (papel, _n) in enumerate(papeis):
            ano = meta[6] - i
            atos.append({
                "id": f"port-reitoria-{68800 + i}-{ano}", "numero": str(68800 + i), "ano": ano,
                "data": f"{ano}-0{(i % 9) + 1}-15", "status": ["Ativo", "Ativo", "Alterado"][i % 3],
                "sigla": "Reitoria", "tipo": "Portaria",
                "link": "https://boletimdeservico.uff.br/",
                "processoSei": None, "linkSeiProcesso": None,
                "papel": papel, "confianca": "alta" if i % 2 == 0 else "media",
                "metodo": "regra",
                "justificativa": f"frase: {meta[1].lower()[:24]}",
                "ementa": f"Ato de {papel} da política de {meta[1].lower()} no âmbito da UFF.",
            })
        return {"politica": {"slug": meta[0], "nome": meta[1], "descricao":
                             f"Catálogo piloto — {meta[1].lower()}.",
                             "categoria": meta[2], "estagio": meta[3]},
                "atos": atos, "avisos": _POL_AVISOS}
    pols = []
    for (s, n, cat, est, a, mn, mx, papeis) in _POLITICAS:
        pols.append({
            "slug": s, "nome": n, "descricao": f"Catálogo piloto — {n.lower()}.",
            "categoria": cat, "estagio": est, "atos": a,
            "anoMin": mn, "anoMax": mx, "ultimaData": f"{mx}-06-01",
            "papeis": papeis,
            "fundador": ({"id": f"port-reitoria-{68000 + a}-{mn}",
                          "label": f"Portaria nº {68000 + a}/{mn}",
                          "sigla": "Reitoria", "data": f"{mn}-03-10", "ano": mn}
                         if papeis.get("fundador") else None),
        })
    return {"politicas": pols, "total": sum(p["atos"] for p in pols), "avisos": _POL_AVISOS}


# ODS: espelha /api/ods (índice ato_ods, docs/METODOLOGIA-ODS.md). Números
# ecoam a proporção do backfill real de 22/07/2026 (ODS 17 e 16 dominam;
# 6/7/11/13 quase vazias — a distribuição desigual é a mensagem do painel).
_ODS = [  # (n, nome, cor, proposta, execucao, pesquisa, ensino, anoMin, anoMax)
    (1, "Erradicação da pobreza", "#E5243B", 7, 5, 0, 0, 2021, 2026),
    (2, "Fome zero", "#DDA63A", 9, 40, 1, 3, 2012, 2026),
    (3, "Saúde e bem-estar", "#4C9F38", 12, 30, 1, 20, 2004, 2026),
    (4, "Educação de qualidade", "#C5192D", 25, 30, 0, 9, 2021, 2026),
    (5, "Igualdade de gênero", "#FF3A21", 10, 12, 0, 4, 2003, 2026),
    (6, "Água potável e saneamento", "#26BDE2", 1, 1, 0, 1, 2023, 2023),
    (7, "Energia limpa e acessível", "#FCC30B", 0, 0, 0, 1, 2010, 2010),
    (8, "Trabalho decente", "#A21942", 30, 70, 1, 5, 2003, 2026),
    (9, "Indústria, inovação e infraestrutura", "#FD6925", 8, 5, 1, 2, 2001, 2026),
    (10, "Redução das desigualdades", "#DD1367", 40, 60, 2, 25, 2012, 2026),
    (11, "Cidades e comunidades sustentáveis", "#FD9D24", 2, 1, 0, 0, 2003, 2013),
    (12, "Consumo e produção responsáveis", "#BF8B2E", 12, 15, 2, 8, 2006, 2026),
    (13, "Ação contra a mudança do clima", "#3F7E44", 2, 1, 1, 1, 2009, 2026),
    (14, "Vida na água", "#0A97D9", 1, 5, 2, 3, 2004, 2026),
    (15, "Vida terrestre", "#56C02B", 8, 15, 0, 4, 2008, 2026),
    (16, "Paz, justiça e instituições eficazes", "#00689D", 35, 45, 3, 10, 2004, 2026),
    (17, "Parcerias e meios de implementação", "#19486A", 90, 60, 4, 2, 2002, 2026),
]


def ods_payload(n=""):
    if n:
        num = int(n)
        meta = next((o for o in _ODS if o[0] == num), None)
        if not meta:
            return {"erro": "ODS inválida (1–17)."}
        vincs = (["proposta"] * min(meta[3], 4) + ["pesquisa"] * min(meta[5], 1)
                 + ["ensino"] * min(meta[6], 2) + ["execucao"] * min(meta[4], 3))
        atos = [{
            "id": f"res-cepex-{4000 + i}-{2026 - i}", "numero": str(4000 + i),
            "ano": 2026 - i, "data": f"{2026 - i}-06-1{i % 9}", "status": "Ativo",
            "sigla": ["CEPEx", "CUV", "Reitoria"][i % 3],
            "link": "https://boletimdeservico.uff.br/",
            "vinculo": v, "confianca": ["alta", "media", "baixa"][i % 3],
            "meta": "THE 10.6.4 / IPEA 10.2" if v == "proposta" else None,
            "justificativa": ("Ato fundador de política institucional ligada à ODS"
                              if v == "proposta" else "Operação de estrutura existente"),
            "metodo": "curadoria" if i == 0 else "ia",
            "ementa": f"Institui programa institucional relacionado a {meta[1]} no âmbito da UFF.",
        } for i, v in enumerate(vincs)]
        return {"ods": {"n": meta[0], "nome": meta[1], "cor": meta[2]}, "atos": atos}
    lista = [{"n": n_, "nome": nome, "cor": cor, "proposta": p, "execucao": e,
              "pesquisa": q_, "ensino": en, "total": p + e + q_ + en,
              "anoMin": mn if p + e + q_ + en else None,
              "anoMax": mx if p + e + q_ + en else None}
             for (n_, nome, cor, p, e, q_, en, mn, mx) in _ODS]
    # Cobertura da curadoria. O registro acima é sintético, então a data de
    # corte é simulada: pega a assinatura mais recente do acervo e recua 90
    # dias, para o aviso de defasagem aparecer no dev com um número real de
    # atos posteriores. No banco isto é MAX(data_ato) sobre ato_ods.
    datas = sorted(a.get("dataAssinatura") or "" for a in ATOS if a.get("dataAssinatura"))
    ate = ult_norm = None
    gap = None
    if datas:
        ult_norm = datas[-1][:10]
        # O registro acima e sintetico: simula um vinculo recente (30 dias de
        # distancia), abaixo do limiar de 90 que dispara o aviso de parada.
        ate = (datetime.date.fromisoformat(ult_norm) - datetime.timedelta(days=30)).isoformat()
        gap = (datetime.date.fromisoformat(ult_norm) - datetime.date.fromisoformat(ate)).days
    return {"lista": lista, "linhas": sum(x["total"] for x in lista),
            "atosDistintos": int(sum(x["total"] for x in lista) * 0.84),
            "curados": 17,
            "cobertura": {"ate": ate, "ultimoNormativo": ult_norm, "diasParado": gap}}


# ---- /chefias: titular atual de cada (unidade, cargo) ----------------------
# Espelha chefias() do index_v2.php e getChefias() do dataSource.ts: vale o
# evento de MAIOR data por posição, e só conta como titular se esse evento for
# 'designar'.
def chefias_payload():
    hoje = datetime.date.today()
    por_pos = {}
    for a in ATOS:
        data = a.get("dataAssinatura") or ""
        if not data:
            continue
        for f in (a.get("funcoes") or []):
            chave = f.get("unidade_chave") or f.get("unidadeChave") or ""
            if not chave:
                continue
            nome = f.get("nome") or ""
            if not nome and f.get("siape"):
                nome = next((p.get("nome", "") for p in (a.get("pessoas") or [])
                             if p.get("siape") == f["siape"]), "")
            ev = {"acao": f.get("acao"), "cargo": f.get("cargo") or "",
                  "unidade": f.get("unidade") or "", "nome": nome,
                  "siape": f.get("siape") or "", "data": data, "atoId": a["id"],
                  "atoLabel": f"{a.get('tipoAto')} nº {a.get('numero')}/{a.get('ano')}",
                  "link": a.get("linkBoletim")}
            k = f"{chave}|{ev['cargo'].lower()}"
            cur = por_pos.get(k)
            if not cur or ev["data"] > cur["data"] or (ev["data"] == cur["data"] and ev["atoId"] > cur["atoId"]):
                por_pos[k] = ev

    # Corte de mandato: sem ato novo há mais de 4 anos, é mais provável que a
    # chave da unidade tenha mudado de grafia do que a pessoa seguir no posto.
    limite = (hoje.replace(year=hoje.year - 4)).isoformat()
    # Reitor é nomeado por decreto presidencial no DOU, nunca pelo BS — nunca
    # captamos a designação, então exibir o cargo daria sempre errado ou vazio.
    chefias = sorted(
        ({"cargo": e["cargo"], "unidade": e["unidade"], "nome": e["nome"] or None,
          "siape": e["siape"] or None, "desde": e["data"], "atoId": e["atoId"],
          "atoLabel": e["atoLabel"], "linkBoletim": e["link"]}
         for e in por_pos.values()
         if e["acao"] == "designar" and e["data"] >= limite and e["cargo"].strip().lower() != "reitor"),
        key=lambda c: (c["unidade"], c["cargo"]))
    return {"total": len(chefias), "atualizadoEm": hoje.isoformat(), "chefias": chefias}


# ---- /insights: agregações do acervo (opcionalmente recortadas por ano) -----
def insights_payload(ano=""):
    recorte = ano not in ("", "todos")
    ano_sel = int(ano) if recorte else None
    base = [a for a in ATOS if a.get("ano") == ano_sel] if ano_sel else ATOS
    tem_sei = lambda a: bool(a.get("processoSei"))

    com_sei = revogados = alterados = relacoes = 0
    data_min = data_max = None
    orgaos, por_dia, por_mes, por_orgao, por_tipo = set(), {}, {}, {}, {}
    for a in base:
        if tem_sei(a):
            com_sei += 1
        if a.get("status") == "Revogado":
            revogados += 1
        elif a.get("status") == "Alterado":
            alterados += 1
        relacoes += len(a.get("relacoes") or [])
        sig = a.get("orgaoEmissor")
        if sig:
            orgaos.add(sig)
            o = por_orgao.setdefault(sig, {"n": 0, "comSei": 0})
            o["n"] += 1
            if tem_sei(a):
                o["comSei"] += 1
        por_tipo[a.get("tipoAto")] = por_tipo.get(a.get("tipoAto"), 0) + 1
        d = a.get("dataAssinatura") or ""
        if re.match(r"^\d{4}-\d{2}-\d{2}", d):
            dia = d[:10]
            por_dia[dia] = por_dia.get(dia, 0) + 1
            por_mes[dia[:7]] = por_mes.get(dia[:7], 0) + 1
            if data_min is None or dia < data_min:
                data_min = dia
            if data_max is None or dia > data_max:
                data_max = dia

    total = len(base)
    return {
        "ano": ano_sel,
        "anos": sorted({a["ano"] for a in ATOS if a.get("ano")}, reverse=True),
        "kpis": {"total": total, "comSei": com_sei, "revogados": revogados,
                 "alterados": alterados, "vigentes": total - revogados - alterados,
                 "orgaos": len(orgaos), "relacoes": relacoes,
                 "dataMin": data_min, "dataMax": data_max},
        "porDia": [{"d": d, "n": n} for d, n in sorted(por_dia.items())],
        "porMes": [{"ym": m, "n": n} for m, n in sorted(por_mes.items())],
        "porOrgao": [{"sigla": s, "n": o["n"], "comSei": o["comSei"]}
                     for s, o in sorted(por_orgao.items(), key=lambda kv: -kv[1]["n"])][:12],
        "porTipo": [{"tipo": t, "n": n} for t, n in sorted(por_tipo.items(), key=lambda kv: -kv[1])],
    }


# ---- /analitico: rotatividade, citações defasadas e séries de RH ------------
def _meses_entre(a, b):
    da = datetime.date.fromisoformat(a[:10])
    db = datetime.date.fromisoformat(b[:10])
    return round((db - da).days / 30.44, 1)


def analitico_payload():
    # Rotatividade: quantos titulares distintos passaram por cada (unidade, cargo).
    pos, total_eventos = {}, 0
    for a in ATOS:
        data = a.get("dataAssinatura") or ""
        for f in (a.get("funcoes") or []):
            chave = f.get("unidade_chave") or f.get("unidadeChave") or ""
            if not chave or not data:
                continue
            total_eventos += 1
            nome = (f.get("nome") or "").lower()
            if not nome and f.get("siape"):
                nome = next((p.get("nome", "") for p in (a.get("pessoas") or [])
                             if p.get("siape") == f["siape"]), "").lower()
            k = f"{chave}|{(f.get('cargo') or '').lower()}"
            p = pos.setdefault(k, {"cargo": f.get("cargo"), "unidade": f.get("unidade"), "ev": []})
            p["ev"].append({"acao": f.get("acao"), "data": data, "ident": f.get("siape") or nome})

    permanencias, cadeiras = [], []
    for p in pos.values():
        p["ev"].sort(key=lambda e: e["data"])
        titulares = []
        for e in p["ev"]:
            if e["acao"] != "designar":
                continue
            if not titulares or e["ident"] != titulares[-1]["ident"]:
                titulares.append({"ident": e["ident"], "inicio": e["data"]})
        if len(titulares) < 2:
            continue
        durs = [_meses_entre(titulares[i]["inicio"], titulares[i + 1]["inicio"])
                for i in range(len(titulares) - 1)]
        permanencias.extend(durs)
        cadeiras.append({"unidade": p["unidade"], "cargo": p["cargo"],
                         "titulares": len(titulares),
                         "permMedia": round(sum(durs) / len(durs), 1)})
    permanencias.sort()
    mediana = round(permanencias[len(permanencias) // 2], 1) if permanencias else None
    n_cad = len(cadeiras)
    cadeiras.sort(key=lambda c: (-c["titulares"], c["permMedia"]))
    cadeiras = cadeiras[:15]

    # Citações defasadas ("zumbis"): ato que referencia norma DEPOIS de revogada.
    zumbis = []
    for alvo in ATOS:
        if alvo.get("status") != "Revogado":
            continue
        refs = alvo.get("referenciadoPor") or []
        datas_rev = sorted(d for d in
                           ((POR_ID.get(r.get("porId")) or {}).get("dataAssinatura")
                            for r in refs if r.get("relacao") == "Revoga") if d)
        if not datas_rev:
            continue
        revogado_em = datas_rev[0]
        alvo_label = f"{alvo.get('tipoAto')} nº {alvo.get('numero')}/{alvo.get('ano')}"
        for ref in refs:
            if ref.get("relacao") == "Revoga":
                continue
            cit = POR_ID.get(ref.get("porId"))
            if not cit or not cit.get("dataAssinatura") or cit["id"] == alvo["id"]:
                continue
            if cit["dataAssinatura"] <= revogado_em:
                continue
            zumbis.append({
                "citLabel": f"{cit.get('tipoAto')} nº {cit.get('numero')}/{cit.get('ano')}",
                "citSigla": cit.get("orgaoEmissor") or "", "citData": cit.get("dataAssinatura"),
                "citLink": cit.get("linkBoletim"), "relacao": ref.get("relacao") or "",
                "alvoLabel": alvo_label, "alvoSigla": alvo.get("orgaoEmissor") or "",
                "revogadoEm": revogado_em})
    zumbis.sort(key=lambda z: z["citData"] or "", reverse=True)
    del zumbis[60:]

    # Série de RH: aposentadorias (campo estruturado) + vacância art. 33, VIII.
    re_vago = re.compile(r"declara\w*\s+(?:vago|(?:a\s+)?vac[aâ]ncia)")
    re_causa8 = re.compile(r"inciso viii,? do artigo 33|posse em outro cargo inacumul|tendo em vista a posse")
    vazio = {"vol": 0, "comp": 0, "inval": 0, "indef": 0, "vac8": 0}
    rh_ano = {}
    for a in ATOS:
        ano = a.get("ano")
        if not isinstance(ano, int) or not (1990 <= ano <= 2100):
            continue
        tipo_apos = (a.get("aposentadoria") or {}).get("tipo")
        t = f"{a.get('ementa') or ''} {a.get('conteudoResumido') or ''} {a.get('textoBusca') or ''}".lower()
        vac8 = bool(re_vago.search(t) and re_causa8.search(t))
        if not tipo_apos and not vac8:
            continue
        s = rh_ano.setdefault(ano, dict(vazio))
        if tipo_apos == "Voluntária":
            s["vol"] += 1
        elif tipo_apos == "Compulsória":
            s["comp"] += 1
        elif tipo_apos == "Invalidez":
            s["inval"] += 1
        elif tipo_apos == "Indefinida":
            s["indef"] += 1
        if vac8:
            s["vac8"] += 1
    series_rh = [dict(ano=ano, **s) for ano, s in sorted(rh_ano.items())]

    # Deslocamento (campo estruturado): remoção × redistribuição.
    d_ano, motivos, setores = {}, {}, {}
    for a in ATOS:
        d = a.get("deslocamento")
        if not d:
            continue
        ano = a.get("ano")
        if isinstance(ano, int) and 1990 <= ano <= 2100:
            s = d_ano.setdefault(ano, {"remocao": 0, "redEntra": 0, "redSaida": 0})
            if d.get("tipo") == "Remoção":
                s["remocao"] += 1
            elif d.get("tipo") == "Redistribuição" and d.get("direcao") == "Entrada":
                s["redEntra"] += 1
            elif d.get("tipo") == "Redistribuição" and d.get("direcao") == "Saída":
                s["redSaida"] += 1
        if d.get("tipo") == "Remoção":
            mot = d.get("motivo") or "Não especificado"
            motivos[mot] = motivos.get(mot, 0) + 1
            if d.get("setor") and ano:
                k = f"{d['setor']}|{ano}"
                r = setores.setdefault(k, {"setor": d["setor"], "ano": ano, "n": 0})
                r["n"] += 1

    return {
        "rotatividade": {"posicoesComTroca": n_cad if n_cad < 15 else None,
                         "totalEventos": total_eventos,
                         "permanenciasMedidas": len(permanencias),
                         "medianaMeses": mediana, "cadeiras": cadeiras},
        "zumbis": zumbis,
        "mortalidade": {"total": len(ATOS),
                        "mexidos": sum(1 for a in ATOS if a.get("status") != "Ativo")},
        "seriesRh": series_rh,
        "deslocamento": {
            "serie": [dict(ano=ano, **s) for ano, s in sorted(d_ano.items())],
            "motivos": [{"motivo": m, "n": n} for m, n in sorted(motivos.items(), key=lambda kv: -kv[1])],
            "setores": list(setores.values()),
        },
    }


# ---- /prazos e /pad_cadeia --------------------------------------------------
# Duas famílias, como no banco:
#   base='PAD_SINVE'   — prazo disciplinar, classificado pelo MESMO módulo que
#                        roda na importação (importado no topo deste arquivo).
#   demais bases       — heurística de data no texto, espelhando extrairPrazos()
#                        do dataSource.ts. É assistiva: cada prazo mostra o
#                        trecho que o originou.
_MES = {"janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4, "maio": 5,
        "junho": 6, "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10,
        "novembro": 11, "dezembro": 12}
_EXCLUI = re.compile(r"(período\s+aquisitivo|aquisitivo|ônus\s+limitad|afastament|licença|"
                     r"capacitaç|suspens|penalidade|advertência|retroativ|\bfaltas?\b|ausência|"
                     r"puniç|apenad|designaç|designad|exercício\s+financeiro|mandato)")
_INSCR = re.compile(r"(inscriç|matrícul|requeriment|candidatur)")
_RECURSO = re.compile(r"(recurso|impugnaç|interpos|contestaç)")
_ENTREGA = re.compile(r"(entrega|envio|encaminh|apresentaç|protocol|submet|remess|preenchiment|manifestaç)")
_VIGENCIA = re.compile(r"(comissã|banca|edital|credenciament|cadastr|chapa|portaria)")


def _iso(y, m, d):
    return "%04d-%02d-%02d" % (y, m, d)


def _add_dias(base, n):
    return (datetime.date.fromisoformat(base[:10]) + datetime.timedelta(days=n)).isoformat()


def _add_meses(base, n):
    d = datetime.date.fromisoformat(base[:10])
    total = d.month - 1 + n
    ano, mes = d.year + total // 12, total % 12 + 1
    dia = min(d.day, [31, 29 if ano % 4 == 0 and (ano % 100 or ano % 400 == 0) else 28,
                      31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1])
    return _iso(ano, mes, dia)


def _y4(y):
    n = int(y)
    return 2000 + n if n < 100 else n


def _valida_data(s):
    return bool(re.match(r"^\d{4}-\d{2}-\d{2}$", s)) and 2015 <= int(s[:4]) <= 2035


def inferir_publico(ementa, contexto):
    """Espelha inferirPublico() do dataSource.ts: para QUEM o prazo serve."""
    f = f"{ementa or ''} {contexto or ''}".lower()
    has = lambda p: bool(re.search(p, f))
    if has(r"licitaç|pregão|contrataç|fornecedor|termo de referência|dispensa de licit|cotaç.o de preç|chamamento públic"):
        return "Fornecedores"
    if has(r"eleiç|consulta eleitoral|\bchapa|votaç|urna|escrutín|diretório acadêmic"):
        return "Comunidade (eleição)"
    dom = ("monitoria" if has(r"monitoria") else
           "pós-graduação" if has(r"mestrad|doutorad|pós-?gradua|\bppg|stricto sensu|lato sensu|resid.ncia médic|especializaç") else
           "seleção docente" if has(r"docente|professor|magistério|magisterio|processo seletivo simplificado|\bpss\b|concurso públic") else
           "bolsa" if has(r"pibic|pibid|iniciaç.o cient|\bbolsa") else
           "estágio" if has(r"estági") else
           "graduação" if has(r"graduaç|graduand|discente|\balun[oa]s?\b|estudante") else None)
    if has(r"inscriç|processo seletivo|seleç.o|candidat|concurso|\bedital|\bprova\b|classificaç"):
        return f"Candidatos · {dom}" if dom else "Candidatos"
    if dom:
        return "Docentes" if dom == "seleção docente" else f"Discentes · {dom}"
    if has(r"servidor|técnico-?administrativ|\btae\b"):
        return "Servidores"
    return "Comunidade acadêmica"


def extrair_prazos(texto, data_ato):
    """Espelha extrairPrazos() do dataSource.ts. Bias em PRECISÃO: só extrai
    data que esteja perto de uma intenção de prazo declarada."""
    if not texto:
        return []
    t = texto.lower()
    out = []
    def win(i, w=95):
        return t[max(0, i - w):i + w]
    def snip(i):
        return "…" + re.sub(r"\s+", " ", t[max(0, i - 48):i + 55]).strip() + "…"
    def push(dl, tipo, conf, base, i):
        if _valida_data(dl) and not any(o["dataLimite"] == dl for o in out):
            out.append({"dataLimite": dl, "tipo": tipo, "conf": conf, "base": base,
                        "origem": snip(i), "ctx": t[max(0, i - 170):i + 170]})

    # 1) janela "de X a Y" — só com intenção de inscrição/recurso
    for m in re.finditer(r"de\s+(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\s+a\s+(\d{1,2})/(\d{1,2})/(\d{2,4})", t):
        c = win(m.start(), 110)
        if _EXCLUI.search(c):
            continue
        intent = "inscrição" if _INSCR.search(c) else "recurso" if _RECURSO.search(c) else None
        if not intent:
            continue
        push(_iso(_y4(m.group(6)), int(m.group(5)), int(m.group(4))), intent, "alta", "data no texto", m.start())
    # 2) "até DD/MM/AAAA" com intenção
    for m in re.finditer(r"até\s+(?:o\s+dia\s+|as?\s+\d{1,2}h?\s+de\s+)?(\d{1,2})/(\d{1,2})/(\d{2,4})", t):
        c = win(m.start())
        if _EXCLUI.search(c):
            continue
        intent = ("inscrição" if _INSCR.search(c) else "recurso" if _RECURSO.search(c)
                  else "entrega/requerimento" if _ENTREGA.search(c)
                  else "vigência/validade" if _VIGENCIA.search(c) else None)
        if not intent:
            continue
        push(_iso(_y4(m.group(3)), int(m.group(2)), int(m.group(1))), intent,
             "média" if intent == "vigência/validade" else "alta", "data no texto", m.start())
    # 3) "até DD de MÊS (de AAAA)?" com intenção
    for m in re.finditer(r"até\s+(?:o\s+dia\s+)?(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?", t):
        if m.group(2) not in _MES:
            continue
        c = win(m.start())
        if _EXCLUI.search(c):
            continue
        intent = ("inscrição" if _INSCR.search(c) else "recurso" if _RECURSO.search(c)
                  else "entrega/requerimento" if _ENTREGA.search(c) else None)
        if not intent:
            continue
        ano = int(m.group(3)) if m.group(3) else (int(data_ato[:4]) if data_ato else 0)
        if not ano:
            continue
        push(_iso(ano, _MES[m.group(2)], int(m.group(1))), intent, "alta", "data no texto", m.start())
    # 4) relativo em DIAS a contar da publicação/assinatura
    for m in re.finditer(r"(\d{1,3})\s*(?:\([^)]*\)\s*)?dias?\s+(?:úteis\s+)?(?:,?\s*)?"
                         r"(?:a\s+contar|contad[oa]s?|a\s+partir)\s+d[ae]\s+(?:sua\s+)?"
                         r"(public|assinatura|data|receb|notific|ciênc)", t):
        if _EXCLUI.search(win(m.start())):
            continue
        if data_ato:
            push(_add_dias(data_ato, int(m.group(1))), f"prazo ({m.group(1)} dias)",
                 "média", "assinatura+N", m.start())
    # 5) relativo em MESES/ANOS
    for m in re.finditer(r"(\d{1,2})\s*(?:\([^)]*\)\s*)?(mês|meses|anos?)\s+"
                         r"(?:a\s+contar|a\s+partir)\s+d[ae]\s+(?:sua\s+)?(assinatura|data|public)", t):
        if _EXCLUI.search(win(m.start())):
            continue
        if data_ato:
            mult = 12 if "ano" in m.group(2) else 1
            push(_add_meses(data_ato, int(m.group(1)) * mult),
                 f"prazo ({m.group(1)} {m.group(2)})", "média", "assinatura+N", m.start())
    return out


_ROTULO_PAPEL = {"INSTAURACAO": "instauração", "EXTENSAO": "prorrogação/recondução",
                 "SOBRESTAMENTO": "sobrestamento"}
_ROTULO_TIPO_PAD = {"PAD": "PAD", "PAD_SUMARIO": "PAD Sumário",
                    "SINVE": "Sindicância Investigativa", "SINDACUS": "Sindicância Acusatória"}
_PUBLICO_PAD = {"PAD": "Comissão de PAD", "PAD_SUMARIO": "Comissão de PAD Sumário",
                "SINVE": "Comissão de Sindicância", "SINDACUS": "Comissão de Sindicância"}


def _prazos_pad_sinve():
    """Um registro por ato PAD/SINVE com prazo literal declarado. A
    classificação vem do módulo do importador — aqui só se monta o payload."""
    achados = []
    for a in ATOS:
        blob = _norm_pad(a.get("ementa") or "") + " " + _norm_pad(
            f"{a.get('conteudoResumido') or ''} {a.get('textoBusca') or ''}")
        tipo = classifica_tipo(blob)
        if tipo is None:
            continue
        papel = classifica_papel(blob)
        if papel == "OUTRO":
            continue
        dias = extrai_dias(blob)
        if dias is None:
            continue
        data_ato = a.get("dataAssinatura") or ""
        if not re.match(r"^\d{4}-\d{2}-\d{2}", data_ato):
            continue
        achados.append({
            "ato": a, "tipo": tipo, "papel": papel, "dias": dias,
            "dataLimite": _add_dias(data_ato, dias),
            "publico": _PUBLICO_PAD.get(tipo, "Comissão"),
            "origem": (f"{_ROTULO_TIPO_PAD.get(tipo, tipo)} · "
                       f"{_ROTULO_PAPEL.get(papel, papel)} · prazo de {dias} dias"),
        })
    return achados


def _mexido_depois(a):
    return any(r.get("relacao") in ("Altera", "Revoga") for r in (a.get("referenciadoPor") or []))


def prazos_payload():
    corte = (datetime.date.today() - datetime.timedelta(days=90)).isoformat()
    prazos = []

    # (1) PAD/SINVE, alta confiança. cadeiaTotal = quantos atos do mesmo
    # processo SEI compõem a cadeia (instauração → prorrogações).
    pad = _prazos_pad_sinve()
    cadeia = defaultdict(set)
    for p in pad:
        sei = p["ato"].get("processoSei")
        if sei:
            a = p["ato"]
            cadeia[sei].add((a.get("tipoAto"), a.get("orgaoEmissor"), a.get("numero"), a.get("ano")))
    for p in pad:
        a = p["ato"]
        sei = a.get("processoSei") or ""
        prazos.append({
            "atoId": a["id"], "atoLabel": f"{a.get('tipoAto')} nº {a.get('numero')}/{a.get('ano')}",
            "sigla": a.get("orgaoEmissor") or "", "tipo": p["tipo"], "dataLimite": p["dataLimite"],
            "conf": "alta", "base": "PAD_SINVE", "textoOrigem": p["origem"],
            "linkBoletim": a.get("linkBoletim"), "dataAto": a.get("dataAssinatura"),
            "mexidoDepois": _mexido_depois(a), "status": a.get("status") or "Ativo",
            "ementa": a.get("ementa") or "", "publico": p["publico"],
            "processoSei": sei, "cadeiaTotal": len(cadeia.get(sei, ())),
        })

    # (2) prazos gerais, heurísticos.
    for a in ATOS:
        texto = f"{a.get('ementa') or ''} . {a.get('conteudoResumido') or ''} . {a.get('textoBusca') or ''}"
        for p in extrair_prazos(texto, a.get("dataAssinatura")):
            prazos.append({
                "atoId": a["id"], "atoLabel": f"{a.get('tipoAto')} nº {a.get('numero')}/{a.get('ano')}",
                "sigla": a.get("orgaoEmissor") or "", "tipo": p["tipo"], "dataLimite": p["dataLimite"],
                "conf": p["conf"], "base": p["base"], "textoOrigem": p["origem"],
                "linkBoletim": a.get("linkBoletim"), "dataAto": a.get("dataAssinatura"),
                "mexidoDepois": _mexido_depois(a), "status": a.get("status") or "Ativo",
                "ementa": a.get("ementa") or "",
                "publico": inferir_publico(a.get("ementa") or "", p["ctx"]),
                "processoSei": a.get("processoSei") or "", "cadeiaTotal": 0,
            })

    # Mesma janela do PHP: nada que venceu há mais de 90 dias.
    prazos = [p for p in prazos if p["dataLimite"] >= corte]
    prazos.sort(key=lambda p: p["dataLimite"])
    return {"prazos": prazos}


def pad_cadeia_payload(proc):
    """Cadeia completa de um processo PAD/SINVE, em ordem cronológica. Sem
    filtro de data: aqui o que interessa é o histórico inteiro."""
    proc = (proc or "").strip()
    if not proc:
        return {"erro": "processo ausente"}, 400
    itens = [p for p in _prazos_pad_sinve() if (p["ato"].get("processoSei") or "") == proc]
    itens.sort(key=lambda p: (p["ato"].get("dataAssinatura") or "", p["ato"]["id"]))
    # Colapsa duplicata de chave natural (mesma portaria republicada em outro
    # boletim vira uid -2/-3): na cadeia é um ato lógico só.
    vistos, unicos = set(), []
    for p in itens:
        a = p["ato"]
        sig = (f"{a.get('tipoAto')} nº {a.get('numero')}/{a.get('ano')}",
               a.get("orgaoEmissor"), a.get("dataAssinatura"))
        if sig in vistos:
            continue
        vistos.add(sig)
        unicos.append(p)
    n = len(unicos)
    atos = []
    for idx, p in enumerate(unicos):
        a = p["ato"]
        tr = (p["origem"] or "").lower()
        papel = ("Sobrestamento" if "sobrest" in tr else
                 "Prorrogação/recondução" if ("prorrog" in tr or "recondu" in tr) else
                 "Instauração" if "instaura" in tr else "—")
        atos.append({
            "id": a["id"], "atoLabel": f"{a.get('tipoAto')} nº {a.get('numero')}/{a.get('ano')}",
            "sigla": a.get("orgaoEmissor") or "", "tipo": p["tipo"], "papel": papel,
            "dataAto": a.get("dataAssinatura"), "dataLimite": p["dataLimite"],
            "ementa": a.get("ementa") or "", "status": a.get("status") or "Ativo",
            "textoOrigem": p["origem"], "linkBoletim": a.get("linkBoletim"),
            "vigente": idx == n - 1,   # o mais recente carrega o prazo vigente
        })
    return {"processo": proc, "total": n, "atos": atos}, 200


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
            self._send(comissoes_payload(q.get("corpo", [""])[0],
                                         q.get("janela", [""])[0]))
        elif recurso == "politicas":
            self._send(politicas_payload(q.get("slug", [""])[0]))
        elif recurso == "ods":
            self._send(ods_payload(q.get("n", [""])[0]))
        elif recurso == "chefias":
            self._send(chefias_payload())
        elif recurso == "insights":
            self._send(insights_payload(q.get("ano", [""])[0]))
        elif recurso == "analitico":
            self._send(analitico_payload())
        elif recurso == "prazos":
            self._send(prazos_payload())
        elif recurso == "pad_cadeia":
            obj, code = pad_cadeia_payload(q.get("processo", [""])[0])
            self._send(obj, code)
        elif recurso == "ato":
            f = ficha_payload(aid)
            self._send(f if f else {"erro": "não encontrado"}, 200 if f else 404)
        else:
            self._send(lista_payload(q))


if __name__ == "__main__":
    print("Mock API em http://127.0.0.1:8900")
    print("  /stats /filtros /atos /atos/{id} /chefias /mandatos /prazos")
    print("  /pad_cadeia?processo= /insights?ano= /analitico /jornada")
    print("  /cooperacao /comissoes /politicas /ods /dossie?siape=")
    ThreadingHTTPServer(("127.0.0.1", 8900), H).serve_forever()
