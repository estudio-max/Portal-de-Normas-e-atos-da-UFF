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

# Matrícula SIAPE: "SIAPE 1642620", "Siape nº 1642620", "Matrícula SIAPE nº 2364493".
# Consome também a abreviação de "Matrícula" colada/pontuada ("Mat. SIAPE 123",
# "MATSIAPE 123") — senão o "MAT" era absorvido como sobrenome ("...SANTOS MAT").
SIAPE_RE = re.compile(
    r"(?:\b(?:matr[íi]cula|mat)\.?\s*)?(?:SIAPE|Siape)[:\s]*n?[ºo°]?\.?\s*(\d{6,7})", re.I)

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
    "extensao graduacao licenca afastamento concessao capacitacao "
    # cargos/ocupações — evita capturar o cargo no lugar do nome ("Auxiliar de
    # Enfermagem", "Produtor Cultural"). Só termos que NÃO servem de sobrenome.
    "auxiliar auxiliares enfermeiro enfermeira enfermagem medico medica odontologo odontologa "
    "dentista cirurgiao psicologo psicologa nutricionista farmaceutico farmaceutica bioquimico "
    "fisioterapeuta fonoaudiologo biologo biomedico veterinario zootecnista engenheiro engenheira "
    "arquiteto arquiteta quimico geologo estatistico economista contador contadora administrador "
    "administradora administrativo bibliotecario bibliotecaria documentalista arquivista museologo "
    "jornalista publicitario tradutor tradutora revisor revisora programador programadora operador "
    "operadora motorista telefonista recepcionista almoxarife vigilante porteiro copeiro cozinheiro "
    "cozinheira servente jardineiro eletricista mecanico soldador torneiro marceneiro desenhista "
    "fotografo diagramador instrumentador produtor produtora cultural social sociologo historiador "
    "pedagogo pedagoga artifice contabilidade laboratorio laboratorista "
    # áreas/departamentos e especialidades — em tabelas de colegiado o nome do
    # departamento antecede o nome da pessoa ("Psicologia João Batista..."). Só
    # termos que não servem de sobrenome.
    "sociologia antropologia geografia historia filosofia psicologia pedagogia letras linguistica "
    "comunicacao jornalismo economia administracao direito arquitetura engenharia matematica fisica "
    "quimica biologia geologia computacao informatica ciencia ciencias politica politicas sociais "
    "humanas naturais exatas biologicas medicina odontologia farmacia nutricao fisioterapia "
    "fonoaudiologia veterinaria cirurgia clinica pediatria ginecologia obstetricia cardiologia "
    "neurologia ortopedia radiologia anestesiologia dermatologia oftalmologia urologia patologia "
    "psiquiatria geriatria traumatologia bucomaxilofacial bucomaxilofaciais buco maxilo facial geral "
    # ruído de cabeçalho de tabela ("Nome:") e abreviação de "Matrícula" que colam no nome
    "nome mat"
).split())
# Classes de letras Latin-1 COMPLETAS: a faixa antiga "à-ú" não cobria ü/û/ý/ÿ
# nem Ü/Þ, o que truncava sobrenomes germânicos ("Frühauf"->"Fr", "SCHMÜTZ"->
# "Schm"). O apóstrofo ('/’) integra sobrenomes ("Sant'Anna", "Dal'Magro",
# "D'Almeida"). A cauda aceita CAIXA MISTA p/ tolerar typo de caps-lock do PDF
# ("LIma"->"Lima", "LIzarbe"->"Lizarbe").
_UP = "A-ZÀ-ÖØ-Þ"          # maiúsculas Latin-1 (pula × U+00D7)
_LO = "a-zà-öø-ÿ"          # minúsculas Latin-1 (pula ÷ U+00F7)
_LET = _UP + _LO
_AP = "'’"
_PALAVRA_NOME = r"[%s][%s]*(?:[%s][%s]+)*" % (_UP, _LET, _AP, _LET)
# NOME_CAPS_RE prioriza CAIXA ALTA (distingue nome de cargo, que vem em title-
# case): exige 2+ maiúsculas iniciais, mas tolera cauda minúscula de typo/OCR
# ("WASSERMAn" -> "Wasserman").
_PALAVRA_CAPS = r"[%s]{2,}[%s]*(?:[%s][%s]+)*" % (_UP, _LET, _AP, _LET)
# Conector: inclui "d'Aquino"/"d'Ávila" inteiros (senão o "d'" corta o sobrenome).
_CONN = r"(?:de|da|do|das|dos|e|d[%s][%s]*)" % (_AP, _LET)
NOME_RE = re.compile(r"%s(?:\s+(?:%s|%s)){1,6}" % (_PALAVRA_NOME, _CONN, _PALAVRA_NOME))
NOME_CAPS_RE = re.compile(r"%s(?:\s+(?:%s|%s)){1,6}" % (_PALAVRA_CAPS, _CONN, _PALAVRA_CAPS))

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
    orgao = re.sub(r"\s+", " ", limpar(rm.group("orgao") or "")).strip(" /.,-()")
    num = limpar(rm.group("numero"))
    if not re.search(r"\d", num):
        return ""
    partes = [tipo]
    if orgao:
        partes.append(orgao)
    partes.append("nº " + num)
    return " ".join(partes)


