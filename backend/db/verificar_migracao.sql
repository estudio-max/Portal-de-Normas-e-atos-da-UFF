-- ============================================================================
--  Verificação pós-importação do banco (schema v2) num servidor NOVO.
--  Rode DEPOIS de importar o dump, no phpMyAdmin (com o banco selecionado) ou
--  no cliente MySQL. Cada bloco tem o resultado ESPERADO ao lado — se bater,
--  o banco está pronto pra API. É o ensaio que pega problema de FULLTEXT e de
--  collation ANTES de virar o DNS. Ver docs/MIGRACAO-UFF.md.
--
--  Rode ANTES no banco atual (produção) pra anotar os números de referência,
--  e DEPOIS no banco novo pra comparar. Os totais têm que ser IGUAIS.
-- ============================================================================

-- 1) CONTAGEM POR TABELA -----------------------------------------------------
--    Anote os números do banco ATUAL e compare com o NOVO: têm que bater.
SELECT 'ato'         AS tabela, COUNT(*) AS linhas FROM ato
UNION ALL SELECT 'ato_texto',  COUNT(*) FROM ato_texto
UNION ALL SELECT 'relacao',    COUNT(*) FROM relacao
UNION ALL SELECT 'orgao',      COUNT(*) FROM orgao
UNION ALL SELECT 'orgao_alias',COUNT(*) FROM orgao_alias
UNION ALL SELECT 'pessoa',     COUNT(*) FROM pessoa
UNION ALL SELECT 'boletim',    COUNT(*) FROM boletim
UNION ALL SELECT 'ato_pessoa', COUNT(*) FROM ato_pessoa
UNION ALL SELECT 'ato_funcao', COUNT(*) FROM ato_funcao
UNION ALL SELECT 'prazo',      COUNT(*) FROM prazo;

-- 2) CHARSET / COLLATION -----------------------------------------------------
--    ESPERADO: ZERO linhas. Qualquer linha aqui = coluna de texto que NÃO ficou
--    utf8mb4 (acento vai quebrar, "ção" vira "Ã§Ã£o"). Reimporte forçando utf8mb4.
SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND DATA_TYPE IN ('char','varchar','text','tinytext','mediumtext','longtext')
   AND (CHARACTER_SET_NAME IS NULL OR CHARACTER_SET_NAME <> 'utf8mb4')
 ORDER BY TABLE_NAME, COLUMN_NAME;

-- 3) MOTOR DAS TABELAS -------------------------------------------------------
--    ESPERADO: todas InnoDB. FULLTEXT do v2 é InnoDB; se vier MyISAM/outro, as
--    settings de token abaixo mudam e a busca se comporta diferente.
SELECT ENGINE, COUNT(*) AS tabelas
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
 GROUP BY ENGINE;

-- 4) ÍNDICES FULLTEXT EXISTEM ------------------------------------------------
--    ESPERADO: 2 linhas — ft_ementa (ato.ementa) e ft_busca (ato_texto.texto_busca).
--    Se faltar, o dump não trouxe o índice: recrie com
--       ALTER TABLE ato       ADD FULLTEXT ft_ementa (ementa);
--       ALTER TABLE ato_texto ADD FULLTEXT ft_busca  (texto_busca);
SELECT DISTINCT TABLE_NAME, INDEX_NAME
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND INDEX_TYPE = 'FULLTEXT'
 ORDER BY TABLE_NAME;

-- 5) FULLTEXT RESPONDE (o teste que mais importa) ----------------------------
--    ESPERADO: ambos > 0 (na base atual, ~60+ e ~120k). Se der 0 num banco que
--    TEM linhas, o índice existe mas está VAZIO — reconstrua com:
--       OPTIMIZE TABLE ato_texto;   (com innodb_optimize_fulltext_only=ON)
--    ou dropando e recriando o índice FULLTEXT.
SELECT
  (SELECT COUNT(*) FROM ato_texto
     WHERE MATCH(texto_busca) AGAINST('+flexibiliza* +jornada' IN BOOLEAN MODE)) AS busca_texto,
  (SELECT COUNT(*) FROM ato
     WHERE MATCH(ementa) AGAINST('portaria' IN BOOLEAN MODE))                    AS busca_ementa;

-- 6) TAMANHO MÍNIMO DE TOKEN DO FULLTEXT -------------------------------------
--    innodb_ft_min_token_size (default 3): palavras com MENOS caracteres não
--    entram no índice. Anote o valor do servidor ATUAL e confira se o NOVO é
--    IGUAL — se a UFF usar um valor maior, siglas curtas somem da busca.
--    (Mudar exige reiniciar o MySQL e reconstruir os índices — peça à TI.)
SHOW VARIABLES LIKE 'innodb_ft_min_token_size';
SHOW VARIABLES LIKE 'ft_min_word_len';          -- equivalente p/ MyISAM

-- 7) ACENTO PRESERVADO -------------------------------------------------------
--    ESPERADO: ementas legíveis com "ção", "á", "ê". Se vier "Ã§Ã£o", a
--    importação corrompeu o charset (bloco 2 já teria acusado).
SELECT numero, ano, LEFT(ementa, 80) AS amostra
  FROM ato
 WHERE ementa LIKE '%ção%'
 LIMIT 5;

-- 8) VERSÕES (registro do ambiente) ------------------------------------------
SELECT VERSION() AS mysql_version, @@character_set_database AS charset_db,
       @@collation_database AS collation_db;
