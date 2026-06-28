# -*- coding: utf-8 -*-
"""
Extrator de Atos do Boletim de Serviço da UFF
==============================================

Lê os PDFs do Boletim de Serviço (https://boletimdeservico.uff.br) e produz
uma base estruturada (CSV/XLSX/JSON) com um registro por ato administrativo,
incluindo:

  - tipo, órgão/sigla, número, data do ato e ementa
  - número do Boletim, data do Boletim, seção e página
  - processos SEI citados (23069.XXXXXX/AAAA-DD)
  - código SEI do documento (código verificador)
  - relações entre atos: ALTERA / REVOGA / SUBSTITUI / RETIFICA /
    REPUBLICA / TORNA SEM EFEITO / PRORROGA / CITA

Uso:
    python extrair_boletim.py                 # processa todos os PDFs da pasta ./boletins
    python extrair_boletim.py 53-26.pdf 54-26.pdf 55-26.pdf
    python extrair_boletim.py --pasta "C:/.../Downloads"

Requisitos: PyMuPDF (pip install pymupdf) e openpyxl (pip install openpyxl).
"""

import sys
import os
import re
import json
import glob
import argparse
import unicodedata
from datetime import datetime

import fitz  # PyMuPDF

# --------------------------------------------------------------------------- #
# Constantes / vocabulário
# --------------------------------------------------------------------------- #

MESES = {
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8, "setembro": 9,
    "outubro": 10, "novembro": 11, "dezembro": 12,
}

# Tipos de ato reconhecidos no início de um título.
TIPOS = [
    "DETERMINAÇÃO DE SERVIÇO",
    "INSTRUÇÃO NORMATIVA",
    "NORMA DE SERVIÇO",
    "ORDEM DE SERVIÇO",
    "RESOLUÇÃO",
    "PORTARIA",
    "DECISÃO",
    "DELIBERAÇÃO",
    "EDITAL",
    "COMUNICADO",
    "RESUMO DE DESPACHOS E DECISÕES",
    "RESUMO DE DESPACHOS",
]
# Regex alternativa de tipos (mais longos primeiro p/ casar o mais específico)
TIPOS_RE = "|".join(re.escape(t) for t in sorted(TIPOS, key=len, reverse=True))

# Título de um ato. Ex.:
#   DETERMINAÇÃO DE SERVIÇO COLUNI/UFF Nº. 20, DE 12 DE JUNHO DE 2026
#   PORTARIA Nº 1004, DE 10 DE JUNHO DE 2026
#   RESOLUÇÃO CEPEX/UFF Nº 004 AR, DE 10 DE JUNHO DE 2026
TITULO_RE = re.compile(
    r"(?P<tipo>%s)\s+"
    r"(?P<orgao>[A-ZÀ-Ú0-9/().\- ]{0,40}?)?\s*"
    r"N[ºo°]?\.?\s*(?P<numero>[\d\.]+(?:\s*[A-Z]{1,4})?)\s*,?\s*"
    # Conectores de data podem vir minúsculos: as portarias da Reitoria (SIGA-EX)
    # saem como "Nº 68.884 de 4 de fevereiro de 2026". O TIPO continua exigido em
    # MAIÚSCULO, então citações minúsculas no corpo ("portaria nº 8858, de ...")
    # NÃO viram falso título.
    r"[Dd][Ee]\s+(?P<dia>\d{1,2})\s+[Dd][Ee]\s+(?P<mes>[A-Za-zçÇãÃéíóúâêôõ]+)\s+[Dd][Ee]\s+(?P<ano>\d{4})"
    % TIPOS_RE
)

# Processo SEI: 23069.166342/2026-40  (aceita espaços no lugar de . / -)
PROC_RE = re.compile(r"23069[.\s]\d{6}[/\s]\d{4}[-\s]\d{2}")
# Código verificador SEI: "SEI nº 3441183"  ou  "(3442574)"
SEI_DOC_RE = re.compile(r"SEI\s*n[ºo°]?\.?\s*(\d{6,8})")
SEI_DOC_PAREN_RE = re.compile(r"\((\d{6,8})\)")