def _norm_pdf(s):
    """Normaliza o texto extraído do PDF, ANTES de qualquer parsing:
      - NFC: junta diacrítico combinante ('c'+cedilha -> 'ç') que truncava nomes
        ("Picanço"->"Picanc"), pois o regex parava na letra-base.
      - remove hífen-suave e caracteres de largura-zero que o PDF insere.
      - cola apóstrofo de sobrenome com espaço espúrio ("Sant’ Anna"->"Sant’Anna")."""
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", s)  # chars de controle (glitch de glifo)
    s = re.sub("[­​‌‍⁠﻿]", "", s)  # hífen-suave / largura-zero
    s = s.replace("\xa0", " ")     # espaço inquebrável -> espaço comum
    s = re.sub(r"([A-Za-zÀ-ÿ]['’])[ \t]+(?=[A-Za-zÀ-ÿ])", r"\1", s)
    return s


def parse_pdf(caminho):
    doc = fitz.open(caminho)
    paginas = [_norm_pdf(doc[p].get_text()) for p in range(doc.page_count)]
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
        orgao = re.sub(r"\s+", " ", orgao).strip(" /.,-()")
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

        # ID do órgão/sigla "limpo": tira traço/CONJUNTA/conector inicial e /UFF
        sigla = limpa_sigla(orgao)

        relacoes = detecta_relacoes(ementa, corpo, sigla, numero)

        ma = ACAO_EMENTA_RE.search(ementa)
        tipo_acao = ma.group(1).title() if ma else ""

        # Texto do corpo para busca por NOME (pega nomes em tabelas, listas etc.)
        # e SIAPEs explícitas para exibição. O texto cobre o que a ementa não tem.
        corpo_busca = limpar(corpo).lower()[:7000]
        siapes = sorted(set(SIAPE_RE.findall(trecho)))

        # Ementa inferida: só quando NÃO há ementa formal. Resume o dispositivo.
        ementa_resumo, ementa_inferida = "", False
        if len(ementa.strip()) < 12:
            ementa_resumo, ementa_inferida = sintetiza_ementa(corpo)

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
            "ementa_resumo": ementa_resumo,
            "ementa_inferida": ementa_inferida,
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
            "funcoes": extrai_funcoes(trecho),
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
    # remove números de página/seção e cabeçalho/rodapé do BS que vazam na ementa
    ementa = re.sub(r"(?i)ANO\s+[IVXLCDM]+\s*[–—-]?\s*N[.°º\s]*\d+", "", ementa)
    ementa = re.sub(r"(?i)SE[ÇC][ÃA]O\s+[IVX]+\s*P[ÁA]?G?[.\s]*\d+", "", ementa)
    ementa = re.sub(r"(?i)P[ÁA]G[.\s]*\d+", "", ementa)
    ementa = re.sub(r"\d{2}/\d{2}/\d{4}", "", ementa)
    ementa = re.sub(r"(?i)MINIST[ÉE]RIO\s+DA\s+EDUCA[ÇC][ÃA]O", "", ementa)
    ementa = re.sub(r"(?i)UNIVERSIDADE\s+FEDERAL\s+FLUMINENSE", "", ementa)
    ementa = re.sub(r"(?i)BOLETIM\s+DE\s+SERVI[ÇC]O", "", ementa)
    ementa = re.sub(r"#(?:\s*#)+", "", ementa)  # marcadores "# # # #" de rodapé
    # tira pontuação/rótulo iniciais (". ", ", ", "Ementa:") — ruído muito comum
    ementa = limpar(ementa)
    ementa = re.sub(r"^[\s.,;:–\- ]+", "", ementa)
    ementa = re.sub(r"(?i)^ementa\s*:?\s*", "", ementa)
    ementa = re.sub(r"^[\s.,;:–\- ]+", "", ementa)
    return limpar(ementa)[:600]


