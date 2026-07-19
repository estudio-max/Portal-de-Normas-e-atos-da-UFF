-- ============================================================================
--  Apaga 5 FANTASMAS DE CITAÇÃO na base v2 (`fanara87_governanca`).
--  Rodar no phpMyAdmin. Complementa `corrigir_anos_impossiveis.sql` (que tratou
--  a duplicata 02/1014 e o fantasma do anexo SIORG 41/1771).
--
--  O QUE SÃO: atos que o extrator inventou a partir de uma MENÇÃO a uma norma
--  antiga ou a uma referência bibliográfica dentro de um ato RECENTE. O sinal
--  claro é ano-do-ato << ano-do-boletim: um "ato de 1996/1998/1999" que só
--  aparece num boletim de 2012-2022 não é ato de época — é citação virada em ato.
--
--  Auditoria dos 108 atos com ano < 2001 (medido na produção, 18/07):
--    • 100 são REAIS, do boletim de 2001 (o único OCR'd) — backlog/erro de ano
--      do OCR, mas atos de verdade (bancas, designações). MANTIDOS.
--    •   3 são REAIS com ano provavelmente errado (Depto de Química Orgânica em
--        boletim de 2007; ratificação em boletim de 2006). NÃO apagados — o ano
--        deles é caso à parte (ver observação no fim).
--    •   5 são estes fantasmas de citação. APAGADOS abaixo.
--
--  in-sedap-205-1988 é citada por 1 ato real: o ON DELETE SET NULL da `relacao`
--  preserva o TEXTO da citação e só tira o link para o fantasma — comportamento
--  desejado (não deve haver ato UFF para uma norma federal). Os outros 4 não têm
--  referência. O CASCADE limpa ato_texto/etc.
-- ============================================================================

-- (1) PREVIEW — confira as 5 linhas antes de apagar:
SELECT uid, numero, ano, LEFT(ementa, 60) AS ementa
  FROM ato
 WHERE uid IN (
   'port-reitoria-2203-1996',   -- ref. ABNT: "BRASIL. Ministério da Saúde. Lei 8142…" (boletim 2012)
   'port-reitoria-280-1999',    -- ref. ABNT: "SARTI, Cynthia. 'Famílias enredadas'…"  (boletim 2012)
   'in-sedap-205-1988',         -- citação da IN SEDAP nº 205/1988 (federal)            (boletim 2013)
   'port-reitoria-29-1998',     -- Portaria SVS/MS 29/98 (norma federal de alimentos)   (boletim 2021)
   'port-reitoria-29-1998-2'    -- idem, outra citação                                  (boletim 2022)
 );

-- (2) APAGAR os 5 (CASCADE nos filhos; SET NULL nas relações que os citam):
DELETE FROM ato WHERE uid IN (
  'port-reitoria-2203-1996',
  'port-reitoria-280-1999',
  'in-sedap-205-1988',
  'port-reitoria-29-1998',
  'port-reitoria-29-1998-2'
);

-- (3) VERIFICAÇÃO — tem que voltar VAZIA:
SELECT uid FROM ato WHERE uid IN (
  'port-reitoria-2203-1996', 'port-reitoria-280-1999', 'in-sedap-205-1988',
  'port-reitoria-29-1998', 'port-reitoria-29-1998-2'
);

-- ============================================================================
--  OBSERVAÇÃO — 3 atos REAIS com ano errado (NÃO apagados; decida à parte):
--    ns-uff-504-2000  — boletim 106-2006 (Norma de Serviço, ratificação)
--    dts-gqo-3-2000   — boletim 144-2007 (Designação de coordenadores, Qca Orgânica)
--    dts-gqo-4-2000   — boletim 144-2007 (idem, Programa de Monitoria)
--  São atos de verdade; o ano 2000 é quase certo erro de leitura (o boletim é de
--  2006/2007). Corrigir o ano exige UPDATE e checar colisão de uid — fica p/ uma
--  rodada de correção de ano, não de exclusão.
-- ============================================================================
