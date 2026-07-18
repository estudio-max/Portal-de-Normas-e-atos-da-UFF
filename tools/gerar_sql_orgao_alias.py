# -*- coding: utf-8 -*-
"""Transforma o relatório de `casar_siglas_uorg.py` em SQL de produção.

    python gerar_sql_orgao_alias.py --relatorio <casamento_siglas_uorg.csv> --saida <arquivo.sql>

Só entram no SQL as linhas de ALTA confiança (`motivo` em `sinonimo` ou
`token_exato`) — 535 na rodada de 16/07/2026. `exato` não precisa de alias
(a grafia já bate); `similaridade` e `sem_candidato` ficam de fora de
propósito (medido: `similaridade` tem casos errados, ex. 3 programas de
pós-graduação DIFERENTES caindo no mesmo "PPG" genérico).

O QUE O SQL FAZ, POR MAPEAMENTO (alias = grafia do corpus, canônico = sigla
oficial candidata):
  1. Garante que o órgão CANÔNICO existe (`INSERT IGNORE INTO orgao`,
     `uq_sigla` é UNIQUE de verdade — idempotente).
  2. Cadastra o alias (`INSERT IGNORE INTO orgao_alias`) — só vale para
     importações FUTURAS (é o que `importar_v2.php::orgao_id()` consulta).
  3. Reatribui os atos JÁ EXISTENTES que hoje apontam pro órgão-grafia
     (criado sem querer pelo importador, via `INSERT INTO orgao ...
     'outro'` quando a sigla não era reconhecida) para o órgão canônico.

Não apaga a linha antiga de `orgao` — fica órfã, e já foi confirmado que
`/api/filtros` só lista órgão que tem `JOIN` com `ato` (linha órfã some
sozinha da UI, sem precisar DELETE).

Reatribuir atos alinha com a arquitetura documentada em CLAUDE.md ("comissão
efêmera não vira órgão"): `CEL/CMF` virou um órgão próprio por acidente —
esta migração desfaz isso.
"""
import argparse
import csv
import os


def sqlstr(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--relatorio", required=True)
    ap.add_argument("--saida", required=True)
    a = ap.parse_args()

    with open(a.relatorio, encoding="utf-8-sig") as f:
        linhas = list(csv.DictReader(f, delimiter=";"))

    mapeamentos = []
    for l in linhas:
        if l["motivo"] not in ("sinonimo", "token_exato"):
            continue
        alias = l["sigla_corpus"].strip()
        canonico = l["sigla_oficial_candidata"].strip()
        if not alias or not canonico or alias == canonico:
            continue
        mapeamentos.append((alias, canonico))

    canonicos = sorted({c for _, c in mapeamentos})
    print(f"{len(mapeamentos)} mapeamentos | {len(canonicos)} órgãos canônicos distintos")

    partes = []
    partes.append("-- Gerado por gerar_sql_orgao_alias.py a partir do relatório de curadoria.")
    partes.append("-- Idempotente: seguro rodar de novo se parar no meio.\n")

    partes.append("-- 1) garante que os órgãos canônicos existem")
    for c in canonicos:
        partes.append(
            f"INSERT IGNORE INTO orgao (sigla, tipo) VALUES ({sqlstr(c)}, 'outro');"
        )

    partes.append("\n-- 2) cadastra os aliases (vale para importações futuras)")
    for alias, canonico in mapeamentos:
        partes.append(
            f"INSERT IGNORE INTO orgao_alias (orgao_id, alias) "
            f"SELECT id, {sqlstr(alias)} FROM orgao WHERE sigla = {sqlstr(canonico)};"
        )

    partes.append("\n-- 3) reatribui os atos já existentes (o efeito visível no site)")
    for alias, canonico in mapeamentos:
        partes.append(
            f"UPDATE ato SET orgao_id = (SELECT id FROM orgao WHERE sigla = {sqlstr(canonico)}) "
            f"WHERE orgao_id = (SELECT id FROM orgao WHERE sigla = {sqlstr(alias)});"
        )

    with open(a.saida, "w", encoding="utf-8") as f:
        f.write("\n".join(partes) + "\n")

    n_ins_orgao = len(canonicos)
    n_ins_alias = len(mapeamentos)
    n_upd = len(mapeamentos)
    print(f"SQL em {os.path.abspath(a.saida)}")
    print(f"comandos esperados: {n_ins_orgao} (orgao) + {n_ins_alias} (orgao_alias) + "
          f"{n_upd} (update ato) = {n_ins_orgao + n_ins_alias + n_upd}")


if __name__ == "__main__":
    main()