# --------------------------------------------------------------------------- #
# Ementa INFERIDA: para atos sem ementa formal, resume o próprio dispositivo
# (o texto após "resolve:") em 3ª pessoa. NÃO inventa nada — usa as palavras do
# ato. O resultado é marcado como inferido (ementa_inferida=True) para o portal
# exibir como "resumo automático", nunca confundido com a ementa oficial.
# --------------------------------------------------------------------------- #
# Verbo do dispositivo (infinitivo) -> forma na 3ª pessoa do singular.
_VERBO_EMENTA = [
    (r"tornar\s+sem\s+efeito", "Torna sem efeito"), (r"tornar\s+p[úu]blico", "Torna público"),
    (r"designar", "Designa"), (r"nomear", "Nomeia"), (r"exonerar", "Exonera"),
    (r"dispensar", "Dispensa"), (r"constituir", "Constitui"), (r"instituir", "Institui"),
    (r"conceder", "Concede"), (r"autorizar", "Autoriza"), (r"prorrogar", "Prorroga"),
    (r"alterar", "Altera"), (r"revogar", "Revoga"), (r"aprovar", "Aprova"),
    (r"homologar", "Homologa"), (r"retificar", "Retifica"), (r"republicar", "Republica"),
    (r"delegar", "Delega"), (r"criar", "Cria"), (r"estabelecer", "Estabelece"),
    (r"remover", "Remove"), (r"redistribuir", "Redistribui"), (r"lotar", "Lota"),
    (r"cancelar", "Cancela"), (r"suspender", "Suspende"), (r"determinar", "Determina"),
    (r"fixar", "Fixa"), (r"declarar", "Declara"), (r"convalidar", "Convalida"),
    (r"reconduzir", "Reconduz"), (r"destituir", "Destitui"), (r"substituir", "Substitui"),
    (r"conceituar", "Conceitua"), (r"ratificar", "Ratifica"), (r"dispor", "Dispõe sobre"),
    (r"interromper", "Interrompe"), (r"aposentar", "Aposenta"), (r"aplicar", "Aplica"),
    (r"atribuir", "Atribui"), (r"extinguir", "Extingue"), (r"atualizar", "Atualiza"),
    (r"publicar", "Publica"), (r"readaptar", "Readapta"), (r"incluir", "Inclui"),
    (r"excluir", "Exclui"), (r"abonar", "Abona"), (r"conferir", "Confere"),
    (r"transferir", "Transfere"), (r"anular", "Anula"), (r"validar", "Valida"),
]
_ENUM_EMENTA_RE = re.compile(
    r"(?i)^\s*(?:art\.?\s*\d+[ºo°.\-]*\s*[-–]?\s*|[ivx]{1,4}\s*[-–.)]\s*|"
    r"\d+\s*[-–.)]\s*|[a-z]\s*[-)]\s*|§\s*\d*[ºo°]?\s*|par[áa]grafo\s+\S+\s*[-–.:]?\s*)")
