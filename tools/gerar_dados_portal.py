# -*- coding: utf-8 -*-
"""
Converte a base extraída (atos.json) para o esquema de Atos do Portal
(UffAct) usado pelo app — gera portal-data.json carregado pela interface.

Uso:
    python gerar_dados_portal.py                  # lê atos.json, escreve no app
    python gerar_dados_portal.py --saida app/portal-data.json

É chamado automaticamente por extrair_boletim.py ao final da indexação.
"""
import os
import re
import json
import argparse
import unicodedata
from datetime import datetime

# Mascaramento de CPF (LGPD art. 6º, III — minimização) ------------------------
# Formato pontuado padrão: mascarado sempre, é um padrão específico o bastante
# (3-3-3-2 com pontos/hífen) pra não colidir com outros números do boletim.
_CPF_RE = re.compile(r"\d{3}\.\d{3}\.\d{3}-\d{2}")
# Variantes sem pontuação/mal formatadas: só mascaradas quando rotuladas por
# "CPF" nas proximidades, pra não confundir com SIAPE/processo/telefone.
_CPF_ROTULADO_RE = re.compile(
    r"(?i)(cpf\.?\s*n?[ºo°]?\.?\s*[:\-]?\s*)(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2})"
)


def _mascara(cpf_str):
    d = re.sub(r"\D", "", cpf_str)
    return f"***.{d[3:6]}.{d[6:9]}-**" if len(d) == 11 else cpf_str


def mascarar_cpfs(texto):
    """Mascara CPF em texto livre, mantendo os 6 dígitos centrais visíveis
    (mesma convenção que a UFF já usa nos boletins de 2026: ***.123.456-**)."""
    if not texto:
        return texto
    texto = _CPF_RE.sub(lambda m: _mascara(m.group(0)), texto)
    texto = _CPF_ROTULADO_RE.sub(lambda m: m.group(1) + _mascara(m.group(2)), texto)
    return texto


# Mapas de tradução para o esquema do app -------------------------------------
TIPO_MAP = {
    "PORTARIA": "Portaria",
    "RESOLUÇÃO": "Resolução",
    "RESOLUÇÃO AD REFERENDUM": "Resolução ad referendum",
    "DETERMINAÇÃO DE SERVIÇO": "Determinação de Serviço",
    "INSTRUÇÃO NORMATIVA": "Instrução Normativa",
    "NORMA DE SERVIÇO": "Norma de Serviço",
    "ORDEM DE SERVIÇO": "Ordem de Serviço",
    "DECISÃO": "Decisão",
    "DELIBERAÇÃO": "Deliberação",
    "COMUNICADO": "Comunicado",
    "EDITAL": "Edital",
    "RESUMO DE DESPACHOS E DECISÕES": "Resumo de Despachos",
    "RESUMO DE DESPACHOS": "Resumo de Despachos",
}
# relação do extrator -> tipoRelacao do app (Altera | Revoga | Complementa | Regulamenta)
REL_MAP = {
    "ALTERA": "Altera", "RETIFICA": "Altera", "REPUBLICA": "Altera", "PRORROGA": "Altera",
    "REVOGA": "Revoga", "TORNA SEM EFEITO": "Revoga", "ANULA": "Revoga", "SUBSTITUI": "Revoga",
    "CITA": "Complementa",
}


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    return s or "ato"


def _fold(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "")
                   if unicodedata.category(c) != "Mn").lower()


# Palavras-descritor que NUNCA são sigla de emissor (caem fora na limpeza).
_NAO_SIGLA = set((
    "conjunta de da do das dos e a o em uff retificado "
    "pessoal notificacao retificacao selecao monitoria ciencia comissao eleitoral local "
    "tutor eliminacao documentos progressao remocao nomeacao designacao exoneracao "
    "aposentadoria concessao processo seletivo simplificado conselho "
    "programa gestao geral nacional permanente especial executiva executivo interna interno "
    "setorial integrada integrado avaliacao planejamento desenvolvimento ensino pesquisa extensao"
).split())
# Descrições por extenso (sem acrônimo no texto) -> sigla oficial. Estender conforme aparecer.
_ALIAS_SIGLA = {
    "de ciencia de eliminacao de documentos": "CPAD",
    "de pessoal": "PORTARIA DE PESSOAL",   # portarias de pessoal (assinadas pelo Reitor)
}