# Matrícula SIAPE: "SIAPE 1642620", "Siape nº 1642620", "Matrícula SIAPE nº 2364493"
SIAPE_RE = re.compile(r"(?:SIAPE|Siape|Matr[íi]cula\s+SIAPE)[:\s]*n?[ºo°]?\.?\s*(\d{6,7})", re.I)

# Nome da pessoa citada, ancorado na matrícula SIAPE que aparece logo depois.
# _CONNECT: conectores que ficam minúsculos no nome ("de", "da", ...).
# _BLOCK_NOME: verbos/cargos/descritores que NÃO fazem parte do nome (sem acento).
_CONNECT = {"de", "da", "do", "das", "dos", "e"}
_BLOCK_NOME = set((
    "professor professora reitor reitora diretor diretora coordenador coordenadora coord "
    "chefe presidente secretario secretaria tecnico analista assistente magisterio superior "
    "matricula codigo cargo ocupante servidor servidora substituto substituta membro membros "
    "comissao subcomissao universidade federal fluminense ministerio educacao departamento "
    "divisao coordenacao reitoria central documento paragrafo considerando quadro permanente "
    "senhor senhora gabinete vice decano superintendente lotar designar dispensar exonerar "
    "nomear conceder autorizar instituir revogar alterar prorrogar tornar retificar republicar "
    "considerar resolver delegar aprovar homologar redistribuido "
    "professores professoras docente docentes diretores coordenadores coordenadoras chefes presidentes "
    "secretarios tecnicos analistas assistentes servidores substitutos assuntos educacionais "
    "educacional gerais administrativos administrativa academicos academica financeiros "
    "institucional institucionais setor nucleo gerencia assessoria pessoal ensino pesquisa "
    "extensao graduacao licenca afastamento concessao capacitacao"
).split())
_PALAVRA_NOME = r"(?:[A-ZÀ-Ú][a-zà-ú]+|[A-ZÀ-Ú]{2,})"
NOME_RE = re.compile(r"%s(?:\s+(?:de|da|do|das|dos|e|%s)){1,6}" % (_PALAVRA_NOME, _PALAVRA_NOME))

# Linha de cabeçalho repetida em cada página do ato
HEADER_BS_RE = re.compile(
    r"UNIVERSIDADE FEDERAL FLUMINENSE.{0,5}BOLETIM DE SERVIÇO", re.I)
ANO_NUM_RE = re.compile(r"ANO\s+([IVXLCDM]+)\s*.{0,4}\s*N[º°o]?\.?\s*(\d+)", re.I)
DATA_BS_RE = re.compile(r"\b(\d{2}/\d{2}/\d{4})\b")
SECAO_RE = re.compile(r"SEÇÃO\s+([IVX]+)\s+(?:PÁG|P)\.?\s*0?(\d+)", re.I)

# Verbos que indicam relação entre atos (ordem = prioridade de classificação).
# Cada par (rótulo, regex). A busca é ANCORADA no ato citado: para cada
# referência a outro ato, olha-se o texto IMEDIATAMENTE ANTERIOR procurando
# um destes verbos.
VERBOS_RELACAO = [
    ("REVOGA",           re.compile(r"revog", re.I)),
    ("TORNA SEM EFEITO", re.compile(r"torna(r|m)?\s+sem\s+efeito", re.I)),
    ("SUBSTITUI",        re.compile(r"substitu", re.I)),
    ("RETIFICA",         re.compile(r"retific", re.I)),
    ("REPUBLICA",        re.compile(r"republic", re.I)),
    ("ANULA",            re.compile(r"\banul", re.I)),
    ("PRORROGA",         re.compile(r"prorrog", re.I)),
    ("ALTERA",           re.compile(r"alter(a|ar|ação|açao)", re.I)),
    ("CITA",             re.compile(r"conforme|nos\s+termos|com\s+base|com\s+fundamento|"
                                    r"previst|de\s+que\s+trata|estabelecid|delegad", re.I)),
]
# Verbo no início da ementa -> natureza do ato (para classificação rápida)
ACAO_EMENTA_RE = re.compile(
    r"^\s*(Altera|Revoga|Substitui|Retifica|Republica|Designa|Designar|Dispõe|"
    r"Prorroga|Torna|Aprova|Cria|Institui|Estabelece|Nomeia|Exonera|Dispensa|"
    r"Concede|Autoriza|Delega|Constitui|Homologa|Cancela|Suspende|Anula)", re.I)