# Corte do objeto: ";" ou "." de fim de frase (NÃO o "." interno de nº de
# processo "23069.002753"), próximo item (II-, IV-), ou início de cláusula acessória.
_STOP_EMENTA_RE = re.compile(
    r"(?i)(?:;|\.(?=\s|$)|\bII+\s*[-–]|\bIV\s*[-–]|,?\s*\bmatr[íi]cula\b|,?\s*\bsiape\b|"
    r",?\s*\bc[óo]digo\b|\ba partir\b|\bcom valid|\bpelo per[íi]odo\b|\bno per[íi]odo\b|"
    r"\btendo em vista\b|\bem virtude\b|\bnos termos\b|\bem substitui|"
    r"\bpublique-se\b|\bregistre-se\b|\bfica\b)")
# Cláusula acessória inicial a descartar para chegar ao objeto real. Ex.:
# "dispensar, A PEDIDO, A PARTIR DE 04/08/2025, Fulano..." -> "Fulano...".
_CLAUSULA_INI_RE = re.compile(
    r"(?i)^\s*,?\s*(?:"
    r"consoante\b[^,]*|conforme\b[^,]*|nos termos\b[^,]*|tendo em vista\b[^,]*|"
    r"de acordo com\b[^,]*|com base n[oa]\b[^,]*|a pedido|"
    r"a partir d[eo]\b[^,]*|a contar d[eo]\b[^,]*|com efeitos?\b[^,]*|"
    r"pelo per[íi]odo\b[^,]*|no per[íi]odo\b[^,]*|retroativ[oa]\b[^,]*|"
    r"em car[áa]ter\b[^,]*|por \d+[^,]*"
    r")\s*,\s*")
_MINUSC_FRASE = {"de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "no",
                 "na", "nos", "nas", "para", "por", "com", "sem", "ao", "aos", "à", "às",
                 "que", "sob", "sobre", "entre"}


def _titlecase_frase(s):
    """Title-case de uma frase (só p/ objetos que vieram em CAIXA ALTA): mantém
    conectores minúsculos, capitaliza as demais palavras."""
    out = []
    for i, w in enumerate(s.split()):
        out.append(w.lower() if (i > 0 and _fold(w) in _MINUSC_FRASE)
                   else (w[:1].upper() + w[1:].lower()))
    return " ".join(out)


def sintetiza_ementa(corpo):
    """Resume o dispositivo de um ato sem ementa formal, em 3ª pessoa, usando as
    próprias palavras do ato. Ex.: '...resolve: exonerar Fulano do cargo...' ->
    'Exonera Fulano.'. Retorna (resumo, True) se achou um verbo de dispositivo;
    ('', False) se não deu para inferir (vai p/ o fallback de LLM)."""
    txt = limpar(corpo)
    m = re.search(r"(?i)\bresolve[m]?\b\s*:?\s*", txt)
    disp = txt[m.end():] if m else txt
    for _ in range(4):                       # pula "I -", "Art. 1º -", "a)"...
        e = _ENUM_EMENTA_RE.match(disp)
        if not e or e.end() == 0:
            break
        disp = disp[e.end():]
    disp = disp.lstrip(" -–.)")
    verbo3 = resto = None
    for pat, t3 in _VERBO_EMENTA:
        mm = re.match(r"(?i)" + pat + r"\b", disp)
        if mm:
            verbo3, resto = t3, disp[mm.end():]
            break
    if not verbo3:
        return "", False
    for _ in range(3):                            # pula cláusulas acessórias iniciais
        novo = _CLAUSULA_INI_RE.sub("", resto, count=1)
        if novo == resto:
            break
        resto = novo
    sm = _STOP_EMENTA_RE.search(resto)
    obj = (resto[:sm.start()] if sm else resto).strip(" ,;.:-–")
    obj = re.sub(r"\s+", " ", obj)
    if len(obj) < 2:
        return "", False
    # title-case runs de 2+ palavras em CAIXA ALTA (nomes/benefícios embutidos):
    # "RENATA HELENA MARTO" -> "Renata Helena Marto"; acrônimos isolados ficam.
    obj = re.sub(r"[A-ZÀ-Þ][A-ZÀ-Þ0-9'’\-]*(?:\s+[A-ZÀ-Þ][A-ZÀ-Þ0-9'’\-]*)+",
                 lambda mm: _titlecase_frase(mm.group(0)), obj)
    ementa = re.sub(r"\s+([,;.])", r"\1", f"{verbo3} {obj}").strip(" ,;:-–")
    return limpar(ementa)[:280].rstrip(" ,;:-–") + ".", True


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


