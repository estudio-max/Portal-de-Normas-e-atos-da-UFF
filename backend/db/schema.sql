-- ============================================================================
--  Portal de Normas e Atos da UFF — esquema do banco (MySQL 5.7+ / MariaDB 10.2+)
--  Recria toda a estrutura. Rode no phpMyAdmin (aba SQL) ou via linha de comando.
--  Charset utf8mb4 (acentos/emoji), InnoDB (FK + FULLTEXT).
-- ============================================================================

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

-- ---------------------------------------------------------------------------
-- Boletins de Serviço (1 linha por edição)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `ato_funcoes`;
DROP TABLE IF EXISTS `ato_tags`;
DROP TABLE IF EXISTS `ato_relacoes`;
DROP TABLE IF EXISTS `ato_siapes`;
DROP TABLE IF EXISTS `ato_corpo`;
DROP TABLE IF EXISTS `atos`;
DROP TABLE IF EXISTS `boletins`;

CREATE TABLE `boletins` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `arquivo`      VARCHAR(64)  NOT NULL,              -- ex.: "56-26.pdf"
  `numero`       VARCHAR(16)  NULL,                  -- ex.: "56"
  `ano`          SMALLINT UNSIGNED NULL,             -- ex.: 2026
  `data_pub`     DATE NULL,                          -- data de publicação
  `url_pdf`      VARCHAR(255) NULL,                  -- PDF oficial na UFF
  `paginas`      SMALLINT UNSIGNED NULL,
  `importado_em` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_arquivo` (`arquivo`),
  KEY `ix_ano` (`ano`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Atos administrativos (1 linha por ato)
--   id estável e determinístico: "{arquivo}-{tipo}-{sigla}-{numero}-{ano}" (slug)
--   → reimportar atualiza a MESMA linha (idempotente).
-- ---------------------------------------------------------------------------
CREATE TABLE `atos` (
  `id`                 VARCHAR(191) NOT NULL,
  `boletim_id`         INT UNSIGNED NULL,
  `tipo`               VARCHAR(60)  NOT NULL,
  `sigla`              VARCHAR(60)  NULL,            -- órgão emissor (ex.: GES/INF)
  `numero`             VARCHAR(32)  NOT NULL,
  `ano`                SMALLINT UNSIGNED NULL,
  `data_ato`           DATE NULL,
  `identificador`      VARCHAR(160) NULL,
  `tipo_acao`          VARCHAR(40)  NULL,            -- Altera/Designa/Revoga...
  `ementa`             TEXT NULL,
  `ementa_inferida`    TINYINT(1) NOT NULL DEFAULT 0,  -- 1 = ementa é resumo automático do dispositivo
  `conteudo_resumido`  TEXT NULL,
  `signatario`         VARCHAR(160) NULL,
  `status`             ENUM('Ativo','Alterado','Revogado') NOT NULL DEFAULT 'Ativo',
  `processo_sei`       VARCHAR(32)  NULL,
  `sei_documento`      VARCHAR(16)  NULL,
  `link_sei_processo`  VARCHAR(255) NULL,
  `link_sei_documento` VARCHAR(255) NULL,
  `link_boletim`       VARCHAR(255) NULL,
  `secao`              VARCHAR(8)   NULL,
  `pagina`             VARCHAR(8)   NULL,
  `criado_em`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                       ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_tipo`    (`tipo`),
  KEY `ix_sigla`   (`sigla`),
  KEY `ix_ano`     (`ano`),
  KEY `ix_status`  (`status`),
  KEY `ix_data`    (`data_ato`),
  KEY `ix_proc`    (`processo_sei`),
  KEY `ix_boletim` (`boletim_id`),
  FULLTEXT KEY `ft_ementa` (`ementa`, `conteudo_resumido`),
  CONSTRAINT `fk_ato_boletim` FOREIGN KEY (`boletim_id`)
    REFERENCES `boletins`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Corpo do ato (texto longo) — separado para listagens leves.
