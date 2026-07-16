# -*- coding: utf-8 -*-
"""
Gera o SQL do NÚCLEO (ato + ato_texto) para o reprocessamento histórico, mais
os lotes JSON da segunda passada (pessoa/função/relação/prazo, via
importar_v2.php?arquivo=).

Por que existe: importar_v2.php resolve dimensões e evita duplicar uid na
republicação entre boletins, mas termina chamando um resolvedor de relações
com ESTADO (resolver_relacoes_v2.php) que cruza contra a tabela `ato` inteira
— isso não vira SQL declarativo com segurança. Design híbrido: SQL grande e
comprimido para o núcleo (ato/ato_texto, phpMyAdmin); JSON pequeno para o
resto (o mecanismo já provado hoje, importar_v2.php?arquivo=).

Racional completo: C:\\Users\\estud\\.claude\\plans\\indexed-toasting-wozniak.md

Uso:
    python gerar_sql_core.py --ano 2001 --entrada ../dados/reprocessamento-2026-07-15 --saida ../dados/import-hibrido
    python gerar_sql_core.py --anos 2001,2002,2003 --entrada ... --saida ...
"""
import os
import re
import sys
import json
import gzip
import argparse
import unicodedata

sys.path.insert(0, os.path.dirname(__file__))
import gerar_dados_portal as gdp

# ---------------------------------------------------------------------------
# Réplica exata de importar_v2.php (slugify, SIGLA_TIPO, digits) — não
# inventar de novo, copiar. Ver plano para o porquê de cada peça.
# ---------------------------------------------------------------------------
SIGLA_TIPO = {
    "Determinação de Serviço": "dts", "Portaria": "port", "Resolução": "res",
    "Decisão": "dec", "Ordem de Serviço": "os", "Resumo de Despachos": "rd",
    "Edital": "ed", "Comunicado": "com", "Norma de Serviço": "ns",
    "Instrução Normativa": "in",
}


def strip_ac(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "")
                   if unicodedata.category(c) != "Mn")


def slugify(s):
    # espelha slugify() do PHP: minúsculo, sem acento, [^a-z0-9]+ -> '-', trim '-'
    s = strip_ac(s or "").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def digits(s):
    return re.sub(r"\D", "", s or "")


class GeradorUid:
    """Sufixo -2/-3 em colisão de uid-base. PER-ANO basta: o ano já entra no
    base, então uid-base só colide DENTRO do mesmo ano (mesmo tipo+sigla+
    numero+ano em boletins diferentes — republicação)."""

    def __init__(self):
        self.usados = set()

    def gerar(self, tipo_ato, sigla_orig_crua, numero_norm, ano):
        prefixo = SIGLA_TIPO.get(tipo_ato, "ato")
        num_str = str(numero_norm) if numero_norm not in (None, "") else "sn"
        base = slugify(f"{prefixo}-{sigla_orig_crua}-{num_str}-{ano}")
        uid = base
        n = 2
        while uid in self.usados:
            uid = f"{base}-{n}"
            n += 1
        self.usados.add(uid)
        return uid


# ---------------------------------------------------------------------------
# Escape SQL. Sem placeholder parametrizado (é texto estático pro phpMyAdmin
# rodar) — escapa backslash ANTES de aspas simples (senão uma ementa
# terminando em barra invertida quebraria o próximo literal).
# ---------------------------------------------------------------------------
def sqlstr(s):
    if s is None:
        return "NULL"
    s = str(s).replace("\\", "\\\\").replace("'", "''")
    return f"'{s}'"


def sqlint(n):
    return "NULL" if n is None else str(int(n))


def sqldate(s):
    if not s or not re.match(r"^\d{4}-\d{2}-\d{2}$", str(s)):
        return "NULL"
    return f"'{s}'"


def sqlbool01(b):
    return "1" if b else "0"