def norm_sigla(orgao):
    """Sigla de EXIBIÇÃO limpa: tira prepositivos/descritores e parênteses,
    mantém só os tokens que parecem acrônimo; conservadora (se nada sobrar,
    devolve o original em vez de apagar). NÃO afeta o id do ato."""
    s = (orgao or "").replace(".", "").strip(" /.,-–")   # tira pontos (I.S.N.F.->ISNF) e bordas
    if not s or s in ("Reitoria", "UFF"):
        return s
    if _fold(s) in _ALIAS_SIGLA:
        return _ALIAS_SIGLA[_fold(s)]
    s2 = re.sub(r"\s*\(\s*", "/", s).replace(")", " ")
    bons = []
    for p in re.split(r"[\s/\-–]+", s2):                  # divide por espaço, barra E hífen
        p = p.strip(" .,()-–")
        if not p or _fold(p) in _NAO_SIGLA:
            continue
        letras = re.sub(r"[^A-Za-zÀ-Ú0-9]", "", p)
        if p == p.upper() and 2 <= len(letras) <= 8 and p not in bons:
            bons.append(p)
    return "/".join(bons) if bons else s


def tags_de(a):
    tags = []
    if a.get("tipo_acao"):
        tags.append(a["tipo_acao"])
    for parte in re.split(r"[/ ]", a.get("sigla", "")):
        p = parte.strip()
        if p and p not in tags:
            tags.append(p)
    tp = TIPO_MAP.get(a.get("tipo", ""), "Outro")
    if tp not in tags:
        tags.append(tp)
    return [t for t in tags if t][:6]


# (?![0-9]) e não \b: o acervo tem "02-26_RETIFICADO.pdf", e \b não casa entre
# "6" e "_" (underscore é caractere de palavra) — o ano sumia justo nos
# retificados.
_ANO_ARQ_4 = re.compile(r"-(\d{4})(?![0-9])")
_ANO_ARQ_2 = re.compile(r"-(\d{2})(?![0-9])")


def _ano_do_arquivo(arq):
    """Ano do BS pelo nome do arquivo, quando o bs_data não veio.

    Os dois padrões convivem no acervo: '120-2016.pdf' (legado, ano com 4
    dígitos) e '01-26.pdf' / '101-21 RETIFICADO.pdf' (recente, 2 dígitos).
    """
    m = _ANO_ARQ_4.search(arq or "")
    if m:
        return m.group(1)
    m = _ANO_ARQ_2.search(arq or "")
    return str(2000 + int(m.group(1))) if m else ""


# Piso do ano de um ato. O acervo começa em 2001 e os boletins de 2001-2003
# publicam backlog real de 1996-2000 (ver docs/PLANO-REPROCESSAMENTO-ACERVO.md),
# então o piso não pode ser o ano do boletim — mas também não pode ser aberto.
ANO_PISO = 1990


def ano_do_ato(ano_bruto, ano_pub):
    """Ano do ato, com guarda de plausibilidade.

    Medido no reprocessamento de 17/08/2026 (136.248 atos): UM ato saiu com
    ano **1771** — fragmento de OCR ("085 THIAGO SIMONATO MOZER FUC
    COORDENADOR…") que o extrator leu como ato e cujo "ano" veio de um número
    solto no meio da linha. É pouco, e é justamente o tipo de sujeira que
    aparece grande: o ano vira opção no filtro da interface e uma barra no
    gráfico, e quem olha conclui que o acervo vai até o século XVIII.

    Fora da faixa, CAI PARA O ANO DO BOLETIM em vez de o ato ser descartado.
    Descartar registro por regra é decisão que este projeto só toma com
    medição (foi assim na guarda de folha de rosto), e aqui a amostra é 1.
    O ato continua no acervo, achável, com ano plausível — e a etapa 7 decide
    se ele é ato de verdade.
    """
    ano = int(ano_bruto) if str(ano_bruto or "").isdigit() else 0
    teto = (int(ano_pub) if str(ano_pub or "").isdigit() else 0) or 0
    if ANO_PISO <= ano <= (teto + 1 if teto else 2026):
        return ano
    if teto:
        return teto
    return ano if ANO_PISO <= ano <= 2026 else 2026


