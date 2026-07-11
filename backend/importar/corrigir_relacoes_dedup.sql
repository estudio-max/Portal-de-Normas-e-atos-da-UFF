-- ---------------------------------------------------------------------------
-- Dedup de ato_relacoes: remove relacoes de SAIDA duplicadas.
-- ---------------------------------------------------------------------------
-- Corrige as duplicatas geradas pela 1a versao do backfill
-- (corrigir_relacoes_producao.sql). O filtro daquela versao usava refCount,
-- que na API conta referencias de ENTRADA (quantos atos apontam PARA este) e
-- NAO as relacoes de saida; por isso reinseriu relacoes em atos que ja as
-- tinham -> linhas duplicadas (mesmo ato_id + tipo_relacao + ato_destino_texto).
--
-- Dados legitimos nao tem duplicata exata de saida (o extrator ja deduplica
-- por ato via 'vistos'), entao este DELETE so remove as colisoes do backfill.
-- Mantem a linha de MENOR id (a pre-existente, com detalhes = ementa completa).
-- Idempotente: rodar de novo nao remove mais nada.

DELETE r1 FROM `ato_relacoes` r1
JOIN `ato_relacoes` r2
  ON  r1.`ato_id`            = r2.`ato_id`
  AND r1.`tipo_relacao`      = r2.`tipo_relacao`
  AND r1.`ato_destino_texto` = r2.`ato_destino_texto`
  AND r1.`id` > r2.`id`;

-- Depois rode resolver_relacoes.php para recalcular vigencia de forma limpa.
