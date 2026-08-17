-- ============================================================================
-- ato_revalidacao — revalidação/reconhecimento de diploma obtido no exterior.
--
-- SEM O NOME DA PESSOA, e isso é a decisão central desta tabela, não um campo
-- esquecido. Decidido pelo mantenedor em 16/08/2026: o painel responde "quais
-- cursos, instituições e países a UFF mais defere/indefere", para orientar
-- quem está pensando em pedir revalidação — e não "quem pediu". São pessoas
-- PRIVADAS, não servidores. Um indeferimento enterrado num PDF de 177 páginas
-- é diferente de uma lista navegável de negados.
--
-- A ausência do nome é ESTRUTURAL de propósito: quem consultar esta tabela no
-- futuro não tem como expor a pessoa por descuido, porque o dado não está
-- aqui. O ato individual segue acessível pela busca normal, via `ato`.
--
-- DUAS VIAS, porque são dois processos distintos, com normas, colegiados e
-- taxas de deferimento diferentes (medido em 18 boletins de produção):
--   Graduação      Resolução CEPEx "Revalidação do Diploma" — Res. 3.790/2024.
--                  26 deferidos / 20 indeferidos na amostra.
--   Pós-graduação  Resolução "Reconhecimento do Título" (Plataforma Carolina
--                  Bori) — Res. 583/2017. 15 deferidos / 6 indeferidos.
-- Somar as duas num número só apaga justamente a diferença que interessa a
-- quem vai pedir: a graduação indefere quase o dobro, proporcionalmente.
--
-- `pais` já vem CANONIZADO do extrator (extrai_revalidacao em
-- tools/extrair_boletim.py): a fonte escreve "EUA" e "Estados Unidos da
-- América" para o mesmo país, e chegou a digitar "Aústria" com o acento
-- trocado. Sem canonizar, o mesmo país vira duas fatias do gráfico. Os nomes
-- são os MESMOS de coop_paises() no index_v2.php, para que o mapa reaproveite
-- as coordenadas em vez de manter duas listas que divergem com o tempo.
--
-- Um ato decide UM pedido — daí a chave natural ser `ato_id` sozinho. Se algum
-- dia aparecer resolução que decide vários pedidos de uma vez, esta UNIQUE é
-- o lugar onde isso vai estourar de forma visível, em vez de gravar só o
-- primeiro em silêncio.
--
-- `curso` e `instituicao` ficam FORA dos índices de propósito: são VARCHAR(180)
-- e, em utf8mb4, 180 caracteres = 720 bytes — perto do limite de 767 bytes por
-- coluna indexada em InnoDB com formato de linha antigo. Os agrupamentos do
-- painel são por `via`, `decisao` e `pais`, todos curtos e indexados.
--
-- Percona 5.7: sem CHECK constraint (aceita e ignora), sem window function,
-- sem CTE. As taxas do painel saem de GROUP BY + SUM(decisao='Deferido').
--
-- Rodar no phpMyAdmin ANTES do primeiro import que traga `revalidacao`.
-- ============================================================================
CREATE TABLE IF NOT EXISTS `ato_revalidacao` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`      BIGINT UNSIGNED NOT NULL,
  `via`         ENUM('Graduação','Pós-graduação') NOT NULL,
  `decisao`     ENUM('Deferido','Indeferido') NOT NULL,
  -- Nível do título. Na graduação vem escrito no dispositivo; na pós sai da
  -- equivalência brasileira declarada ("como equivalente ao de Doutorado em
  -- Filosofia"). Vazio quando o ato não declara — não se infere.
  `nivel`       VARCHAR(20)  NULL,
  `curso`       VARCHAR(180) NULL,
  `instituicao` VARCHAR(180) NULL,
  -- Vazio quando o dispositivo não nomeia o país. Melhor lacuna honesta que
  -- palpite: 4% dos casos medidos não declaram, e adivinhar pelo nome da
  -- instituição erra em casos como universidades com nome em espanhol fora da
  -- América Latina.
  `pais`        VARCHAR(60)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ato_revalidacao` (`ato_id`),
  KEY `ix_via_decisao` (`via`, `decisao`),
  KEY `ix_pais` (`pais`, `via`),
  CONSTRAINT `fk_atorevalidacao_ato` FOREIGN KEY (`ato_id`) REFERENCES `ato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
