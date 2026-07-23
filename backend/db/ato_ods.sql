-- ============================================================================
-- ato_ods — liga um ato a uma ODS (Objetivo de Desenvolvimento Sustentável).
--
-- Racional completo em docs/METODOLOGIA-ODS.md. Resumo: dossiê de evidência
-- por ODS, não "17 baldes" — cada linha carrega o TIPO do vínculo:
--   proposta  = ato fundador de política/programa/plano (a evidência que
--               rankings e controle pedem — THE "policy & initiative metrics")
--   execucao  = staffing/operação de política já existente (contexto)
--   pesquisa  = ato que cria/viabiliza pesquisa ODS-relevante
--   ensino    = oferta acadêmica sobre tema-ODS (curso/currículo; métrica
--               educacional do THE — nunca conta como política institucional)
--
-- `meta` ancora a ligação numa meta nomeável (THE Impact Rankings / IPEA
-- ODS-Brasil) — regra de ouro: sem meta nomeável, não grava.
-- `metodo` distingue o rótulo da IA da curadoria humana; a curadoria pode
-- corrigir qualquer linha (o backfill com upsert preserva metodo='curadoria').
--
-- Rodar no phpMyAdmin ANTES do backfill_ato_ods.php.
-- ============================================================================
CREATE TABLE IF NOT EXISTS `ato_ods` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`        BIGINT UNSIGNED NOT NULL,
  `ods`           TINYINT UNSIGNED NOT NULL,           -- 1..17
  `vinculo`       ENUM('proposta','execucao','pesquisa','ensino') NOT NULL,
  `confianca`     ENUM('alta','media','baixa') NOT NULL,
  `meta`          VARCHAR(40) NULL,                    -- ex.: 'THE 10.6.11 / IPEA 5.2'
  `justificativa` VARCHAR(400) NULL,                   -- 1 frase, auditável
  `metodo`        ENUM('ia','curadoria','ia+curadoria') NOT NULL DEFAULT 'ia',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ato_ods` (`ato_id`, `ods`),
  KEY `ix_ods` (`ods`, `vinculo`),
  KEY `ix_vinculo` (`vinculo`),
  CONSTRAINT `fk_atoods_ato` FOREIGN KEY (`ato_id`) REFERENCES `ato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