# Referência a um ato citado dentro do corpo, ex.:
#   "Portaria nº 65.784, de 29/11/2019"
#   "DTS GES/INF/UFF nº 16, de 22 de agosto de 2025"
#   "Resolução CUV nº 026 de 18 de abril de 2017"
REF_TIPOS = (r"Portaria|Resolução|Determinação de Serviço|DTS|Norma de Serviço|"
             r"Instrução Normativa|Decisão|Edital|Ordem de Serviço|Deliberação")
REF_RE = re.compile(
    r"(?P<tipo>(?i:%s))\s+(?P<orgao>[A-ZÀ-Ú0-9/().]{1,25}(?:\s[A-ZÀ-Ú0-9/().]{1,15}){0,3})?\s*"
    r"n[ºo°]?\.?\s*(?P<numero>\d[\d\.]*(?:\s*[A-Z]{1,4})?)" % REF_TIPOS)

# Referência a outro Boletim: "publicada no BS nº 102, de 01/09/2025"
BS_REF_RE = re.compile(r"BS\s*n[ºo°]?\.?\s*(\d+)\s*,?\s*de\s*(\d{2}/\d{2}/\d{4})", re.I)


# --------------------------------------------------------------------------- #
# Funções utilitárias
# --------------------------------------------------------------------------- #

# Caracteres de controle ilegais (rejeitados por XLSX e indesejados no resto)
CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def limpar(txt):
    """Normaliza espaços/quebras de linha e remove caracteres de controle."""
    txt = CTRL_RE.sub("", txt)
    txt = re.sub(r"[ \t]+", " ", txt)
    txt = re.sub(r"\s*\n\s*", " ", txt)
    return txt.strip()


def normaliza_proc(s):
    """Normaliza um processo SEI para 23069.XXXXXX/AAAA-DD."""
    d = re.sub(r"\D", "", s)
    if len(d) >= 17:
        return f"{d[0:5]}.{d[5:11]}/{d[11:15]}-{d[15:17]}"
    return s.strip()


def data_iso(dia, mes_nome, ano):
    m = MESES.get(mes_nome.lower().strip())
    if not m:
        return ""
    try:
        return f"{int(ano):04d}-{m:02d}-{int(dia):02d}"
    except ValueError:
        return ""


def link_sei_processo(proc):
    """Link para a pesquisa pública de processos do SEI/UFF."""
    if not proc:
        return ""
    return ("https://sei.uff.br/sei/modulos/pesquisa/"
            "md_pesq_processo_pesquisar.php?acao_externa=protocolo_pesquisar"
            "&acao_origem_externa=protocolo_pesquisar"
            "&id_orgao_acesso_externo=0&txtProtocoloPesquisa=" + proc)


def link_sei_documento(cod):
    """Link para conferência pública de documento do SEI/UFF (código verificador)."""
    if not cod:
        return ""
    return ("https://sei.uff.br/sei/controlador_externo.php?"
            "acao=documento_conferir&id_orgao_acesso_externo=0&id_documento=" + str(cod))


# --------------------------------------------------------------------------- #
# Parsing de um PDF
# --------------------------------------------------------------------------- #

def metadados_bs(texto_paginas):
    """Descobre número/data/ano do Boletim a partir da capa."""
    bs_num = bs_data = bs_ano = ""
    capa = "\n".join(texto_paginas[:3])
    ma = re.search(r"ANO\s+([IVXLCDM]+)", capa)
    if ma:
        bs_ano = ma.group(1)
    mn = re.search(r"N[.\s]*[°ºo]?\s*(\d{1,4})", capa)
    if mn:
        bs_num = mn.group(1)
    md = DATA_BS_RE.search(capa)
    if md:
        bs_data = md.group(1)
    return bs_num, bs_data, bs_ano


def contexto_secao_pagina(trecho):
    """Extrai seção e página do(s) cabeçalho(s) presentes no trecho do ato."""
    secao = pagina = ""
    m = SECAO_RE.search(trecho)
    if m:
        secao, pagina = m.group(1), m.group(2)
    return secao, pagina


