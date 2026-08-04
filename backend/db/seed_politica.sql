-- ==========================================================================
--  seed_politica.sql — GERADO por tools/gerar_seed_politicas.py.
--  Nao edite aqui. Regenerar: python tools/gerar_seed_politicas.py
--
--  7 politicas do piloto, 93 vinculos ato<->politica.
--  62 atos ficaram de fora e estao em dados/curadoria_politicas.csv.
--
--  Os vinculos entram como `metodo=regra`. A curadoria e soberana: uma
--  repassagem automatica so pode apagar metodo NOT IN ('curadoria',
--  'regra+curadoria','ia+curadoria').
--
--  `status_curadoria` nasce RASCUNHO de proposito: a politica so aparece
--  no portal depois que alguem confirmar o catalogo.
--
--  No phpMyAdmin: aba Importar (e DML, nao tem saida para exibir).
-- ==========================================================================

INSERT INTO `politica` (`slug`, `nome`, `descricao`, `categoria`, `status_curadoria`)
VALUES
  ('assistencia-estudantil', 'Assistência estudantil', 'Programas de auxílio, moradia, alimentação e permanência destinados a estudantes da UFF.', 'Estudantes', 'rascunho'),
  ('acessibilidade', 'Acessibilidade e inclusão', 'Condições de acessibilidade e inclusão para pessoas com deficiência na UFF.', 'Direitos', 'rascunho'),
  ('acoes-afirmativas', 'Ações afirmativas, diversidade e equidade', 'Reserva de vagas, heteroidentificação e políticas para grupos historicamente excluídos.', 'Direitos', 'rascunho'),
  ('assedio', 'Prevenção e enfrentamento ao assédio', 'Prevenção, enfrentamento e tratamento do assédio moral e sexual no âmbito da UFF.', 'Direitos', 'rascunho'),
  ('integridade-riscos', 'Integridade, riscos e controles', 'Programa de integridade, gestão de riscos e controles internos da UFF.', 'Governança', 'rascunho'),
  ('seguranca-informacao', 'Segurança da informação e proteção de dados', 'Política de segurança da informação, privacidade e proteção de dados pessoais.', 'Governança', 'rascunho'),
  ('sustentabilidade', 'Sustentabilidade', 'Agenda ambiental, logística sustentável e gestão socioambiental da UFF.', 'Governança', 'rascunho')
ON DUPLICATE KEY UPDATE
  `nome` = VALUES(`nome`), `descricao` = VALUES(`descricao`),
  `categoria` = VALUES(`categoria`);

INSERT IGNORE INTO `politica_alias` (`politica_id`, `termo`, `tipo`)
VALUES
  ((SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'assistencia estudantil', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'apoio estudantil', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'auxilio moradia', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'auxilio alimentacao', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'auxilio acolhimento', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'auxilio creche', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'auxilio permanencia', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'permanencia estudantil', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'moradia universitaria', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='acessibilidade'), 'acessibilidade', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='acessibilidade'), 'uff acessivel', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='acessibilidade'), 'pessoa com deficiencia', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='acessibilidade'), 'pessoas com deficiencia', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'acoes afirmativas', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'politicas afirmativas', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'heteroidentificacao', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'indigenas e quilombolas', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'reserva de vagas', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'equidade de genero', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'nome social', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='assedio'), 'assedio', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='integridade-riscos'), 'plano de integridade', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='integridade-riscos'), 'programa de integridade', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='integridade-riscos'), 'politica de integridade', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='integridade-riscos'), 'gestao de riscos', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='integridade-riscos'), 'gestao de risco', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='integridade-riscos'), 'mapa de riscos', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='integridade-riscos'), 'controles internos', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='seguranca-informacao'), 'seguranca da informacao', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='seguranca-informacao'), 'protecao de dados', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='seguranca-informacao'), 'lgpd', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='seguranca-informacao'), 'privacidade', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='seguranca-informacao'), 'governanca digital', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='seguranca-informacao'), 'governanca de dados', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='sustentabilidade'), 'sustentabilidade', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='sustentabilidade'), 'sustentavel', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='sustentabilidade'), 'agenda ambiental', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='sustentabilidade'), 'a3p', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='sustentabilidade'), 'gestao socioambiental', 'frase_estrita'),
  ((SELECT id FROM politica WHERE slug='sustentabilidade'), 'logistica sustentavel', 'frase_estrita');

