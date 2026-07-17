# -*- coding: utf-8 -*-
"""Cruza as ~1.161 grafias de sigla do corpus (produção) contra a lista oficial
de setores da UFF (SIGLA/DESCRIÇÃO/UORG/STATUS, `dados_referencia/uorg-siglas-uff.csv`).

    python casar_siglas_uorg.py --corpus <filtros.json ou lista> --saida relatorio.csv

NÃO escreve em `orgao_alias` nem em nenhuma tabela — gera um RELATÓRIO para
revisão humana. Consolidar sigla é curadoria, não regex (ver CLAUDE.md): este
script propõe candidatos com um score de confiança, nada mais.

O QUE A LISTA OFICIAL TEM E NÃO TEM
------------------------------------
2.715 linhas, UORG nunca se repete — é mesmo a chave estável. Mas cada UORG
aparece só UMA VEZ, com a sigla atual (ou última antes de desativar): não é
um histórico "esta UORG já se chamou X, depois Y". Então o casamento aqui é
sigla-do-corpus × sigla-oficial-mais-parecida, não um join por UORG — o
corpus nunca capturou UORG (o extrator só lê a sigla do cabeçalho do BS).

ESTRATÉGIA DE SCORE (da mais para a menos confiável)
------------------------------------------------------
1. EXATO após normalizar (maiúsculas, sem acento, sem pontuação de borda):
   confiança 1.00.
2. TOKEN inteiro em comum, separando por "/" (ex.: "AD/CAL" tem os tokens
   AD e CAL; a oficial "CAL" bate porque CAL é um token INTEIRO igual dos
   dois lados — não um pedaço de string): confiança 0.90.
   Isto NÃO é substring bruta de propósito. Medido: substring bruta
   ("CE" dentro de "TCE", "SCO" dentro de "ASCOM", "CAPE" dentro de "CAPES")
   dava dezenas de falsos positivos por coincidência de letras — CAPES é uma
   agência federal, não tem nada a ver com a "CAPE" da UFF. Comparando só
   tokens inteiros, esses somem sozinhos (nenhum é um token separado por /).
3. Similaridade de string (difflib) acima de 0.82: confiança = a própria
   similaridade.
Abaixo de 0.82 fica em "sem candidato" — melhor não sugerir do que sugerir
errado; a lista tem 2.713 siglas distintas, sobra ambiguidade real.
"""
import argparse
import csv
import difflib
import json
import os
import re
import sys
import unicodedata

REF_PADRAO = os.path.join(os.path.dirname(__file__), "dados_referencia", "uorg-siglas-uff.csv")
LIMIAR_FUZZY = 0.82


