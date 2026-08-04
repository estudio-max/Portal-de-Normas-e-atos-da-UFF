-- ============================================================================
--  seed_obrigacao_legal.sql — GERADO por tools/registro_obrigacoes_legais.py.
--  Não edite aqui. Regenerar: python tools/registro_obrigacoes_legais.py --sql
--
--  12 obrigações que NÃO vêm do Boletim: vêm da norma que exige o
--  colegiado. A CPA não deve relatório porque uma portaria mandou — deve porque
--  a Lei 10.861/2004 instituiu o SINAES.
--
--  `ato_origem_id` é NULL de propósito, e é a diferença que o módulo descobriu:
--  esta obrigação não nasce de um ato da UFF. `trecho_origem` guarda a NORMA.
--
--  `metodo='curadoria'`: nenhuma linha aqui saiu de detector. Todas foram
--  levantadas à mão a partir da legislação, e por isso sobrevivem a qualquer
--  passada automática.
--
--  Todas as linhas foram conferidas em fonte oficial em 04/08/2026, uma a uma.
--  Duas suposições minhas caíram na conferência e foram REMOVIDAS em vez de
--  suavizadas — estão comentadas no gerador, com o motivo. O campo `conf`
--  continua no registro porque a próxima linha acrescentada nasce a confirmar.
--
--  No phpMyAdmin: aba Importar (é DML, não tem saída para exibir).
-- ============================================================================
INSERT INTO `obrigacao`
  (`uid`, `ato_origem_id`, `comissao_slug`, `tipo`, `descricao`, `responsavel_texto`,
   `periodicidade_meses`, `condicao_texto`, `trecho_origem`, `data_base_origem`,
   `confianca`, `metodo`, `estado_curado`)
VALUES
  ('obl-cpa-relatorio', NULL, 'cpa', 'relatorio', 'Relatório de autoavaliação institucional, coordenado pela CPA e enviado ao INEP/MEC.', 'Comissão Própria de Avaliação',
   12, 'Lei 10.861/2004, art. 11 (SINAES); relatórios publicados em cpa.uff.br', 'Lei 10.861/2004, art. 11 (SINAES); relatórios publicados em cpa.uff.br', 'sem_data', 'media',
   'curadoria', NULL),
  ('obl-ceua-relatorio', NULL, 'ceua', 'relatorio', 'Relatório anual de atividades ao CONCEA.', 'Comissão de Ética no Uso de Animais',
   12, 'Lei 11.794/2008 (Lei Arouca) e Resoluções Normativas do CONCEA', 'Lei 11.794/2008 (Lei Arouca) e Resoluções Normativas do CONCEA', 'sem_data', 'media',
   'curadoria', NULL),
  ('obl-biosseg-relatorio', NULL, 'biosseg', 'relatorio', 'Relatório anual à CTNBio, até 31 de março, sob pena de suspensão ou cancelamento do Certificado de Qualidade em Biossegurança (CQB).', 'Comissão Interna de Biossegurança (CIBio)',
   12, 'Resolução Normativa CTNBio nº 37/2022, art. 11', 'Resolução Normativa CTNBio nº 37/2022, art. 11', 'sem_data', 'media',
   'curadoria', NULL),
  ('obl-acessib-relatorio', NULL, 'acessib', 'relatorio', 'Relatório Anual de Acessibilidade e Inclusão (RAAI).', 'Comissão Permanente de Acessibilidade e Inclusão (UFF Acessível)',
   12, 'uff.br/sobre/comites-e-comissoes/ — atribuição declarada', 'uff.br/sobre/comites-e-comissoes/ — atribuição declarada', 'sem_data', 'media',
   'curadoria', NULL),
  ('obl-cgirc-relatorio', NULL, 'cgirc', 'relatorio', 'Relatório semestral de integridade.', 'Comitê de Governança, Integridade, Riscos e Controles',
   6, 'Relatórios semestrais publicados em uff.br (1º e 2º semestres de 2023)', 'Relatórios semestrais publicados em uff.br (1º e 2º semestres de 2023)', 'sem_data', 'media',
   'curadoria', NULL),
  ('obl-gov-dig-plano', NULL, 'gov-dig', 'plano', 'Plano Diretor de Tecnologia da Informação e Comunicação (PDTIC): vigência mínima de dois anos, com revisão anual. A publicação é requisito para contratar TI.', 'Comitê de Governança Digital',
   12, 'Guia de PDTIC do SISP e IN SGD/ME nº 94/2022', 'Guia de PDTIC do SISP e IN SGD/ME nº 94/2022', 'sem_data', 'media',
   'curadoria', NULL),
  ('obl-cgi-plano', NULL, 'cgi', 'plano', 'Plano de Integridade, com revisão periódica — a norma não fixa prazo.', 'Comitê de Gestão da Integridade',
   NULL, 'Decreto 9.203/2017 e Portaria CGU nº 1.089/2018', 'Decreto 9.203/2017 e Portaria CGU nº 1.089/2018', 'sem_data', 'media',
   'curadoria', NULL),
  ('obl-cipa-recomposicao', NULL, 'cipa', 'recomposicao', 'Mandato de um ano, permitida uma reeleição. A convocação da eleição ocorre no mínimo 60 dias antes do fim do mandato, e a eleição, no mínimo 30 dias antes.', 'Comissão Interna de Prevenção de Acidentes e de Assédio',
   12, 'NR-5 (texto vigente, Ministério do Trabalho e Emprego) e Lei 14.457/2022', 'NR-5 (texto vigente, Ministério do Trabalho e Emprego) e Lei 14.457/2022', 'sem_data', 'media',
   'curadoria', NULL),
  ('obl-cppd-recomposicao', NULL, 'cppd', 'recomposicao', 'Mandato de dois anos, com membros eleitos pela comunidade docente.', 'Comissão Permanente de Pessoal Docente',
   24, 'Lei 12.772/2012 e regulamentação interna da UFF (cppd.uff.br)', 'Lei 12.772/2012 e regulamentação interna da UFF (cppd.uff.br)', 'sem_data', 'media',
   'curadoria', NULL),
  ('obl-cis-recomposicao', NULL, 'cis', 'recomposicao', 'Mandato de três anos, com membros eleitos diretamente pelos técnico-administrativos.', 'Comissão Interna de Supervisão do PCCTAE',
   36, 'Lei 11.091/2005, art. 22, §3º', 'Lei 11.091/2005, art. 22, §3º', 'sem_data', 'media',
   'curadoria', NULL),
  ('obl-cep-recomposicao', NULL, 'cep', 'recomposicao', 'Mandato de três anos; a renovação do registro na CONEP é solicitada a cada mandato.', 'Comitê de Ética em Pesquisa',
   36, 'Normas da CONEP / Conselho Nacional de Saúde', 'Normas da CONEP / Conselho Nacional de Saúde', 'sem_data', 'media',
   'curadoria', NULL),
  ('obl-cpa-constituicao', NULL, 'cpa', 'constituicao', 'Designação e recomposição dos membros da CPA.', 'Reitoria',
   NULL, 'Lei 10.861/2004, art. 11', 'Lei 10.861/2004, art. 11', 'sem_data', 'media',
   'curadoria', NULL)

ON DUPLICATE KEY UPDATE
  `descricao`           = VALUES(`descricao`),
  `responsavel_texto`   = VALUES(`responsavel_texto`),
  `periodicidade_meses` = VALUES(`periodicidade_meses`),
  `condicao_texto`      = VALUES(`condicao_texto`),
  `trecho_origem`       = VALUES(`trecho_origem`);
