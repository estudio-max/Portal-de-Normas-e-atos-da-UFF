-- ============================================================================
-- Migra ato_revalidacao para aceitar várias decisões por ato.
--
-- Compatível com Percona Server 5.7: consulta information_schema e executa
-- ALTER TABLE por PREPARE, pois a versão não oferece formas condicionais de
-- ADD COLUMN ou DROP INDEX. Pode ser reaplicada sem alterar o resultado.
-- ============================================================================

-- ⚠️ O NOME DO BANCO É CAPTURADO AQUI, ANTES DE QUALQUER information_schema.
-- Referência a `information_schema` troca o banco corrente para as consultas
-- SEGUINTES do mesmo arquivo (medido no phpMyAdmin em 03/08/2026, e de novo em
-- 17/08/2026 com esta migração: a conferência final estourou
-- "#1109 Tabela 'ato_revalidacao' desconhecida em 'information_schema'").
-- A consulta às tabelas do PROJETO no fim do arquivo se qualifica com @db por
-- causa disso — sem depender de qual banco o cliente acha que é o corrente.
SET @db := DATABASE();

-- Linhas antigas recebem automaticamente o DEFAULT 1 quando a coluna nasce.
SET @tem_ordem := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ato_revalidacao'
    AND COLUMN_NAME = 'ordem'
);
SET @sql := IF(
  @tem_ordem = 0,
  CONCAT('ALTER TABLE `', @db, '`.`ato_revalidacao` ',
         'ADD COLUMN `ordem` SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER `ato_id`'),
  'SELECT ''ordem já existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Troca a UNIQUE antiga de ato_id pela chave natural composta, quando preciso.
SET @uq_cols := (
  SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ato_revalidacao'
    AND INDEX_NAME = 'uq_ato_revalidacao'
);
SET @uq_nao_unico := (
  SELECT MAX(NON_UNIQUE)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ato_revalidacao'
    AND INDEX_NAME = 'uq_ato_revalidacao'
);
SET @sql := CASE
  WHEN @uq_cols = 'ato_id,ordem' AND @uq_nao_unico = 0 THEN 'SELECT ''chave já migrada'' AS info'
  WHEN @uq_cols IS NULL THEN CONCAT('ALTER TABLE `', @db, '`.`ato_revalidacao` ',
    'ADD UNIQUE KEY `uq_ato_revalidacao` (`ato_id`,`ordem`)')
  ELSE CONCAT('ALTER TABLE `', @db, '`.`ato_revalidacao` ',
    'DROP INDEX `uq_ato_revalidacao`, ADD UNIQUE KEY `uq_ato_revalidacao` (`ato_id`,`ordem`)')
END;
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificação final: coluna, definição do índice e eventual chave duplicada.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'ato_revalidacao'
  AND COLUMN_NAME = 'ordem';

SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME, NON_UNIQUE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'ato_revalidacao'
  AND INDEX_NAME = 'uq_ato_revalidacao'
ORDER BY SEQ_IN_INDEX;

-- Chave duplicada. Qualificada com @db pelo motivo explicado no topo: as duas
-- conferências acima leem o information_schema, e a partir delas o banco
-- corrente deixa de ser o do projeto. Sem a qualificação, esta consulta procura
-- `ato_revalidacao` dentro do information_schema e devolve #1109 — erro que
-- parece tabela ausente e é só endereço errado.
SET @sql := CONCAT(
  'SELECT ato_id, ordem, COUNT(*) AS total FROM `', @db, '`.`ato_revalidacao` ',
  'GROUP BY ato_id, ordem HAVING COUNT(*) > 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
