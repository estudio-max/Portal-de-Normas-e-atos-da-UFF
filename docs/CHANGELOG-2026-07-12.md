# CHANGELOG — 2026-07-11/12 · Base v2 normalizada + Radar de Prazos server-side

Reescrita da base de dados do Portal para um **schema normalizado (v2)** e uma
instância completa nova em **https://inteligencia.fanara.com.br/** (banco
`fanara87_governanca`). O `uff.fanara.com.br` foi redirecionado para lá.
Racional do schema: [`ARQUITETURA-BASE-DADOS.md`](ARQUITETURA-BASE-DADOS.md).

> Começou com um pedido simples — "preencher as relações em branco" — e virou uma
> re-arquitetura, porque a base v1 tinha dívidas estruturais que faziam qualquer
> reprocessamento **destruir dados** (reimportar com DELETE-por-ano derrubava a
> base de 130k → 55k atos).

## Por que (dívidas do v1)

- `atos.id` era slug string com **dois esquemas** convivendo (`NNN-19` × `NNN-2003`).
- Órgão como texto livre — **1.162 grafias** para ~poucas centenas de órgãos reais.
- Colunas mortas (`identificador`/`tipo_acao`/`signatario` = 0%); features viravam
  colunas na `atos`; corpo só em minúsculas; `ato_tags` só repetia o tipo.
- ~1.913 duplicatas reais.

## Schema v2 (`backend/db/schema_v2.sql`)

Modelo em estrela: **PK substituta `BIGINT` estável** + `uid` legível separado;
dimensões `orgao`/`orgao_alias`/`tipo_ato`/`pessoa`/`boletim`; núcleo `ato` +
`ato_texto` (texto_original + texto_busca); fatos `relacao`/`ato_funcao`/
`ato_pessoa`/`ato_tag`/`ato_aposentadoria`/`ato_deslocamento`/`prazo`; `extracao`
para proveniência. `UNIQUE` de chave natural barra duplicata; toda mudança futura
(tipo/órgão/análise/prazo novos) vira `INSERT`, não migração de schema.

## O que foi feito

### 1. ETL Fase A — reformatar sem perda (`backend/db/etl-v2/`)
128.487 atos migrados (1.913 duplicatas reais colapsadas, **zero perda**), 926
órgãos, 23.938 relações, 21.973 pessoas, 4.914 boletins. Integridade 100%.
Dois bugs pegos por divergência entre o dedup Python e a **collation do MySQL**:
alias colidindo por acento (`DECISOES`==`DECISÕES`) e `numero_norm` como INT
(`'001'`==`'01'`==`'1'`). Lição registrada para qualquer ETL futuro.

### 2. Órgão resolvido POR ATO (do texto)
**77% dos órgãos vêm do texto** (`orgao_origem='texto'`): a cláusula de abertura
dá o nome autoritativo + o cargo do signatário. Regra do Reitor aplicada
(Reitor → Reitoria, salvo colegiado que ele preside — CGIRC/CUV/CEPEx). Backbone
oficial em `backend/db/orgaos_backbone.json` (organograma UFF, Portaria
68.235/2021 + lista de unidades). Siglas que derivam o mesmo nome colapsam
(ex.: `EEIMVR` ≡ `VEI`). A **identidade** do ato é a `sigla_orig` (cabeçalho); o
órgão derivado é enriquecimento.

### 3. Backfill de relações
8.920 relações novas (extrator corrigido: `Nº` maiúsculo + formato compacto
`SIGLA NN/AAAA`), zero colisão, zero órfão. 2ª camada de checagem de
autorreferência via `tipo_id+numero_norm+ano` (limpo) pegou 2.961 casos que a
checagem por sigla do v1 deixava passar.

### 4. Camada PHP v2 (deploy em inteligencia.fanara.com.br)
- **`backend/api/index_v2.php`** — reescrita completa da API (7 endpoints)
  traduzindo toda referência de tabela/coluna para o schema v2, **mantendo o
  mesmo formato de resposta JSON** (o frontend compilado roda sem alteração).
  `link_sei_*`/`link_boletim` são derivados (não precisaram de coluna).
- **`backend/importar/resolver_relacoes_v2.php`** — liga `destino_ato_id` +
  recalcula vigência. Melhoria: desempata pelo ano citado (`nº 267/2013`).
  Produção: 12.382 resolvidas, vigência estável.
- **`backend/importar/importar_v2.php`** — sincronização diária (cron 2×/dia).
  **Idempotente** (SELECT-first por chave natural, sem `ON DUPLICATE`). Dois bugs
  reais evitados via simulação: uid sem boletim sequestrava a linha errada; e a
  **identidade do boletim é o ARQUIVO**, não o número impresso (o arquivo
  `57-26.pdf` traz "BS nº 113") — keying por número duplicaria 178 atos.
  Confirmado em produção: `novos=0`, total inalterado (0 duplicata).

### 5. Correção CEP ≠ CEPEx
O resolver rotulou erroneamente ~14k atos como um órgão "CEP" separado (era o
CEPEx citado sem "Extensão"). Corrigido (`fix_cep_cepex.sql`) + guarda em
`resolver_orgaos.py`. **CEP (Comitê de Ética em Pesquisa, 3 instâncias) é órgão
totalmente diferente do CEPEx** — não mesclar.

### 6. Correções cosméticas
Title Case dos nomes de órgão derivados (backbone curado à mão preservado); datas
`0000-00-00` → NULL; 1 ano de OCR errado (`1014`→`2014`). Causa raiz corrigida no
pipeline (`resolver_orgaos.py`, `etl_v2.py`).

### 7. Radar de Prazos server-side
Antes: a API mandava **8 MB** de texto cru (3.000 atos, janela cega de ~11 meses)
e extraía no cliente — contratos de 5 anos e validades de bolsa de atos antigos
ficavam **invisíveis**. Agora: extração no servidor materializada na tabela
`prazo`. `extrair_prazos.php` (importador) é **espelho fiel** de `extrairPrazos`
em `src/dataSource.ts` e de `etl-v2/extrair_prazos.py` (backfill) — os três
concordam (paridade confirmada em produção). A API lê da tabela
(`data_limite >= hoje-90d`); `getPrazos()` virou passthrough. Resultado:
**payload 8 MB → 100 KB (~80×)**, e o ponto cego resolvido (ato de 2021 com prazo
vencendo agora, antes invisível, aparece).

### 8. Cache-Control (`public/.htaccess`)
`index.html` com `no-cache` (deploy novo aparece na hora) + assets hasheados
imutáveis por 1 ano. Resolve o cache velho de `index.html` visto no deploy.

## Pendências

- **Cutover para o domínio oficial da UFF** (próximo passo, ainda não abordado).
- Curadoria fina: identificar o Comitê de Ética (CEP) no corpus; ~35 nomes de
  órgão com sigla embutida entre parênteses (limitação da caixa perdida).
- Re-extração dos PDFs em caixa natural (Fase B) — habilitada pela PK estável.