# Conectores "de/do/da" que precedem a sigla no título ("... DO RCM/RIC Nº").
_CONECT_SIGLA = {"do", "da", "de", "dos", "das"}


def limpa_sigla(orgao):
    """Normaliza a sigla do órgão emissor capturada no título do ato.

    O título traz separadores e qualificadores que NÃO fazem parte da sigla:
    um traço solto ("DETERMINAÇÃO DE SERVIÇO - DAP/UFF"), o qualificador
    "CONJUNTA" ("PORTARIA CONJUNTA PROPLAN/DCF") ou um conector inicial
    ("... DO RCM/RIC"). Também remove o "/UFF". Ex.:
      "- DAP/UFF"            -> "DAP"
      "CONJUNTA PROPLAN/DCF" -> "PROPLAN/DCF"
      "DO FFE / ISNF"        -> "FFE/ISNF"
    """
    s = orgao or ""
    s = re.sub(r"[–—]", "-", s)                      # unifica traços
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"(?i)/?\s*\bUFF\b", "", s)           # tira "/UFF" ou "UFF" solto
    # remove "CONJUNTA" e conectores iniciais (repete até estabilizar)
    mudou = True
    while mudou:
        mudou = False
        s = s.strip(" /.,-()")
        mc = re.match(r"(?i)CONJUNTA\b\s*", s)
        if mc:
            s = s[mc.end():]; mudou = True; continue
        mp = re.match(r"([A-Za-zÀ-ú]+)\b\s*", s)
        if mp and _fold(mp.group(1)) in _CONECT_SIGLA:
            s = s[mp.end():]; mudou = True
    s = re.sub(r"\s*/\s*", "/", s)                   # "FFE / ISNF" -> "FFE/ISNF"
    return s.strip(" /.,-()")


def _titlecase_nome(s):
    def cap(w):
        w = w.lower() if _fold(w) in _CONNECT else (w[:1].upper() + w[1:].lower())
        # capitaliza após apóstrofo/hífen: "sant'anna"->"Sant'Anna", "dal'magro"->"Dal'Magro"
        return re.sub(r"(['’\-])([a-zà-öø-ÿ])", lambda m: m.group(1) + m.group(2).upper(), w)
    return " ".join(cap(w) for w in s.split())


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
    # Portaria padrão: nomes em CAIXA ALTA, cargos/ocupação em title-case.
    # Tenta primeiro sequências totalmente em maiúsculas para evitar capturar o cargo.
    for m in reversed(list(NOME_CAPS_RE.finditer(janela))):
        nome = _limpa_nome(m.group(0))
        if nome:
            return nome
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


# ===========================================================================
#  CHEFIAS — designações/dispensas de função (Chefe, Coordenador, Diretor...)
#  Extrai só do DISPOSITIVO ("...função de Chefe do Departamento X..."), que é
#  a fonte autoritativa. Cada evento vira uma linha rastreável a um ato; a
#  projeção do "titular atual" (último não substituído) é feita no servidor.
# ===========================================================================
_MINUSC = {"de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "a", "o",
           "ao", "aos", "com", "para", "por", "sob", "sem", "entre", "sobre"}