def classifica_verbo(trecho_anterior):
    """Dado o texto que antecede uma referência, retorna o rótulo da relação."""
    melhor = None
    melhor_pos = -1
    for rotulo, rgx in VERBOS_RELACAO:
        for vm in rgx.finditer(trecho_anterior):
            if vm.start() > melhor_pos:      # verbo mais próximo da referência
                melhor_pos = vm.start()
                melhor = rotulo
    return melhor


def detecta_relacoes(ementa, corpo, sigla_atual, numero_atual):
    """
    Encontra relações entre atos. ANCORA na referência a um ato citado e
    procura, nos ~75 caracteres anteriores, o verbo que define a relação
    (Altera/Revoga/Substitui/...). Evita autorreferências e citações de leis.
    """
    relacoes = []
    texto = limpar(ementa) + " ¶ " + limpar(corpo)
    vistos = set()

    for rm in REF_RE.finditer(texto):
        ato_citado = monta_ref(rm)
        if not ato_citado:
            continue
        # ignora autorreferência (mesma sigla + mesmo número)
        num_ref = re.sub(r"\D", "", rm.group("numero"))
        if num_ref and num_ref == re.sub(r"\D", "", numero_atual) and \
           (sigla_atual and sigla_atual.lower() in ato_citado.lower()):
            continue

        anterior = texto[max(0, rm.start() - 75): rm.start()]
        rotulo = classifica_verbo(anterior)
        if not rotulo:
            continue  # referência sem verbo de relação -> ruído (não registra)

        # BS de origem do ato citado (logo após a referência)
        seguinte = texto[rm.end(): rm.end() + 90]
        bs_origem = ""
        bm = BS_REF_RE.search(seguinte)
        if bm:
            bs_origem = f"BS {bm.group(1)} de {bm.group(2)}"

        chave = (rotulo, re.sub(r"\s+", "", ato_citado.lower()))
        if chave in vistos:
            continue
        vistos.add(chave)
        relacoes.append({
            "relacao": rotulo,
            "ato_citado": ato_citado,
            "bs_origem": bs_origem,
            "trecho": limpar(texto[max(0, rm.start() - 75): rm.end() + 30]),
        })
    return relacoes


ACRONIMOS = {"Dts": "DTS", "Rdd": "RDD", "In": "IN", "Ns": "NS", "Os": "OS",
             "Uff": "UFF", "Cuv": "CUV", "Cepex": "CEPEX", "Cepx": "CEPEx"}


def monta_ref(rm):
    tipo = limpar(rm.group("tipo")).title()
    tipo = ACRONIMOS.get(tipo, tipo)
    orgao = re.sub(r"\s+", " ", limpar(rm.group("orgao") or "")).strip(" /.,")
    num = limpar(rm.group("numero"))
    if not re.search(r"\d", num):
        return ""
    partes = [tipo]
    if orgao:
        partes.append(orgao)
    partes.append("nº " + num)
    return " ".join(partes)


