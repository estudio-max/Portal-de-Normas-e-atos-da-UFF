-- ============================================================================
--  Apaga 6 FANTASMAS DE CITAÇÃO na base v2 (`fanara87_governanca`).
--  Rodar no phpMyAdmin. Complementa `corrigir_anos_impossiveis.sql` (que tratou
--  a duplicata 02/1014 e o fantasma do anexo SIORG 41/1771).
--
--  O QUE SÃO: atos que o extrator inventou a partir de uma MENÇÃO a uma norma
--  antiga ou a uma referência bibliográfica dentro de um ato RECENTE. O sinal
--  claro é ano-do-ato << ano-do-boletim: um "ato de 1996/1998/2000" que só
--  aparece num boletim de 2006-2022 não é ato de época — é citação virada em ato.
--
--  Auditoria dos 108 atos com ano < 2001 (medido na produção, 18/07):
--    • 100 são REAIS, do boletim de 2001 (o único OCR'd) — backlog/erro de ano
--      do OCR, mas atos de verdade (bancas, designações). MANTIDOS.
--    •   2 são REAIS com ano mal lido (DTS GQO 003/004 — o boletim 144-2007
--        imprime "de 23 de agosto de 20007", OCR de 2007, e o extrator pegou os
--        4 primeiros dígitos = 2000). NÃO apagados — o ano é corrigido em
--        `corrigir_ano_gqo.sql`.
--    •   6 são estes fantasmas de citação. APAGADOS abaixo.
--
--  Sobre ns-uff-504-2000: lendo o boletim 106-2006, o ato do Adalmir é um ato
--  REAL de 2006 que só CITA "a Norma de Serviço nº 504/00, de 27 de abril de
--  2000, que criou o NEDIN". O extrator montou um fantasma dessa citação, com a
--  ementa errada. Por isso entra aqui, não na correção de ano.
--
--  in-sedap-205-1988 é citada por 1 ato real: o ON DELETE SET NULL da `relacao`
--  preserva o TEXTO da citação e só tira o link para o fantasma — comportamento
--  desejado (não deve haver ato UFF para uma norma federal). Os outros não têm
--  referência. O CASCADE limpa ato_texto/etc.
-- ============================================================================

-- (1) PREVIEW — confira as 6 linhas antes de apagar:
SELECT uid, numero, ano, LEFT(ementa, 55) AS ementa
  FROM ato
 WHERE uid IN (
   'port-reitoria-2203-1996',   -- ref. ABNT: "BRASIL. Ministério da Saúde. Lei 8142…" (boletim 2012)
   'port-reitoria-280-1999',    -- ref. ABNT: "SARTI, Cynthia. 'Famílias enredadas'…"  (boletim 2012)
   'in-sedap-205-1988',         -- citação da IN SEDAP nº 205/1988 (federal)            (boletim 2013)
   'port-reitoria-29-1998',     -- Portaria SVS/MS 29/98 (norma federal de alimentos)   (boletim 2021)
   'port-reitoria-29-1998-2',   -- idem, outra citação                                  (boletim 2022)
   'ns-uff-504-2000'            -- citação da NS 504/00 que criou o NEDIN (ementa errada)(boletim 2006)
 );

-- (2) APAGAR os 6 (CASCADE nos filhos; SET NULL nas relações que os citam):
DELETE FROM ato WHERE uid IN (
  'port-reitoria-2203-1996',
  'port-reitoria-280-1999',
  'in-sedap-205-1988',
  'port-reitoria-29-1998',
  'port-reitoria-29-1998-2',
  'ns-uff-504-2000'
);

-- (3) VERIFICAÇÃO — tem que voltar VAZIA:
SELECT uid FROM ato WHERE uid IN (
  'port-reitoria-2203-1996', 'port-reitoria-280-1999', 'in-sedap-205-1988',
  'port-reitoria-29-1998', 'port-reitoria-29-1998-2', 'ns-uff-504-2000'
);