_PFX_CARGO = r"(?:Vice[-\s]?|Sub[-\s]?)?"
_NUC_CARGO = (r"(?:Chefes?|Coordenador[ae]?(?:es)?|Diretor[ae]?(?:es)?|Superintendentes?|"
              r"Gerentes?|Decan[oa]s?|Pr[óo][-\s]?Reitor[ae]?(?:es)?|Reitor[ae]?(?:es)?)")
_CARGO_G = r"(?P<cargo>%s%s)" % (_PFX_CARGO, _NUC_CARGO)
_CONECT_CU = r"(?:d[oae]s?|d')"

# Gatilho do dispositivo. Cobre "função de", "função gratificada de",
# "cargo de", "cargo de direção de", "exercício do cargo de"... (toda chefia
# é função gratificada/CD, então a qualificação pode aparecer no meio).
_TRIG_FUNC = (r"(?P<prep>d[ao]s?|para\s+(?:as?|os?)|pel[ao]|a|as|o|os)\s+"
              r"(?:exerc[íi]cio\s+d[ao]\s+)?"
              r"(?:fun[çc](?:[ãa]o|[õo]es)|cargo)\s+"
              r"(?:(?:gratificad|comissionad)[ao]s?\s+|de\s+confian[çc]a\s+|em\s+comiss[ãa]o\s+)?"
              r"de\s+(?:dire[çc][ãa]o\s+de\s+)?")
FUNCAO_RE = re.compile(
    _TRIG_FUNC + _CARGO_G + r"\s+" + _CONECT_CU + r"\s+"
    r"(?P<unidade>[A-ZÀ-Úa-zà-ú(][^;:.]{2,90}?)"
    r"(?=\s*(?:,|;|\.|:|\bc[óo]digo\b|\bc[óo]d\b|\bs[íi]mbolo\b|\bFG[- ]?\d|\bCD[- ]?\d|"
    r"\bFCC\b|\bFUC\b|\bn[ºo°]|\ba partir\b|\bpelo per|\bno per[íi]odo\b|\bcom valid|"
    r"\bem substitui|\bda Universidade\b|/UFF|\bem virtude\b|\bdurante\b|$))", re.I)

_TIPO_SO_UNID = {"curso", "departamento", "programa", "instituto", "faculdade", "escola",
                 "divisao", "secao", "setor", "nucleo", "coordenacao", "coordenadoria",
                 "diretoria", "gerencia", "reitoria", "unidade", "polo", "colegiado"}
_VERBO_FUNC = re.compile(r"design|dispens|exoner|destitu")
_SUBST_FUNC = re.compile(r"(?i)substitut|eventual|pro\s*tempore|respond|interin|exerc[íi]cio eventual")
_ANAFORA_UNID = re.compile(r"\b(referid|mesm|respectiv|citad|aludid|supracitad|present|seguinte|propri)")


def canon_cargo(c):
    """Normaliza a grafia do cargo, preservando Vice-/Sub."""
    low = _fold(c)
    pref = ""
    m = re.match(r"(vice|sub)[-\s]?", low)
    if m:
        pref = "Vice-" if m.group(1) == "vice" else "Sub"
        low = low[m.end():]
    if "reitor" in low:        base = "Pró-Reitor" if "pro" in _fold(c) else "Reitor"
    elif "superintend" in low: base = "Superintendente"
    elif "coordena" in low:    base = "Coordenador"
    elif "chef" in low:        base = "Chefe"
    elif "dire" in low:        base = "Diretor"
    elif "geren" in low:       base = "Gerente"
    elif "decan" in low:       base = "Decano"
    else:                      base = c.title()
    return ("Sub" + base.lower()) if pref == "Sub" else (pref + base)