def parse_pdf(caminho):
    doc = fitz.open(caminho)
    paginas = [doc[p].get_text() for p in range(doc.page_count)]
    doc.close()

    bs_num, bs_data, bs_ano = metadados_bs(paginas)
    arquivo = os.path.basename(caminho)

    # texto com marcadores de página para localizar seção/página por offset
    full = ""
    page_offsets = []  # (offset_inicio, numero_pagina, texto_pagina)
    for i, t in enumerate(paginas):
        page_offsets.append((len(full), i + 1, t))
        full += t + "\n"

    # Localiza todos os títulos (pulando o SUMÁRIO, onde aparecem só listas).
    titulos = []
    for m in TITULO_RE.finditer(full):
        # ignora ocorrências dentro do sumário (heurística: sem "RESOLVE"/"Art."
        # logo depois e com muitos títulos colados não é o caso; melhor filtrar
        # por presença do cabeçalho do BS antes). Mantemos todos e filtramos
        # quando o corpo for vazio.
        titulos.append(m)

    atos = []
    for idx, m in enumerate(titulos):
        ini = m.start()
        fim = titulos[idx + 1].start() if idx + 1 < len(titulos) else len(full)
        trecho = full[ini:fim]

        # corpo sem o cabeçalho/rodapé repetido do BS
        corpo = HEADER_BS_RE.sub(" ", trecho)
        corpo = re.sub(r"#\s*#\s*#\s*#\s*#\s*#", " ", corpo)

        # seção/página: procura no trecho IMEDIATAMENTE antes do título também
        ctx = full[max(0, ini - 400): ini + 200]
        secao, pagina = contexto_secao_pagina(ctx)

        tipo = limpar(m.group("tipo"))
        orgao = limpar(m.group("orgao") or "")
        orgao = re.sub(r"\s+", " ", orgao).strip(" /.,")
        numero = limpar(m.group("numero"))
        data_ato = data_iso(m.group("dia"), m.group("mes"), m.group("ano"))
        ano_ato = m.group("ano")

        # Ementa: texto entre o fim do título e o "RESOLVE"/"O REITOR"/etc.
        pos_resto = m.end()
        resto = full[pos_resto: pos_resto + 1200]
        resto = HEADER_BS_RE.sub(" ", resto)
        ementa = extrai_ementa(resto)

        # Assinante: última linha em CAIXA ALTA antes de cargo/separador
        signatario = extrai_signatario(trecho)

        # Processos SEI e código do documento
        procs = []
        for pm in PROC_RE.finditer(trecho):
            p = normaliza_proc(pm.group(0))
            if p not in procs:
                procs.append(p)
        sei_doc = ""
        sd = SEI_DOC_RE.search(trecho)
        if sd:
            sei_doc = sd.group(1)
        else:
            # padrão "(3442574)" perto da assinatura
            sp = SEI_DOC_PAREN_RE.search(trecho)
            if sp:
                sei_doc = sp.group(1)

        # ID do órgão/sigla "limpo" (sem /UFF)
        sigla = orgao.replace("/UFF", "").replace("UFF", "").strip(" /")

        relacoes = detecta_relacoes(ementa, corpo, sigla, numero)

        ma = ACAO_EMENTA_RE.search(ementa)
        tipo_acao = ma.group(1).title() if ma else ""

        # Texto do corpo para busca por NOME (pega nomes em tabelas, listas etc.)
        # e SIAPEs explícitas para exibição. O texto cobre o que a ementa não tem.
        corpo_busca = limpar(corpo).lower()[:7000]
        siapes = sorted(set(SIAPE_RE.findall(trecho)))

        ato = {
            "arquivo": arquivo,
            "bs_numero": bs_num,
            "bs_data": bs_data,
            "secao": secao,
            "pagina": pagina,
            "tipo": tipo,
            "orgao": orgao,
            "sigla": sigla,
            "numero": numero,
            "ano": ano_ato,
            "data_ato": data_ato,
            "identificador": monta_identificador(tipo, sigla, numero, ano_ato),
            "tipo_acao": tipo_acao,
            "ementa": ementa,
            "signatario": signatario,
            "processos_sei": procs,
            "processo_sei_principal": procs[0] if procs else "",
            "sei_documento": sei_doc,
            "link_sei_processo": link_sei_processo(procs[0] if procs else ""),
            "link_sei_documento": link_sei_documento(sei_doc),
            "relacoes": relacoes,
            "altera": "; ".join(r["ato_citado"] for r in relacoes if r["relacao"] == "ALTERA"),
            "revoga": "; ".join(r["ato_citado"] for r in relacoes if r["relacao"] in ("REVOGA", "TORNA SEM EFEITO", "ANULA")),
            "substitui": "; ".join(r["ato_citado"] for r in relacoes if r["relacao"] in ("SUBSTITUI", "RETIFICA", "REPUBLICA")),
            "cita": "; ".join(r["ato_citado"] for r in relacoes if r["relacao"] == "CITA"),
            "siapes": siapes,
            "pessoas": extrai_pessoas(trecho),
            "corpo_busca": corpo_busca,
        }
        # filtra falsos positivos: títulos capturados dentro do sumário costumam
        # ter corpo muito curto e nenhum verbo "RESOLVE/Art./O ... DA UFF".
        corpo_baixo = trecho.lower()
        tem_corpo = ("resolve" in corpo_baixo or "art." in corpo_baixo
                     or "art " in corpo_baixo or "considerando" in corpo_baixo
                     or len(trecho) > 700)
        if tem_corpo:
            atos.append(ato)

    return atos, {"bs_numero": bs_num, "bs_data": bs_data, "bs_ano": bs_ano,
                  "arquivo": arquivo, "paginas": len(paginas)}


