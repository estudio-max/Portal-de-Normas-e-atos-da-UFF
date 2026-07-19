-- ============================================================================
--  Corrige o ANO de 2 atos REAIS mal lidos pelo OCR (base v2 `fanara87_governanca`).
--  Rodar no phpMyAdmin. NÃO são fantasmas — são Determinações de Serviço de
--  verdade do Departamento de Química Orgânica (GQO), publicadas no boletim 144
--  de 05/09/2007. Conferido no PDF de origem: o boletim imprime
--    "DETERMINAÇÃO DE SERVIÇO GQO Nº 003 ... de 23 de agosto de 20007"
--  "20007" é OCR de 2007, e o extrator pegou os 4 primeiros dígitos (→ 2000).
--
--  Corrige ano 2000 → 2007, a data (23/08/2007) e o uid (…-2000 → …-2007;
--  ambos os uids novos foram checados na produção e estão livres, sem colisão).
--  data_ato NÃO fica NULL — vira a data real.
--
--  Nota: o mesmo padrão "ano de 5 dígitos → 4 primeiros" pode existir em outros
--  atos; é um dos itens que a re-extração da Fase B precisa cobrir (ver CLAUDE.md).
-- ============================================================================

-- (1) PREVIEW — os 2 atos, hoje com ano 2000:
SELECT uid, numero, ano, data_ato, LEFT(ementa, 55) AS ementa
  FROM ato WHERE uid IN ('dts-gqo-3-2000', 'dts-gqo-4-2000');

-- (2) CORRIGIR ano, data e uid:
UPDATE ato SET ano = 2007, data_ato = '2007-08-23', uid = 'dts-gqo-3-2007'
 WHERE uid = 'dts-gqo-3-2000';
UPDATE ato SET ano = 2007, data_ato = '2007-08-23', uid = 'dts-gqo-4-2007'
 WHERE uid = 'dts-gqo-4-2000';

-- (3) VERIFICAÇÃO — 2 linhas, agora com ano 2007 e data 2007-08-23:
SELECT uid, numero, ano, data_ato FROM ato WHERE uid IN ('dts-gqo-3-2007', 'dts-gqo-4-2007');
-- E os uids antigos têm que sumir (VAZIO):
SELECT uid FROM ato WHERE uid IN ('dts-gqo-3-2000', 'dts-gqo-4-2000');
