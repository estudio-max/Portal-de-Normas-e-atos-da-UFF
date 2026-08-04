-- ============================================================================
--  inteligencia_institucional.sql — schema ADITIVO do núcleo analítico.
--
--  Doze tabelas novas para os cinco módulos de inteligência institucional:
--  política (dossiê temático), obrigação (radar), comissão (observatório),
--  indicador (maturidade documental) e mudança (monitor). Nenhuma tabela do
--  schema v2 é alterada; nenhuma coluna nova entra em `ato`.
--
--  Rodar no phpMyAdmin, DEPOIS de `schema_v2.sql` e ANTES de qualquer backfill.
--  Confira o resultado com `verificar_inteligencia.sql`.
--
--  Percona Server 5.7 — sem CTE, sem função de janela, sem REGEXP_REPLACE.
--
--  ---------------------------------------------------------------------------
--  SEIS DECISÕES QUE ESTE ARQUIVO TOMA (e que a especificação não tomava)
--  ---------------------------------------------------------------------------
--
--  1. TODA tabela tem chave natural UNIQUE. Sem ela, reprocessar um ato duplica
--     o fato — e "importação idempotente" é regra do projeto, não preferência.
--     Vale inclusive para `evidencia_fato` e `comissao_membro_evento`, que na
--     especificação só tinham índice de leitura.
--
--  2. `comissao` é chaveada pelo SLUG, não por um BIGINT novo. `ato_comissao`
--     (schema v2) já liga ato→corpo por `comissao VARCHAR(32)`, o slug do
--     registro curado. Um id substituto criaria dois identificadores para a
--     mesma entidade e obrigaria um JOIN a mais em toda consulta do painel que
--     já está no ar. São 26 linhas curadas à mão: o slug É a chave estável.
--
--  3. NÃO existe FK de `obrigacao` para `prazo`. O importador faz
--     `DELETE FROM prazo WHERE ato_id=:id` seguido de INSERT a cada importação
--     do ato (importar_v2.php), então `prazo.id` é reciclado a cada rodada —
--     uma FK apontaria para linha trocada ou seria zerada por ON DELETE SET
--     NULL todo dia. A obrigação guarda a sua própria data resolvida e a base
--     de cálculo; o reencontro com `prazo`, quando interessar, é por
--     (`ato_origem_id`, `data_limite`).
--
--  4. As datas vêm de `extrair_prazos()` (importar/extrair_prazos.php), não de
--     regex novo. Aquela função já casa "até DD/MM/AAAA", "até DD de MÊS" e
--     "N dias a contar da publicação/assinatura", e já tem TRÊS espelhos que
--     precisam concordar (PHP, dataSource.ts, .py do backfill). Um quarto
--     espelho seria dois códigos discordando sobre a mesma cláusula. O detector
--     de obrigação acrescenta o que não existe hoje: modal obrigatório,
--     responsável e evidência posterior.
--     ⚠️ Limite herdado: `_pz_valida()` só aceita ano entre 2015 e 2035.
--     Obrigação com prazo fora disso entra com `data_limite` NULL e
--     `data_base_origem='fora_da_janela'` — não some, mas não vira semáforo.
--
--  5. Curadoria é soberana, no mesmo desenho da `ato_ods`: a passada automática
--     só pode apagar o que ela mesma escreveu. O predicado é
--     `metodo NOT IN ('curadoria','regra+curadoria','ia+curadoria')` — qualquer
--     linha que passou por mão humana sobrevive ao reprocessamento.
--
--  6. Orçamento de índice conferido para os DOIS formatos de linha do 5.7, já
--     que não há SSH para inspecionar o servidor antes de aplicar. As regras do
--     InnoDB são duas, e não uma: cada COLUNA do índice cabe em 767 bytes no
--     formato COMPACT/REDUNDANT (3072 no DYNAMIC, que é o default do 5.7), e a
--     CHAVE INTEIRA cabe em 3072 bytes em qualquer formato. Em utf8mb4 cada
--     caractere custa 4 bytes, então o teto por coluna no pior caso é
--     VARCHAR(191). Nenhuma coluna indexada aqui passa de VARCHAR(180) = 720
--     bytes, e a maior chave composta soma 857 — folga nos dois limites.
--     `backend/db/teste_inteligencia_sql.php` recalcula isso a cada CI.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. POLÍTICA — a dimensão que organiza o assunto.
--
-- Catálogo CURADO, como o das comissões. Descoberta automática de política
-- nova é etapa posterior; aqui o mantenedor decide o que é política.
-- `slug` é o identificador público (rota `#/institucional/politicas/{slug}`) —
-- nunca exponha o BIGINT, mesma regra do `ato.uid`.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `politica` (
  `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`                 VARCHAR(80)  NOT NULL,
  `nome`                 VARCHAR(180) NOT NULL,
  `descricao`            VARCHAR(600) NULL,
  `categoria`            VARCHAR(60)  NULL,
  `orgao_responsavel_id` BIGINT UNSIGNED NULL,
  `ato_fundador_id`      BIGINT UNSIGNED NULL,
  `status_curadoria`     ENUM('rascunho','publicada','arquivada') NOT NULL DEFAULT 'rascunho',
  `criado_em`            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_politica_slug` (`slug`),
  KEY `ix_politica_orgao` (`orgao_responsavel_id`),
  KEY `ix_politica_status` (`status_curadoria`),
  CONSTRAINT `fk_politica_orgao`    FOREIGN KEY (`orgao_responsavel_id`) REFERENCES `orgao` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_politica_fundador` FOREIGN KEY (`ato_fundador_id`)      REFERENCES `ato`   (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 2. POLITICA_ALIAS — os nomes pelos quais a política aparece no corpus.
--
-- Mesma lição do registro de comissões: um corpo tem VÁRIOS nomes históricos, e
-- o termo errado esconde atos (o CEP era grafado "em Pesquisa", não "na
-- Pesquisa" — 44 atos invisíveis). `frase_estrita` é o tipo que casa por LIKE
-- numa tabela-fato; `termo_busca` serve para triagem, nunca para gravar vínculo
-- (FULLTEXT tokeniza: "segurança da informação" casa "engenharia da informação").
--
-- `termo` é VARCHAR(180): 180×4 = 720 bytes na UNIQUE, abaixo dos 767 por
-- coluna do formato COMPACT, e a chave fecha em 729 dos 3072 disponíveis. O
-- nome de colegiado mais longo do registro atual tem 73 caracteres.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `politica_alias` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `politica_id` BIGINT UNSIGNED NOT NULL,
  `termo`       VARCHAR(180) NOT NULL,
  `tipo`        ENUM('nome_historico','sigla','frase_estrita','termo_busca') NOT NULL,
  `ativo`       TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_politica_alias` (`politica_id`, `termo`, `tipo`),
  CONSTRAINT `fk_palias_politica` FOREIGN KEY (`politica_id`) REFERENCES `politica` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 3. ATO_POLITICA — qual PAPEL o ato cumpre na política.
--
-- Não é "o ato fala do assunto X": é o que ele FAZ pela política. Mesma regra
-- do `ato_ods.vinculo`, e pela mesma razão — sem separar papel, o dossiê conta
-- menção como execução e o indicador infla sozinho.
--
-- O mapeamento com `ato_ods.vinculo`, para as duas taxonomias não divergirem:
--   ato_ods 'proposta' ≈ papel 'fundador' ou 'regulamentacao'
--   ato_ods 'execucao' ≈ papel 'execucao' ou 'governanca'
--   ato_ods 'pesquisa'/'ensino' não têm papel correspondente — são evidência
--   de missão acadêmica, não de ciclo de política institucional.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ato_politica` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`        BIGINT UNSIGNED NOT NULL,
  `politica_id`   BIGINT UNSIGNED NOT NULL,
  `papel`         ENUM('fundador','regulamentacao','execucao','governanca','monitoramento','avaliacao','alteracao','revogacao','referencia') NOT NULL,
  `confianca`     ENUM('alta','media','baixa') NOT NULL,
  `metodo`        ENUM('regra','ia','curadoria','regra+curadoria','ia+curadoria') NOT NULL,
  `justificativa` VARCHAR(500) NULL,
  `extracao_id`   BIGINT UNSIGNED NULL,
  `revisado_em`   DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ato_politica_papel` (`ato_id`, `politica_id`, `papel`),
  KEY `ix_ap_politica` (`politica_id`, `papel`),
  CONSTRAINT `fk_apol_ato`      FOREIGN KEY (`ato_id`)      REFERENCES `ato`      (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_apol_politica` FOREIGN KEY (`politica_id`) REFERENCES `politica` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_apol_extracao` FOREIGN KEY (`extracao_id`) REFERENCES `extracao` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 4. POLITICA_EVENTO — a unidade da linha do tempo.
--
-- Um ato pode gerar mais de um evento (institui E designa a comissão). O evento
-- guarda o seu ato: nunca funda texto de atos distintos numa "norma
-- consolidada" — isso é interpretação jurídica, não indexação.
--
-- `data_evento` é NULL quando o corpus não declara data. A interface mostra
-- "data não localizada"; ausência de dado não vira estimativa silenciosa.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `politica_evento` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `politica_id` BIGINT UNSIGNED NOT NULL,
  `ato_id`      BIGINT UNSIGNED NOT NULL,
  `tipo`        ENUM('instituicao','regulamentacao','designacao','recomposicao','plano','execucao','entrega','monitoramento','avaliacao','alteracao','revogacao','outro') NOT NULL,
  `data_evento` DATE NULL,
  `titulo`      VARCHAR(240) NOT NULL,
  `resumo`      VARCHAR(700) NULL,
  `orgao_id`    BIGINT UNSIGNED NULL,
  `confianca`   ENUM('alta','media','baixa') NOT NULL,
  `metodo`      ENUM('regra','ia','curadoria','regra+curadoria','ia+curadoria') NOT NULL,
  `extracao_id` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_evento` (`politica_id`, `ato_id`, `tipo`),
  KEY `ix_evento_tempo` (`politica_id`, `data_evento`),
  CONSTRAINT `fk_pe_politica` FOREIGN KEY (`politica_id`) REFERENCES `politica` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pe_ato`      FOREIGN KEY (`ato_id`)      REFERENCES `ato`      (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pe_orgao`    FOREIGN KEY (`orgao_id`)    REFERENCES `orgao`    (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pe_extracao` FOREIGN KEY (`extracao_id`) REFERENCES `extracao` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 5. COMISSAO — projeção em tabela do registro curado de colegiados.
--
-- Hoje o registro vive em DUAS cópias que não podem divergir:
-- `comissoes_registro()` (index_v2.php) e `comissoes_termos()`
-- (importar/comissoes_match.php), ambas geradas por tools/registro_comissoes.py.
-- Esta tabela é a TERCEIRA projeção e obedece à mesma regra: sai do gerador,
-- nunca da mão. Editar linha aqui e não no gerador é como o registro diverge.
--
-- PK = slug (ver decisão 2 no cabeçalho). `ato_comissao.comissao` guarda o
-- mesmo slug, então o JOIN é direto e o contrato de /api/comissoes não muda.
-- `obrigatoriedade` espelha o campo `obrig` do registro, com 'nao_classificada'
-- no lugar da string vazia: 7 por lei, 6 por controle, 13 sem.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `comissao` (
  `slug`             VARCHAR(32)  NOT NULL,
  `nome`             VARCHAR(240) NOT NULL,
  `sigla`            VARCHAR(40)  NULL,
  `obrigatoriedade`  ENUM('lei','controle','institucional','nao_classificada') NOT NULL DEFAULT 'nao_classificada',
  `fundamento_texto` VARCHAR(400) NULL,
  `ato_fundador_id`  BIGINT UNSIGNED NULL,
  `orgao_id`         BIGINT UNSIGNED NULL,
  `escopo`           ENUM('central','local') NOT NULL DEFAULT 'central',
  `ativa_catalogo`   TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`slug`),
  KEY `ix_comissao_obrig` (`obrigatoriedade`),
  CONSTRAINT `fk_com_ato`   FOREIGN KEY (`ato_fundador_id`) REFERENCES `ato`   (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_com_orgao` FOREIGN KEY (`orgao_id`)        REFERENCES `orgao` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 6. COMISSAO_EVENTO — o que aconteceu com o colegiado, ato a ato.
--
-- `mencao` é o piso: o ato cita o corpo sem agir sobre ele. Serve de cobertura
-- documental, NUNCA de evidência de atividade — é a distinção que impede o
-- observatório de confundir "foi citada" com "está funcionando".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `comissao_evento` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `comissao_slug` VARCHAR(32) NOT NULL,
  `ato_id`        BIGINT UNSIGNED NOT NULL,
  `tipo`          ENUM('instituicao','designacao','recomposicao','dispensa','prorrogacao','plano','decisao','relatorio','entrega','alteracao','extincao','mencao') NOT NULL,
  `data_evento`   DATE NULL,
  `resumo`        VARCHAR(500) NULL,
  `confianca`     ENUM('alta','media','baixa') NOT NULL,
  `metodo`        ENUM('regra','ia','curadoria','regra+curadoria','ia+curadoria') NOT NULL,
  `extracao_id`   BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_com_evento` (`comissao_slug`, `ato_id`, `tipo`),
  KEY `ix_com_evento_tempo` (`comissao_slug`, `data_evento`),
  CONSTRAINT `fk_ce_comissao` FOREIGN KEY (`comissao_slug`) REFERENCES `comissao` (`slug`) ON DELETE CASCADE,
  CONSTRAINT `fk_ce_ato`      FOREIGN KEY (`ato_id`)        REFERENCES `ato`      (`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_ce_extracao` FOREIGN KEY (`extracao_id`)   REFERENCES `extracao` (`id`)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 7. COMISSAO_MEMBRO_EVENTO — entrada e saída de membro, sempre com o ato.
--
-- ⚠️ Esta é a tabela mais adiante do que o corpus consegue hoje. Os quatro
-- pré-requisitos estão registrados como pendência no CLAUDE.md: `ato_funcao`
-- vem vazio nos atos de comissão; o papel só existe em prosa anafórica ("sob a
-- presidência do primeiro" depende da ORDEM dos nomes); o `signatario` erra em
-- 10–13%; e 1.462 pessoas estão partidas pelo zero à esquerda do SIAPE.
-- A tabela existe desde já para que o observatório não invente um formato
-- próprio depois — mas povoá-la exige resolver aquilo antes.
--
-- `pessoa_id` é NULL quando o ato não traz SIAPE: só 30–70% trazem, e o
-- extrator só cria `pessoa` quando acha um. `nome_texto` guarda a grafia do
-- ato, que é o que sobra nos outros casos.
--
-- A chave natural inclui `nome_texto` inteiro, sem prefixo: 128 + 8 + 720 + 1 =
-- 857 bytes, a maior chave deste arquivo e ainda assim dentro dos 3072. Usar
-- prefixo aqui só faria dois nomes que divergem tarde colidirem, sem ganho.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `comissao_membro_evento` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `comissao_slug` VARCHAR(32) NOT NULL,
  `ato_id`        BIGINT UNSIGNED NOT NULL,
  `pessoa_id`     BIGINT UNSIGNED NULL,
  `nome_texto`    VARCHAR(180) NOT NULL,
  `papel`         VARCHAR(100) NULL,
  `acao`          ENUM('designar','dispensar','substituir','reconduzir') NOT NULL,
  `inicio`        DATE NULL,
  `fim_previsto`  DATE NULL,
  `confianca`     ENUM('alta','media','baixa') NOT NULL,
  `metodo`        ENUM('regra','ia','curadoria','regra+curadoria','ia+curadoria') NOT NULL,
  `extracao_id`   BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cme` (`comissao_slug`, `ato_id`, `nome_texto`, `acao`),
  KEY `ix_cme_comissao` (`comissao_slug`, `inicio`),
  KEY `ix_cme_pessoa` (`pessoa_id`),
  CONSTRAINT `fk_cme_comissao` FOREIGN KEY (`comissao_slug`) REFERENCES `comissao` (`slug`) ON DELETE CASCADE,
  CONSTRAINT `fk_cme_ato`      FOREIGN KEY (`ato_id`)        REFERENCES `ato`      (`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_cme_pessoa`   FOREIGN KEY (`pessoa_id`)     REFERENCES `pessoa`   (`id`)   ON DELETE SET NULL,
  CONSTRAINT `fk_cme_extracao` FOREIGN KEY (`extracao_id`)   REFERENCES `extracao` (`id`)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 8. OBRIGACAO — a cláusula normativa virada item acompanhável.
--
-- O que a distingue da `prazo` (schema v2): `prazo` é ancorada em DATA — acha
-- uma data e pergunta se há intenção de prazo por perto. A obrigação é ancorada
-- em MODAL ("deverá apresentar"), e a data é opcional. As duas convivem: a data
-- desta tabela é resolvida por `extrair_prazos()`, o mesmo código que alimenta
-- a `prazo`, para não haver dois resultados para a mesma cláusula.
--
-- Note o que a `prazo` recusa de propósito (PZ_EXCLUI em extrair_prazos.php):
-- `designaç|designad|mandato`. É exatamente o território desta tabela — os dois
-- extratores são complementares, não concorrentes.
--
-- `data_base_origem` cumpre o critério de aceite "prazo relativo informa a
-- data-base usada e se ela foi declarada ou inferida":
--   declarada       — a data-limite está escrita no ato
--   assinatura      — contada a partir da assinatura/publicação (base do ato)
--   inferida        — data-base reconstruída de outro sinal
--   fora_da_janela  — a cláusula tem prazo, mas fora de 2015–2035 (ver decisão 4)
--   sem_data        — obrigação sem prazo determinado
--
-- `estado_curado` vence qualquer cálculo automático. A ordem completa de
-- apresentação (curado → cancelamento → cumprimento → parcial → vence em breve
-- → transcorrido sem evidência → sem prazo → requer validação) mora no
-- calculador, não aqui: estado derivado não vira coluna materializada, senão
-- ele congela e passa a mentir no dia seguinte.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `obrigacao` (
  `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid`                  VARCHAR(120) NOT NULL,
  -- NULL é permitido, e isso é uma descoberta do módulo, não uma frouxidão:
  -- a obrigação de um colegiado permanente costuma NÃO nascer de um ato da
  -- UFF. A CPA deve relatório porque a Lei 10.861/2004 instituiu o SINAES; a
  -- CIBio, porque a RN CTNBio 37/2022 manda, até 31 de março. Nenhum ato do
  -- Boletim cria essas obrigações — o Boletim registra, quando muito, o
  -- cumprimento. Nesses casos `trecho_origem` guarda a NORMA.
  `ato_origem_id`        BIGINT UNSIGNED NULL,
  `politica_id`          BIGINT UNSIGNED NULL,
  `comissao_slug`        VARCHAR(32) NULL,
  `tipo`                 ENUM('entrega','publicacao','constituicao','recomposicao','revisao','regulamentacao','plano','relatorio','designacao','implementacao','outro') NOT NULL,
  `descricao`            VARCHAR(700) NOT NULL,
  `orgao_responsavel_id` BIGINT UNSIGNED NULL,
  `responsavel_texto`    VARCHAR(220) NULL,
  `data_inicio`          DATE NULL,
  `data_limite`          DATE NULL,
  `data_base_origem`     ENUM('declarada','assinatura','inferida','fora_da_janela','sem_data') NOT NULL DEFAULT 'sem_data',
  `periodicidade_meses`  SMALLINT UNSIGNED NULL,
  `condicao_texto`       VARCHAR(300) NULL,
  `trecho_origem`        VARCHAR(700) NOT NULL,
  `pagina`               VARCHAR(12) NULL,
  `confianca`            ENUM('alta','media','baixa') NOT NULL,
  `metodo`               ENUM('regra','ia','curadoria','regra+curadoria','ia+curadoria') NOT NULL,
  `estado_curado`        ENUM('aberta','cumprida','cumprida_parcial','prorrogada','cancelada','nao_aplicavel') NULL,
  `extracao_id`          BIGINT UNSIGNED NULL,
  `revisado_em`          DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_obrigacao_uid` (`uid`),
  KEY `ix_obrigacao_prazo` (`data_limite`),
  KEY `ix_obrigacao_orgao` (`orgao_responsavel_id`),
  KEY `ix_obrigacao_politica` (`politica_id`),
  KEY `ix_obrigacao_comissao` (`comissao_slug`),
  KEY `ix_obrigacao_ato` (`ato_origem_id`),
  CONSTRAINT `fk_ob_ato`      FOREIGN KEY (`ato_origem_id`)        REFERENCES `ato`      (`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_ob_politica` FOREIGN KEY (`politica_id`)          REFERENCES `politica` (`id`)   ON DELETE SET NULL,
  CONSTRAINT `fk_ob_comissao` FOREIGN KEY (`comissao_slug`)        REFERENCES `comissao` (`slug`) ON DELETE SET NULL,
  CONSTRAINT `fk_ob_orgao`    FOREIGN KEY (`orgao_responsavel_id`) REFERENCES `orgao`    (`id`)   ON DELETE SET NULL,
  CONSTRAINT `fk_ob_extracao` FOREIGN KEY (`extracao_id`)          REFERENCES `extracao` (`id`)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 9. OBRIGACAO_EVIDENCIA — o ato POSTERIOR que age sobre a obrigação.
--
-- `efeito='relaciona'` é o vizinho: o ato fala do mesmo processo/política mas
-- não cumpre nada. Guardar isso é o que permite dizer "não foi localizada
-- evidência de cumprimento" sem afirmar que nada aconteceu.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `obrigacao_evidencia` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `obrigacao_id`     BIGINT UNSIGNED NOT NULL,
  `ato_evidencia_id` BIGINT UNSIGNED NOT NULL,
  `efeito`           ENUM('cumpre','cumpre_parcial','prorroga','cancela','contradiz','relaciona') NOT NULL,
  `justificativa`    VARCHAR(500) NULL,
  `confianca`        ENUM('alta','media','baixa') NOT NULL,
  `metodo`           ENUM('regra','ia','curadoria','regra+curadoria','ia+curadoria') NOT NULL,
  `extracao_id`      BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ob_evidencia` (`obrigacao_id`, `ato_evidencia_id`, `efeito`),
  KEY `ix_obe_ato` (`ato_evidencia_id`),
  CONSTRAINT `fk_obe_obrigacao` FOREIGN KEY (`obrigacao_id`)     REFERENCES `obrigacao` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_obe_ato`       FOREIGN KEY (`ato_evidencia_id`) REFERENCES `ato`       (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_obe_extracao`  FOREIGN KEY (`extracao_id`)      REFERENCES `extracao`  (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 10. EVIDENCIA_FATO — a proveniência transversal dos cinco módulos.
--
-- Existe para que cada módulo NÃO invente a sua própria proveniência. Toda
-- afirmação analítica publicada precisa de pelo menos uma linha aqui: ato,
-- trecho, página, método, confiança, versão da regra e se passou por humano.
--
-- A referência é POLIMÓRFICA de propósito (`entidade_tipo` + `entidade_id`) e
-- portanto SEM FK — cinco FKs opcionais mutuamente exclusivas seriam piores. O
-- preço é que órfão não é barrado pelo banco: `verificar_inteligencia.sql` tem
-- a consulta que os encontra, e ela precisa rodar depois de todo backfill.
--
-- A chave natural inclui `fato_tipo` para o mesmo ato poder sustentar dois
-- fatos diferentes da mesma entidade (a data e o responsável, por exemplo) sem
-- que a segunda evidência sobrescreva a primeira.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `evidencia_fato` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entidade_tipo` ENUM('politica','politica_evento','obrigacao','obrigacao_evidencia','comissao_evento','comissao_membro_evento','mudanca') NOT NULL,
  `entidade_id`   BIGINT UNSIGNED NOT NULL,
  `ato_id`        BIGINT UNSIGNED NOT NULL,
  `fato_tipo`     VARCHAR(60) NOT NULL,
  `trecho`        VARCHAR(1000) NOT NULL,
  `pagina`        VARCHAR(12) NULL,
  `metodo`        VARCHAR(40) NOT NULL,
  `confianca`     ENUM('alta','media','baixa') NOT NULL,
  `regra_versao`  VARCHAR(80) NULL,
  `extracao_id`   BIGINT UNSIGNED NULL,
  `revisado`      TINYINT(1) NOT NULL DEFAULT 0,
  `revisado_por`  VARCHAR(120) NULL,
  `revisado_em`   DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_evidencia` (`entidade_tipo`, `entidade_id`, `ato_id`, `fato_tipo`),
  KEY `ix_ev_entidade` (`entidade_tipo`, `entidade_id`),
  KEY `ix_ev_ato` (`ato_id`),
  KEY `ix_ev_revisado` (`revisado`),
  CONSTRAINT `fk_ev_ato`      FOREIGN KEY (`ato_id`)      REFERENCES `ato`      (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ev_extracao` FOREIGN KEY (`extracao_id`) REFERENCES `extracao` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 11. POLITICA_INDICADOR — snapshot da maturidade documental.
--
-- Nome público: "maturidade documental da política". Não é avaliação de
-- desempenho, e o nome existe para o leitor não confundir as duas coisas.
--
-- É SNAPSHOT, não estado: guardar cada cálculo com `versao_metodologia`
-- preserva a série histórica e permite reproduzir o que o portal exibia numa
-- data. Mudar peso = versão nova; snapshot antigo não se reescreve.
--
-- `cobertura` NÃO entra no escore — ela limita a confiança da leitura. Abaixo
-- de 60 a interface troca a classe por "evidência insuficiente para
-- classificação segura" e o registro sai do ranking, mantendo o valor técnico
-- visível no detalhe.
--
-- Sem índice extra em (politica_id, calculado_em): a UNIQUE já é exatamente
-- esse índice, e o duplicado só custaria escrita.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `politica_indicador` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `politica_id`        BIGINT UNSIGNED NOT NULL,
  `calculado_em`       DATETIME NOT NULL,
  `versao_metodologia` VARCHAR(30) NOT NULL,
  `instituicao`        TINYINT UNSIGNED NOT NULL,
  `regulamentacao`     TINYINT UNSIGNED NOT NULL,
  `governanca`         TINYINT UNSIGNED NOT NULL,
  `execucao`           TINYINT UNSIGNED NOT NULL,
  `monitoramento`      TINYINT UNSIGNED NOT NULL,
  `revisao`            TINYINT UNSIGNED NOT NULL,
  `continuidade`       TINYINT UNSIGNED NOT NULL,
  -- NULL nos três, e é uma decisão de método, não folga de modelagem.
  --
  -- A nota única foi MEDIDA sobre os dados reais e reprovada: com pontuação
  -- binária, cinco das sete políticas empatam, a assistência estudantil (38
  -- atos) empata com a acessibilidade (8), e o assédio — a única com plano
  -- central — aparece como a menos madura, porque concentra em duas etapas.
  -- Pior: `monitoramento` e `avaliacao` quase não são emitidos pelas regras de
  -- papel, então 25 dos 100 pontos são inalcançáveis e o teto real fica em ~75.
  -- Uma nota cujo máximo ninguém atinge não mede maturidade, mede a taxonomia.
  --
  -- `cobertura` também fica NULL: o projeto manda usá-la para limitar a
  -- classificação, mas não define a fórmula. Qualquer peso que eu arbitrasse
  -- apareceria na tela como fato.
  --
  -- O que o snapshot guarda em `versao_metodologia='etapas-v1'` são CONTAGENS
  -- por etapa, não pontos — e é isso que sustenta a pergunta factual: quando
  -- esta política ganhou monitoramento, há quanto tempo não tem execução.
  `cobertura`          TINYINT UNSIGNED NULL,
  `escore`             TINYINT UNSIGNED NULL,
  `classe`             ENUM('incipiente','formalizada','estruturada','em_execucao','monitorada') NULL,
  `resumo_calculo`     TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pi_snapshot` (`politica_id`, `calculado_em`),
  CONSTRAINT `fk_pi_politica` FOREIGN KEY (`politica_id`) REFERENCES `politica` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 12. MUDANCA_RELEVANTE — o feed "o que mudou para mim?".
--
-- Dois estágios: candidato (`publicado=0`, visível só na curadoria) e publicado.
-- No piloto, todo resumo em linguagem simples é revisado antes de publicar.
--
-- Item DESCARTADO não é apagado: fica com `publicado=0` e o motivo, porque é a
-- única forma de medir falso positivo depois. Apagar candidato é apagar a
-- métrica de qualidade do próprio módulo.
--
-- `relevancia` 0–100 com os redutores da metodologia (ato estritamente
-- individual −30, designação sem efeito amplo −20, republicação/retificação
-- sem mudança material −25). Ato de efeito individual não entra no feed amplo:
-- é regra de privacidade, não de relevância.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `mudanca_relevante` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`           BIGINT UNSIGNED NOT NULL,
  `politica_id`      BIGINT UNSIGNED NULL,
  `tipo`             ENUM('norma_nova','alteracao','revogacao','prazo','beneficio','processo_seletivo','governanca','comissao','jornada','assistencia','outro') NOT NULL,
  `publico`          ENUM('estudantes','docentes','tecnicos','gestores','pesquisadores','fornecedores','comunidade','controle','multiplo') NOT NULL,
  `titulo`           VARCHAR(240) NOT NULL,
  `resumo`           VARCHAR(700) NOT NULL,
  `impacto`          VARCHAR(700) NULL,
  `acao_recomendada` VARCHAR(500) NULL,
  `relevancia`       TINYINT UNSIGNED NOT NULL,
  `confianca`        ENUM('alta','media','baixa') NOT NULL,
  `metodo`           ENUM('regra','ia','curadoria','regra+curadoria','ia+curadoria') NOT NULL,
  `publicado`        TINYINT(1) NOT NULL DEFAULT 0,
  `publicado_em`     DATETIME NULL,
  `motivo_descarte`  VARCHAR(300) NULL,
  `extracao_id`      BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mudanca_ato_tipo_publico` (`ato_id`, `tipo`, `publico`),
  KEY `ix_mudanca_feed` (`publicado`, `relevancia`, `publicado_em`),
  KEY `ix_mudanca_politica` (`politica_id`),
  CONSTRAINT `fk_mr_ato`      FOREIGN KEY (`ato_id`)      REFERENCES `ato`      (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mr_politica` FOREIGN KEY (`politica_id`) REFERENCES `politica` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mr_extracao` FOREIGN KEY (`extracao_id`) REFERENCES `extracao` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
