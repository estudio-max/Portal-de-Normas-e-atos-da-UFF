-- ============================================================================
--  seed_comissao.sql — GERADO por tools/registro_comissoes.py. Nao edite aqui.
--
--  Regenerar:  python tools/registro_comissoes.py --sql
--
--  Popular a `comissao` com os 26 colegiados permanentes centrais do
--  registro curado. Depois disto, o bloco 7 do verificar_inteligencia.sql tem
--  que devolver 26 no catalogo e ZERO slugs sem catalogo -- e esse zero e a
--  prova de que os slugs batem com os que a `ato_comissao` ja usa.
--
--  Idempotente: reaplicar refresca nome/sigla/obrigatoriedade a partir do
--  gerador e preserva os campos de curadoria (ato_fundador_id, orgao_id,
--  fundamento_texto), que ninguem gera automaticamente.
--
--  No phpMyAdmin: aba Importar (e DML, nao tem saida para exibir).
-- ============================================================================
INSERT INTO `comissao` (`slug`, `nome`, `sigla`, `obrigatoriedade`, `escopo`, `ativa_catalogo`)
VALUES
  ('cpa', 'Comissão Própria de Avaliação', 'CPA', 'lei', 'central', 1),
  ('cppd', 'Comissão Permanente de Pessoal Docente', 'CPPD', 'lei', 'central', 1),
  ('ceua', 'Comissão de Ética no Uso de Animais', 'CEUA', 'lei', 'central', 1),
  ('biosseg', 'Comissão de Biossegurança da UFF', 'CBio', 'lei', 'central', 1),
  ('etica', 'Comissão de Ética da UFF', NULL, 'lei', 'central', 1),
  ('cep', 'Comitê de Ética em Pesquisa', 'CEP', 'lei', 'central', 1),
  ('cis', 'Comissão Interna de Supervisão do Plano de Carreira (PCCTAE)', 'CIS', 'lei', 'central', 1),
  ('gov-dig', 'Comitê de Governança Digital', NULL, 'controle', 'central', 1),
  ('cgirc', 'Comitê de Governança, Integridade, Riscos e Controles', 'CGIRC', 'controle', 'central', 1),
  ('cgi', 'Comitê de Gestão da Integridade', NULL, 'controle', 'central', 1),
  ('cgestao-inf', 'Comitê de Gestão da Informação', NULL, 'controle', 'central', 1),
  ('acessib', 'Comissão de Acessibilidade e Inclusão (UFF Acessível)', NULL, 'controle', 'central', 1),
  ('cipa', 'Comissão Interna de Prevenção de Acidentes e de Assédio', NULL, 'controle', 'central', 1),
  ('cppta', 'Comissão Permanente de Pessoal Técnico-Administrativo', 'CPPTA', 'nao_classificada', 'central', 1),
  ('csi', 'Comitê de Segurança da Informação', 'CSI', 'nao_classificada', 'central', 1),
  ('cti', 'Comitê de Tecnologia da Informação', NULL, 'nao_classificada', 'central', 1),
  ('assessor-pesq', 'Comitê Assessor de Pesquisa', NULL, 'nao_classificada', 'central', 1),
  ('multi-pesq', 'Comitê Multidisciplinar de Pesquisa', NULL, 'nao_classificada', 'central', 1),
  ('patrim-gen', 'Comitê de Acesso ao Patrimônio Genético', NULL, 'nao_classificada', 'central', 1),
  ('afide', 'Comissão Permanente de Ações Afirmativas, Diversidade e Equidade', 'AFIDE', 'nao_classificada', 'central', 1),
  ('cppiq', 'Comissão Permanente de Políticas para Indígenas e Quilombolas', 'CPPIQ', 'nao_classificada', 'central', 1),
  ('cps', 'Comissão Permanente de Sustentabilidade', 'CPS', 'nao_classificada', 'central', 1),
  ('cpt', 'Comissão Permanente de Telefonia', 'CPT', 'nao_classificada', 'central', 1),
  ('pgd', 'Comissão Permanente do Programa de Gestão e Desempenho', NULL, 'nao_classificada', 'central', 1),
  ('doc-sig', 'Comissão Permanente de Acesso aos Documentos Públicos de Natureza Sigilosa', NULL, 'nao_classificada', 'central', 1),
  ('rsc', 'Comissão Especial de Reconhecimento de Saberes e Competências (RSC)', 'RSC', 'nao_classificada', 'central', 1)

ON DUPLICATE KEY UPDATE
  `nome`            = VALUES(`nome`),
  `sigla`           = VALUES(`sigla`),
  `obrigatoriedade` = VALUES(`obrigatoriedade`),
  `escopo`          = VALUES(`escopo`),
  `ativa_catalogo`  = VALUES(`ativa_catalogo`);
