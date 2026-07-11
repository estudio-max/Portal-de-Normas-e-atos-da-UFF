-- HOTFIX: corrige tipo_relacao das linhas ja inseridas pela 1a versao (UPPERCASE).
-- Producao usa Title Case (Revoga|Altera|Complementa); os valores crus do extrator
-- nao batiam com resolver_relacoes.php (destino nao ligava, vigencia nao recalculava).
-- Alvo exclusivo: as proprias linhas do backfill (unicas em UPPERCASE no banco).
UPDATE `ato_relacoes` SET `tipo_relacao`='Altera'      WHERE `tipo_relacao` IN ('ALTERA','RETIFICA','REPUBLICA','PRORROGA');
UPDATE `ato_relacoes` SET `tipo_relacao`='Revoga'      WHERE `tipo_relacao` IN ('REVOGA','TORNA SEM EFEITO','ANULA','SUBSTITUI');
UPDATE `ato_relacoes` SET `tipo_relacao`='Complementa' WHERE `tipo_relacao` IN ('CITA');
-- Depois rode resolver_relacoes.php para ligar ato_destino_id e recalcular vigencia.
