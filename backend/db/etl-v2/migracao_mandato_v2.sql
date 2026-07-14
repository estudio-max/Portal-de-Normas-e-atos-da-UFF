-- ---------------------------------------------------------------------------
-- Migração: colunas de MANDATO em ato_funcao (base v2 `fanara87_governanca`)
--
-- Rodar no phpMyAdmin ANTES de sincronizar o portal-data.json novo pelo
-- importar_v2.php. Idempotente: pode rodar duas vezes sem erro.
--
-- Por que estas colunas existem
-- -----------------------------
-- A designação de chefia é AUTOLIMITADA — ela traz a própria validade ("com
-- mandato de 04 (quatro) anos"). Medido no corpus (5.555 designações,
-- 2001-2026): 83% das dispensas saem mais de 90 dias ANTES do fim do prazo,
-- ou seja, a dispensa é o ato de encerrar ANTECIPADAMENTE. Quem cumpre o
-- mandato inteiro não gera ato nenhum. É por isso que o Boletim não publica
-- revogação ao fim do mandato: ela seria redundante.
--
-- Consequência: o fim do mandato NÃO existe como ato. Só existe se for
-- calculado — e sem estas colunas não há como o gabinete ver que um setor
-- está sem chefia formalmente constituída.
--
-- unidade_chave
-- -------------
-- O v2 vinha agrupando chefia pelo TEXTO CRU da unidade. Com o drift de
-- grafia entre boletins, a mesma unidade escrita de dois jeitos vira duas
-- posições — e a antiga fica para trás como titular fantasma de mandato
-- vencido, poluindo justamente o painel de mandatos. O extrator já calcula a
-- chave normalizada (chave_unidade) e o portal-data.json já a traz; só o
-- importador a descartava.
--
-- `ADD COLUMN IF NOT EXISTS` é do MariaDB e quebra no MySQL, então o teste vai
-- no information_schema (mesmo idioma do resto do projeto).
-- ---------------------------------------------------------------------------

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'ato_funcao' AND COLUMN_NAME = 'unidade_chave');
SET @ddl := IF(@c = 0,
  'ALTER TABLE `ato_funcao`
     ADD COLUMN `unidade_chave` VARCHAR(180) NOT NULL DEFAULT '''' AFTER `unidade`,
     ADD KEY `ix_chave` (`unidade_chave`, `cargo`)',
  'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'ato_funcao' AND COLUMN_NAME = 'prazo_meses');
SET @ddl := IF(@c = 0,
  'ALTER TABLE `ato_funcao`
     ADD COLUMN `prazo_meses` SMALLINT UNSIGNED NULL AFTER `pessoa_id`,
     ADD COLUMN `data_inicio` DATE NULL AFTER `prazo_meses`,
     ADD COLUMN `inicio_origem` ENUM(''declarado'',''tampao'',''data_ato'') NULL AFTER `data_inicio`,
     ADD KEY `ix_mandato` (`acao`, `data_inicio`)',
  'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- Conferência (deve listar as 4 colunas novas):
-- SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
--  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ato_funcao'
--    AND COLUMN_NAME IN ('unidade_chave','prazo_meses','data_inicio','inicio_origem');
