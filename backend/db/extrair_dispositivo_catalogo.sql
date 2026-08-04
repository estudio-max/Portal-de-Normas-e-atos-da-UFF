-- ============================================================================
--  extrair_dispositivo_catalogo.sql — o corpo dos atos do catálogo, para medir
--  obrigações sem mexer em produção.
--
--  POR QUE ESTE ARQUIVO EXISTE
--  ---------------------------
--  O Radar de Obrigações (módulo 4.1) foi medido sobre o acervo inteiro e o
--  desenho original não se sustentou: o `deverá` do corpus é texto de edital
--  dirigido a uma pessoa ("o candidato deverá apresentar"), não obrigação
--  institucional. Evidência em `tools/medir_obrigacoes.py`.
--
--  O caminho que sobrou é o inverso — procurar obrigação DENTRO das políticas e
--  comissões já catalogadas, onde o universo é pequeno e o responsável é
--  conhecido. Para medir isso falta o DISPOSITIVO desses atos, e ele não está
--  ao alcance: a API expõe ementa, não corpo, e o extrato local
--  (`tools/portal-data-extrato-reprocessado.json`) não cobre nenhum dos 136
--  atos do catálogo — zero casam por uid.
--
--  Este SELECT resolve isso sem alterar a API nem publicar nada: roda no
--  phpMyAdmin, você exporta o resultado, e a medição acontece offline.
--
--  COMO USAR
--  ---------
--  1. phpMyAdmin → banco selecionado → aba **SQL** (não Importar: aqui há
--     resultado para ver).
--  2. Cole e execute.
--  3. No rodapé do resultado: **Exportar** → formato **CSV** → marque
--     "Colocar nomes dos campos na primeira linha" → Executar.
--  4. Salve como `dados/dispositivo_catalogo.csv`.
--
--  São ~520 linhas. `LEFT(tx.texto_original, 8000)` corta o corpo em 8 mil
--  caracteres: o dispositivo de um ato normativo cabe folgado nisso, e o corte
--  evita um CSV de dezenas de MB por causa de anexos longos.
--
--  NÃO expõe nada que já não seja público: é o mesmo texto do PDF do Boletim,
--  que a busca já indexa. O recorte aqui é só de conveniência.
-- ============================================================================

SELECT a.uid,
       t.nome                AS tipo,
       o.sigla               AS orgao,
       a.numero,
       a.ano,
       a.data_ato,
       a.status,
       'politica'            AS origem,
       p.slug                AS entidade,
       ap.papel              AS papel,
       REPLACE(REPLACE(COALESCE(a.ementa, ''), '\r', ' '), '\n', ' ')     AS ementa,
       REPLACE(REPLACE(LEFT(COALESCE(tx.texto_original, ''), 8000), '\r', ' '), '\n', ' ') AS dispositivo
  FROM ato_politica ap
  JOIN politica p      ON p.id = ap.politica_id
  JOIN ato a           ON a.id = ap.ato_id
  JOIN tipo_ato t      ON t.id = a.tipo_id
  JOIN orgao o         ON o.id = a.orgao_id
  LEFT JOIN ato_texto tx ON tx.ato_id = a.id

UNION ALL

SELECT a.uid,
       t.nome                AS tipo,
       o.sigla               AS orgao,
       a.numero,
       a.ano,
       a.data_ato,
       a.status,
       'comissao'            AS origem,
       ac.comissao           AS entidade,
       NULL                  AS papel,
       REPLACE(REPLACE(COALESCE(a.ementa, ''), '\r', ' '), '\n', ' ')     AS ementa,
       REPLACE(REPLACE(LEFT(COALESCE(tx.texto_original, ''), 8000), '\r', ' '), '\n', ' ') AS dispositivo
  FROM ato_comissao ac
  JOIN ato a           ON a.id = ac.ato_id
  JOIN tipo_ato t      ON t.id = a.tipo_id
  JOIN orgao o         ON o.id = a.orgao_id
  LEFT JOIN ato_texto tx ON tx.ato_id = a.id

ORDER BY origem, entidade, ano DESC, numero;