# ── Limpeza dos campos da revalidação ────────────────────────────────────────
# ESPELHA `backend/importar/revalidacao_campos.php`, e a amostra em
# `dados_referencia/revalidacao-campos.json` é conferida pelos DOIS — é o que
# impede uma ponta de melhorar e a outra ficar para trás.
#
# POR QUE PRECISA EXISTIR AQUI TAMBÉM: há dois caminhos de escrita em
# `ato_revalidacao`. O backfill lê o texto do banco (PHP, já limpo desde
# 17/08/2026) e o import lê ESTE JSON. Com a limpeza só de um lado, a aba
# continuou exibindo `"…Die Medizinische Fakultät", Tübingen, Na Alemanha`
# como nome de instituição depois de o conserto já estar no ar — porque aquele
# registro veio por aqui.
def _carrega_paises_canon():
    """Lê a tabela de canonização do PHP em vez de copiá-la.

    Uma terceira cópia da lista de países (já há a do PHP e a de
    `coop_paises()` na API) divergiria no primeiro país novo. Ler o arquivo é
    feio e é honesto — e se o formato mudar, a tabela vem VAZIA, e aí a
    limpeza deixa o país passar em vez de apagá-lo. Falhar para o lado de não
    mexer no dado é a direção certa quando o instrumento quebra.
    """
    caminho = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "..", "backend", "importar", "revalidacao_campos.php")
    try:
        with open(caminho, encoding="utf-8") as f:
            php = f.read()
    except OSError:
        return {}
    m = re.search(r"function revalidacao_paises_canon\(\): array \{\s*static \$p = \[(.*?)\n    \];",
                  php, re.S)
    if not m:
        return {}
    return dict(re.findall(r"'([^']+)'\s*=>\s*'([^']+)'", m.group(1)))


PAISES_CANON = _carrega_paises_canon()

_ASPAS = '"“”\'«»'
_PREFIXO = re.compile(
    r"^(?:n[íi]vel\s+(?:de\s+)?)?"
    r"(?:gradua[çc][ãa]o|bacharelado|licenciatura|mestrado|doutorado|p[óo]s-?gradua[çc][ãa]o)\s+em\s+",
    re.I)
_PREPOSICAO = re.compile(r"^(?:na|no|nos|nas|em|de|da|do|dos|das|como)\s+", re.I)
_NAO_PAIS = ("conselho", "resolucao", "termos", "parecer", "comissao", "colegiado",
             "processo", "decisao", "reuniao", "sala", "universidade", "universidad",
             "faculdade", "instituto", "departamento", "curso", "diploma", "titulo",
             "equivalente", "doutor", "mestre", "bacharel", "mestrado", "doutorado",
             "licenciatura", "ph.d", "phd", "sorbonne")
_NAO_INST = ("resolucao", "termos estabelecidos", "deste conselho",
             "parecer da comissao", "nos termos", "processo n", "decisao n")


def _limpa_campo(s):
    s = re.sub(r"\s+", " ", (s or "").strip())
    for _ in range(4):
        antes = s
        s = re.sub(r"^[\s.,;:\-–—]+|[\s.,;:\-–—]+$", "", s)
        if len(s) > 1 and s[0] in _ASPAS and s[-1] in _ASPAS:
            s = s[1:-1].strip()
        s = s.strip()
        if s == antes:
            break
    s = _PREFIXO.sub("", s)
    return _PREPOSICAO.sub("", s).strip()