def normaliza(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.upper()
    s = re.sub(r"[^A-Z0-9/]+", "", s)  # mantém a barra: separa unidade/superior
    return s


def tokens(s_normalizado):
    return [t for t in s_normalizado.split("/") if len(t) >= 2]


# Tokens que, quando aparecem como PREFIXO (1º token), NÃO são setor — são um
# modificador. Regras de domínio do usuário (16/07/2026). Mapeiam para
# (rótulo, papel do setor-âncora):
#   CEL = Comissão Eleitoral Local (comissão não tem UORG; o setor é o PAI dela).
#   AD  = "ad referendum" — decisão provisória do reitor/presidente a ratificar
#         depois pelo plenário. É a NATUREZA do ato; o setor é quem o EMITE.
# ⚠️ POSICIONAL: "AD" só é ad referendum como PREFIXO. Como token POSTERIOR
# ("GRAUNI/AD", "CAF/AD") é a antiga Pró-Reitoria de Administração (hoje PROAD)
# — e aí a lista oficial já traz a sigla composta inteira, então casa por
# exato/token normalmente, sem regra especial.
# Medido no corpus: CEL 112 siglas, AD-prefixo 3 (AD/CAL, AD/CEPEX, AD/CUV).
# Os demais "prefixos não-setor" são artefatos (DTS/RDD/DECISÕES/DIREÇÃO) ou
# externos (MEC/CNE). Dict extensível se o usuário identificar outros.
PREFIXOS_MODIFICADORES = {
    "CEL": ("Comissão Eleitoral Local", "setor-pai"),
    "AD": ("Ad referendum (decisão provisória a ratificar pelo plenário)", "setor emissor"),
}


# Sinônimos de sigla INTEIRA — o corpus usa uma grafia que a lista oficial não
# tem, mas que o usuário confirmou apontar para uma sigla oficial. Dois tipos:
#   RENOMEAÇÃO: "ASCOM" (antiga Assessoria de Comunicação) -> "SCS" (hoje
#               Superintendência de Comunicação Social, UORG 1483).
#   GRAFIA CORRIDA: "GARRETUFF" = "GAR/RET/UFF" escrito sem barras -> "GAR/RET"
#               (Gabinete do Reitor, UORG 1787). O tokenizador não separa
#               "GARRETUFF" sozinho, daí o mapa explícito.
# Só entram aqui as grafias que NÃO casam por conta própria (GAR, RET, GABR,
# GAR/RET, SCS já casam exato sozinhas). Valor = sigla oficial JÁ NORMALIZADA.
# Estes são os mapeamentos de MAIOR confiança do relatório: vêm do usuário,
# não de heurística. Dict extensível conforme o usuário ensina mais.
SINONIMOS = {
    "ASCOM": "SCS",
    "GARRETUFF": "GAR/RET",
}


def tipo_prefixo(sigla_normalizada):
    """Devolve (rótulo, papel, tokens_do_setor). rótulo='' se não é modificador.
    Para AD/CEPEX: ('Ad referendum...', 'setor emissor', ['CEPEX']) — o AD sai,
    o setor emissor é CEPEX. Para CEL/CMF: ('Comissão Eleitoral Local',
    'setor-pai', ['CMF']). Também pega nome de comissão por extenso."""
    toks = tokens(sigla_normalizada)
    if toks and toks[0] in PREFIXOS_MODIFICADORES:
        rotulo, papel = PREFIXOS_MODIFICADORES[toks[0]]
        return rotulo, papel, toks[1:]
    if "COMISSAO" in sigla_normalizada:
        return "Comissão (nome por extenso)", "setor-pai", []
    return "", "equivalente", toks


def carrega_referencia(caminho):
    with open(caminho, encoding="utf-8-sig") as f:
        linhas = list(csv.DictReader(f, delimiter=";"))
    ref = {}
    for l in linhas:
        sigla = l["SIGLA"].strip()
        if not sigla:
            continue
        chave = normaliza(sigla)
        # se a mesma sigla normalizada repetir, fica o Ativo (ou o primeiro)
        if chave in ref and ref[chave]["status"] == "Ativo":
            continue
        ref[chave] = {"sigla_oficial": sigla, "descricao": l["DESCRIÇÃO"].strip(),
                       "uorg": l["UORG"].strip(), "status": l["STATUS"].strip()}

    # índice por TOKEN inteiro (separado por /), para o casamento "token_exato".
    # Desempate, do mais forte pro mais fraco:
    #  (1) STANDALONE: a sigla oficial inteira É o token (ex.: token "CMF" achar
    #      a sigla oficial "CMF"=Faculdade de Farmácia) ganha de qualquer sigla
    #      COMPOSTA que só contenha o token ("FSQ/CMF"). Sem isto, "CEL/CMF"
    #      casava com "FSQ/CMF" (Residência) em vez do CMF puro — medido, era bug.
    #  (2) Ativo ganha de Desativado.
    por_token = {}
    for chave, info in ref.items():
        for t in tokens(chave):
            cand = {**info, "_standalone": chave == t}
            atual = por_token.get(t)
            if atual is None or (
                (cand["_standalone"], cand["status"] == "Ativo")
                > (atual["_standalone"], atual["status"] == "Ativo")):
                por_token[t] = cand
    return ref, por_token


def melhor_candidato(alvo, tokens_alvo, ref, por_token):
    """alvo: sigla já normalizada. tokens_alvo: os tokens a considerar como
    setor (para comissão, já vêm sem o prefixo CEL)."""
    if not alvo:
        return None
    # exato só vale se NÃO for comissão (comissão nunca é setor oficial)
    if alvo in ref and tokens_alvo == tokens(alvo):
        return {**ref[alvo], "score": 1.0, "motivo": "exato"}

    melhor = None
    for t in tokens_alvo:
        info = por_token.get(t)
        if info and (melhor is None or 0.90 > melhor["score"]):
            melhor = {**info, "score": 0.90, "motivo": "token_exato"}

    if melhor is None and tokens_alvo:
        for chave, info in ref.items():
            if not chave:
                continue
            score = difflib.SequenceMatcher(None, alvo, chave).ratio()
            if score >= LIMIAR_FUZZY and (melhor is None or score > melhor["score"]):
                melhor = {**info, "score": score, "motivo": "similaridade"}
    return melhor


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", required=True,
                    help="JSON do /api/filtros (chave 'orgaos') OU um .txt com 1 sigla por linha")
    ap.add_argument("--referencia", default=REF_PADRAO)
    ap.add_argument("--saida", required=True)
    a = ap.parse_args()

    if a.corpus.endswith(".json"):
        with open(a.corpus, encoding="utf-8") as f:
            siglas_corpus = json.load(f)["orgaos"]
    else:
        with open(a.corpus, encoding="utf-8") as f:
            siglas_corpus = [l.strip() for l in f if l.strip()]

    ref, por_token = carrega_referencia(a.referencia)
    print(f"corpus: {len(siglas_corpus)} siglas | referência: {len(ref)} siglas oficiais normalizadas "
          f"| {len(por_token)} tokens distintos")

    linhas = []
    contagem = {"sinonimo": 0, "exato": 0, "token_exato": 0, "similaridade": 0, "sem_candidato": 0}
    n_modif = 0
    for sigla in sorted(siglas_corpus):
        alvo = normaliza(sigla)

        # 1) sinônimo ensinado pelo usuário: substitui e resolve o canônico
        if alvo in SINONIMOS:
            canonico = SINONIMOS[alvo]
            cand = melhor_candidato(canonico, tokens(canonico), ref, por_token)
            rotulo = f"sinônimo conhecido: {sigla} → {canonico}"
            if cand:
                contagem["sinonimo"] += 1
                linhas.append([sigla, rotulo, "equivalente", cand["sigla_oficial"],
                               cand["descricao"], cand["uorg"], cand["status"],
                               "sinonimo", "1.00"])
            else:  # não deveria acontecer (o canônico é sigla oficial)
                contagem["sem_candidato"] += 1
                linhas.append([sigla, rotulo, "", "", "", "", "", "sem_candidato", ""])
            continue

        # 2) prefixo modificador (comissão / ad referendum) ou sigla comum
        rotulo, papel, toks_setor = tipo_prefixo(alvo)
        if rotulo:
            n_modif += 1
        cand = melhor_candidato(alvo, toks_setor, ref, por_token)
        # papel: o que o candidato REPRESENTA relativo à sigla do corpus —
        # "setor-pai"/"setor emissor" p/ modificador, "equivalente" p/ comum.
        if cand:
            contagem[cand["motivo"]] += 1
            linhas.append([sigla, rotulo, papel, cand["sigla_oficial"],
                           cand["descricao"], cand["uorg"], cand["status"],
                           cand["motivo"], f'{cand["score"]:.2f}'])
        else:
            contagem["sem_candidato"] += 1
            linhas.append([sigla, rotulo, papel if rotulo else "", "", "", "", "",
                           "sem_candidato", ""])

    print(f"  ({contagem['sinonimo']} por sinônimo ensinado; {n_modif} com prefixo "
          f"modificador — comissão/ad referendum, candidato = setor-pai/emissor)")

    with open(a.saida, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["sigla_corpus", "prefixo_significado", "papel_do_candidato",
                    "sigla_oficial_candidata", "descricao_oficial", "uorg",
                    "status_oficial", "motivo", "score"])
        w.writerows(linhas)

    print()
    for k, v in contagem.items():
        print(f"  {k}: {v}")
    print(f"\nRelatório em {os.path.abspath(a.saida)}")


if __name__ == "__main__":
    main()
