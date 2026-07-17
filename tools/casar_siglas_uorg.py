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
    # Prefere o candidato Ativo quando o mesmo token aparece em mais de uma
    # sigla oficial (ex.: "CP" é token de várias) — ambíguo demais pra
    # escolher sozinho, então guarda todos e o relatório mostra 1 (o melhor).
    por_token = {}
    for chave, info in ref.items():
        for t in tokens(chave):
            atual = por_token.get(t)
            if atual is None or (info["status"] == "Ativo" and atual["status"] != "Ativo"):
                por_token[t] = info
    return ref, por_token


def melhor_candidato(sigla_corpus, ref, por_token):
    alvo = normaliza(sigla_corpus)
    if not alvo:
        return None
    if alvo in ref:
        return {**ref[alvo], "score": 1.0, "motivo": "exato"}

    melhor = None
    for t in tokens(alvo):
        info = por_token.get(t)
        if info and (melhor is None or 0.90 > melhor["score"]):
            melhor = {**info, "score": 0.90, "motivo": "token_exato"}

    if melhor is None:
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
    contagem = {"exato": 0, "token_exato": 0, "similaridade": 0, "sem_candidato": 0}
    for sigla in sorted(siglas_corpus):
        cand = melhor_candidato(sigla, ref, por_token)
        if cand:
            contagem[cand["motivo"]] += 1
            linhas.append([sigla, cand["sigla_oficial"], cand["descricao"], cand["uorg"],
                           cand["status"], cand["motivo"], f'{cand["score"]:.2f}'])
        else:
            contagem["sem_candidato"] += 1
            linhas.append([sigla, "", "", "", "", "sem_candidato", ""])

    with open(a.saida, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["sigla_corpus", "sigla_oficial_candidata", "descricao_oficial",
                    "uorg", "status_oficial", "motivo", "score"])
        w.writerows(linhas)

    print()
    for k, v in contagem.items():
        print(f"  {k}: {v}")
    print(f"\nRelatório em {os.path.abspath(a.saida)}")


if __name__ == "__main__":
    main()
