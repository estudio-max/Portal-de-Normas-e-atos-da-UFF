# Arquitetura da Base de Dados — Portal de Normas e Atos da UFF

> Documento de projeto. Fonte da verdade para a migração do schema atual (v1) para
> o schema normalizado (v2). Escrito a partir de auditoria do dump real de produção
> (dump `fanara87_uffnormas.sql`, 130.400 atos, 11/07/2026 — artefato gerado,
> fora do repositório).

---

## 1. Princípios de arquitetura

**Eixo central — o texto é a fonte da verdade.** Órgão, relações (revoga/altera),
signatário, aposentadoria e prazos são *derivados* do texto do ato. Quanto mais rica
a ementa/corpo, mais dado estruturado se deriva e se valida sozinho. Investir na
qualidade da ementa é o maior multiplicador de qualidade do projeto inteiro: melhora
uma coisa (o texto) e melhora dez a jusante. A base é desenhada para **guardar dado
derivado com sua origem e confiança**, de modo que, quando o texto melhorar, tudo se
re-deriva de forma limpa e auditável.

1. **Chave primária substituta e estável.** Todo registro tem PK `BIGINT AUTO_INCREMENT`
   sem significado de negócio. As chaves naturais (número/ano/órgão) viram restrições
   `UNIQUE`, nunca a PK. Isso elimina de vez a fragilidade do slug com dois esquemas.
2. **Dimensões normalizadas.** Órgão, tipo de ato, pessoa (servidor) e boletim são
   entidades de primeira classe, com tabela própria — não texto repetido em cada ato.
3. **Integridade referencial real.** Chaves estrangeiras em tudo, com `ON DELETE`
   pensado caso a caso. Nada de "id solto" apontando para lugar nenhum.
4. **Busca separada de exibição.** O corpo do ato guarda o texto original (caixa
   natural, para exibir e re-extrair) *e* uma versão normalizada (para FULLTEXT).
5. **Extensão sem alterar o núcleo.** Cada nova análise (aposentadoria, deslocamento,
   futuras) entra como tabela-fato estreita própria — nunca como coluna nova em `ato`.
6. **Proveniência, inferência e confiança.** Cada rodada de extração é registrada; cada
   fato carrega de qual extração veio, **por qual método foi obtido** (lido do
   cabeçalho, derivado do texto, inferido do signatário, curadoria manual) e com que
   confiança. Dado inferido é cidadão de primeira classe — não um "furo". Re-processar
   é auditável e reversível, e nunca quebra links (as PKs são estáveis).
7. **URL legível preservada.** O slug humano (`portaria-60164-2019`) sobrevive como
   coluna `uid UNIQUE` num único esquema determinístico — desacoplado da PK.

### 1.1 Cadeia de inferência do órgão emissor

Nem todo ato traz ementa ou sigla confiável. O órgão real é triangulado de vários
sinais, do mais forte ao mais fraco, registrando qual venceu (`ato.orgao_origem`):

1. **Cláusula de abertura do corpo** — *"O COMITÊ DE GOVERNANÇA, INTEGRIDADE, RISCOS
   E CONTROLES… no uso de suas atribuições… DECIDE"*. Quem age está declarado ali,
   por extenso; é o sinal mais autoritativo (dá nome canônico + permite achar a sigla).
2. **Nome no texto com sigla** — "…Comissão Permanente de Avaliação de Documentos
   **- CPAD**…" corrige glitches de cabeçalho e casa nome↔sigla.
3. **Sigla do cabeçalho** — "DECISÃO **CGIRC**/UFF nº 7"; boa quando não é glitch.
4. **Cargo do signatário** — quem assina ajuda a resolver e, sobretudo, a **posicionar
   na hierarquia**. Cuidado: o signatário nem sempre É o órgão. O Reitor assina tanto
   atos *da Reitoria* quanto de **colegiados que ele preside** (CGIRC, CUV, CEPEX…) —
   nesses, o órgão é o colegiado, e o Reitor apenas revela que ele é *ligado à Reitoria*.

