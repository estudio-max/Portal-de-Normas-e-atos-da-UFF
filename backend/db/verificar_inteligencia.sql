-- ============================================================================
--  Verificação pós-migração do núcleo de inteligência institucional.
--  Rode no phpMyAdmin (com o banco selecionado) DEPOIS de aplicar
--  `inteligencia_institucional.sql`, e de novo DEPOIS de cada backfill amplo.
--
--  Cada bloco traz o resultado ESPERADO ao lado. Os blocos 1 a 4 conferem a
--  migração; os blocos 5 a 9 são as TRAVAS DE PUBLICAÇÃO — enquanto qualquer
--  um deles devolver linha, nada daquele módulo vai ao ar.
--
--  Percona Server 5.7: sem CTE, sem função de janela, sem REGEXP_REPLACE.
-- ============================================================================

-- 1) AS DOZE TABELAS EXISTEM -------------------------------------------------
--    ESPERADO: 12 linhas, todas InnoDB e utf8mb4.
SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_ROWS
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('politica','politica_alias','ato_politica','politica_evento',
                      'comissao','comissao_evento','comissao_membro_evento',
                      'obrigacao','obrigacao_evidencia','evidencia_fato',
                      'politica_indicador','mudanca_relevante')
 ORDER BY TABLE_NAME;

-- 2) O NÚCLEO v2 NÃO FOI TOCADO ----------------------------------------------
--    A regra do projeto é que análise nova vira tabela-fato, nunca coluna em
--    `ato`. ESPERADO: ZERO linhas. Qualquer linha aqui significa que alguém
--    resolveu "só acrescentar uma coluninha" — pare e reveja.
SELECT TABLE_NAME, COLUMN_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'ato'
   AND (COLUMN_NAME LIKE '%politica%' OR COLUMN_NAME LIKE '%obrigac%'
        OR COLUMN_NAME LIKE '%comissao%' OR COLUMN_NAME LIKE '%mudanca%'
        OR COLUMN_NAME LIKE '%indicador%' OR COLUMN_NAME LIKE '%evidencia%');

-- 3) TODA TABELA TEM CHAVE NATURAL -------------------------------------------
--    Sem UNIQUE de chave natural, reprocessar um ato duplica o fato.
--    ESPERADO: 1 linha, só `comissao` — nela a chave natural É a PK (o slug).
--    Qualquer outra tabela nesta lista é defeito de idempotência.
SELECT t.TABLE_NAME
  FROM information_schema.TABLES t
  LEFT JOIN information_schema.STATISTICS s
         ON s.TABLE_SCHEMA = t.TABLE_SCHEMA
        AND s.TABLE_NAME   = t.TABLE_NAME
        AND s.NON_UNIQUE   = 0
        AND s.INDEX_NAME  <> 'PRIMARY'
 WHERE t.TABLE_SCHEMA = DATABASE()
   AND t.TABLE_NAME IN ('politica','politica_alias','ato_politica','politica_evento',
                        'comissao','comissao_evento','comissao_membro_evento',
                        'obrigacao','obrigacao_evidencia','evidencia_fato',
                        'politica_indicador','mudanca_relevante')
   AND s.INDEX_NAME IS NULL
 GROUP BY t.TABLE_NAME;

-- 4) AS CHAVES ESTRANGEIRAS ENTRARAM -----------------------------------------
--    ESPERADO: 33 no total, com esta distribuição —
--      ato_politica 3 · comissao 2 · comissao_evento 3 · comissao_membro_evento 4
--      evidencia_fato 2 · mudanca_relevante 3 · obrigacao 5 · obrigacao_evidencia 3
--      politica 2 · politica_alias 1 · politica_evento 4 · politica_indicador 1
--    FK a menos costuma ser divergência de charset entre a coluna e a
--    referenciada (`comissao_slug` precisa ser utf8mb4_unicode_ci, como o slug).
SELECT TABLE_NAME, COUNT(*) AS fks
  FROM information_schema.TABLE_CONSTRAINTS
 WHERE TABLE_SCHEMA = DATABASE()
   AND CONSTRAINT_TYPE = 'FOREIGN KEY'
   AND TABLE_NAME IN ('politica','politica_alias','ato_politica','politica_evento',
                      'comissao','comissao_evento','comissao_membro_evento',
                      'obrigacao','obrigacao_evidencia','evidencia_fato',
                      'politica_indicador','mudanca_relevante')
 GROUP BY TABLE_NAME WITH ROLLUP;