def monta_identificador(tipo, sigla, numero, ano):
    siglas_curtas = {
        "DETERMINAÇÃO DE SERVIÇO": "DTS",
        "RESUMO DE DESPACHOS E DECISÕES": "RDD",
        "RESUMO DE DESPACHOS": "RDD",
        "INSTRUÇÃO NORMATIVA": "IN",
        "NORMA DE SERVIÇO": "NS",
        "ORDEM DE SERVIÇO": "OS",
    }
    base = siglas_curtas.get(tipo, tipo.title())
    partes = [base]
    if sigla:
        partes.append(sigla)
    partes.append(f"nº {numero}/{ano}")
    return " ".join(partes)


def extrai_ementa(resto):
    """A ementa é o texto descritivo logo após o título, antes do dispositivo."""
    # corta no primeiro marcador de início de dispositivo
    cortes = [r"\bRESOLVE\b", r"\bRESOLVEM\b", r"\bO\s+REITOR\b", r"\bA\s+REITORA\b",
              r"\bO\s+CONSELHO\b", r"\bO\s+COORDENADOR", r"\bA\s+COORDENADOR",
              r"\bO\s+CHEFE\b", r"\bA\s+DIRETORA\b", r"\bO\s+DIRETOR\b",
              r"\bO\s+PR[ÓO]-REITOR", r"\bConsiderando\b", r"\bArt\.?\s*1"]
    pos = len(resto)
    for c in cortes:
        mm = re.search(c, resto)
        if mm and mm.start() < pos:
            pos = mm.start()
    ementa = limpar(resto[:pos])
    # remove números de página/seção residuais
    ementa = re.sub(r"SEÇÃO\s+[IVX]+\s+P[ÁA]G\.?\s*\d+", "", ementa, flags=re.I)
    ementa = re.sub(r"ANO\s+[IVXLCDM]+.{0,3}N[º°o]?\.?\s*\d+", "", ementa, flags=re.I)
    ementa = re.sub(r"\d{2}/\d{2}/\d{4}", "", ementa)
    return limpar(ementa)[:600]


def extrai_signatario(trecho):
    """Heurística: nome em CAIXA ALTA seguido por um cargo conhecido."""
    linhas = [l.strip() for l in trecho.splitlines() if l.strip()]
    cargos = re.compile(r"(REITOR|DIRETOR|COORDENADOR|CHEFE|PRESIDENTE|SUPERINTEND|"
                        r"PR[ÓO]-REITOR|VICE|SECRET|DECAN)", re.I)
    for i, l in enumerate(linhas):
        if cargos.search(l) and i > 0:
            cand = linhas[i - 1]
            letras = re.sub(r"[^A-Za-zÀ-Ú]", "", cand)
            if letras and cand.upper() == cand and len(letras) >= 6:
                return limpar(cand)
    return ""


def _fold(s):
    """minúsculas e sem acento, para comparar com a blocklist de nomes."""
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn").lower()


def _titlecase_nome(s):
    return " ".join(w.lower() if _fold(w) in _CONNECT else (w[:1].upper() + w[1:].lower())
                    for w in s.split())


def _limpa_nome(run):
    """Tira verbo/cargo/conector colado nas pontas; exige nome com 2+ palavras."""
    p = run.split()
    while p and (_fold(p[0]) in _BLOCK_NOME or _fold(p[0]) in _CONNECT):
        p.pop(0)
    while p and (_fold(p[-1]) in _BLOCK_NOME or _fold(p[-1]) in _CONNECT):
        p.pop()
    return _titlecase_nome(" ".join(p)) if len(p) >= 2 else ""


