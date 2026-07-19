-- ============================================================================
--  Varredura e curadoria dos ~100 atos com ano < 2001 (boletim de 2001)
--  Auditoria completa: 45 backlog legitimo, 26 com ano mal lido, 29 para
--  revisao humana. Este SQL corrige os 26 mal-lidos.
--
--  Criterio: o ano do PDF e SEMPRE a fonte de verdade. Conferido pixel
--  a pixel no boletim 2001 impresso (OCR 2001).
-- ============================================================================

-- (1) PREVIEW - os 26 atos com ano errado:
SELECT uid, numero, ano, data_ato, LEFT(ementa, 60) AS ementa
  FROM ato WHERE uid IN ('dts-moc-4-1998', 'dts-mot-8-1998', 'dts-tec-10-1998', 'dts-tec-11-1998', 'dts-tec-12-1998', 'dts-tec-13-1998', 'dts-tec-14-1998', 'dts-tec-15-1998', 'dts-tec-16-1998', 'dts-tec-17-1998', 'dts-tec-18-1998', 'dts-tec-2-1998', 'dts-tec-20-1998', 'dts-tec-201-1998', 'dts-tec-21-1998', 'dts-tec-222-1998', 'dts-tec-3-1998', 'dts-tec-4-1998', 'dts-tec-5-1998', 'dts-tec-6-1998', 'dts-tec-7-1998', 'dts-tec-8-1998', 'dts-tec-9-1998', 'dts-uff-1-2000-2', 'dts-uff-2-2000-2', 'dts-uff-4-2000-3')
  ORDER BY uid;

-- (2) CORRIGIR ano, data e uid:
UPDATE ato SET ano = 2001, data_ato = '2001-02-08', uid = 'dts-moc-4-2001'
 WHERE uid = 'dts-moc-4-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-09', uid = 'dts-mot-8-2001'
 WHERE uid = 'dts-mot-8-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-10-2001'
 WHERE uid = 'dts-tec-10-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-11-2001'
 WHERE uid = 'dts-tec-11-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-12-2001'
 WHERE uid = 'dts-tec-12-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-13-2001'
 WHERE uid = 'dts-tec-13-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-14-2001'
 WHERE uid = 'dts-tec-14-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-15-2001'
 WHERE uid = 'dts-tec-15-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-16-2001'
 WHERE uid = 'dts-tec-16-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-17-2001'
 WHERE uid = 'dts-tec-17-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-18-2001'
 WHERE uid = 'dts-tec-18-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-2-2001'
 WHERE uid = 'dts-tec-2-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-20-2001'
 WHERE uid = 'dts-tec-20-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-201-2001'
 WHERE uid = 'dts-tec-201-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-24', uid = 'dts-tec-21-2001'
 WHERE uid = 'dts-tec-21-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-31', uid = 'dts-tec-222-2001'
 WHERE uid = 'dts-tec-222-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-3-2001'
 WHERE uid = 'dts-tec-3-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-4-2001'
 WHERE uid = 'dts-tec-4-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-5-2001'
 WHERE uid = 'dts-tec-5-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-6-2001'
 WHERE uid = 'dts-tec-6-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-7-2001'
 WHERE uid = 'dts-tec-7-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-8-2001'
 WHERE uid = 'dts-tec-8-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-tec-9-2001'
 WHERE uid = 'dts-tec-9-1998';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-uff-1-2000-2001'
 WHERE uid = 'dts-uff-1-2000-2';
UPDATE ato SET ano = 2001, data_ato = '2001-01-19', uid = 'dts-uff-2-2000-2001'
 WHERE uid = 'dts-uff-2-2000-2';
UPDATE ato SET ano = 2001, data_ato = '2001-01-29', uid = 'dts-uff-4-2000-2001'
 WHERE uid = 'dts-uff-4-2000-3';

-- (3) VERIFICACAO - os 26 com novos uids:
SELECT uid, numero, ano, data_ato FROM ato
  WHERE uid IN ('dts-moc-4-2001', 'dts-mot-8-2001', 'dts-tec-10-2001', 'dts-tec-11-2001', 'dts-tec-12-2001', 'dts-tec-13-2001', 'dts-tec-14-2001', 'dts-tec-15-2001', 'dts-tec-16-2001', 'dts-tec-17-2001', 'dts-tec-18-2001', 'dts-tec-2-2001', 'dts-tec-20-2001', 'dts-tec-201-2001', 'dts-tec-21-2001', 'dts-tec-222-2001', 'dts-tec-3-2001', 'dts-tec-4-2001', 'dts-tec-5-2001', 'dts-tec-6-2001', 'dts-tec-7-2001', 'dts-tec-8-2001', 'dts-tec-9-2001', 'dts-uff-1-2000-2001', 'dts-uff-2-2000-2001', 'dts-uff-4-2000-2001')
  ORDER BY uid;

-- Os uids antigos tem que sumir (vazio):
SELECT uid FROM ato WHERE uid IN ('dts-moc-4-1998', 'dts-mot-8-1998', 'dts-tec-10-1998', 'dts-tec-11-1998', 'dts-tec-12-1998', 'dts-tec-13-1998', 'dts-tec-14-1998', 'dts-tec-15-1998', 'dts-tec-16-1998', 'dts-tec-17-1998', 'dts-tec-18-1998', 'dts-tec-2-1998', 'dts-tec-20-1998', 'dts-tec-201-1998', 'dts-tec-21-1998', 'dts-tec-222-1998', 'dts-tec-3-1998', 'dts-tec-4-1998', 'dts-tec-5-1998', 'dts-tec-6-1998', 'dts-tec-7-1998', 'dts-tec-8-1998', 'dts-tec-9-1998', 'dts-uff-1-2000-2', 'dts-uff-2-2000-2', 'dts-uff-4-2000-3');