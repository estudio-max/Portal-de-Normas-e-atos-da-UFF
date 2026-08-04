---
name: deploying-portal-uff
description: Use when preparing or executing a deploy of the Portal de Normas e Atos da UFF (frontend build, API route/contract change, SQL migration, or data backfill) to the production server — HostGator today, UFF after the migration.
---

# Deploying Portal de Normas e Atos da UFF

> **Este arquivo existe em DUAS cópias.** A que o Claude Code carrega é a da
> pasta-mãe (`portal-normas-uff/.claude/skills/`) — skill dentro de `repo/`
> não é descoberta quando se trabalha a partir da pasta-mãe (testado). A do
> `repo/` é a versionada no Git. **Editou uma, copie para a outra**:
> `cp repo/.claude/skills/deploying-portal-uff/SKILL.md .claude/skills/deploying-portal-uff/SKILL.md`

## Overview

Deploy aqui é **manual, sem SSH, sem CI/CD**: upload por Gerenciador de
Arquivos + SQL por phpMyAdmin. O erro mais caro nunca foi técnico — foi
subir metade do que devia, ou subir na ordem errada.

## Ambiente atual

- **Hoje: HostGator**, cPanel, sem SSH. Mapa de arquivos e schema em
  `repo/CLAUDE.md` § "Como fazer deploy" / "Schema v2".
- **Migração para UFF prevista.** Sinal rápido: se a URL de produção já for
  `*.uff.br` (não mais `inteligencia.fanara.com.br`), a migração aconteceu —
  pare e confira `CLAUDE.md`/`docs/MIGRACAO-UFF.md` antes de seguir os passos
  abaixo (upload/SQL/cron mudam; pode haver SSH, outro `config.php`). Este
  skill assume HostGator até o corte acontecer.

## O que mudou → o que fazer

| Mudou | Ação |
|---|---|
| Só `src/`/`public/` (frontend) | `npm run build` → subir **todo o `dist/`, inclusive o `.htaccess`** (dotfile — ative "mostrar arquivos ocultos" no Gerenciador) |
| Nova rota ou contrato de resposta da API | build do frontend **+** `backend/api/index_v2.php` → **renomear para `api/index.php`** ao subir. Bump em `api_versao()`. Os dois sobem **juntos, mesma janela** — nunca só um. Regra prática de ordem: **API primeiro, frontend depois** (rota nova não quebra front velho); só inverta se for mudança de **contrato** numa rota já existente. |
| Nova tabela-fato / novo tipo de backfill | 1) SQL idempotente (`CREATE TABLE IF NOT EXISTS`) no phpMyAdmin. 2) Subir o `.php` de backfill (recebe `?arquivo=` — é genérico, reaproveite o mesmo script em recargas futuras da mesma tabela, não crie um novo por correção) + o(s) `.json` de carga em `importar/`. 3) Rodar via URL: `?token=<import_token do config.php>&arquivo=nome.json`. |
| Correção de uma carga já rodada | **Sempre `&recomecar=1` na carga principal.** É um `DELETE` restrito às linhas `metodo='ia'` daquela tabela — não trunca, nunca toca em linha de curadoria, e é seguro repetir se o PHP cair no meio (sem SSH para retomar). Sem esse parâmetro, upsert não apaga linha que saiu do JSON novo — nenhum erro aparece, o painel só mistura dado velho com o novo. Rodar a carga "ia" primeiro, a de "curadoria" depois. |

## Checklist pós-deploy (sempre)

```bash
curl -s $BASE/api/health              # confirma api_versao
curl -s $BASE/api/<rota-que-mudou>    # confirma o dado novo
```

No navegador: abrir a aba afetada e confirmar que **não** caiu no "modo de
contingência" (isso significa que a API não respondeu e o front caiu para
o JSON estático do GitHub).

## Erros já cometidos aqui (não repetir)

- `cp -r dist/* destino/` **não copia** o `.htaccess` (dotfile) →
  `index.html` fica sem revalidação de cache → usuário pode ver tela
  branca em cache velho. Use `cp -a dist/. destino/`.
- **Pacote parcial montado "pelo que eu editei" derrubou o portal inteiro**
  (03/08/2026). Os painéis são `lazy()`: cada aba é um chunk próprio com
  hash no nome (`ComissoesApi-hT10-kmb.js`), e o `index.html` **não os
  referencia** — são pedidos em runtime, ao clicar na aba. Ficaram 20 de
  fora, todos 404, e toda aba quebrou. Pior: eles mudam de nome TODOS
  JUNTOS quando um módulo compartilhado muda (bastou editar
  `dataSource.ts`, que todo painel importa).
  **O que entra no pacote não se deduz do que se editou — pergunta-se ao
  servidor:** `python tools/pacote_delta.py` compara cada arquivo do
  `dist/` por hash contra a produção e monta a pasta só com o que falta.
  Exceção conhecida: o `.htaccess` não dá para comparar (o Apache responde
  403 ao próprio arquivo, corretamente) — decida por
  `git log -- public/.htaccess`.
- Subir `index_v2.php` **com esse nome** deixa a API inerte — o
  `api/.htaccess` só roteia `/api/*` para `api/index.php`.
- Recarregar um backfill sem `&recomecar=1`: linhas que saíram da
  classificação nova continuam no banco — nenhum erro aparece, o painel
  só mistura dado velho com o novo.
- Pasta `importar/` sem `.htaccess` próprio expõe `.json`/`.sql`/`.md` de
  carga por HTTP a quem adivinhar o nome do arquivo — toda pasta de
  ferramentas de manutenção precisa de um `.htaccess` bloqueando essas
  extensões (`api/.htaccess` já protege `config.php`; `importar/` teve
  que ganhar o dele à parte).
- **A aba Importar do phpMyAdmin DESCARTA o resultado de `SELECT`.** Ela é
  para carregar dados: devolve "N consultas executadas" ou o erro, e mais
  nada. Um arquivo de verificação inteiro passa por ali sem exibir uma
  linha — parece falha muda do banco. **SQL de migração vai pela Importar
  (é DDL, não tem saída); SQL de verificação vai pela aba SQL.**
- **Referência a `information_schema` vira o banco corrente para as
  consultas SEGUINTES do mesmo arquivo.** Medido em 03/08/2026: com
  `SELECT DATABASE()` devolvendo `fanara87_governanca` corretamente, a
  consulta logo depois de um `FROM information_schema.TABLES` estourou com
  "#1109 Tabela 'evidencia_fato' desconhecida em 'information_schema'". Num
  arquivo que mistura os dois, **ponha as consultas às tabelas do projeto
  primeiro e as de `information_schema` no fim** — é o que
  `backend/db/verificar_inteligencia.sql` faz e por quê.

## Empacotando um deploy de dados (padrão a repetir)

**Correção pontual de 1 arquivo** (ex.: um `.json` de carga corrigido): sobe
direto, sem pacote — é ruído para uma mudança pequena.

**Carga nova ou multi-artefato** (dist + api + dados juntos, como a virada
inicial da aba ODS): monte antes, localmente, uma pasta
`enviar-hostgator-<nome>/` com `dist/`, `api/`, `importar/` e um
`LEIA-ME.md` com o checklist daquela carga (`enviar-hostgator-ods/`, na
pasta-mãe fora do repo, é o modelo). Antes de anunciar "pronto", rodar
checagens em Python: contagem de linhas do JSON, vínculos válidos, e
ausência de colisão de chave (ex.: par `(uid, ods)` duplicado entre a carga
principal e a de curadoria).