# ---------------------------------------------------------------------------
def carrega_ano(pasta_entrada, ano):
    """Lê atos.json cru do extrator e devolve no formato portal-data.json,
    via gerar_dados_portal.converter() — MESMA lógica que o pipeline diário
    já usa (mascara CPF, limpa sigla via norm_sigla, monta tags)."""
    caminho = os.path.join(pasta_entrada, str(ano), "atos.json")
    with open(caminho, encoding="utf-8") as f:
        dados = json.load(f)
    return gdp.converter(dados)


def monta_nucleo_sql(atos_convertidos, gerador_uid):
    """Devolve (texto_sql, contagem). Um bloco por ato: INSERT-se-nao-existe
    + UPDATE + upsert de ato_texto. Ver o plano para o porque do NOT EXISTS
    em vez de ON DUPLICATE KEY (NULL de sigla_orig/numero_norm nao colide
    como duplicata pro MySQL, so pro <=> null-safe que o PHP usa)."""
    partes = []

    # tipos fixos, sempre os mesmos 10 — resolvidos uma vez por arquivo
    partes.append("-- tipo_ato: dimensao fixa, ja existe em producao (10 valores)")
    tipos_usados = sorted({a["tipoAto"] for a in atos_convertidos})
    var_tipo = {}
    for t in tipos_usados:
        v = f"@tipo_{slugify(t).replace('-', '_')}"
        var_tipo[t] = v
        partes.append(f"SET {v} = (SELECT id FROM tipo_ato WHERE nome = {sqlstr(t)});")
    partes.append("")

    # boletim: dedup por arquivo. numero/ano extraidos de boletimNumero
    # ("BS nº 57/2026") — mesma fonte que importar_v2.php usa.
    boletins = {}
    for a in atos_convertidos:
        arq = a.get("arquivo") or ""
        if not arq or arq in boletins:
            continue
        # mesma ordem de preferência do boletim_id() do PHP: número IMPRESSO
        # (boletimNumero, ex. "BS nº 198/2001") primeiro — diverge do nome do
        # arquivo com frequência (ver CLAUDE.md, "57-26.pdf" traz "BS nº 113").
        # Sem o fallback pro nome do arquivo, um boletimNumero que não bate no
        # regex fazia o ato inteiro ser pulado em silêncio (achado no piloto:
        # 0 casos em 2001, mas não é garantia para os outros 25 anos).
        m = re.search(r"(\d+)\s*/\s*(\d{4})", a.get("boletimNumero") or "")
        if m:
            num, ano_bol = int(m.group(1)), int(m.group(2))
        else:
            m2 = re.search(r"(\d+)\s*-\s*(\d{2,4})", arq)
            if not m2:
                continue
            ano_raw = int(m2.group(2))
            num, ano_bol = int(m2.group(1)), (2000 + ano_raw if ano_raw < 100 else ano_raw)
        boletins[arq] = (num, ano_bol, a.get("linkBoletim") or None)

    # 15/07/2026: achado no piloto de 2001 — "178-2001.pdf" tem numero IMPRESSO
    # 198 (confirmado no proprio PDF), mas ja existia em producao com numero=178
    # (import antigo, url_pdf real). Um INSERT IGNORE em massa por (numero,ano)
    # nao verifica se o ARQUIVO ja tem linha — cria uma SEGUNDA linha pro mesmo
    # arquivo sempre que o numero impresso diverge do que ja estava salvo, o que
    # contraria a propria regra do projeto ("identidade do boletim e o ARQUIVO,
    # nao o numero impresso" — CLAUDE.md). Isso quebrou o SET seguinte com
    # #1242 (subconsulta com mais de 1 linha). Por isso aqui e POR ARQUIVO, com
    # NOT EXISTS tanto por arquivo quanto por (numero,ano) — so cria linha nova
    # quando NENHUM dos dois ja existir.
    partes.append(f"-- boletim: {len(boletins)} distintos neste lote (1 INSERT por arquivo, NOT EXISTS-guarded)")
    for arq, (num, ano, url) in boletins.items():
        partes.append(
            f"INSERT INTO boletim (numero,ano,arquivo,url_pdf)\n"
            f"SELECT {num},{ano},{sqlstr(arq)},{sqlstr(url)} FROM (SELECT 1) x\n"
            f"WHERE NOT EXISTS (SELECT 1 FROM boletim WHERE arquivo = {sqlstr(arq)})\n"
            f"  AND NOT EXISTS (SELECT 1 FROM boletim WHERE numero={num} AND ano={ano});"
        )
    var_bol = {}
    for i, arq in enumerate(boletins, 1):
        v = f"@bol_{i}"
        var_bol[arq] = v
        # ORDER BY id LIMIT 1: mesma tolerancia que o PHP ja tem sem querer
        # (fetchColumn() pega a 1a linha, nao erra com duplicata) — cobre
        # duplicatas RESIDUAIS que já existiam antes deste script (como a
        # 178-2001.pdf, que segue com 2 linhas em producao ate alguem limpar).
        partes.append(f"SET {v} = (SELECT id FROM boletim WHERE arquivo = {sqlstr(arq)} ORDER BY id LIMIT 1);")
    partes.append("")

    # orgao: dedup por sigla (orgaoEmissor, já limpo por norm_sigla). uq_sigla
    # é NOT NULL de verdade — INSERT IGNORE seguro aqui também.
    siglas = sorted({a.get("orgaoEmissor") or "N/D" for a in atos_convertidos})
    partes.append(f"-- orgao: {len(siglas)} siglas distintas neste lote")
    if siglas:
        vals = ", ".join(f"({sqlstr(s)},'outro')" for s in siglas)
        partes.append(f"INSERT IGNORE INTO orgao (sigla,tipo) VALUES {vals};")
    var_org = {}
    for i, s in enumerate(siglas, 1):
        v = f"@org_{i}"
        var_org[s] = v
        partes.append(f"SET {v} = (SELECT id FROM orgao WHERE sigla = {sqlstr(s)});")
    partes.append("")

    partes.append(f"-- {len(atos_convertidos)} atos")
    n = 0
    for a in atos_convertidos:
        arq = a.get("arquivo") or ""
        if arq not in var_bol:
            continue  # sem boletim resolvível — mesmo aviso que importar_v2.php dá e pula
        tipo_ato = a["tipoAto"]
        bol_v = var_bol[arq]
        tipo_v = var_tipo[tipo_ato]
        sigla_crua = a.get("orgaoEmissor") or "N/D"
        org_v = var_org.get(sigla_crua, var_org.get("N/D"))
        sigla_sql = None if sigla_crua in ("N/D", "") else sigla_crua
        numero = str(a.get("numero") or "")
        numnorm_str = digits(numero)
        numnorm = int(numnorm_str) if numnorm_str else None
        ano = int(a["ano"])
        data_ato = a.get("dataAssinatura") or None
        ementa = (a.get("ementa") or "")[:600]
        einf = bool(a.get("ementaInferida"))
        proc = a.get("processoSei") or None
        seidoc = a.get("seiDocumento") or None
        secao = a.get("secao") or None
        pagina = a.get("pagina") or None

        uid = gerador_uid.gerar(tipo_ato, sigla_crua, numnorm, ano)

        cond = (
            f"boletim_id={bol_v} AND tipo_id={tipo_v} "
            f"AND (sigla_orig <=> {sqlstr(sigla_sql)}) "
            f"AND (numero_norm <=> {sqlint(numnorm)}) AND ano={ano}"
        )

        # INSERT IGNORE, não INSERT puro: achado no lote 2002-2006 (real, não
        # hipotético) — 'port-reitoria-33755-2005' já existia em produção sob
        # OUTRO boletim_id (republicação — o mesmo ato saiu em 2 boletins). O
        # meu GeradorUid só evita colisão DENTRO deste lote; contra o que já
        # está no banco de ANTES eu não tenho como checar (sem acesso ao banco
        # ao vivo). Um INSERT puro parava o arquivo inteiro em uq_uid. Com
        # IGNORE, só ESSA linha some do núcleo (o UPDATE/ato_texto seguintes
        # também viram no-op, natural key não existe) — sem perda: a segunda
        # passada (importar_v2.php) resolve sozinha, com a MESMA lógica de
        # sufixo -2/-3 que já tem, olhando o banco ao vivo de verdade.
        partes.append(
            f"INSERT IGNORE INTO ato (uid,boletim_id,tipo_id,orgao_id,numero,numero_norm,ano,sigla_orig,"
            f"data_ato,ementa,ementa_inferida,status,processo_sei,sei_documento,secao,pagina,orgao_origem)\n"
            f"SELECT {sqlstr(uid)},{bol_v},{tipo_v},{org_v},{sqlstr(numero)},{sqlint(numnorm)},{ano},"
            f"{sqlstr(sigla_sql)},{sqldate(data_ato)},{sqlstr(ementa)},{sqlbool01(einf)},'Ativo',"
            f"{sqlstr(proc)},{sqlstr(seidoc)},{sqlstr(secao)},{sqlstr(pagina)},'cabecalho'\n"
            f"WHERE NOT EXISTS (SELECT 1 FROM ato WHERE {cond});"
        )
        partes.append(
            f"UPDATE ato SET numero={sqlstr(numero)}, data_ato={sqldate(data_ato)}, "
            f"ementa={sqlstr(ementa)}, ementa_inferida={sqlbool01(einf)}, "
            f"processo_sei={sqlstr(proc)}, sei_documento={sqlstr(seidoc)}, "
            f"secao={sqlstr(secao)}, pagina={sqlstr(pagina)}, orgao_id={org_v}\n"
            f"WHERE {cond};"
        )
        texto = a.get("textoBusca") or ""
        partes.append(
            f"INSERT INTO ato_texto (ato_id, texto_original, texto_busca)\n"
            f"SELECT id, {sqlstr(texto)}, {sqlstr(texto)} FROM ato WHERE {cond}\n"
            f"ON DUPLICATE KEY UPDATE texto_original=VALUES(texto_original), texto_busca=VALUES(texto_busca);"
        )
        partes.append("")
        n += 1

    return "\n".join(partes), n


