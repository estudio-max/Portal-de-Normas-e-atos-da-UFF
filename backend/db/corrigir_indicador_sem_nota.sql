-- ============================================================================
--  corrigir_indicador_sem_nota.sql — `politica_indicador` deixa de exigir nota.
--
--  POR QUE
--  -------
--  Escrevi `escore`, `classe` e `cobertura` como NOT NULL, assumindo que o
--  indicador produziria uma nota de 0 a 100. A simulação sobre os dados reais
--  reprovou o desenho:
--
--    - com pontuação binária, CINCO das sete políticas empatam;
--    - a assistência estudantil (38 atos) tira o mesmo que a acessibilidade
--      (8 atos) — ter UM ato de execução vale igual a ter quinze;
--    - o assédio tira a MENOR nota justamente por ter o padrão mais nítido do
--      acervo (um plano central e nove comissões locais): concentração em duas
--      etapas é lida como imaturidade;
--    - `monitoramento` e `avaliacao` quase não são emitidos pelas regras de
--      papel, então 25 dos 100 pontos são inalcançáveis e o teto real é ~75.
--
--  E `cobertura` não tem fórmula no projeto — só a instrução de usá-la. Peso
--  arbitrado por mim apareceria na tela como fato.
--
--  O snapshot passa a guardar CONTAGEM por etapa, com
--  `versao_metodologia='etapas-v1'`. Isso responde perguntas factuais — quando
--  a política ganhou monitoramento, há quanto tempo não tem execução — sem
--  arbitrar peso nenhum.
--
--  SEGURO: a tabela está VAZIA em produção (bloco 1 do verificar_inteligencia
--  confirma `politica_indicador` = 0). O ALTER não reescreve linha alguma.
--
--  No phpMyAdmin: aba Importar (é DDL, não tem saída para exibir).
-- ============================================================================

ALTER TABLE `politica_indicador`
  MODIFY COLUMN `cobertura` TINYINT UNSIGNED NULL,
  MODIFY COLUMN `escore`    TINYINT UNSIGNED NULL,
  MODIFY COLUMN `classe`    ENUM('incipiente','formalizada','estruturada','em_execucao','monitorada') NULL;

-- Conferir (aba SQL): IS_NULLABLE = 'YES' nas três.
-- SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
--  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'politica_indicador'
--    AND COLUMN_NAME IN ('cobertura','escore','classe');