def _titulo_unidade(u):
    """Title-case da unidade: conectores minúsculos, siglas curtas preservadas."""
    u = re.sub(r"\s+", " ", u).strip()
    saida = []
    for w in u.split(" "):
        sub = []
        for part in w.split("-"):
            if not part:
                sub.append(part); continue
            f = _fold(part)
            if f in _MINUSC and saida:
                sub.append(part.lower())
            elif part.isupper() and len(part) <= 6 and not re.search(r"[À-Ú]", part):
                sub.append(part)
            else:
                sub.append(part[:1].upper() + part[1:].lower())
        saida.append("-".join(sub))
    return " ".join(saida)


def _limpa_unid(u):
    u = unicodedata.normalize("NFKC", u)                      # desfaz ligaduras (ﬁ->fi)
    u = re.sub(r"\s+", " ", u).strip(" /.,-–·()")
    u = re.sub(r"(?i)\s+d[aoe]st?[ae]?\s+Universidade.*$", "", u)
    u = re.sub(r"(?i)\s+d[ao]\s+UFF\b.*$", "", u)
    u = re.sub(r"\s*\([^)]*$", "", u)                         # parêntese aberto no fim
    u = re.sub(r"(?i)\b(\w+)(\s+\1\b)+", r"\1", u)            # colapsa palavra repetida (em em)
    return u.strip(" /.,-–·")


def _unid_ok(u):
    f = _fold(u)
    return len(f) >= 4 and f not in _TIPO_SO_UNID and not _ANAFORA_UNID.search(f)


def chave_unidade(u):
    """Chave estável p/ casar a mesma unidade escrita de formas diferentes."""
    f = _fold(unicodedata.normalize("NFKC", u))
    f = re.sub(r"[\-–]\s*[a-z]{2,6}$", "", f)                 # sigla final "- gcm"
    f = re.sub(r"\([a-z0-9/]{2,8}\)", "", f)                  # sigla "(pch)"
    f = re.sub(r"\bpos\s*-?\s*graduacao\b", "posgraduacao", f)
    f = re.sub(r"[^a-z0-9]+", " ", f)
    return re.sub(r"\s+", " ", f).strip()


def _acao_func(trecho, pos, prep):
    jan = _fold(trecho[max(0, pos - 300):pos])
    last = None
    for mm in _VERBO_FUNC.finditer(jan):
        last = mm.group(0)
    if last in ("dispens", "exoner", "destitu"):
        return "dispensar"
    if last == "design":
        return "designar"
    return "dispensar" if re.match(r"d[ao]s?$", _fold(prep).strip()) else "designar"


def _pessoa_antes(trecho, pos):
    achou = None
    for m in SIAPE_RE.finditer(trecho[:pos]):
        achou = m
    if achou and pos - achou.start() < 220:
        return achou.group(1), nome_antes_siape(trecho, achou.start())
    return "", nome_antes_siape(trecho, pos)


def extrai_funcoes(trecho):
    """[{acao, cargo, unidade, unidade_chave, nome, siape}] — designações/dispensas
    de chefia/coordenação/direção citadas no dispositivo. Sempre exige SIAPE."""
    ev, vistos = [], set()
    for m in FUNCAO_RE.finditer(trecho):
        if _SUBST_FUNC.search(trecho[max(0, m.start() - 50):m.start("cargo")]):
            continue
        unid = _limpa_unid(m.group("unidade"))
        if not _unid_ok(unid):
            continue
        siape, nome = _pessoa_antes(trecho, m.start("cargo"))
        if not siape:
            continue
        if nome and _fold(nome) in _fold(unid):              # nome-lixo da própria unidade
            nome = ""
        cargo = canon_cargo(m.group("cargo"))
        chave = chave_unidade(unid)
        k = (_acao_func(trecho, m.start(), m.group("prep")), cargo.lower(), chave, siape)
        if k in vistos:
            continue
        vistos.add(k)
        ev.append({"acao": k[0], "cargo": cargo, "unidade": _titulo_unidade(unid),
                   "unidade_chave": chave, "nome": nome, "siape": siape})
    return ev


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