-- 5) EVIDÊNCIA ÓRFÃ (o preço da referência polimórfica) ----------------------
--    `evidencia_fato.entidade_id` não tem FK — o banco não barra órfão, então a
--    integridade se confere aqui. ESPERADO: ZERO em todas as sete linhas.
--    Órfão aparece quando um backfill apaga a entidade e deixa a evidência.
SELECT 'politica' AS entidade, COUNT(*) AS orfaos
  FROM evidencia_fato e LEFT JOIN politica x ON x.id = e.entidade_id
 WHERE e.entidade_tipo = 'politica' AND x.id IS NULL
UNION ALL
SELECT 'politica_evento', COUNT(*)
  FROM evidencia_fato e LEFT JOIN politica_evento x ON x.id = e.entidade_id
 WHERE e.entidade_tipo = 'politica_evento' AND x.id IS NULL
UNION ALL
SELECT 'obrigacao', COUNT(*)
  FROM evidencia_fato e LEFT JOIN obrigacao x ON x.id = e.entidade_id
 WHERE e.entidade_tipo = 'obrigacao' AND x.id IS NULL
UNION ALL
SELECT 'obrigacao_evidencia', COUNT(*)
  FROM evidencia_fato e LEFT JOIN obrigacao_evidencia x ON x.id = e.entidade_id
 WHERE e.entidade_tipo = 'obrigacao_evidencia' AND x.id IS NULL
UNION ALL
SELECT 'comissao_evento', COUNT(*)
  FROM evidencia_fato e LEFT JOIN comissao_evento x ON x.id = e.entidade_id
 WHERE e.entidade_tipo = 'comissao_evento' AND x.id IS NULL
UNION ALL
SELECT 'comissao_membro_evento', COUNT(*)
  FROM evidencia_fato e LEFT JOIN comissao_membro_evento x ON x.id = e.entidade_id
 WHERE e.entidade_tipo = 'comissao_membro_evento' AND x.id IS NULL
UNION ALL
SELECT 'mudanca', COUNT(*)
  FROM evidencia_fato e LEFT JOIN mudanca_relevante x ON x.id = e.entidade_id
 WHERE e.entidade_tipo = 'mudanca' AND x.id IS NULL;

-- 6) TRAVA: NADA PÚBLICO SEM FONTE E TRECHO ----------------------------------
--    "100% dos itens públicos possuem fonte e trecho" é critério de aceite do
--    monitor, e a mesma regra vale para o radar. ESPERADO: ZERO nas três.
SELECT 'obrigacao sem trecho' AS trava, COUNT(*) AS itens
  FROM obrigacao WHERE trecho_origem IS NULL OR TRIM(trecho_origem) = ''
UNION ALL
SELECT 'mudanca publicada sem evidencia', COUNT(*)
  FROM mudanca_relevante m
  LEFT JOIN evidencia_fato e ON e.entidade_tipo = 'mudanca' AND e.entidade_id = m.id
 WHERE m.publicado = 1 AND e.id IS NULL
UNION ALL
SELECT 'politica publicada incompleta', COUNT(*)
  FROM politica
 WHERE status_curadoria = 'publicada'
   AND (nome IS NULL OR TRIM(nome) = '' OR slug IS NULL OR TRIM(slug) = ''
        OR descricao IS NULL OR TRIM(descricao) = '');

-- 7) TRAVA: CONFIANÇA BAIXA NÃO VAI AO FEED ----------------------------------
--    Publicação sugerida = relevância >= 60 E confiança alta; 40–59 vai à
--    curadoria. ESPERADO: ZERO linhas.
SELECT id, ato_id, tipo, publico, relevancia, confianca
  FROM mudanca_relevante
 WHERE publicado = 1 AND (confianca = 'baixa' OR relevancia < 40)
 ORDER BY relevancia
 LIMIT 50;

-- 8) TRAVA: INDICADOR DENTRO DE 0–100 E COERENTE -----------------------------
--    ESPERADO: ZERO linhas. `escore` fora da faixa, ou classe que não bate com
--    a faixa do escore, significa calculador desalinhado da metodologia.
SELECT id, politica_id, versao_metodologia, escore, cobertura, classe
  FROM politica_indicador
 WHERE escore > 100 OR cobertura > 100
    OR (escore <= 24 AND classe <> 'incipiente')
    OR (escore BETWEEN 25 AND 44 AND classe <> 'formalizada')
    OR (escore BETWEEN 45 AND 64 AND classe <> 'estruturada')
    OR (escore BETWEEN 65 AND 84 AND classe <> 'em_execucao')
    OR (escore >= 85 AND classe <> 'monitorada')
 LIMIT 50;

