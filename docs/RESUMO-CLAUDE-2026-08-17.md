# Resumo para o Claude — 17/08/2026

Hoje concluímos a etapa de suporte a múltiplas decisões de revalidação por ato.

## Decisões do usuário

- Pediu que Codex e Claude trabalhassem em parceria.
- Autorizou a configuração/disponibilização do Claude CLI no terminal; o Claude Desktop já estava instalado.
- Como o Claude ficou temporariamente sem tokens, autorizou o Codex a continuar o trabalho.
- Aprovou uma transição retrocompatível e pediu que ela fosse documentada para o Claude.
- Escolheu execução com subagentes e autorizou uma worktree isolada.
- Definiu explicitamente o contrato:
  - ausência de `revalidacao` e `revalidacoes` significa preservar fatos existentes;
  - `revalidacao: null` explícito significa sincronizar zero decisões;
  - o plural prevalece quando presente;
  - o singular continua como alias do primeiro item.
- Aprovou a criação do PR e informou ter feito backup do banco de produção.
- Aprovou o merge na `main`.

## Implementação realizada

- Criada `extrai_revalidacoes()`, mantendo `extrai_revalidacao()` como wrapper compatível.
- O ato real `#5792` agora produz duas decisões, em ordem documental, sem capturar a decisão `017/08` de afastamento.
- Foram adicionadas proteções contra blocos de revalidação apenas citados.
- Nenhum nome de requerente entra nos dados estruturados.
- O JSON agora:
  - mantém somente `revalidacao` para um pedido;
  - publica `revalidacoes` com a lista completa quando há dois ou mais;
  - preserva corretamente ausência, `null` e plural vazio.
- O schema passou a usar `UNIQUE (ato_id, ordem)`.
- Criada migração idempotente compatível com Percona 5.7.
- O importador aceita safras antigas e novas e sincroniza pedidos em ordem.
- O backfill histórico reconhece blocos coletivos, preserva os matchers singulares e faz substituição atômica com transação/savepoint.
- Os novos testes foram integrados ao CI.
- O contrato e a ordem de deploy foram documentados em `CLAUDE.md` e em `docs/PLANO-REPROCESSAMENTO-ACERVO.md`.

## Documentos de projeto

- Design aprovado: `docs/superpowers/specs/2026-08-17-multiplas-revalidacoes-design.md`.
- Plano de implementação: `docs/superpowers/plans/2026-08-17-multiplas-revalidacoes.md`.
- Migração do banco: `backend/db/migrar_ato_revalidacao_multiplas.sql`.

## Verificação e GitHub

- PR [#6 — Suporta múltiplas revalidações por ato](https://github.com/estudio-max/Portal-de-Normas-e-atos-da-UFF/pull/6) revisado e mesclado.
- `main` sincronizada no commit `8c80c84`.
- CI remoto verde: `extrator`, `frontend` e `ods`.
- Indexação automática concluída com sucesso.
- Na `main`, passaram novamente:
  - todos os scripts Python, incluindo 24/24 casos dependentes de PDFs;
  - todos os testes PHP;
  - testes Node de schema e integridade;
  - lint TypeScript;
  - build do frontend.
- Worktree e branches temporárias foram removidas.

## Estado de produção

Nenhuma migração, importação, execução de backfill ou implantação foi realizada em produção.

O usuário informou que já fez backup do banco de produção.

A ordem obrigatória para o deploy é:

1. Executar `backend/db/migrar_ato_revalidacao_multiplas.sql`.
2. Publicar helpers e importador.
3. Publicar o JSON novo.
4. Somente depois executar eventual backfill/reprocessamento controlado.

Inverter essa ordem pode descartar silenciosamente decisões posteriores à primeira.