def nome_antes_siape(texto, pos):
    """Nome mais próximo ANTES da matrícula (posição pos), pulando cargos/verbos."""
    janela = texto[max(0, pos - 170): pos]
    for m in reversed(list(NOME_RE.finditer(janela))):
        nome = _limpa_nome(m.group(0))
        if nome:
            return nome
    return ""


def extrai_pessoas(trecho):
    """[{nome, siape}] das pessoas citadas — uma por matrícula, sem repetir."""
    pessoas, vistos = [], set()
    for m in SIAPE_RE.finditer(trecho):
        s = m.group(1)
        if s in vistos:
            continue
        vistos.add(s)
        pessoas.append({"nome": nome_antes_siape(trecho, m.start()), "siape": s})
    return pessoas


# --------------------------------------------------------------------------- #
# Saídas
# --------------------------------------------------------------------------- #

COLUNAS = [
    ("identificador", "Identificador"),
    ("tipo", "Tipo"),
    ("sigla", "Órgão/Sigla"),
    ("numero", "Número"),
    ("ano", "Ano"),
    ("data_ato", "Data do ato"),
    ("tipo_acao", "Natureza"),
    ("ementa", "Ementa"),
    ("signatario", "Assinante"),
    ("altera", "Altera"),
    ("revoga", "Revoga / Torna sem efeito"),
    ("substitui", "Substitui / Retifica / Republica"),
    ("cita", "Cita / Fundamenta-se em"),
    ("processo_sei_principal", "Processo SEI"),
    ("sei_documento", "Doc. SEI"),
    ("link_sei_processo", "Link SEI (processo)"),
    ("link_sei_documento", "Link SEI (documento)"),
    ("bs_numero", "Boletim nº"),
    ("bs_data", "Data do Boletim"),
    ("secao", "Seção"),
    ("pagina", "Página"),
    ("arquivo", "Arquivo"),
]


