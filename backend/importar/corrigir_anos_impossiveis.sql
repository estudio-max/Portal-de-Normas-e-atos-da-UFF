-- ============================================================================
--  Correção de dois atos com ANO impossível (base v2 `fanara87_governanca`).
--  Rodar no phpMyAdmin. Os dois foram apontados na revisão; ambos são para
--  APAGAR (não editar), cada um por um motivo diferente:
--
--  1) res-mgn-02-1014 — "Resolução 02/1014" (equivalência Bioestatística, aluna
--     Danielle). O boletim 134-2014 tem o typo "de 26 de agosto de 1014". É
--     DUPLICATA: o mesmo ato já existe CORRETO como `res-mgn-2-1014` (ano 2014,
--     data 2014-08-26). Apagamos só a cópia com o ano errado.
--
--  2) dec-uff-41-1771 — "Decisão nº 41/1771". FANTASMA: extraído do ANEXO da
--     Portaria 57.716/2017 (cadastro SIORG), que lista unidades com "Criado em:
--     DECISÃO Nº 41/2010". O extrator confundiu essa MENÇÃO com um ato próprio,
--     e o ano saiu lixo (1771). Não existe esse ato no BS.
--
--  Nenhum dos dois tem relações (referenciadoPor/relacoes vazios). O ON DELETE
--  CASCADE do schema limpa ato_texto/ato_pessoa/ato_funcao/prazo/etc. junto.
--
--  Estável: o cron diário NÃO reprocessa boletins antigos (2014/2017). Só
--  voltaria numa re-extração completa (Fase B) — aí o extrator precisará de
--  guarda contra ano impossível e contra o anexo-SIORG. Ver as pendências.
-- ============================================================================

-- (1) PREVIEW — confira que são EXATAMENTE estas 2 linhas antes de apagar:
SELECT uid, numero, ano, data_ato, LEFT(ementa, 55) AS ementa
  FROM ato
 WHERE uid IN ('res-mgn-02-1014', 'dec-uff-41-1771');

-- (2) A versão CORRETA da resolução — NÃO apagar esta (ano 2014):
SELECT uid, numero, ano, data_ato FROM ato WHERE uid = 'res-mgn-2-1014';

-- (3) APAGAR os dois (o CASCADE cuida dos filhos):
DELETE FROM ato WHERE uid = 'res-mgn-02-1014';   -- duplicata (ano 1014; já existe a de 2014)
DELETE FROM ato WHERE uid = 'dec-uff-41-1771';   -- fantasma do anexo SIORG

-- (4) VERIFICAÇÃO — esta tem que voltar VAZIA (os dois sumiram):
SELECT uid FROM ato WHERE uid IN ('res-mgn-02-1014', 'dec-uff-41-1771');

-- (5) E a resolução correta tem que CONTINUAR lá (1 linha, ano 2014):
SELECT uid, numero, ano, data_ato FROM ato WHERE uid = 'res-mgn-2-1014';
