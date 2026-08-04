-- ============================================================================
--  corrigir_obrigacao_sem_ato.sql — `obrigacao.ato_origem_id` passa a aceitar
--  NULL.
--
--  POR QUE
--  -------
--  Eu escrevi a coluna como NOT NULL assumindo que toda obrigação nasce de um
--  ato do Boletim. A medição do módulo mostrou o contrário, e é o achado
--  central dele: a obrigação de um colegiado permanente costuma NÃO nascer de
--  um ato da UFF.
--
--    - a CPA deve o relatório de autoavaliação porque a Lei 10.861/2004
--      instituiu o SINAES;
--    - a CIBio deve relatório à CTNBio até 31 de março porque a Resolução
--      Normativa CTNBio nº 37/2022, art. 11, manda — sob pena de suspensão do
--      Certificado de Qualidade em Biossegurança;
--    - a CIPA tem mandato de um ano porque a NR-5 fixa.
--
--  Nenhum ato do Boletim cria essas obrigações. O Boletim registra, quando
--  muito, o cumprimento — e às vezes nem isso, porque o relatório vai para o
--  MEC, o CONCEA ou o site da própria comissão.
--
--  Manter NOT NULL obrigaria a inventar um ato de origem falso para cada uma.
--  Preferir o esquema à evidência é como um portal de normas começa a mentir.
--
--  SEGURO: a tabela está VAZIA em produção (bloco 1 do
--  verificar_inteligencia.sql confirma `obrigacao` = 0). Um ALTER aqui não
--  reescreve linha nenhuma.
--
--  No phpMyAdmin: aba Importar (é DDL, não tem saída para exibir).
-- ============================================================================

ALTER TABLE `obrigacao`
  MODIFY COLUMN `ato_origem_id` BIGINT UNSIGNED NULL;

-- Conferir (aba SQL): IS_NULLABLE tem que ler 'YES'.
-- SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
--   FROM information_schema.COLUMNS
--  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obrigacao'
--    AND COLUMN_NAME = 'ato_origem_id';
