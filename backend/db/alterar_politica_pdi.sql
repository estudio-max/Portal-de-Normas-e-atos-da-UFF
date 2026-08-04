-- ============================================================================
--  alterar_politica_pdi.sql — ancora a categoria da política no PDI da UFF.
--
--  POR QUE ESTA MIGRAÇÃO EXISTE
--
--  A coluna `categoria` guardava 'Direitos', 'Governança' e 'Estudantes' —
--  três rótulos SEM ÂNCORA, escritos por quem montou o catálogo. Pior: os três
--  não respondiam à mesma pergunta. "Direitos" classifica pela natureza do que
--  se protege, "Estudantes" pelo destinatário, "Governança" pela função. Sob
--  qualquer critério consistente o conjunto se desfazia, e "Estudantes" era uma
--  prateleira de um item só — criada porque a assistência estudantil não cabia
--  nas outras duas, não porque um critério a exigisse.
--
--  O PDI 2023-2027 (aprovado pelo CGIRC em 21/08/2023) declara 5 eixos
--  mobilizadores e, dentro deles, subtemas que NOMEIAM cinco das sete políticas
--  do piloto quase literalmente. É a taxonomia da própria universidade, a que
--  os órgãos de controle reconhecem — mesmo princípio das ODS, ancoradas em
--  THE/IPEA, e das obrigações, ancoradas na legislação.
--
--  A ÂNCORA É DATADA. `pdi_versao` guarda a edição do plano, porque o PDI
--  2023-2027 vence em 2027 e o próximo pode reorganizar os eixos.
--
--  MySQL 5.7 NÃO tem `ADD COLUMN IF NOT EXISTS`. Este script roda UMA VEZ; se
--  repetido, dá erro 1060 (Duplicate column name), que é inofensivo mas assusta.
--  Confira antes com o bloco de verificação no fim do arquivo.
--
--  No phpMyAdmin: aba SQL (o ALTER não tem saída, mas a verificação tem).
--  Depois deste script, aplique o `seed_politica.sql` regerado.
-- ============================================================================

ALTER TABLE `politica`
  ADD COLUMN `eixo_pdi`    VARCHAR(60) NULL AFTER `categoria`,
  ADD COLUMN `subtema_pdi` VARCHAR(80) NULL AFTER `eixo_pdi`,
  ADD COLUMN `pdi_base`    ENUM('nome','conteudo','afinidade') NULL AFTER `subtema_pdi`,
  ADD COLUMN `pdi_versao`  VARCHAR(20) NULL AFTER `pdi_base`;


-- ---------------------------------------------------------------------------
--  VERIFICAÇÃO — rode DEPOIS de aplicar o seed regerado.
--
--  Esperado: 7 linhas, todas com eixo, subtema, base e versão preenchidos.
--  `pdi_base` deve sair 5 'nome', 1 'conteudo' (assédio) e 1 'afinidade'
--  (segurança da informação). Qualquer NULL aqui é política que ficou sem
--  âncora — e política sem âncora não deve exibir categoria nenhuma na tela.
-- ---------------------------------------------------------------------------
SELECT `slug`, `eixo_pdi`, `subtema_pdi`, `pdi_base`, `pdi_versao`
  FROM `politica`
 ORDER BY `eixo_pdi`, `subtema_pdi`, `slug`;

SELECT `pdi_base`, COUNT(*) AS `politicas`
  FROM `politica`
 GROUP BY `pdi_base`
 ORDER BY `politicas` DESC;
