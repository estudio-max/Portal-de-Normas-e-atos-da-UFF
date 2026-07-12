# Pipeline ETL — Base v2 (schema normalizado)

Scripts Python que **construíram a base v2** (`fanara87_governanca`) a partir do
dump da base v1 (`atos`, `ato_relacoes`, …), na migração de 11–12/07/2026.
Ver o racional do schema em [`../../../docs/ARQUITETURA-BASE-DADOS.md`](../../../docs/ARQUITETURA-BASE-DADOS.md)
e o relato completo em [`../../../docs/CHANGELOG-2026-07-12.md`](../../../docs/CHANGELOG-2026-07-12.md).

> ⚠️ **Caminhos hardcoded.** Estes scripts têm os caminhos do ambiente original
> (`C:/Users/estud/…/out/…`, `…/out_v2/…`) escritos direto no código. Foram uma
> migração pontual, não um pipeline parametrizado. Para re-rodar (ex.: cutover
> para o domínio da UFF), ajustar os caminhos no topo de cada script.

## Ordem de execução

1. **`parse_dump.py`** — stream-parser de `INSERT`s de um mysqldump (usado por
   todos os outros). Sozinho, imprime estatísticas da `ato_relacoes` do dump.
2. **`derivar_orgao_texto.py`** — deriva o NOME do órgão + cargo do signatário
   da cláusula de abertura do corpo de cada ato ("[o/a] cargo d[oa] NOME, no uso
   de suas atribuições…"). Diagnóstico; alimenta a intuição do resolver.
3. **`resolver_orgaos.py`** — resolve o órgão emissor **por ato** (backbone
   oficial + derivação do texto + regra do Reitor). Gera `out_v2/orgao_resolucao.json`.
4. **`etl_v2.py`** — ETL principal: lê o dump v1, aplica a resolução de órgãos,
   deduplica por chave natural (mantém a linha mais rica, sem perda) e emite
   `out_v2/v2_dados.sql` + `out_v2/v2_texto.sql` (schema em `../schema_v2.sql`).
5. **`validar_v2.py`** — valida integridade do SQL gerado (uid único, chave
   natural única, todas as FKs fechando, zero órfãos). Replica as regras de
   collation do MySQL (acento-insensível; `numero_norm` como INT).

### Enriquecimentos (rodados sobre a base já importada)

- **`backfill_relacoes_v2.py`** — backfill INSERT-only de `relacao` (extrator
  corrigido sobre ementa+corpo). Gera `out_v2/v2_backfill_relacoes.sql`.
- **`extrair_prazos.py`** — extração de datas-limite (Radar de Prazos). **Espelho
  fiel** de `extrairPrazos`/`inferirPublico` de `src/dataSource.ts` e de
  `../../importar/extrair_prazos.php` — os três precisam concordar.
- **`gerar_backfill_prazos.py`** — usa o anterior p/ gerar `out_v2/prazo_backfill.sql`
  (popula a tabela `prazo` de todos os atos existentes).
- **`gerar_fix_cosmeticos.py`** — corrige nomes de órgão (Title Case) + datas
  zeradas em produção. Gera `out_v2/fix_cosmeticos.sql`.

### Harnesses de validação (sem PHP/MySQL local)

- **`simular_resolver_v2.py`** — simula a lógica do `resolver_relacoes_v2.php`
  contra os dados reais (confere taxa de resolvidos/ambíguos antes de rodar).
- **`simular_importar_v2.py`** — simula a identidade do `importar_v2.php`
  (chave natural + boletim-por-arquivo) p/ garantir idempotência (0 duplicata).