def _e_pais(s):
    k = _fold(_limpa_campo(s))
    return bool(k) and (k in PAISES_CANON
                        or any(_fold(v) == k for v in PAISES_CANON.values()))


def _limpa_pais(s):
    p = _limpa_campo(s)
    if not p or len(p) > 40:
        return ""
    k = _fold(p)
    if k in PAISES_CANON:
        return PAISES_CANON[k]
    if any(w in k for w in _NAO_PAIS) or len(k.split()) > 4:
        return ""
    return p


def _limpa_instituicao(s):
    partes = []
    for p in (s or "").split(","):
        p = _limpa_campo(p)
        # Aspa de abertura sem a de fechamento: captura truncada ("“Language").
        if len(p) > 1 and p[0] in _ASPAS and not any(c in p[1:] for c in _ASPAS):
            p = p[1:].strip()
        if p:
            partes.append(p)
    while len(partes) > 1 and _e_pais(partes[-1]):
        partes.pop()
    if not partes:
        return ""
    junto = ", ".join(partes)
    # Só o país sobrou: não é instituição. Lacuna é honesta; país no lugar de
    # instituição é erro — e foi o que a aba mostrou ("Argentina", "Peru").
    if len(partes) <= 1 and _e_pais(junto):
        return ""
    if any(w in _fold(junto) for w in _NAO_INST):
        return ""
    return junto


def limpa_revalidacao(r):
    """Aplica a limpeza aos campos de um pedido, preservando o resto."""
    if not isinstance(r, dict):
        return r
    saida = dict(r)
    if "pais" in saida:
        saida["pais"] = _limpa_pais(saida.get("pais") or "")
    if "curso" in saida:
        saida["curso"] = _limpa_campo(saida.get("curso") or "")
    if "instituicao" in saida:
        saida["instituicao"] = _limpa_instituicao(saida.get("instituicao") or "")
    return saida


