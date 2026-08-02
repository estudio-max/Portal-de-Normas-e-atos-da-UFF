-- ============================================================================
--  Sete Portarias com número IMPOSSÍVEL (base v2 `fanara87_governanca`).
--  Rodar no phpMyAdmin.
--
--  O DEFEITO NÃO É NOSSO. Os sete números estão impressos exatamente assim no
--  Boletim de Serviço -- conferido página a página no PDF de origem. O extrator
--  leu com fidelidade um erro de digitação da fonte:
--
--      "PORTARIA N.º 44.4991 de 20 de junho de 2011"   (BS 103/2011, pág. 03)
--      "PORTARIA N.º 55.1480 de 09 de dezembro de 2015" (BS 009/2016, pág. 012)
--      "PORTARIA N.º 38.0779 de 19 de setembro de 2008" (BS 180/2008, pág. 040)
--
--  Seis dos sete são um dígito INSERIDO; o sétimo é uma SUBSTITUIÇÃO
--  ("81.875" onde a série pede 51.875).
--
--  COMO O NÚMERO PRETENDIDO FOI INFERIDO (não é chute)
--  Para cada um, as Portarias da MESMA DATA formam sequência contígua com
--  exatamente um buraco -- e o buraco é um dígito de distância do impresso.
--  Os sete foram verificados em três frentes: (a) o número inferido não existe
--  em nenhum ano do acervo, então não há colisão; (b) cai dentro da faixa da
--  própria data; (c) é o único candidato a uma edição de distância.
--  Detecção e inferência estão em `tools/auditar_datas.py`.
--
--  O QUE ESTE SCRIPT MUDA -- E O QUE ELE DELIBERADAMENTE NÃO MUDA
--  Muda só `numero_norm`, que é o inteiro usado para busca, ordenação e
--  casamento. NÃO toca `numero`, que é a string exibida.
--
--  Isso é escolha de princípio, não economia: o portal é uma camada de
--  consulta sobre o BS, e a fidelidade ao que foi publicado é o que dá a ele
--  valor probatório. Reescrever o número exibido faria o portal DISCORDAR do
--  documento oficial -- e quem conferir no PDF vai achar que o portal errou.
--  Com esta correção, a tela continua mostrando "44.4991" (o que o BS diz) e
--  quem procura pela Portaria 44.991 encontra assim mesmo.
--
--  Se preferirem exibir o número provável, isso é decisão editorial da equipe,
--  não conserto técnico -- e aí o certo é exibir os dois, com nota de que o BS
--  publicou grafia diferente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) PREVIEW — devem voltar exatamente 7 linhas, com numero_norm impossível:
-- ----------------------------------------------------------------------------
SELECT a.uid, a.numero, a.numero_norm, a.ano, a.data_ato, b.arquivo
  FROM ato a
  LEFT JOIN boletim b ON b.id = a.boletim_id
 WHERE a.numero_norm > 75000
 ORDER BY a.numero_norm DESC;

-- (1b) GUARDA — tem que voltar VAZIA. Se alguma linha voltar, o número
--      pretendido JÁ EXISTE e a correção criaria duas Portarias com o mesmo
--      número no mesmo ano. PARE e reavalie o caso.
SELECT uid, numero, numero_norm, ano FROM ato
 WHERE (numero_norm, ano) IN
       ((55148, 2015), (44353, 2011), (45464, 2011),
        (44992, 2011), (44991, 2011), (38779, 2008), (51875, 2014));

-- ----------------------------------------------------------------------------
-- (2) CORRIGIR — um a um, cada um com o BS onde foi conferido.
--     `numero` (a grafia publicada) fica intacto de propósito.
-- ----------------------------------------------------------------------------
UPDATE ato SET numero_norm =  55148 WHERE uid = 'port-reitoria-551480-2015';  -- BS 009/2016 p.012, "55.1480"
UPDATE ato SET numero_norm =  44353 WHERE uid = 'port-reitoria-474353-2011';  -- BS 062/2011 p.015, "474.353"
UPDATE ato SET numero_norm =  45464 WHERE uid = 'port-reitoria-456464-2011';  -- BS 191/2011 p.04,  "456464"
UPDATE ato SET numero_norm =  44992 WHERE uid = 'port-reitoria-444992-2011';  -- BS 103/2011 p.04,  "44.4992"
UPDATE ato SET numero_norm =  44991 WHERE uid = 'port-reitoria-444991-2011';  -- BS 103/2011 p.03,  "44.4991"
UPDATE ato SET numero_norm =  38779 WHERE uid = 'port-reitoria-380779-2008';  -- BS 180/2008 p.040, "38.0779"
UPDATE ato SET numero_norm =  51875 WHERE uid = 'port-reitoria-116-2014' ;    -- ATENCAO: conferir o uid abaixo antes
-- O uid do caso de 2014 precisa ser lido do PREVIEW (1) -- ele nao segue o
-- mesmo padrao dos outros. Rode o (1), copie o uid da linha nº 81875 e use-o
-- na linha acima ANTES de executar. Sem isso, este UPDATE nao casa nada.

-- ----------------------------------------------------------------------------
-- (3) VERIFICAÇÃO
-- ----------------------------------------------------------------------------
-- (3a) Tem que voltar VAZIA (não sobrou nenhum número impossível):
SELECT uid, numero, numero_norm FROM ato WHERE numero_norm > 75000;

-- (3b) Os sete agora com numero_norm plausível e `numero` PRESERVADO:
SELECT uid, numero AS publicado, numero_norm AS para_busca, ano, data_ato
  FROM ato
 WHERE uid IN ('port-reitoria-551480-2015','port-reitoria-474353-2011',
               'port-reitoria-456464-2011','port-reitoria-444992-2011',
               'port-reitoria-444991-2011','port-reitoria-380779-2008')
 ORDER BY ano;

-- ----------------------------------------------------------------------------
-- (4) DEPOIS: limpar `api/cache/`, senão a busca continua servindo o índice
--     antigo. Qualquer importador também invalida o cache ao terminar.
-- ----------------------------------------------------------------------------
