# Portal de Normas e Atos da UFF — estado atual

Indexador do Boletim de Serviço da UFF: baixa os PDFs, extrai os atos, carrega
num MySQL e serve um portal de busca e análise.

**Este arquivo descreve só o presente.** Nada de histórico entra aqui — a história
está no `git log` e em `docs/CHANGELOG-*.md`. Se algo aqui deixou de ser verdade,
corrija a linha, não acrescente uma nota dizendo que mudou.

## O que está no ar

- **Site:** https://inteligencia.fanara.com.br/ (`uff.fanara.com.br` redireciona
  para lá — é um domínio antigo, não use como referência).
- **Host:** HostGator (cPanel). **Sem acesso SSH** — todo deploy é upload manual
  pelo Gerenciador de Arquivos, e todo SQL roda pelo phpMyAdmin.
- **Banco:** `fanara87_governanca`, schema **v2 normalizado**.
- **Frontend:** React + TypeScript (Vite). **Backend:** PHP + MySQL (só leitura).

## Fonte canônica

**Esta pasta (`repo/`) é a única fonte.** É um clone git de
`estudio-max/Portal-de-Normas-e-atos-da-UFF`. Existem outras pastas ao lado com
cópias do app — todas defasadas. Nunca edite fora daqui.

Regra de fechamento: **todo trabalho termina em `git commit` + `git push`.** O
GitHub é o espelho único; se não foi empurrado, não aconteceu.

## Armadilhas de nome (leia antes de editar qualquer arquivo)

| Arquivo | O que é |
|---|---|
| `backend/api/index_v2.php` | **A API viva.** É este que você edita. |
| `backend/api/index.php` | API do v1, **morta**. Não edite, não faça deploy. |
| `backend/db/schema_v2.sql` | O schema vivo. |
| `backend/db/schema.sql`, `gerar_sql.py`, `importar/importar.php`, `resolver_relacoes.php` | v1, mortos. |
| `backend/importar/importar_v2.php`, `resolver_relacoes_v2.php` | Os vivos. |

**Regra de deploy da API:** `index_v2.php` sobe para o servidor **renomeado como
`api/index.php`**. O `.htaccess` roteia `/api/*` para `index.php`; subir com o
nome `index_v2.php` deixa a API inerte e o portal cai para o modo estático sem
avisar.

## Schema v2 (essencial)

Modelo em estrela. PK substituta `ato.id` (BIGINT, estável) + `ato.uid` (slug
legível). **A API expõe `uid AS id`** — o `id` público em URLs é o `uid`, nunca o
BIGINT interno.

- Dimensões: `orgao`, `orgao_alias`, `tipo_ato`, `pessoa`, `boletim`
- Núcleo: `ato`, `ato_texto` (`texto_original` exibe, `texto_busca` é o FULLTEXT)
- Fatos: `relacao`, `ato_funcao`, `ato_pessoa`, `ato_tag`, `ato_aposentadoria`,
  `ato_deslocamento`, `prazo`
- Proveniência: `extracao`

Consequência prática: **análise nova vira `INSERT` numa tabela-fato, não coluna
nova.** Se você está pensando em `ALTER TABLE ato ADD COLUMN`, parou no modelo
errado — era assim no v1 e foi justamente o que se abandonou.

Racional completo: `docs/ARQUITETURA-BASE-DADOS.md`.

## Como fazer deploy

```bash
npm install
npm run build      # gera dist/ (dist/ é gitignored — não vem do GitHub)
```

Suba pelo Gerenciador de Arquivos da HostGator:

1. **Frontend:** conteúdo de `dist/` → raiz do site.
2. **API:** `backend/api/index_v2.php` → `api/index.php` (renomeando).

**Se o formato de resposta da API mudou, `dist/` e `api/index.php` sobem juntos,
na mesma janela.** Subir só um dos dois quebra o painel afetado.

`backend/api/config.php` mora só no servidor (está no `.gitignore` e contém as
credenciais do banco). Não versione, não imprima o conteúdo.

## Regras do domínio que já custaram retrabalho

- **CEP ≠ CEPEx.** CEP é o Comitê de Ética em Pesquisa (3 instâncias), órgão
  totalmente diferente do CEPEx. Nunca mesclar.
- **A identidade do boletim é o ARQUIVO, não o número impresso.** O arquivo
  `57-26.pdf` traz "BS nº 113"; chavear pelo número duplica atos.
- **A identidade do ato é a `sigla_orig`** (a do cabeçalho). O órgão derivado do
  texto é enriquecimento, não identidade.
- **Classifique pelo dispositivo do ato, não por menção.** Uma retificação que
  cita uma concessão anterior ("…portaria X, **que concedeu** aposentadoria…")
  não é uma concessão nova. O marcador é o "que" antes do verbo.
- **Collation do MySQL ≠ dedup do Python.** `DECISOES` == `DECISÕES` e
  `'001'` == `'01'` == `'1'` para o MySQL. Qualquer ETL precisa considerar isso.
- Órgão tem ~1.162 grafias de sigla no corpus. Consolidar é **curadoria** (via
  `orgao_alias`), não regex.

## Documentos que NÃO são confiáveis

`README.md` (topo), `DEPLOY.md` e `backend/README.md` descrevem o mundo v1
(Cloud Run, `app-fonte/`, banco `fanara87_uffnormas`). Estão marcados como
defasados. **Este arquivo manda neles.**

## Pendências

- **Aposentadoria/deslocamento no v2 estão incompletos e provavelmente
  inflados.** O ETL copiou as colunas do v1 para `ato_aposentadoria` /
  `ato_deslocamento` sem reclassificar, e o v1 nunca recebeu as correções: falta
  o backfill de 2001-2014, e 2015-2026 carrega ~11% de retificações contadas como
  concessão nova. Os SQLs antigos em `../out/corrigir_*.sql` **são do v1 e não
  rodam no v2** (escrevem em `atos`/`ato_corpo`, que não existem) — precisam ser
  regerados no formato das tabelas-fato. Confira o estado real no phpMyAdmin
  antes de agir.
- Curadoria fina de órgãos: identificar o CEP no corpus; ~35 nomes com sigla
  embutida entre parênteses.
- Fase B: re-extração dos PDFs em caixa natural (habilitada pela PK estável).
- Cutover para o domínio oficial da UFF.