def salvar_csv(atos, caminho):
    import csv
    with open(caminho, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow([c[1] for c in COLUNAS])
        for a in atos:
            w.writerow([a.get(c[0], "") for c in COLUNAS])


def _payload(atos, meta):
    return {"gerado_em": datetime.now().isoformat(timespec="seconds"),
            "boletins": meta, "total": len(atos), "atos": atos}


def salvar_json(atos, meta, caminho):
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(_payload(atos, meta), f, ensure_ascii=False, indent=1)


def salvar_dados_js(atos, meta, caminho):
    """Mesma base em JS para o portal.html funcionar offline (file://)."""
    with open(caminho, "w", encoding="utf-8") as f:
        f.write("window.DADOS = ")
        json.dump(_payload(atos, meta), f, ensure_ascii=False)
        f.write(";")


def salvar_xlsx(atos, caminho):
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
        from openpyxl.utils import get_column_letter
    except ImportError:
        print("  (openpyxl não instalado — pulei o XLSX; gere com pip install openpyxl)")
        return
    wb = Workbook()
    ws = wb.active
    ws.title = "Atos"
    cab = [c[1] for c in COLUNAS]
    ws.append(cab)
    fill = PatternFill("solid", fgColor="13315C")
    for j, _ in enumerate(cab, 1):
        cell = ws.cell(row=1, column=j)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = fill
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    def limpa_cel(v):
        return CTRL_RE.sub("", v) if isinstance(v, str) else v

    keys = [c[0] for c in COLUNAS]
    idx_proc = keys.index("link_sei_processo") + 1
    idx_doc = keys.index("link_sei_documento") + 1
    for a in atos:
        linha = [limpa_cel(a.get(c[0], "")) for c in COLUNAS]
        ws.append(linha)
        r = ws.max_row
        # hyperlinks nas colunas de link
        for col_key, col_idx in (("link_sei_processo", idx_proc), ("link_sei_documento", idx_doc)):
            url = a.get(col_key, "")
            if url:
                cell = ws.cell(row=r, column=col_idx)
                cell.hyperlink = url
                cell.value = "abrir SEI"
                cell.font = Font(color="0563C1", underline="single")
    larguras = {"identificador": 26, "ementa": 60, "altera": 28, "revoga": 28,
                "substitui": 28, "cita": 28, "signatario": 26, "tipo": 22,
                "link_sei_processo": 13, "link_sei_documento": 13}
    for j, c in enumerate(COLUNAS, 1):
        ws.column_dimensions[get_column_letter(j)].width = larguras.get(c[0], 12)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    # aba de relações (long format) — ótima para tabela dinâmica
    ws2 = wb.create_sheet("Relações")
    ws2.append(["Ato (origem)", "Relação", "Ato citado", "BS de origem", "Trecho"])
    for j in range(1, 6):
        c = ws2.cell(row=1, column=j)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = fill
    for a in atos:
        for rel in a.get("relacoes", []):
            ws2.append([limpa_cel(a["identificador"]), rel["relacao"],
                        limpa_cel(rel["ato_citado"]), limpa_cel(rel.get("bs_origem", "")),
                        limpa_cel(rel.get("trecho", ""))])
    for j, w in enumerate([28, 18, 30, 18, 70], 1):
        ws2.column_dimensions[get_column_letter(j)].width = w
    ws2.freeze_panes = "A2"
    ws2.auto_filter.ref = ws2.dimensions
    wb.save(caminho)


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main():
    ap = argparse.ArgumentParser(description="Extrator do Boletim de Serviço da UFF")
    ap.add_argument("pdfs", nargs="*", help="arquivos PDF (se vazio, usa --pasta)")
    ap.add_argument("--pasta", default=None, help="pasta com PDFs do boletim")
    ap.add_argument("--saida", default=".", help="pasta de saída")
    ap.add_argument("--sem-app", action="store_true",
                    help="não atualiza app/portal-data.json (use em testes/legado)")
    args = ap.parse_args()

    arquivos = list(args.pdfs)
    if not arquivos:
        pasta = args.pasta or os.path.join(os.path.dirname(__file__), "boletins")
        arquivos = sorted(glob.glob(os.path.join(pasta, "*.pdf")))
    if not arquivos:
        print("Nenhum PDF encontrado. Informe arquivos ou --pasta.")
        sys.exit(1)

    todos = []
    metas = []
    for caminho in arquivos:
        print(f"Lendo {os.path.basename(caminho)} ...", flush=True)
        atos, meta = parse_pdf(caminho)
        print(f"   -> {len(atos)} atos | BS {meta['bs_numero']} de {meta['bs_data']}")
        todos.extend(atos)
        metas.append(meta)

    os.makedirs(args.saida, exist_ok=True)
    salvar_csv(todos, os.path.join(args.saida, "atos.csv"))
    salvar_json(todos, metas, os.path.join(args.saida, "atos.json"))
    salvar_dados_js(todos, metas, os.path.join(args.saida, "dados.js"))
    salvar_xlsx(todos, os.path.join(args.saida, "atos.xlsx"))

    # Atualiza a base do app (Portal de Normas e Atos), se a pasta app/ existir
    # ao lado deste script (ambiente local). No CI isso é feito por gerar_dados_portal.
    app_dir = os.path.join(os.path.dirname(__file__), "app")
    if os.path.isdir(app_dir) and not args.sem_app:
        try:
            import gerar_dados_portal as gdp
            urls = {}
            man = os.path.join(args.pasta or os.path.join(os.path.dirname(__file__), "boletins"),
                               "_urls.json")
            if os.path.exists(man):
                with open(man, encoding="utf-8") as f:
                    urls = json.load(f)
            registros = gdp.converter(_payload(todos, metas), urls)
            destino = os.path.join(app_dir, "portal-data.json")
            with open(destino, "w", encoding="utf-8") as f:
                json.dump(registros, f, ensure_ascii=False)
            print(f"App atualizado: {len(registros)} atos -> app/portal-data.json")
        except Exception as e:
            print(f"  (aviso: não atualizei o app/portal-data.json: {e})")

    n_rel = sum(len(a["relacoes"]) for a in todos)
    n_sei = sum(1 for a in todos if a["processo_sei_principal"])
    print(f"\nTotal: {len(todos)} atos | {n_rel} relações detectadas | "
          f"{n_sei} com processo SEI")
    print(f"Gerados em {os.path.abspath(args.saida)}: atos.csv, atos.json, atos.xlsx")


if __name__ == "__main__":
    main()
