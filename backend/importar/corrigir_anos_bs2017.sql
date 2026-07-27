-- ============================================================================
--  Correção da DATA de 212 atos dos boletins de março/2017 (base v2
--  `fanara87_governanca`). Rodar no phpMyAdmin.
--
--  O DEFEITO
--  Seis boletins (050, 051, 052, 053, 054, 056 de 2017) foram diagramados
--  sobre um modelo de 2007 que ninguém atualizou: a capa diz
--  "ANO XLI ... 23/03/2007" enquanto o cabeçalho das páginas internas diz
--  "ANO LI ... 23/03/2017", repetido em cada página. Como a data do boletim é
--  a âncora de `corrige_ano_futuro` no extrator, todo ato legítimo de 2017
--  parecia "futuro" diante de um boletim de 2007 e era reescrito 10 anos para
--  trás. Efeito visível: na aba "Meu SIAPE" a portaria aparecia com data de
--  2007 enquanto a coluna "Referência no BS" dizia "BS nº 51/2017" -- as duas
--  colunas se contradiziam na mesma linha.
--
--  O extrator já foi corrigido (`tools/extrair_boletim.py`, `metadados_bs`
--  agora exige duas testemunhas: cabeçalho interno E nome do arquivo). Este
--  SQL conserta o que já entrou na base ANTES da correção.
--
--  O QUE NÃO ESTÁ QUEBRADO
--  O vínculo com o boletim está CERTO. `boletim_id` é resolvido pelo nome do
--  ARQUIVO (`importar_v2.php`, boletim_id()), não pela capa -- por isso a
--  coluna de referência sempre mostrou 2017. Só `ato.ano` e `ato.data_ato`
--  precisam de conserto.
--
--  POR QUE UPDATE E NÃO "APAGAR E REIMPORTAR"
--  A chave natural do importador é (boletim,tipo,sigla_orig,numero_norm,ANO)
--  -- ela INCLUI o ano. Reimportar sem consertar antes NÃO atualizaria as
--  linhas erradas: criaria 212 linhas novas com ano=2017 e deixaria as de 2007
--  para trás, duplicadas. Depois deste UPDATE a chave natural passa a casar e
--  a reimportação vira idempotente.
--  Apagar também não serve: o ON DELETE CASCADE levaria junto ato_ods,
--  ato_pessoa, ato_funcao e as relações -- inclusive classificação curada à
--  mão. O UPDATE preserva o `id`, e com ele todos os filhos.
--
--  O `uid` NÃO é alterado de propósito: ele é slug de exibição, e o próprio
--  importador o mantém estável ao atualizar um ato ("uid fica estável, não
--  regenera"). Fica a marca cosmética de um uid terminado em -2007 num ato de
--  2017; mexer nele arriscaria colisão com o uid de um ato real de 2007.
--
--  MEDIDO (diff da extração antiga vs. nova nos 6 PDFs):
--    212 atos, bijeção exata (0 órfãos), TODOS deslocados de +10 anos,
--    dia e mês preservados em todos.
--      206 atos  2007 -> 2017
--        6 atos  2006 -> 2016   (assinados no fim de 2016, publicados em 2017)
--    Nenhum ato desses 6 boletins permanece em 2006/2007 -- o predicado abaixo
--    seleciona exatamente os 212.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) PREVIEW — tem que voltar 212 linhas, distribuídas 206/6.
-- ----------------------------------------------------------------------------
SELECT b.arquivo, a.ano, COUNT(*) AS qtd
  FROM ato a
  JOIN boletim b ON b.id = a.boletim_id
 WHERE b.arquivo IN ('050-2017.pdf','051-2017.pdf','052-2017.pdf',
                     '053-2017.pdf','054-2017.pdf','056-2017.pdf')
   AND a.ano IN (2006, 2007)
 GROUP BY b.arquivo, a.ano
 ORDER BY b.arquivo, a.ano;

-- (1b) Amostra, para conferir que dia/mês fazem sentido e a ementa é de 2017:
SELECT a.uid, a.numero, a.ano, a.data_ato, LEFT(a.ementa, 50) AS ementa
  FROM ato a
  JOIN boletim b ON b.id = a.boletim_id
 WHERE b.arquivo = '051-2017.pdf' AND a.ano IN (2006, 2007)
 ORDER BY a.data_ato
 LIMIT 10;

-- (1c) GUARDA — tem que voltar VAZIA. Se voltar alguma linha, PARE: existe
--      ato desses boletins fora de 2006/2007 e a premissa acima não vale mais.
SELECT a.uid, a.ano, COUNT(*) AS qtd
  FROM ato a
  JOIN boletim b ON b.id = a.boletim_id
 WHERE b.arquivo IN ('050-2017.pdf','051-2017.pdf','052-2017.pdf',
                     '053-2017.pdf','054-2017.pdf','056-2017.pdf')
   AND a.ano NOT IN (2006, 2007)
 GROUP BY a.uid, a.ano;

-- ----------------------------------------------------------------------------
-- (2) CORRIGIR — +10 anos em `ano` e em `data_ato`. Dia e mês não mudam.
--     `data_ato` pode ser NULL; o DATE_ADD devolve NULL e a linha fica NULL.
-- ----------------------------------------------------------------------------
UPDATE ato a
  JOIN boletim b ON b.id = a.boletim_id
   SET a.ano      = a.ano + 10,
       a.data_ato = DATE_ADD(a.data_ato, INTERVAL 10 YEAR)
 WHERE b.arquivo IN ('050-2017.pdf','051-2017.pdf','052-2017.pdf',
                     '053-2017.pdf','054-2017.pdf','056-2017.pdf')
   AND a.ano IN (2006, 2007);
-- Esperado: 212 linhas afetadas.

-- ----------------------------------------------------------------------------
-- (3) VERIFICAÇÃO
-- ----------------------------------------------------------------------------
-- (3a) Tem que voltar VAZIA (não sobrou nenhum em 2006/2007):
SELECT a.uid, a.ano FROM ato a
  JOIN boletim b ON b.id = a.boletim_id
 WHERE b.arquivo IN ('050-2017.pdf','051-2017.pdf','052-2017.pdf',
                     '053-2017.pdf','054-2017.pdf','056-2017.pdf')
   AND a.ano IN (2006, 2007);

-- (3b) Agora tem que voltar 212, distribuídas 206 em 2017 e 6 em 2016:
SELECT a.ano, COUNT(*) AS qtd FROM ato a
  JOIN boletim b ON b.id = a.boletim_id
 WHERE b.arquivo IN ('050-2017.pdf','051-2017.pdf','052-2017.pdf',
                     '053-2017.pdf','054-2017.pdf','056-2017.pdf')
 GROUP BY a.ano;

-- (3c) O ato que originou o relato (aba "Meu SIAPE", BS nº 51/2017 Seção IV):
SELECT a.uid, a.numero, a.ano, a.data_ato, b.arquivo
  FROM ato a JOIN boletim b ON b.id = a.boletim_id
 WHERE b.arquivo = '051-2017.pdf' AND a.secao LIKE '%IV%'
 ORDER BY a.pagina LIMIT 5;

-- ----------------------------------------------------------------------------
-- (4) DEPOIS DO SQL: limpar o cache da API, senão a aba continua mostrando 2007.
--     Apagar os arquivos de `api/cache/` pelo Gerenciador de Arquivos, ou
--     rodar qualquer importador (eles invalidam o cache ao terminar).
-- ----------------------------------------------------------------------------