def fatiar_json(atos_convertidos, tamanho=3000):
    for i in range(0, len(atos_convertidos), tamanho):
        yield atos_convertidos[i:i + tamanho]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--anos", required=True, help="ex.: 2001  ou  2001,2002,2003")
    ap.add_argument("--entrada", required=True, help="pasta com <ano>/atos.json (reprocessamento)")
    ap.add_argument("--saida", required=True)
    ap.add_argument("--lote", type=int, default=3000)
    args = ap.parse_args()

    anos = [int(x) for x in args.anos.split(",")]
    os.makedirs(args.saida, exist_ok=True)
    gerador_uid = GeradorUid()

    for ano in anos:
        print(f"=== {ano} ===")
        atos = carrega_ano(args.entrada, ano)
        print(f"  {len(atos)} atos convertidos")

        sql, n_sql = monta_nucleo_sql(atos, gerador_uid)
        caminho_sql = os.path.join(args.saida, f"ato_{ano}.sql")
        with open(caminho_sql, "w", encoding="utf-8") as f:
            f.write(sql)
        tam = os.path.getsize(caminho_sql)
        print(f"  SQL nucleo: {caminho_sql} ({tam/1024/1024:.1f} MB, {n_sql} atos)")

        n_lotes = 0
        for i, lote in enumerate(fatiar_json(atos, args.lote), 1):
            caminho_json = os.path.join(args.saida, f"ato_{ano}_lote{i:02d}.json")
            with open(caminho_json, "w", encoding="utf-8") as f:
                json.dump(lote, f, ensure_ascii=False)
            n_lotes += 1
        print(f"  {n_lotes} lote(s) JSON (~{args.lote} atos cada) para a segunda passada")


if __name__ == "__main__":
    main()