-- FULLTEXT permite busca por NOME do servidor (inclusive em tabelas/listas).
-- ---------------------------------------------------------------------------
CREATE TABLE `ato_corpo` (
  `ato_id` VARCHAR(191) NOT NULL,
  `texto`  MEDIUMTEXT NULL,
  PRIMARY KEY (`ato_id`),
  FULLTEXT KEY `ft_texto` (`texto`),
  CONSTRAINT `fk_corpo_ato` FOREIGN KEY (`ato_id`)
    REFERENCES `atos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Matrículas SIAPE citadas (busca exata por matrícula)
-- ---------------------------------------------------------------------------
CREATE TABLE `ato_siapes` (
  `id`     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id` VARCHAR(191) NOT NULL,
  `siape`  VARCHAR(10)  NOT NULL,
  `nome`   VARCHAR(120) NULL,                  -- nome da pessoa dessa matrícula
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ato_siape` (`ato_id`, `siape`),
  KEY `ix_siape` (`siape`),
  CONSTRAINT `fk_siape_ato` FOREIGN KEY (`ato_id`)
    REFERENCES `atos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Chefias: designações/dispensas de função (Chefe, Coordenador, Diretor...).
-- 1 linha por evento (rastreável ao ato). O "titular atual" por unidade+cargo
-- é projetado na consulta (designação mais recente não substituída).
-- ---------------------------------------------------------------------------
CREATE TABLE `ato_funcoes` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`        VARCHAR(191) NOT NULL,
  `acao`          ENUM('designar','dispensar') NOT NULL,
  `cargo`         VARCHAR(40)  NOT NULL,          -- Chefe, Coordenador, Diretor, Vice-...
  `unidade`       VARCHAR(180) NOT NULL,          -- rótulo para exibição
  `unidade_chave` VARCHAR(180) NOT NULL,          -- chave normalizada (casa a mesma unidade)
  `siape`         VARCHAR(10)  NULL,
  `nome`          VARCHAR(120) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_chave` (`unidade_chave`, `cargo`),
  KEY `ix_ato`   (`ato_id`),
  CONSTRAINT `fk_func_ato` FOREIGN KEY (`ato_id`)
    REFERENCES `atos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Relações entre atos (saída). O "referenciado por" é a consulta inversa
-- (WHERE ato_destino_id = X) — não precisa de tabela separada.
-- ---------------------------------------------------------------------------
CREATE TABLE `ato_relacoes` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`            VARCHAR(191) NOT NULL,         -- ato de origem
  `tipo_relacao`      VARCHAR(20)  NOT NULL,         -- Altera/Revoga/Complementa/Regulamenta
  `ato_destino_texto` VARCHAR(200) NOT NULL,         -- como citado no texto
  `ato_destino_id`    VARCHAR(191) NULL,             -- resolvido p/ ato da base (se houver)
  `externo`           TINYINT(1)   NOT NULL DEFAULT 0, -- cita órgão federal externo (MEC/DOU/SGP…): nunca resolve
  `detalhes`          VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_origem`  (`ato_id`),
  KEY `ix_destino` (`ato_destino_id`),
  KEY `ix_externo` (`externo`),
  CONSTRAINT `fk_rel_ato` FOREIGN KEY (`ato_id`)
    REFERENCES `atos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Marcadores / palavras-chave
-- ---------------------------------------------------------------------------
CREATE TABLE `ato_tags` (
  `id`     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id` VARCHAR(191) NOT NULL,
  `tag`    VARCHAR(60)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_tag` (`tag`),
  KEY `ix_ato` (`ato_id`),
  CONSTRAINT `fk_tag_ato` FOREIGN KEY (`ato_id`)
    REFERENCES `atos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET foreign_key_checks = 1;

-- ============================================================================
-- Fim. Após criar, rode o importador (backend/importar/importar.php) para
-- carregar os dados a partir do JSON publicado no GitHub.
-- ============================================================================
