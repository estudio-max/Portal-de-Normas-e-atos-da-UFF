# -*- coding: utf-8 -*-
"""Porta FIEL de extrairPrazos + inferirPublico (repo/src/dataSource.ts) para
Python. Mesma logica de intent-anchoring (so extrai data perto de uma intencao
de prazo). Usada para (1) validar contra o corpus e (2) gerar o backfill da
tabela `prazo` do v2. O importador PHP tera um espelho identico desta logica.
"""
import re, datetime

MES = {"janeiro":1,"fevereiro":2,"março":3,"marco":3,"abril":4,"maio":5,"junho":6,
       "julho":7,"agosto":8,"setembro":9,"outubro":10,"novembro":11,"dezembro":12}

EXCLUI  = re.compile(r"(período\s+aquisitivo|aquisitivo|ônus\s+limitad|afastament|licença|capacitaç|suspens|penalidade|advertência|retroativ|\bfaltas?\b|ausência|puniç|apenad|designaç|designad|exercício\s+financeiro|mandato)")
INSCR   = re.compile(r"(inscriç|matrícul|requeriment|candidatur)")
RECURSO = re.compile(r"(recurso|impugnaç|interpos|contestaç)")
ENTREGA = re.compile(r"(entrega|envio|encaminh|apresentaç|protocol|submet|remess|preenchiment|manifestaç)")
VIGENCIA= re.compile(r"(comissã|banca|edital|credenciament|cadastr|chapa|portaria)")

def y4(y): n=int(y); return 2000+n if n<100 else n
def iso(y,m,d): return f"{y:04d}-{m:02d}-{d:02d}"
def valida_data(s):
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", s): return False
    return 2015 <= int(s[:4]) <= 2035
def add_dias(b,n):
    try: dt=datetime.date.fromisoformat(b)
    except ValueError: return ""
    return (dt+datetime.timedelta(days=n)).isoformat()
def add_meses(b,n):
    try: dt=datetime.date.fromisoformat(b)
    except ValueError: return ""
    mo=dt.month-1+n; y=dt.year+mo//12; mo=mo%12+1
    d=min(dt.day, [31,29 if y%4==0 and (y%100!=0 or y%400==0) else 28,31,30,31,30,31,31,30,31,30,31][mo-1])
    return datetime.date(y,mo,d).isoformat()

# ---- inferirPublico (fiel ao TS) ----
def inferir_publico(ementa, contexto):
    f = f"{ementa or ''} {contexto or ''}".lower()
    def has(p): return re.search(p, f) is not None
    if has(r"licitaç|pregão|contrataç|fornecedor|termo de referência|dispensa de licit|cotaç.o de preç|chamamento públic"): return "Fornecedores"
    if has(r"eleiç|consulta eleitoral|\bchapa|votaç|urna|escrutín|diretório acadêmic"): return "Comunidade (eleição)"
    dom = ("monitoria" if has(r"monitoria") else
           "pós-graduação" if has(r"mestrad|doutorad|pós-?gradua|\bppg|stricto sensu|lato sensu|resid.ncia médic|especializaç") else
           "seleção docente" if has(r"docente|professor|magistério|magisterio|processo seletivo simplificado|\bpss\b|concurso públic") else
           "bolsa" if has(r"pibic|pibid|iniciaç.o cient|\bbolsa") else
           "estágio" if has(r"estági") else
           "graduação" if has(r"graduaç|graduand|discente|\balun[oa]s?\b|estudante") else None)
    selec = has(r"inscriç|processo seletivo|seleç.o|candidat|concurso|\bedital|\bprova\b|classificaç")
    if selec: return f"Candidatos · {dom}" if dom else "Candidatos"
    if dom: return "Docentes" if dom=="seleção docente" else f"Discentes · {dom}"
    if has(r"servidor|técnico-?administrativ|\btae\b"): return "Comunidade acadêmica" if False else "Servidores"
    return "Comunidade acadêmica"

