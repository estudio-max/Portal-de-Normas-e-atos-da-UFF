-- =====================================================================
-- Portal de Normas UFF — Schema v2 (normalizado)
-- Ver docs/ARQUITETURA-BASE-DADOS.md para o racional completo.
-- Importar num banco NOVO (fanara87_governanca) antes de carregar os dados.
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------- DIMENSÕES ----------
DROP TABLE IF EXISTS `tipo_ato`;
CREATE TABLE `tipo_ato` (
  `id`    SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome`  VARCHAR(60) NOT NULL,
  `sigla` VARCHAR(8)  NULL,
  `ordem` SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `orgao`;
CREATE TABLE `orgao` (
  `id`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sigla`     VARCHAR(60)  NOT NULL,
  `nome`      VARCHAR(200) NULL,
  -- categorias do organograma oficial (Portaria 68.235/2021):
  `tipo`      ENUM('deliberacao','fiscalizacao','reitoria','assessoramento',
                   'pro_reitoria','suplementar','unidade','departamento',
                   'comite_comissao','externo','outro') NULL,
  `parent_id` BIGINT UNSIGNED NULL,          -- órgão-pai (CGIRC -> Reitoria); permite roll-up
  `ativo`     TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sigla` (`sigla`),
  KEY `ix_parent` (`parent_id`),
  CONSTRAINT `fk_orgao_parent` FOREIGN KEY (`parent_id`) REFERENCES `orgao` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `orgao_alias`;
CREATE TABLE `orgao_alias` (
  `id`       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `orgao_id` BIGINT UNSIGNED NOT NULL,
  `alias`    VARCHAR(80) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_alias` (`alias`),
  KEY `ix_orgao` (`orgao_id`),
  CONSTRAINT `fk_alias_orgao` FOREIGN KEY (`orgao_id`) REFERENCES `orgao` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `pessoa`;
CREATE TABLE `pessoa` (
  `id`    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `siape` VARCHAR(10) NULL,
  `nome`  VARCHAR(160) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_siape` (`siape`),
  KEY `ix_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `boletim`;
CREATE TABLE `boletim` (
  `id`       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `numero`   SMALLINT UNSIGNED NOT NULL,
  `ano`      SMALLINT UNSIGNED NOT NULL,
  `data_pub` DATE NULL,
  `arquivo`  VARCHAR(120) NULL,
  `url_pdf`  VARCHAR(255) NULL,
  `paginas`  SMALLINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_num_ano` (`numero`, `ano`),
  KEY `ix_ano` (`ano`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `extracao`;
CREATE TABLE `extracao` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `executada_em` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `git_commit`   VARCHAR(40) NULL,
  `versao`       VARCHAR(20) NULL,
  `escopo`       VARCHAR(60) NULL,
  `n_atos`       INT NULL,
  `observacao`   VARCHAR(255) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- NÚCLEO ----------
DROP TABLE IF EXISTS `ato`;
CREATE TABLE `ato` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid`             VARCHAR(120) NOT NULL,
  `boletim_id`      BIGINT UNSIGNED NOT NULL,
  `tipo_id`         SMALLINT UNSIGNED NOT NULL,
  `orgao_id`        BIGINT UNSIGNED NOT NULL,
  `numero`          VARCHAR(32) NOT NULL,
  `numero_norm`     INT UNSIGNED NULL,
  `ano`             SMALLINT UNSIGNED NOT NULL,
  `sigla_orig`      VARCHAR(60) NULL,                -- sigla impressa no cabeçalho (identidade do ato)
  `data_ato`        DATE NULL,
  `ementa`          VARCHAR(600) NULL,
  `ementa_inferida` TINYINT(1) NOT NULL DEFAULT 0,
  `status`          ENUM('Ativo','Alterado','Revogado') NOT NULL DEFAULT 'Ativo',
  `processo_sei`    VARCHAR(32) NULL,
  `sei_documento`   VARCHAR(16) NULL,
  `secao`           VARCHAR(8) NULL,
  `pagina`          VARCHAR(8) NULL,
  `signatario_id`   BIGINT UNSIGNED NULL,
  `signatario_cargo` VARCHAR(80) NULL,               -- cargo ao assinar (Reitor, Presidente da Comissão...)
  `orgao_origem`    ENUM('texto','signatario','cabecalho','curadoria') NULL, -- de qual sinal veio o órgão
  `extracao_id`     BIGINT UNSIGNED NULL,
  `criado_em`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_uid` (`uid`),
  -- identidade = o que está IMPRESSO (sigla do cabeçalho), não o órgão derivado
  -- (este é enriquecimento e pode redistribuir catch-alls sem afetar a unicidade)
  UNIQUE KEY `uq_natural` (`boletim_id`, `tipo_id`, `sigla_orig`, `numero_norm`, `ano`),
  KEY `ix_tipo` (`tipo_id`), KEY `ix_orgao` (`orgao_id`), KEY `ix_ano` (`ano`),
  KEY `ix_status` (`status`), KEY `ix_data` (`data_ato`), KEY `ix_proc` (`processo_sei`),
  KEY `ix_boletim` (`boletim_id`),
  CONSTRAINT `fk_ato_boletim`   FOREIGN KEY (`boletim_id`)   REFERENCES `boletim` (`id`),
  CONSTRAINT `fk_ato_tipo`      FOREIGN KEY (`tipo_id`)      REFERENCES `tipo_ato` (`id`),
  CONSTRAINT `fk_ato_orgao`     FOREIGN KEY (`orgao_id`)     REFERENCES `orgao` (`id`),
  CONSTRAINT `fk_ato_signat`    FOREIGN KEY (`signatario_id`) REFERENCES `pessoa` (`id`) ON DELETE SET NULL,
  FULLTEXT KEY `ft_ementa` (`ementa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `ato_texto`;
CREATE TABLE `ato_texto` (
  `ato_id`         BIGINT UNSIGNED NOT NULL,
  `texto_original` MEDIUMTEXT NULL,
  `texto_busca`    MEDIUMTEXT NULL,
  PRIMARY KEY (`ato_id`),
  CONSTRAINT `fk_texto_ato` FOREIGN KEY (`ato_id`) REFERENCES `ato` (`id`) ON DELETE CASCADE,
  FULLTEXT KEY `ft_busca` (`texto_busca`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- FATOS ----------
DROP TABLE IF EXISTS `relacao`;
CREATE TABLE `relacao` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`         BIGINT UNSIGNED NOT NULL,
  `tipo`           ENUM('Revoga','Altera','Complementa') NOT NULL,
  `destino_ato_id` BIGINT UNSIGNED NULL,
  `destino_texto`  VARCHAR(200) NOT NULL,
  `destino_norm`   VARCHAR(200) NOT NULL,
  `externo`        TINYINT(1) NOT NULL DEFAULT 0,
  `trecho`         VARCHAR(255) NULL,
  `metodo`         VARCHAR(20) NULL,
  `extracao_id`    BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rel` (`ato_id`, `tipo`, `destino_norm`),
  KEY `ix_origem` (`ato_id`), KEY `ix_destino` (`destino_ato_id`), KEY `ix_externo` (`externo`),
  CONSTRAINT `fk_rel_ato`     FOREIGN KEY (`ato_id`)         REFERENCES `ato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rel_destino` FOREIGN KEY (`destino_ato_id`) REFERENCES `ato` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `ato_funcao`;
CREATE TABLE `ato_funcao` (
  `id`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`    BIGINT UNSIGNED NOT NULL,
  `acao`      ENUM('designar','dispensar') NOT NULL,
  `cargo`     VARCHAR(60) NOT NULL,
  `unidade`   VARCHAR(180) NOT NULL,          -- rótulo, como saiu do ato
  -- Chave normalizada da unidade: casa a MESMA unidade escrita de formas
  -- diferentes entre boletins. Sem ela a projeção agrupa pelo texto cru, e a
  -- unidade que mudou de grafia vira duas posições — a antiga fica para trás
  -- como titular fantasma de mandato vencido. O extrator já calcula isto
  -- (chave_unidade) e o portal-data.json já traz; v2 vinha descartando.
  `unidade_chave` VARCHAR(180) NOT NULL DEFAULT '',
  `orgao_id`  BIGINT UNSIGNED NULL,
  `pessoa_id` BIGINT UNSIGNED NULL,
  -- Mandato (só na designação; a dispensa encerra o mandato de OUTRO ato).
  -- A designação de chefia é AUTOLIMITADA: traz a própria validade ("com
  -- mandato de 04 (quatro) anos"). É por isso que o Boletim quase nunca
  -- publica revogação ao fim do mandato — seria redundante (medido: 83% das
  -- dispensas saem >90 dias ANTES do fim do prazo, ou seja, dispensa é saída
  -- ANTECIPADA). Logo o fim do mandato não existe como ato: só existe se for
  -- calculado daqui.
  `prazo_meses`   SMALLINT UNSIGNED NULL,     -- NULL = o ato não declarou prazo
  `data_inicio`   DATE NULL,                  -- quando o mandato começa a correr
  -- Proveniência de data_inicio — o painel precisa distinguir fato de
  -- aproximação, senão o gabinete lê uma data sem saber se é lei ou dedução:
  --   declarado -> "a partir de DD/MM/AAAA" escrito no ato
  --   tampao    -> completa mandato do antecessor ("iniciado em ..."); o
  --                relógio começou com ELE, não com este ato
  --   data_ato  -> nada declarado; usa a data do ato (aproximação)
  `inicio_origem` ENUM('declarado','tampao','data_ato') NULL,
  PRIMARY KEY (`id`),
  KEY `ix_ato` (`ato_id`), KEY `ix_cargo` (`cargo`), KEY `ix_pessoa` (`pessoa_id`),
  KEY `ix_chave` (`unidade_chave`, `cargo`),
  KEY `ix_mandato` (`acao`, `data_inicio`),
  CONSTRAINT `fk_func_ato`    FOREIGN KEY (`ato_id`)    REFERENCES `ato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_func_orgao`  FOREIGN KEY (`orgao_id`)  REFERENCES `orgao` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_func_pessoa` FOREIGN KEY (`pessoa_id`) REFERENCES `pessoa` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `ato_pessoa`;
CREATE TABLE `ato_pessoa` (
  `id`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`    BIGINT UNSIGNED NOT NULL,
  `pessoa_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ato_pessoa` (`ato_id`, `pessoa_id`),
  KEY `ix_pessoa` (`pessoa_id`),
  CONSTRAINT `fk_ap_ato`    FOREIGN KEY (`ato_id`)    REFERENCES `ato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ap_pessoa` FOREIGN KEY (`pessoa_id`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `tag`;
CREATE TABLE `tag` (
  `id`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome`      VARCHAR(60) NOT NULL,
  `categoria` VARCHAR(30) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `ato_tag`;
CREATE TABLE `ato_tag` (
  `ato_id` BIGINT UNSIGNED NOT NULL,
  `tag_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`ato_id`, `tag_id`),
  KEY `ix_tag` (`tag_id`),
  CONSTRAINT `fk_at_ato` FOREIGN KEY (`ato_id`) REFERENCES `ato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_at_tag` FOREIGN KEY (`tag_id`) REFERENCES `tag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `ato_aposentadoria`;
CREATE TABLE `ato_aposentadoria` (
  `ato_id`     BIGINT UNSIGNED NOT NULL,
  `tipo`       VARCHAR(20) NULL,
  `base_legal` VARCHAR(60) NULL,
  PRIMARY KEY (`ato_id`),
  CONSTRAINT `fk_apos_ato` FOREIGN KEY (`ato_id`) REFERENCES `ato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `ato_deslocamento`;
CREATE TABLE `ato_deslocamento` (
  `ato_id`  BIGINT UNSIGNED NOT NULL,
  `tipo`    VARCHAR(20) NULL,
  `direcao` VARCHAR(12) NULL,
  `motivo`  VARCHAR(30) NULL,
  `setor`   VARCHAR(60) NULL,
  PRIMARY KEY (`ato_id`),
  CONSTRAINT `fk_desl_ato` FOREIGN KEY (`ato_id`) REFERENCES `ato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `prazo`;
CREATE TABLE `prazo` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`      BIGINT UNSIGNED NOT NULL,
  `tipo`        VARCHAR(30) NULL,   -- inscrição/recurso/entrega/vigência/"prazo (N dias)"
  `data_limite` DATE NULL,
  `conf`        VARCHAR(10) NULL,   -- 'alta' | 'média'
  `base`        VARCHAR(20) NULL,   -- 'data no texto' | 'assinatura+N'
  `publico`     VARCHAR(60) NULL,   -- quem precisa agir (inferirPublico)
  `trecho`      VARCHAR(255) NULL,  -- snippet-origem p/ exibir
  PRIMARY KEY (`id`),
  KEY `ix_ato` (`ato_id`), KEY `ix_data` (`data_limite`),
  CONSTRAINT `fk_prazo_ato` FOREIGN KEY (`ato_id`) REFERENCES `ato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- ato_processo — TODOS os números de processo citados por um ato.
--
-- `ato.processo_sei` guarda UM número, o primeiro que aparece no texto. Medido
-- numa extração de 20.310 atos: 9.554 têm processo, mas o total de menções é
-- 17.040 — a coluna única descartava 44% das referências, e 1.500 atos citam
-- dois ou mais. Um ato que revoga outro cita o processo do revogado; uma
-- designação de fiscal cita o processo do contrato. Sem esta tabela, pesquisar
-- "quais atos falam deste processo" só encontrava aqueles em que ele calhou de
-- ser o primeiro.
--
-- `numero` guarda o número COMO ESTÁ NO TEXTO (com ponto, barra e hífen) e
-- `digitos` a versão só-dígitos, que é o que a busca usa: quem consulta digita
-- ora "23069.154690/2019-45", ora "23069154690201945", ora só "154690".
-- Comparar dígito a dígito evita depender da pontuação que o OCR às vezes come.
--
-- `ordem` preserva a posição no texto: ordem=1 é o mesmo número que está em
-- `ato.processo_sei`, mantido lá por compatibilidade com quem já consome o campo.
DROP TABLE IF EXISTS `ato_processo`;
CREATE TABLE `ato_processo` (
  `id`      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`  BIGINT UNSIGNED NOT NULL,
  `numero`  VARCHAR(32) NOT NULL,
  `digitos` VARCHAR(24) NOT NULL,
  `ordem`   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ato_processo` (`ato_id`, `digitos`),
  KEY `ix_digitos` (`digitos`),
  CONSTRAINT `fk_atoproc_ato` FOREIGN KEY (`ato_id`) REFERENCES `ato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- ato_comissao — liga um ato ao COLEGIADO PERMANENTE que ele menciona.
--
-- Alimenta a aba Comissões, que centraliza os comitês/comissões permanentes de
-- alcance institucional (CPA, CPPD, CEUA, Governança, Sustentabilidade...). A
-- lista dos corpos é CURADA (vive em comissoes_registro() no index_v2.php); esta
-- tabela é o índice que diz quais atos falam de cada um.
--
-- Por que uma tabela e não busca ao vivo: casar corpo↔ato exige FRASE ESTRITA
-- (LIKE), não FULLTEXT — o índice de texto tokeniza e "segurança da informação"
-- casaria "currículo de engenharia da informação". LIKE sobre 128 mil textos,
-- 23 corpos, por requisição, seria lento demais; aqui roda uma vez no backfill
-- e a cada import diário, e a rota só lê o índice pronto.
--
-- `comissao` é o SLUG do corpo no registro curado (ex.: 'cpa', 'ceua').
DROP TABLE IF EXISTS `ato_comissao`;
CREATE TABLE `ato_comissao` (
  `id`       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`   BIGINT UNSIGNED NOT NULL,
  `comissao` VARCHAR(32) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ato_comissao` (`ato_id`, `comissao`),
  KEY `ix_comissao` (`comissao`),
  CONSTRAINT `fk_atocom_ato` FOREIGN KEY (`ato_id`) REFERENCES `ato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- ato_ods — liga um ato a uma ODS. Racional em docs/METODOLOGIA-ODS.md;
-- comentários linha a linha em ato_ods.sql (o arquivo de migração avulso).
-- `vinculo` distingue proposta (ato fundador — a evidência que rankings e
-- controle pedem) de execução/pesquisa/ensino; `meta` ancora numa meta
-- nomeável THE/IPEA; `metodo` separa rótulo de IA da curadoria humana.
-- Alimentada por importar/backfill_ato_ods.php (upsert por uid).
DROP TABLE IF EXISTS `ato_ods`;
CREATE TABLE `ato_ods` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`        BIGINT UNSIGNED NOT NULL,
  `ods`           TINYINT UNSIGNED NOT NULL,
  `vinculo`       ENUM('proposta','execucao','pesquisa','ensino') NOT NULL,
  `confianca`     ENUM('alta','media','baixa') NOT NULL,
  `meta`          VARCHAR(40) NULL,
  `justificativa` VARCHAR(400) NULL,
  `metodo`        ENUM('ia','curadoria','ia+curadoria') NOT NULL DEFAULT 'ia',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ato_ods` (`ato_id`, `ods`),
  KEY `ix_ods` (`ods`, `vinculo`),
  KEY `ix_vinculo` (`vinculo`),
  CONSTRAINT `fk_atoods_ato` FOREIGN KEY (`ato_id`) REFERENCES `ato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