def converter(dados, urls=None):
    """urls: dict opcional {arquivo.pdf: url_oficial_uff} para linkar o PDF
    de origem na UFF (sem hospedar cópia)."""
    urls = urls or {}
    atos = dados["atos"]
    # O ANO vem do nome do arquivo, não do bs_data: o nome é o que a UFF
    # controla ("027-2001.pdf"), enquanto bs_data é OCR do cabeçalho do PDF e
    # erra — há boletim de 2001 cuja data lida diz 1998, e outros com 2091.
    # O bs_data só entra quando o nome não diz o ano.
    ano_bs = {}
    for m in dados.get("boletins", []):
        d = m.get("bs_data", "")
        ano_bs[m["arquivo"]] = _ano_do_arquivo(m["arquivo"]) or (d.split("/")[-1] if "/" in d else "")

    # índice reverso: marca status de vigência (Revogado/Alterado) a partir
    # de atos que revogam/alteram outro com mesmo número+ano e tipo compatível
    saida = []
    ids = set()
    for i, a in enumerate(atos):
        # chave estável e globalmente única (inclui o boletim de origem) — é o
        # PK no banco; reimportar atualiza a mesma linha (idempotente).
        arq = re.sub(r"\.pdf$", "", a.get("arquivo", ""), flags=re.I)
        base = f"{arq}-{slug(a.get('tipo'))}-{slug(a.get('sigla'))}-{slug(a.get('numero'))}-{a.get('ano')}"
        aid = base
        n = 2
        while aid in ids:
            aid = f"{base}-{n}"; n += 1
        ids.add(aid)

        relacoes = []
        for r in a.get("relacoes", []):
            relacoes.append({
                "id": f"rel-{i}-{len(relacoes)}",
                "tipoRelacao": REL_MAP.get(r["relacao"], "Complementa"),
                "atoDestino": r["ato_citado"],
                "detalhes": r.get("bs_origem") or (r.get("trecho", "")[:90] or None),
            })

        orgao = norm_sigla(a.get("sigla")) or ("Reitoria" if a.get("tipo") == "PORTARIA" else "UFF")
        # Cascata: bs_data > nome do arquivo > ano do próprio ato. O default
        # antigo era "2026" fixo — inofensivo enquanto o pipeline só rodava o
        # ano corrente, mas sobre o legado ele carimbava 2026 em boletim de
        # 2012/2016 (os 30 cujo bs_data não parseia), inventando "BS nº
        # 120/2026" e estragando qualquer contagem por ano.
        ano_pub = (ano_bs.get(a.get("arquivo")) or _ano_do_arquivo(a.get("arquivo", ""))
                   or (a.get("data_ato") or "")[:4] or "")
        # Ementa: oficial > resumo inferido > placeholder. ementaInferida sinaliza
        # ao front-end que o texto é um "resumo automático" (não a ementa oficial).
        ementa_oficial = mascarar_cpfs((a.get("ementa") or "").strip())
        ementa_resumo = mascarar_cpfs((a.get("ementa_resumo") or "").strip())
        ementa_inferida = bool(ementa_resumo) and not ementa_oficial
        ementa_disp = ementa_oficial or ementa_resumo or "(sem ementa formal no boletim)"
        tem_revalidacao = "revalidacao" in a or "revalidacoes" in a
        lista_reval = a.get("revalidacoes")
        if not isinstance(lista_reval, list):
            lista_reval = [a["revalidacao"]] if a.get("revalidacao") else []
        lista_reval = [limpa_revalidacao(r) for r in lista_reval if r]
        registro = {
            "id": aid,
            "_idx": i,
            "tipoAto": TIPO_MAP.get(a.get("tipo", ""), "Outro"),
            "numero": a.get("numero", ""),
            "ano": ano_do_ato(a.get("ano"), ano_pub),
            "dataAssinatura": a.get("data_ato") or "",
            "orgaoEmissor": orgao,
            "ementa": ementa_disp,
            "ementaInferida": ementa_inferida,
            "processoSei": a.get("processo_sei_principal") or None,
            # TODOS os processos citados, não só o primeiro. O extrator sempre
            # coletou a lista em `processos_sei`; era aqui que ela morria, e com
            # ela 44% das referências (medido: 17.040 menções contra 9.554 atos
            # com processo). Um ato de revogação cita o processo do ato revogado,
            # uma designação de fiscal cita o do contrato — perder isso é perder
            # justamente a ligação entre atos que o usuário procura.
            "processosSei": a.get("processos_sei") or [],
            "seiDocumento": a.get("sei_documento") or None,
            "linkSeiProcesso": a.get("link_sei_processo") or None,
            "linkSeiDocumento": a.get("link_sei_documento") or None,
            "relacoes": relacoes,
            "tags": tags_de(a),
            # `siapes` e `pessoas` NAO entram mais neste arquivo (04/08/2026).
            #
            # O portal-data.json e servido publicamente em dois lugares -- na raiz
            # do site e no repositorio do GitHub --, e trazia 3.836 pares
            # DISTINTOS de nome+matricula. Isso e um cadastro, e um cadastro
            # pronto: nos PDFs do Boletim o mesmo pareamento existe, mas disperso
            # em milhares de arquivos. Agregar e tratamento proprio, nao
            # republicacao.
            #
            # O que sustentavam era pouco: `pessoas` so resolvia matricula->nome
            # para ampliar a busca, e `siapes` so fazia o filtro por matricula
            # funcionar no MODO ESTATICO -- a contingencia que roda quando o
            # banco esta fora. A aba Meu SIAPE nunca usou nenhum dos dois: ela
            # exige o banco e mostra "disponivel apenas no modo banco de dados".
            #
            # Cifrar nao era alternativa. O arquivo existe para o navegador ler
            # SEM servidor, entao a chave teria de viajar junto -- seria
            # ofuscacao com aparencia de protecao. E hash tambem nao: SIAPE tem
            # 7 digitos, forca bruta resolve em minutos.
            #
            # AINDA HA dado pessoal em `funcoes` (210 pares nome+SIAPE), e ele
            # fica de proposito: alimenta as abas Chefias e Mandatos no modo
            # estatico, cujo objeto E dizer quem ocupa cada cargo. Tirar ali
            # esvazia a funcao, o que nao era o caso destes dois campos.
            # [{acao,cargo,unidade,unidade_chave,nome,siape,prazo_meses,
            #   data_inicio,inicio_origem}] p/ Chefias e p/ o cálculo de mandato
            "funcoes": a.get("funcoes", []),
            "aposentadoria": a.get("aposentadoria"),  # {tipo,baseLegal} | None — p/ Insights
            "deslocamento": a.get("deslocamento"),  # {tipo,direcao,motivo,setor} | None — p/ Insights
            # {via,decisao,nivel,curso,instituicao,pais} | None — p/ a aba
            # Revalidação. NÃO carrega o nome de quem pediu, por desenho: ver o
            # cabeçalho de extrai_revalidacao() e de backend/db/ato_revalidacao.sql.
            # O corpo do ato viaja numa forma só: a de CAIXA PRESERVADA. Quem
            # precisa da versão minúscula (busca por nome/SIAPE, FULLTEXT,
            # regex de prazo) a DERIVA — `mb_strtolower()` no importador,
            # `.toLowerCase()` no `dataSource.ts` e no `mock_api.py`.
            #
            # Publicar as duas foi o estado entre 17 e 18/08/2026 e custava o
            # DOBRO do arquivo (3,71 -> 6,70 MB nos 15 boletins de teste;
            # ~24 MB no índice completo) para republicar a mesma informação —
            # este arquivo vai por Git todo dia E é baixado pelo navegador do
            # visitante no modo de contingência.
            #
            # Derivar é idêntico a republicar porque `mascarar_cpfs()` COMUTA
            # com o rebaixamento de caixa (a máscara só tem dígito e `*`).
            # É invariante, não coincidência: `tools/teste_dados_portal.py`
            # reprova quem o quebrar. `mascarar_cpfs` vale sem exceção — o
            # texto que sai daqui é o único que existe.
            #
            # O `or corpo_busca` atende safra ANTIGA: `corpo_texto` só existe
            # em atos.json gerado pelo extrator de 17/08/2026 em diante, e a
            # bancada tem cargas anteriores (import-2002-2003,
            # reprocessamento-*). Sem ele, rodar o gerador sobre uma dessas
            # publicaria o corpo VAZIO — perda silenciosa, que é o defeito que
            # este projeto mais paga. Vem minúsculo, como vinha antes.
            "textoOriginal": mascarar_cpfs(a.get("corpo_texto") or a.get("corpo_busca") or ""),
            "conteudoResumido": ementa_disp if ementa_disp[:1] != "(" else "Ato administrativo publicado no Boletim de Serviço da UFF.",
            "status": "Ativo",  # ajustado abaixo
            "boletimNumero": f"BS nº {a.get('bs_numero','')}/{ano_pub}",
            "linkBoletim": urls.get(a.get("arquivo", ""),
                                    "https://boletimdeservico.uff.br/boletins/bs-2026/"),
            "secao": a.get("secao", ""),
            "pagina": a.get("pagina", ""),
            "arquivo": a.get("arquivo", ""),
            "notasInternas": mascarar_cpfs(f"Extraído de {a.get('arquivo','')}."
                              + (f" Assinante: {a['signatario']}." if a.get("signatario") else "")),
            # data estável (a do próprio ato) — evita commits diários sem mudança
            "dataCriacao": a.get("data_ato") or "",
        }
        if tem_revalidacao or lista_reval:
            registro["revalidacao"] = lista_reval[0] if lista_reval else None
        if len(lista_reval) > 1:
            registro["revalidacoes"] = lista_reval
        saida.append(registro)

    # --- status de vigência via índice reverso (quem revoga/altera quem) ------
    # chave por (numero_digits) -> lista de índices na saída
    por_num = {}
    for idx, s in enumerate(saida):
        nd = re.sub(r"\D", "", s["numero"])
        por_num.setdefault(nd, []).append(idx)

    TIPO_PALAVRAS = {
        "Portaria": "portaria", "Resolução": "resolu", "Decisão": "decis",
        "Determinação de Serviço": "determina", "Instrução Normativa": "instru",
        "Norma de Serviço": "norma", "Edital": "edital", "Comunicado": "comunicado",
    }

    def acha_alvos(ato_destino, alvo_filtro):
        """Casa a referência textual a atos da base, exigindo número + (sigla
        OU tipo) coincidentes, para evitar falsos positivos entre órgãos."""
        dest = ato_destino.lower()
        nums = {re.sub(r"\D", "", t) for t in re.findall(r"\d[\d.]*", ato_destino)}
        achados = []
        for nd in nums:
            if len(nd) < 2:
                continue
            for idx in por_num.get(nd, []):
                alvo = saida[idx]
                sigla = (alvo["orgaoEmissor"] or "").lower().split()[0] if alvo["orgaoEmissor"] else ""
                tem_sigla = sigla and sigla not in ("reitoria", "uff") and sigla in dest
                palavra = TIPO_PALAVRAS.get(alvo["tipoAto"], "")
                tem_tipo = palavra and palavra in dest
                # sem sigla (ex.: Portaria da Reitoria): exige a palavra do tipo
                if alvo["orgaoEmissor"] in ("Reitoria", "UFF", ""):
                    ok = tem_tipo and len(nd) >= 3
                else:
                    ok = tem_sigla and (tem_tipo or True)
                if ok and alvo["tipoAto"] == alvo_filtro:
                    achados.append(idx)
        return achados

    # passe único: liga cada ato citado (alvo) ao ato que o cita (origem),
    # preenchendo "referenciadoPor" e ajustando o status de vigência.
    for s in saida:
        for r in s["relacoes"]:
            destino = r["atoDestino"]
            tipo_alvo = None
            for tp_app, palavra in TIPO_PALAVRAS.items():
                if palavra in destino.lower():
                    tipo_alvo = tp_app
                    break
            if not tipo_alvo:
                continue
            for idx in acha_alvos(destino, tipo_alvo):
                alvo = saida[idx]
                if alvo["id"] == s["id"]:
                    continue
                # só atos de data igual/posterior "afetam" o alvo
                if (s["dataAssinatura"] or "") < (alvo["dataAssinatura"] or ""):
                    continue
                alvo.setdefault("referenciadoPor", []).append({
                    "relacao": r["tipoRelacao"],
                    "porId": s["id"],
                    "porLabel": f'{s["tipoAto"]} {s["orgaoEmissor"]} nº {s["numero"]}/{s["ano"]}',
                    "detalhes": r.get("detalhes"),
                })
                if r["tipoRelacao"] == "Revoga":
                    alvo["status"] = "Revogado"
                elif r["tipoRelacao"] == "Altera" and alvo["status"] != "Revogado":
                    alvo["status"] = "Alterado"

    for s in saida:
        ref = s.setdefault("referenciadoPor", [])
        vistos, unico = set(), []
        for r in ref:
            ch = (r["relacao"], r["porId"])
            if ch not in vistos:
                vistos.add(ch)
                unico.append(r)
        s["referenciadoPor"] = unico
    return saida


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrada", default=os.path.join(os.path.dirname(__file__), "atos.json"))
    ap.add_argument("--saida", default=os.path.join(os.path.dirname(__file__), "app", "portal-data.json"))
    ap.add_argument("--urls", default=None, help="manifesto nome.pdf->URL UFF (boletins/_urls.json)")
    args = ap.parse_args()

    with open(args.entrada, encoding="utf-8") as f:
        dados = json.load(f)
    urls = {}
    if args.urls and os.path.exists(args.urls):
        with open(args.urls, encoding="utf-8") as f:
            urls = json.load(f)
    saida = converter(dados, urls)
    os.makedirs(os.path.dirname(args.saida), exist_ok=True)
    with open(args.saida, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False)

    from collections import Counter
    st = Counter(s["status"] for s in saida)
    print(f"{len(saida)} atos -> {args.saida}")
    print("status:", dict(st))


if __name__ == "__main__":
    main()