# ---- extrairPrazos (fiel ao TS: 5 passes) ----
def extrair_prazos(texto, data_ato):
    if not texto: return []
    t = texto.lower()
    out = []
    vistos = set()
    def win(i,w=95): return t[max(0,i-w):i+w]
    def snip(i): return "…"+re.sub(r"\s+"," ", t[max(0,i-48):i+55]).strip()+"…"
    def push(dl,tipo,conf,base,i):
        if valida_data(dl) and dl not in vistos:
            vistos.add(dl)
            out.append({"dataLimite":dl,"tipo":tipo,"conf":conf,"base":base,
                        "origem":snip(i),"ctx":t[max(0,i-170):i+170]})

    # 1) janela "de X a Y" — inscrição/recurso
    for m in re.finditer(r"de\s+(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\s+a\s+(\d{1,2})/(\d{1,2})/(\d{2,4})", t):
        c=win(m.start(),110)
        if EXCLUI.search(c): continue
        intent = "inscrição" if INSCR.search(c) else "recurso" if RECURSO.search(c) else None
        if not intent: continue
        push(iso(y4(m.group(6)),int(m.group(5)),int(m.group(4))), intent,"alta","data no texto",m.start())
    # 2) "até DD/MM/AAAA"
    for m in re.finditer(r"até\s+(?:o\s+dia\s+|as?\s+\d{1,2}h?\s+de\s+)?(\d{1,2})/(\d{1,2})/(\d{2,4})", t):
        c=win(m.start())
        if EXCLUI.search(c): continue
        intent = "inscrição" if INSCR.search(c) else "recurso" if RECURSO.search(c) else "entrega/requerimento" if ENTREGA.search(c) else "vigência/validade" if VIGENCIA.search(c) else None
        if not intent: continue
        push(iso(y4(m.group(3)),int(m.group(2)),int(m.group(1))), intent, "média" if intent=="vigência/validade" else "alta","data no texto",m.start())
    # 3) "até DD de MÊS (de AAAA)?"
    for m in re.finditer(r"até\s+(?:o\s+dia\s+)?(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?", t):
        if m.group(2) not in MES: continue
        c=win(m.start())
        if EXCLUI.search(c): continue
        intent = "inscrição" if INSCR.search(c) else "recurso" if RECURSO.search(c) else "entrega/requerimento" if ENTREGA.search(c) else None
        if not intent: continue
        ano = int(m.group(3)) if m.group(3) else (int(data_ato[:4]) if data_ato else None)
        if not ano: continue
        push(iso(ano,MES[m.group(2)],int(m.group(1))), intent,"alta","data no texto",m.start())
    # 4) relativo em DIAS
    for m in re.finditer(r"(\d{1,3})\s*(?:\([^)]*\)\s*)?dias?\s+(?:úteis\s+)?(?:,?\s*)?(?:a\s+contar|contad[oa]s?|a\s+partir)\s+d[ae]\s+(?:sua\s+)?(public|assinatura|data|receb|notific|ciênc)", t):
        c=win(m.start())
        if EXCLUI.search(c): continue
        if data_ato:
            dl=add_dias(data_ato,int(m.group(1)))
            if dl: push(dl,f"prazo ({m.group(1)} dias)","média","assinatura+N",m.start())
    # 5) relativo MESES/ANOS
    for m in re.finditer(r"(\d{1,2})\s*(?:\([^)]*\)\s*)?(mês|meses|anos?)\s+(?:a\s+contar|a\s+partir)\s+d[ae]\s+(?:sua\s+)?(assinatura|data|public)", t):
        c=win(m.start())
        if EXCLUI.search(c): continue
        mult = 12 if re.search(r"ano", m.group(2)) else 1
        if data_ato:
            dl=add_meses(data_ato,int(m.group(1))*mult)
            if dl: push(dl,f"prazo ({m.group(1)} {m.group(2)})","média","assinatura+N",m.start())
    return out