**Hierarquia de órgãos.** Órgãos têm pai (`orgao.parent_id`): CGIRC → Reitoria,
CUV → Reitoria, um departamento → sua unidade. Isso permite atribuir o ato ao órgão
**específico** (CGIRC) e, ao mesmo tempo, fazer roll-up ("todos os atos de órgãos
ligados à Reitoria"). O cargo do signatário é uma das fontes para inferir esse pai.

O signatário, portanto, **não** é dado descartável: é sinal de primeira classe,
modelado como `ato.signatario_id` (+ `signatario_cargo`), que alimenta tanto a
identificação do órgão quanto a montagem da hierarquia.

---

## 2. Dívidas do schema atual (v1) — o que estamos corrigindo

Medido no dump de 11/07/2026:

| # | Dívida | Evidência | Correção em v2 |
|---|--------|-----------|----------------|
| 1 | `atos.id` = slug com 2 esquemas (`NNN-19` × `NNN-2003`) | 49.448 × 79.545 | PK substituta + `uid` único |
| 2 | Órgão como texto livre | 1.162 siglas distintas | dimensão `orgao` + `orgao_alias` |
| 3 | Colunas mortas | `identificador`/`tipo_acao`/`signatario` = 0% | removidas |
| 4 | Feature vira coluna na `atos` | `aposentadoria_*`, `deslocamento_*` | tabelas-fato `ato_aposentadoria`, `ato_deslocamento` |
| 5 | `ementa` mistura resumo e corpo | 26.178 "ementas" >200ch | `ementa` = só resumo; corpo em `ato_texto` |
| 6 | Corpo só minúsculo | 1 coluna p/ busca+exibição | `texto_original` + `texto_busca` |
| 7 | `ato_tags` repete o tipo | AUTO_INCREMENT 1,95M / 130k linhas | `tag` + `ato_tag` temáticas |
| 8 | Duplicatas de chave natural | ~10.922 linhas extras | `UNIQUE` natural + dedup na ETL |
| 9 | Pessoa/SIAPE desnormalizada | `ato_funcoes` + `ato_siapes` | dimensão `pessoa` |
| 10 | Sem proveniência; `boletins.data_pub` 100% vazia | — | tabela `extracao` + backfill de datas |

---

## 3. Schema alvo (v2)

Modelo em estrela leve: entidades-núcleo (`ato`, `boletim`) cercadas de dimensões
(`orgao`, `tipo_ato`, `pessoa`, `tag`) e tabelas-fato (`relacao`, `ato_funcao`,
`ato_pessoa`, `ato_aposentadoria`, `ato_deslocamento`, `prazo`).

### 3.1 Dimensões

```sql
-- Órgão emissor / unidade (canônico). As 1.162 grafias viram ~200-300 órgãos reais.
CREATE TABLE orgao (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sigla      VARCHAR(60)  NOT NULL,              -- canônica (ex.: "EEIMVR")
  nome       VARCHAR(200) NULL,                  -- por extenso, quando conhecido
  tipo       ENUM('reitoria','pro_reitoria','unidade','departamento',
                  'orgao_suplementar','conselho','externo','outro') NULL,
  ativo      TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_sigla (sigla)
) ENGINE=InnoDB;

-- Variações de grafia -> órgão canônico (ex.: "EEIMVR/UFF", "EEIMVR." -> EEIMVR)
CREATE TABLE orgao_alias (
  id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  orgao_id  BIGINT UNSIGNED NOT NULL,
  alias     VARCHAR(80) NOT NULL,
  UNIQUE KEY uq_alias (alias),
  FOREIGN KEY (orgao_id) REFERENCES orgao(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Os 10 tipos de ato (vocabulário controlado, estável).
CREATE TABLE tipo_ato (
  id     SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nome   VARCHAR(60) NOT NULL,                   -- "Determinação de Serviço"
  sigla  VARCHAR(8)  NULL,                        -- "DTS"
  ordem  SMALLINT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_nome (nome)
) ENGINE=InnoDB;

-- Servidor (por SIAPE). Consolida ato_funcoes + ato_siapes.
CREATE TABLE pessoa (
  id     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  siape  VARCHAR(10) NULL,                        -- pode faltar em atos antigos
  nome   VARCHAR(160) NOT NULL,
  UNIQUE KEY uq_siape (siape)                     -- NULL não colide (MySQL)
) ENGINE=InnoDB;

-- Boletim de Serviço (reconstruído com PK substituta).
CREATE TABLE boletim (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  numero     SMALLINT UNSIGNED NOT NULL,
  ano        SMALLINT UNSIGNED NOT NULL,
  data_pub   DATE NULL,                           -- backfill a partir do PDF/índice
  arquivo    VARCHAR(120) NULL,
  url_pdf    VARCHAR(255) NULL,
  paginas    SMALLINT UNSIGNED NULL,
  UNIQUE KEY uq_num_ano (numero, ano)
) ENGINE=InnoDB;
```

### 3.2 Núcleo: `ato`

```sql
CREATE TABLE ato (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,  -- estável p/ sempre
  uid           VARCHAR(120) NOT NULL,            -- slug legível único (URL)
  boletim_id    BIGINT UNSIGNED NOT NULL,
  tipo_id       SMALLINT UNSIGNED NOT NULL,
  orgao_id      BIGINT UNSIGNED NOT NULL,
  numero        VARCHAR(32) NOT NULL,             -- como impresso ("60.164")
  numero_norm   INT UNSIGNED NULL,                -- só dígitos, p/ ordenar/casar
  ano           SMALLINT UNSIGNED NOT NULL,       -- ano do ATO
  data_ato      DATE NULL,
  ementa        VARCHAR(600) NULL,                -- resumo REAL (corpo vai p/ ato_texto)
  ementa_inferida TINYINT(1) NOT NULL DEFAULT 0,
  status        ENUM('Ativo','Alterado','Revogado') NOT NULL DEFAULT 'Ativo',
  processo_sei  VARCHAR(32) NULL,
  sei_documento VARCHAR(16) NULL,
  secao         VARCHAR(8) NULL,
  pagina        VARCHAR(8) NULL,
  signatario_id BIGINT UNSIGNED NULL,             -- FK pessoa (quando extraído)
  extracao_id   BIGINT UNSIGNED NULL,             -- proveniência
  criado_em     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_uid (uid),
  UNIQUE KEY uq_natural (boletim_id, tipo_id, orgao_id, numero_norm, ano),
  KEY ix_tipo (tipo_id), KEY ix_orgao (orgao_id), KEY ix_ano (ano),
  KEY ix_status (status), KEY ix_data (data_ato), KEY ix_proc (processo_sei),
  FOREIGN KEY (boletim_id) REFERENCES boletim(id),
  FOREIGN KEY (tipo_id)    REFERENCES tipo_ato(id),
  FOREIGN KEY (orgao_id)   REFERENCES orgao(id),
  FOREIGN KEY (signatario_id) REFERENCES pessoa(id) ON DELETE SET NULL,
  FULLTEXT KEY ft_ementa (ementa)
) ENGINE=InnoDB;
```

> **`uq_natural` é a barreira anti-duplicata.** As ~10.922 linhas extras do v1 não
> conseguem entrar duas vezes: a ETL escolhe a linha mais rica e as demais colidem.

### 3.3 Corpo do ato (1:1) — resolve a dívida do minúsculo

```sql
CREATE TABLE ato_texto (
  ato_id          BIGINT UNSIGNED PRIMARY KEY,
  texto_original  MEDIUMTEXT NULL,      -- caixa natural: exibição + re-extração
  texto_busca     MEDIUMTEXT NULL,      -- normalizado (minúsculo, sem acento)
  FOREIGN KEY (ato_id) REFERENCES ato(id) ON DELETE CASCADE,
  FULLTEXT KEY ft_busca (texto_busca)
) ENGINE=InnoDB;
```

> Enquanto os PDFs não forem re-extraídos, `texto_original` recebe o que já existe
> (minúsculo) e `texto_busca` é cópia normalizada. A coluna `texto_original` fica
> pronta para, num segundo momento, receber o texto com caixa natural dos PDFs —
> sem mais nenhuma mudança de schema.

### 3.4 Tabelas-fato

```sql
-- Relações ato -> ato (substitui ato_relacoes).
CREATE TABLE relacao (
  id             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ato_id         BIGINT UNSIGNED NOT NULL,          -- origem
  tipo           ENUM('Revoga','Altera','Complementa') NOT NULL,
  destino_ato_id BIGINT UNSIGNED NULL,              -- link interno resolvido
  destino_texto  VARCHAR(200) NOT NULL,             -- como citado
  destino_norm   VARCHAR(200) NOT NULL,             -- normalizado p/ dedup/casar
  externo        TINYINT(1) NOT NULL DEFAULT 0,     -- destino fora do corpus UFF
  trecho         VARCHAR(255) NULL,                 -- evidência
  metodo         VARCHAR(20) NULL,                  -- 'corpo','ementa','manual'
  extracao_id    BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_rel (ato_id, tipo, destino_norm),
  KEY ix_origem (ato_id), KEY ix_destino (destino_ato_id), KEY ix_externo (externo),
  FOREIGN KEY (ato_id) REFERENCES ato(id) ON DELETE CASCADE,
  FOREIGN KEY (destino_ato_id) REFERENCES ato(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Designações/dispensas de função (substitui ato_funcoes, com pessoa/órgão FK).
CREATE TABLE ato_funcao (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ato_id     BIGINT UNSIGNED NOT NULL,
  acao       ENUM('designar','dispensar') NOT NULL,
  cargo      VARCHAR(60) NOT NULL,
  unidade    VARCHAR(180) NOT NULL,          -- texto fiel do ato
  orgao_id   BIGINT UNSIGNED NULL,           -- unidade casada ao órgão canônico
  pessoa_id  BIGINT UNSIGNED NULL,
  KEY ix_ato (ato_id), KEY ix_cargo (cargo),
  FOREIGN KEY (ato_id)    REFERENCES ato(id) ON DELETE CASCADE,
  FOREIGN KEY (orgao_id)  REFERENCES orgao(id) ON DELETE SET NULL,
  FOREIGN KEY (pessoa_id) REFERENCES pessoa(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Menções de servidor num ato (substitui ato_siapes).
CREATE TABLE ato_pessoa (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ato_id     BIGINT UNSIGNED NOT NULL,
  pessoa_id  BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_ato_pessoa (ato_id, pessoa_id),
  FOREIGN KEY (ato_id)    REFERENCES ato(id) ON DELETE CASCADE,
  FOREIGN KEY (pessoa_id) REFERENCES pessoa(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Tags temáticas REAIS (ODS etc.), many-to-many (substitui ato_tags).
CREATE TABLE tag (
  id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nome      VARCHAR(60) NOT NULL,
  categoria VARCHAR(30) NULL,             -- 'ODS', 'tema', ...
  UNIQUE KEY uq_nome (nome)
) ENGINE=InnoDB;
CREATE TABLE ato_tag (
  ato_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (ato_id, tag_id),
  FOREIGN KEY (ato_id) REFERENCES ato(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Analítico: aposentadoria (tira aposentadoria_* da tabela ato).
CREATE TABLE ato_aposentadoria (
  ato_id     BIGINT UNSIGNED PRIMARY KEY,
  tipo       VARCHAR(20) NULL,            -- voluntaria/compulsoria/invalidez
  base_legal VARCHAR(60) NULL,
  FOREIGN KEY (ato_id) REFERENCES ato(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Analítico: deslocamento de servidor (tira deslocamento_* da tabela ato).
CREATE TABLE ato_deslocamento (
  ato_id  BIGINT UNSIGNED PRIMARY KEY,
  tipo    VARCHAR(20) NULL,              -- remocao (art.36) / redistribuicao (art.37)
  direcao VARCHAR(12) NULL,             -- entrada/saida
  motivo  VARCHAR(30) NULL,
  setor   VARCHAR(60) NULL,
  FOREIGN KEY (ato_id) REFERENCES ato(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Analítico: prazos detectados (feature Prazos).
CREATE TABLE prazo (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ato_id      BIGINT UNSIGNED NOT NULL,
  tipo        VARCHAR(30) NULL,          -- inscricao/recurso/entrega/validade
  data_limite DATE NULL,
  trecho      VARCHAR(255) NULL,
  KEY ix_ato (ato_id), KEY ix_data (data_limite),
  FOREIGN KEY (ato_id) REFERENCES ato(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Todos os nºs de processo citados por um ato (feature Busca por processo).
-- ato.processo_sei guarda so o 1o; esta guarda todos. `digitos` = so-numeros,
-- p/ casar com/sem pontuacao. Preenchida por backfill_ato_processo.php + import.
CREATE TABLE ato_processo (
  id      BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ato_id  BIGINT UNSIGNED NOT NULL,
  numero  VARCHAR(32) NOT NULL,          -- como esta no texto
  digitos VARCHAR(24) NOT NULL,          -- so digitos (a busca usa este)
  ordem   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_ato_processo (ato_id, digitos), KEY ix_digitos (digitos),
  FOREIGN KEY (ato_id) REFERENCES ato(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Liga o ato ao colegiado PERMANENTE que ele cita (feature Comissões). A lista
-- de corpos e curada (comissoes_registro no index); esta tabela e o indice,
-- casado por FRASE ESTRITA (LIKE), nao FULLTEXT -- o indice de texto tokeniza e
-- daria falso positivo. `comissao` = slug do corpo no registro ('cpa','ceua').
-- Preenchida por backfill_ato_comissao.php + import diario.
CREATE TABLE ato_comissao (
  id       BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ato_id   BIGINT UNSIGNED NOT NULL,
  comissao VARCHAR(32) NOT NULL,
  UNIQUE KEY uq_ato_comissao (ato_id, comissao), KEY ix_comissao (comissao),
  FOREIGN KEY (ato_id) REFERENCES ato(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

### 3.5 Proveniência

```sql
CREATE TABLE extracao (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  executada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  git_commit   VARCHAR(40) NULL,
  versao       VARCHAR(20) NULL,
  escopo       VARCHAR(60) NULL,          -- 'full', '2018', 'relacoes-backfill'
  n_atos       INT NULL,
  observacao   VARCHAR(255) NULL
) ENGINE=InnoDB;
```

Cada fato re-processável (`ato`, `relacao`, `ato_funcao`, ...) carrega `extracao_id`.
Reprocessar um escopo = criar uma `extracao` nova, inserir os fatos com o novo id e
remover os do escopo anterior — **sem tocar nas PKs de `ato`**, então nenhum link
quebra. É o que torna a base "preparada para mudanças".

---

## 4. Por que isso "prevê mudanças"

| Mudança futura | Custo no v2 |
|----------------|-------------|
| Novo tipo de ato | 1 `INSERT` em `tipo_ato` |
| Novo órgão / nova grafia | 1 `INSERT` em `orgao`/`orgao_alias` |
| Nova análise (ex.: "afastamentos") | 1 tabela-fato nova; `ato` intacta |
| Re-extrair um ano com extrator melhor | nova `extracao`; PKs estáveis; links preservados |
| Tags ODS / curadoria temática | popular `tag`/`ato_tag`; nada de schema |
| Corrigir caixa do corpo | preencher `texto_original`; nada de schema |
| URL amigável nova | `uid` determinístico, 1 esquema só |

---

## 5. Estratégia de migração (sem perda, em paralelo)

Nunca mexer na produção viva. Construir a v2 ao lado, validar, e só então virar a chave.

1. **Criar banco `uffnormas_v2`** com o schema acima (vazio).
2. **ETL a partir do dump v1** (script Python, idempotente):
   - a. Construir `tipo_ato` (10 valores) e `orgao` + `orgao_alias` (canonicalizar as
        1.162 siglas → mapa alias→canônico; revisão humana da lista final).
   - b. Construir `boletim` (dedup por `numero+ano`) e `pessoa` (dedup por SIAPE).
   - c. Carregar `ato` com PK nova; **manter mapa `slug_v1 → id_v2`** em memória/tabela.
   - d. Dividir corpo → `ato_texto` (`texto_original` = atual; `texto_busca` = normalizado).
   - e. Migrar `relacao` re-apontando `destino_ato_id` pelo mapa slug→id.
   - f. Migrar `ato_funcao`, `ato_pessoa`, `ato_tag`, `ato_aposentadoria`, `ato_deslocamento`.
   - g. Dedup garantido pelas `UNIQUE` (mantém a linha mais rica).
3. **Validar** (relatório automático): contagens por ano/tipo, zero órfãos, FKs íntegras,
   amostras lado a lado v1×v2, busca FULLTEXT funcionando.
4. **Backfill de relações** sobre a base limpa (o INSERT-only que já preparamos, agora
   com `destino_norm`/`extracao_id` e, quando houver, corpo em caixa natural → mais recall).
5. **Rodar `resolver_relacoes_v2.php`** (liga `destino_ato_id`, recalcula status).
6. **Cutover**: apontar o app PHP para `uffnormas_v2`; manter v1 como backup congelado.
7. **Atualizar o pipeline** (`tools/extrair_boletim.py` / `tools/gerar_sql_core.py`)
   para emitir v2 nativo. O `backend/db/gerar_sql.py` citado nas primeiras versões
   deste plano era o gerador do v1 e foi apagado junto com o resto do v1;
   `gerar_sql_core.py` é o sucessor.

Cada passo tem um checkpoint de validação antes do próximo. A produção atual só é
tocada no passo 6, e mesmo assim de forma reversível (basta reapontar o app).

---

## 6. Pontos de decisão (do dono do produto)

1. **URL/slug legível (`uid`)** — vale manter URLs amigáveis? (recomendado: sim,
   esquema único determinístico `tipo-orgao-numero-ano`).
2. **Features analíticas** — tabelas-fato dedicadas por feature (recomendado, tipado)
   vs. um `ato_atributo` genérico (EAV, flexível mas sem tipo). Recomendo dedicadas.
3. **Cutover** — banco v2 novo + reapontar app (recomendado, reversível) vs. migração
   in-place no banco atual (mais arriscado).
4. **Canonicalização de órgãos** — precisa de uma passada de revisão humana no mapa
   das 1.162 siglas → ~200-300 órgãos. Definir quem valida a lista final.
```
