-- ============================================================================
-- Conserta os atos "AD REFERENDUM" com emissor errado (achado 23/07/2026).
--
-- O título "RESOLUÇÃO AD REFERENDUM CEPEx/UFF Nº 001, DE 20/01/2022" era
-- fatiado com "AD REFERENDUM CEPEx" no lugar do órgão, e a normalização de
-- sigla reduzia isso a "AD" (REFERENDUM cai pelo comprimento; CEPEx cai pelo
-- x minúsculo — a mesma armadilha do CEPEx pela terceira vez). Quando o órgão
-- vinha em caixa alta plena, sobrava "AD/CEPEX", "AD/CAL", "AD/CUV".
--
-- "Ad referendum" é SÉRIE PRÓPRIA (a Resolução CEPEx 010/2021 comum e a ad
-- referendum 010/2021 COEXISTEM — medido: a série comum de 2021 usa 6,7,8...
-- junto da ad referendum 001-066). Por isso vira TIPO novo na dimensão, não
-- só troca de sigla: a chave natural inclui o tipo e separa as séries.
--
-- Rode no phpMyAdmin (banco fanara87_governanca). Percona 5.7-compatível.
-- Idempotente: rodar duas vezes não duplica nem re-estraga nada.
-- ============================================================================

START TRANSACTION;

-- 1) O tipo novo na dimensão (id automático; ordem depois dos 10 existentes).
INSERT INTO tipo_ato (nome, sigla, ordem)
SELECT 'Resolução ad referendum', 'RES-AR', 10
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM tipo_ato WHERE nome = 'Resolução ad referendum');

-- 2) Os 66 com sigla_orig 'AD' — todos são o CEPEx da era do x minúsculo
--    (é justamente por ser "CEPEx" que o token caiu e sobrou só "AD").
UPDATE ato SET
    tipo_id    = (SELECT id FROM tipo_ato WHERE nome = 'Resolução ad referendum'),
    orgao_id   = (SELECT id FROM orgao    WHERE sigla = 'CEPEx' LIMIT 1),
    sigla_orig = 'CEPEx',
    uid        = CONCAT('resad-cepex-', numero_norm, '-', ano)
WHERE sigla_orig = 'AD' AND uid LIKE 'res-ad-%';

-- 3) A 010/2021, cujo título trouxe CEPEX em caixa alta plena.
UPDATE ato SET
    tipo_id    = (SELECT id FROM tipo_ato WHERE nome = 'Resolução ad referendum'),
    orgao_id   = (SELECT id FROM orgao    WHERE sigla = 'CEPEx' LIMIT 1),
    sigla_orig = 'CEPEX',
    uid        = CONCAT('resad-cepex-', numero_norm, '-', ano)
WHERE sigla_orig = 'AD/CEPEX' AND uid LIKE 'res-ad-cepex-%';

-- 4) A do CAL (Colegiado de curso, boletim 95-21). Garante o órgão CAL na
--    dimensão antes de apontar para ele.
INSERT INTO orgao (sigla, tipo)
SELECT 'CAL', 'outro' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM orgao WHERE sigla = 'CAL');

UPDATE ato SET
    tipo_id    = (SELECT id FROM tipo_ato WHERE nome = 'Resolução ad referendum'),
    orgao_id   = (SELECT id FROM orgao    WHERE sigla = 'CAL' LIMIT 1),
    sigla_orig = 'CAL',
    uid        = CONCAT('resad-cal-', numero_norm, '-', ano)
WHERE sigla_orig = 'AD/CAL' AND uid LIKE 'res-ad-cal-%';

-- 5) Idem CUV, se existir alguma (o dump de 14/07 tinha 1 de 2025).
UPDATE ato SET
    tipo_id    = (SELECT id FROM tipo_ato WHERE nome = 'Resolução ad referendum'),
    orgao_id   = (SELECT id FROM orgao    WHERE sigla = 'CUV' LIMIT 1),
    sigla_orig = 'CUV',
    uid        = CONCAT('resad-cuv-', numero_norm, '-', ano)
WHERE sigla_orig = 'AD/CUV' AND uid LIKE 'res-ad-cuv-%';

-- 6) Defensivo: se alguma linha de ato_funcao apontava para os órgãos-lixo
--    AD*, migra para o CEPEx (0 linhas esperadas).
UPDATE ato_funcao SET orgao_id = (SELECT id FROM orgao WHERE sigla = 'CEPEx' LIMIT 1)
WHERE orgao_id IN (SELECT id FROM orgao WHERE sigla IN ('AD','AD/CEPEX','AD/CAL','AD/CUV'));

COMMIT;

-- ============================================================================
-- Conferência (rode depois do COMMIT):
--   a) Deve dar 0:
SELECT COUNT(*) AS restam_ad FROM ato WHERE sigla_orig IN ('AD','AD/CEPEX','AD/CAL','AD/CUV');
--   b) Deve listar ~68 atos do tipo novo, todos CEPEx/CAL:
SELECT t.nome, a.sigla_orig, COUNT(*) AS n
FROM ato a JOIN tipo_ato t ON t.id = a.tipo_id
WHERE t.nome = 'Resolução ad referendum'
GROUP BY t.nome, a.sigla_orig;
--   c) A do print do mantenedor deve responder pelo uid novo:
SELECT uid, numero, ano, sigla_orig FROM ato WHERE uid = 'resad-cepex-1-2022';
-- Os órgãos 'AD*' somem do filtro sozinhos (o dropdown só lista órgão com ato).
-- O cache da API expira em <=10 min (TTL); não precisa de passo extra.
-- ============================================================================