-- 9) TRAVA: PRAZO DECLARADO SEM DATA, E VICE-VERSA ---------------------------
--    `data_base_origem` explica de onde veio a data-limite. As duas colunas não
--    podem se contradizer, senão a interface exibe semáforo sem base.
--    ESPERADO: ZERO linhas.
SELECT id, uid, data_limite, data_base_origem
  FROM obrigacao
 WHERE (data_limite IS NOT NULL AND data_base_origem IN ('sem_data','fora_da_janela'))
    OR (data_limite IS NULL     AND data_base_origem NOT IN ('sem_data','fora_da_janela'))
 LIMIT 50;

-- 10) O REGISTRO DE COMISSÕES NÃO DIVERGIU -----------------------------------
--     `comissao` é a terceira projeção do registro curado (as outras duas são
--     comissoes_registro() e comissoes_termos(), ambas geradas por
--     tools/registro_comissoes.py). Os slugs têm que ser os MESMOS que a
--     `ato_comissao` já usa.
--     ESPERADO depois do seed: 26 no catálogo e ZERO slugs órfãos.
--     ANTES do seed (logo após a migração): 0 no catálogo e 26 slugs órfãos —
--     é o estado normal, e é exatamente o que o seed do PR 2 vai zerar.
SELECT (SELECT COUNT(*) FROM comissao)                       AS corpos_no_catalogo,
       (SELECT COUNT(DISTINCT ac.comissao)
          FROM ato_comissao ac
          LEFT JOIN comissao c ON c.slug = ac.comissao
         WHERE c.slug IS NULL)                               AS slugs_sem_catalogo,
       (SELECT COUNT(*)
          FROM comissao c
          LEFT JOIN ato_comissao ac ON ac.comissao = c.slug
         WHERE ac.id IS NULL)                                AS corpos_sem_ato;

-- 11) CONTAGEM POR TABELA (linha de base do backfill) ------------------------
--     Anote ANTES e DEPOIS de cada backfill amplo: é o relatório de diff que a
--     regra de publicação exige. Queda grande sem justificativa barra o deploy.
SELECT 'politica'               AS tabela, COUNT(*) AS linhas FROM politica
UNION ALL SELECT 'politica_alias',         COUNT(*) FROM politica_alias
UNION ALL SELECT 'ato_politica',           COUNT(*) FROM ato_politica
UNION ALL SELECT 'politica_evento',        COUNT(*) FROM politica_evento
UNION ALL SELECT 'comissao',               COUNT(*) FROM comissao
UNION ALL SELECT 'comissao_evento',        COUNT(*) FROM comissao_evento
UNION ALL SELECT 'comissao_membro_evento', COUNT(*) FROM comissao_membro_evento
UNION ALL SELECT 'obrigacao',              COUNT(*) FROM obrigacao
UNION ALL SELECT 'obrigacao_evidencia',    COUNT(*) FROM obrigacao_evidencia
UNION ALL SELECT 'evidencia_fato',         COUNT(*) FROM evidencia_fato
UNION ALL SELECT 'politica_indicador',     COUNT(*) FROM politica_indicador
UNION ALL SELECT 'mudanca_relevante',      COUNT(*) FROM mudanca_relevante;

-- 12) CURADORIA PRESERVADA ---------------------------------------------------
--     A passada automática só pode apagar o que ela mesma escreveu. Rode ANTES
--     e DEPOIS de um reprocessamento: os números NÃO podem cair.
--     (Mesmo desenho da `ato_ods`, onde o import faz
--      DELETE ... WHERE metodo <> 'curadoria'.)
SELECT 'ato_politica curado'   AS tabela, COUNT(*) AS linhas
  FROM ato_politica    WHERE metodo IN ('curadoria','regra+curadoria','ia+curadoria')
UNION ALL SELECT 'politica_evento curado', COUNT(*)
  FROM politica_evento WHERE metodo IN ('curadoria','regra+curadoria','ia+curadoria')
UNION ALL SELECT 'obrigacao curada', COUNT(*)
  FROM obrigacao       WHERE metodo IN ('curadoria','regra+curadoria','ia+curadoria')
                          OR estado_curado IS NOT NULL
UNION ALL SELECT 'comissao_evento curado', COUNT(*)
  FROM comissao_evento WHERE metodo IN ('curadoria','regra+curadoria','ia+curadoria')
UNION ALL SELECT 'evidencia revisada', COUNT(*)
  FROM evidencia_fato  WHERE revisado = 1;