-- O `papel` faz parte da chave natural (ato_id, politica_id, papel).
-- Reclassificar um ato — que foi o caso da cartilha de acessibilidade,
-- de `fundador` para `regulamentacao` — não é UPDATE: o upsert enxerga
-- uma chave nova e INSERE, deixando a linha velha viva. O ato passaria a
-- aparecer duas vezes na linha do tempo, com dois papéis.
--
-- Daí o DELETE: o mesmo desenho da `ato_ods` no importador. A passada
-- automática apaga só o que ela mesma escreveu; qualquer linha que passou
-- por mão humana sobrevive.
DELETE ap FROM `ato_politica` ap
 WHERE ap.`metodo` NOT IN ('curadoria','regra+curadoria','ia+curadoria');

INSERT INTO `ato_politica`
  (`ato_id`, `politica_id`, `papel`, `confianca`, `metodo`, `justificativa`)
VALUES
  ((SELECT id FROM ato WHERE uid='in-proaes-40-2026'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'alta', 'regra', 'frase: auxilio acolhimento'),
  ((SELECT id FROM ato WHERE uid='in-proaes-35-2025'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-28-2025'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'regulamentacao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-17-2023'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'alta', 'regra', 'frase: moradia universitaria'),
  ((SELECT id FROM ato WHERE uid='in-proaes-5-2023'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'alta', 'regra', 'frase: auxilio acolhimento'),
  ((SELECT id FROM ato WHERE uid='in-proaes-21-2022'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'alta', 'regra', 'frase: auxilio acolhimento'),
  ((SELECT id FROM ato WHERE uid='in-proaes-19-2022'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'alta', 'regra', 'frase: auxilio moradia'),
  ((SELECT id FROM ato WHERE uid='in-proaes-15-2022-2'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-6-2022'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'alta', 'regra', 'frase: auxilio acolhimento'),
  ((SELECT id FROM ato WHERE uid='in-proaes-2-2022-2'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-1-2022-2'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'alta', 'regra', 'frase: auxilio moradia'),
  ((SELECT id FROM ato WHERE uid='in-proaes-3-2021'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-2-2021'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-1-2021'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='port-normativa-4-2018-2'), (SELECT id FROM politica WHERE slug='acessibilidade'), 'referencia', 'alta', 'regra', 'frase: pessoas com deficiencia'),
  ((SELECT id FROM ato WHERE uid='in-proaes-41-2026'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'alta', 'regra', 'frase: auxilio alimentacao'),
  ((SELECT id FROM ato WHERE uid='in-proaes-31-2025'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'alta', 'regra', 'frase: auxilio alimentacao'),
  ((SELECT id FROM ato WHERE uid='in-proaes-30-2025'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'alta', 'regra', 'frase: auxilio alimentacao'),
  ((SELECT id FROM ato WHERE uid='in-proaes-24-2024'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'alta', 'regra', 'frase: assistencia estudantil'),
  ((SELECT id FROM ato WHERE uid='in-proaes-8-2023-3'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-13-2022'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'alta', 'regra', 'frase: auxilio alimentacao'),
  ((SELECT id FROM ato WHERE uid='in-proaes-4-2022'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'alta', 'regra', 'frase: auxilio alimentacao'),
  ((SELECT id FROM ato WHERE uid='in-proaes-16-2023'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-61899-2018'), (SELECT id FROM politica WHERE slug='acessibilidade'), 'alteracao', 'alta', 'regra', 'frase: acessibilidade'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-59085-2017'), (SELECT id FROM politica WHERE slug='acessibilidade'), 'governanca', 'alta', 'regra', 'frase: acessibilidade'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68900-2026'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'governanca', 'alta', 'regra', 'frase: assistencia estudantil'),
  ((SELECT id FROM ato WHERE uid='in-proaes-38-2026'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'alta', 'regra', 'frase: assistencia estudantil'),
  ((SELECT id FROM ato WHERE uid='in-proaes-38-2026'), (SELECT id FROM politica WHERE slug='acessibilidade'), 'execucao', 'alta', 'regra', 'frase: pessoas com deficiencia'),
  ((SELECT id FROM ato WHERE uid='in-proaes-38-2026'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'execucao', 'alta', 'regra', 'frase: politicas afirmativas'),
  ((SELECT id FROM ato WHERE uid='res-cuv-635-2025'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'regulamentacao', 'alta', 'regra', 'frase: politicas afirmativas'),
  ((SELECT id FROM ato WHERE uid='in-proaes-34-2025-3'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-34-2025-3'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'alteracao', 'alta', 'regra', 'frase: politicas afirmativas'),
  ((SELECT id FROM ato WHERE uid='in-proaes-33-2025'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-32-2025'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-26-2025'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-26-2025'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'execucao', 'alta', 'regra', 'frase: politicas afirmativas'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68772-2025'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'governanca', 'alta', 'regra', 'frase: acoes afirmativas'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68768-2025'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'governanca', 'alta', 'regra', 'frase: acoes afirmativas'),
  ((SELECT id FROM ato WHERE uid='in-prograd-58-2025'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'referencia', 'alta', 'regra', 'frase: heteroidentificacao'),
  ((SELECT id FROM ato WHERE uid='in-proaes-23-2024'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-22-2024'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'alta', 'regra', 'frase: auxilio permanencia'),
  ((SELECT id FROM ato WHERE uid='in-proaes-15-2023'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-14-2023-2'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-12-2023'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-6-2023-2'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-1-2023-2'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-12-2022'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'alteracao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-8-2022-2'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='in-proaes-4-2021'), (SELECT id FROM politica WHERE slug='assistencia-estudantil'), 'execucao', 'media', 'regra', 'emissor: PROAES'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68317-2022'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'governanca', 'alta', 'regra', 'frase: equidade de genero'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-67216-2020'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'alteracao', 'alta', 'regra', 'frase: acoes afirmativas'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-67183-2020'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'governanca', 'alta', 'regra', 'frase: acoes afirmativas'),
  ((SELECT id FROM ato WHERE uid='res-uff-580-2017'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'referencia', 'alta', 'regra', 'frase: acoes afirmativas'),
  ((SELECT id FROM ato WHERE uid='res-uff-160-2013'), (SELECT id FROM politica WHERE slug='acoes-afirmativas'), 'regulamentacao', 'alta', 'regra', 'frase: nome social'),
  ((SELECT id FROM ato WHERE uid='dec-cgirc-1-2025'), (SELECT id FROM politica WHERE slug='assedio'), 'fundador', 'alta', 'regra', 'frase: assedio'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68876-2025'), (SELECT id FROM politica WHERE slug='acessibilidade'), 'governanca', 'alta', 'regra', 'frase: acessibilidade'),
  ((SELECT id FROM ato WHERE uid='in-sdc-16-2025'), (SELECT id FROM politica WHERE slug='acessibilidade'), 'regulamentacao', 'alta', 'regra', 'frase: acessibilidade'),
  ((SELECT id FROM ato WHERE uid='res-ese-4-2023'), (SELECT id FROM politica WHERE slug='acessibilidade'), 'governanca', 'alta', 'regra', 'frase: acessibilidade'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-63254-2019'), (SELECT id FROM politica WHERE slug='acessibilidade'), 'governanca', 'alta', 'regra', 'frase: acessibilidade'),
  ((SELECT id FROM ato WHERE uid='res-cuv-528-2025'), (SELECT id FROM politica WHERE slug='sustentabilidade'), 'regulamentacao', 'alta', 'regra', 'frase: sustentavel'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68787-2025'), (SELECT id FROM politica WHERE slug='sustentabilidade'), 'governanca', 'alta', 'regra', 'frase: agenda ambiental'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68583-2023'), (SELECT id FROM politica WHERE slug='sustentabilidade'), 'governanca', 'alta', 'regra', 'frase: sustentabilidade'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-60767-2018'), (SELECT id FROM politica WHERE slug='sustentabilidade'), 'governanca', 'alta', 'regra', 'frase: sustentabilidade'),
  ((SELECT id FROM ato WHERE uid='res-cuv-655-2025'), (SELECT id FROM politica WHERE slug='sustentabilidade'), 'governanca', 'alta', 'regra', 'frase: sustentabilidade'),
  ((SELECT id FROM ato WHERE uid='res-cmn-3-2024'), (SELECT id FROM politica WHERE slug='sustentabilidade'), 'referencia', 'alta', 'regra', 'frase: sustentabilidade'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68215-2021'), (SELECT id FROM politica WHERE slug='sustentabilidade'), 'governanca', 'alta', 'regra', 'frase: sustentavel'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-62118-2018'), (SELECT id FROM politica WHERE slug='sustentabilidade'), 'governanca', 'alta', 'regra', 'frase: sustentabilidade'),
  ((SELECT id FROM ato WHERE uid='ns-uff-578-2006'), (SELECT id FROM politica WHERE slug='sustentabilidade'), 'fundador', 'alta', 'regra', 'frase: sustentavel'),
  ((SELECT id FROM ato WHERE uid='res-uff-300-2017'), (SELECT id FROM politica WHERE slug='sustentabilidade'), 'regulamentacao', 'alta', 'regra', 'frase: sustentabilidade'),
  ((SELECT id FROM ato WHERE uid='dec-cgirc-16-2025'), (SELECT id FROM politica WHERE slug='sustentabilidade'), 'fundador', 'alta', 'regra', 'frase: agenda ambiental'),
  ((SELECT id FROM ato WHERE uid='dec-cgirc-15-2025'), (SELECT id FROM politica WHERE slug='integridade-riscos'), 'monitoramento', 'alta', 'regra', 'frase: gestao de riscos'),
  ((SELECT id FROM ato WHERE uid='dec-cgirc-10-2025'), (SELECT id FROM politica WHERE slug='integridade-riscos'), 'fundador', 'alta', 'regra', 'frase: plano de integridade'),
  ((SELECT id FROM ato WHERE uid='dec-cgirc-3-2025'), (SELECT id FROM politica WHERE slug='seguranca-informacao'), 'fundador', 'alta', 'regra', 'frase: protecao de dados'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68760-2024'), (SELECT id FROM politica WHERE slug='seguranca-informacao'), 'fundador', 'alta', 'regra', 'frase: protecao de dados'),
  ((SELECT id FROM ato WHERE uid='res-cuv-372-2024'), (SELECT id FROM politica WHERE slug='seguranca-informacao'), 'regulamentacao', 'alta', 'regra', 'frase: seguranca da informacao'),
  ((SELECT id FROM ato WHERE uid='res-cuv-310-2024'), (SELECT id FROM politica WHERE slug='integridade-riscos'), 'regulamentacao', 'alta', 'regra', 'frase: plano de integridade'),
  ((SELECT id FROM ato WHERE uid='res-cuv-308-2024'), (SELECT id FROM politica WHERE slug='seguranca-informacao'), 'regulamentacao', 'alta', 'regra', 'frase: seguranca da informacao'),
  ((SELECT id FROM ato WHERE uid='res-cuv-191-2023'), (SELECT id FROM politica WHERE slug='integridade-riscos'), 'regulamentacao', 'alta', 'regra', 'frase: plano de integridade'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68476-2023'), (SELECT id FROM politica WHERE slug='seguranca-informacao'), 'governanca', 'alta', 'regra', 'frase: privacidade'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68259-2021'), (SELECT id FROM politica WHERE slug='integridade-riscos'), 'regulamentacao', 'alta', 'regra', 'frase: programa de integridade'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-68126-2021'), (SELECT id FROM politica WHERE slug='seguranca-informacao'), 'governanca', 'alta', 'regra', 'frase: lgpd'),
  ((SELECT id FROM ato WHERE uid='port-reitoria-67197-2020'), (SELECT id FROM politica WHERE slug='seguranca-informacao'), 'governanca', 'alta', 'regra', 'frase: governanca digital'),
  ((SELECT id FROM ato WHERE uid='dts-cmm-13-2026'), (SELECT id FROM politica WHERE slug='assedio'), 'governanca', 'alta', 'regra', 'frase: assedio'),
  ((SELECT id FROM ato WHERE uid='dts-ric-10-2026'), (SELECT id FROM politica WHERE slug='assedio'), 'governanca', 'alta', 'regra', 'frase: assedio'),
  ((SELECT id FROM ato WHERE uid='dts-ppgcaps-14-2025'), (SELECT id FROM politica WHERE slug='assedio'), 'governanca', 'alta', 'regra', 'frase: assedio'),
  ((SELECT id FROM ato WHERE uid='dts-inf-40-2025'), (SELECT id FROM politica WHERE slug='assedio'), 'governanca', 'alta', 'regra', 'frase: assedio'),
  ((SELECT id FROM ato WHERE uid='dts-isnf-19-2025'), (SELECT id FROM politica WHERE slug='assedio'), 'governanca', 'alta', 'regra', 'frase: assedio'),
  ((SELECT id FROM ato WHERE uid='dts-inf-31-2025'), (SELECT id FROM politica WHERE slug='assedio'), 'alteracao', 'alta', 'regra', 'frase: assedio'),
  ((SELECT id FROM ato WHERE uid='dts-inf-26-2025'), (SELECT id FROM politica WHERE slug='assedio'), 'alteracao', 'alta', 'regra', 'frase: assedio'),
  ((SELECT id FROM ato WHERE uid='dts-inf-15-2025'), (SELECT id FROM politica WHERE slug='assedio'), 'governanca', 'alta', 'regra', 'frase: assedio'),
  ((SELECT id FROM ato WHERE uid='dts-esd-17-2024'), (SELECT id FROM politica WHERE slug='assedio'), 'governanca', 'alta', 'regra', 'frase: assedio'),
  ((SELECT id FROM ato WHERE uid='dts-ter-3-2022'), (SELECT id FROM politica WHERE slug='assedio'), 'governanca', 'alta', 'regra', 'frase: assedio'),
  ((SELECT id FROM ato WHERE uid='dts-grc-1-2018'), (SELECT id FROM politica WHERE slug='assedio'), 'governanca', 'alta', 'regra', 'frase: assedio')
ON DUPLICATE KEY UPDATE
  `confianca` = VALUES(`confianca`), `justificativa` = VALUES(`justificativa`);
