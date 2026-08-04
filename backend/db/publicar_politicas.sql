-- ============================================================================
--  publicar_politicas.sql — tira o selo "catálogo em revisão" das políticas.
--
--  RODE SÓ DEPOIS DE REVISAR `dados/curadoria_politicas.csv`. Enquanto a
--  política está em `rascunho`, o portal exibe o selo dizendo que os vínculos
--  foram propostos por regra e não passaram por revisão humana. Publicar antes
--  de revisar é afirmar uma conferência que não aconteceu.
--
--  No phpMyAdmin: aba Importar (é DML, não tem saída para exibir).
--
--  ---------------------------------------------------------------------------
--  ANTES DE RODAR, decida uma coisa por política, no CSV:
--
--    - os vínculos com `confianca=media` entraram pelo ÓRGÃO EMISSOR, sem a
--      frase da política na ementa. São 24 na assistência estudantil. Se algum
--      estiver errado, corrija ANTES: depois de publicado, ele aparece sem
--      nenhum selo de ressalva.
--    - `papel` errado é o defeito mais visível: ele muda a faixa de etapas do
--      cartão. Confira sobretudo os `fundador`.
--
--  Corrigir um vínculo à mão, preservando-o de futuras reaplicações do seed:
--
--    UPDATE ato_politica ap
--      JOIN ato a      ON a.id = ap.ato_id
--      JOIN politica p ON p.id = ap.politica_id
--       SET ap.papel = 'governanca', ap.metodo = 'regra+curadoria',
--           ap.revisado_em = NOW()
--     WHERE a.uid = 'uid-do-ato' AND p.slug = 'slug-da-politica';
--
--  O `metodo='regra+curadoria'` é o que faz a linha sobreviver ao DELETE
--  guardado do seed. Sem ele, a próxima regeneração desfaz a correção.
-- ============================================================================

-- 1) PUBLICAR. Ajuste a lista para as que você revisou — publicar todas de uma
--    vez só faz sentido se você conferiu todas.
UPDATE `politica`
   SET `status_curadoria` = 'publicada'
 WHERE `slug` IN (
   'assistencia-estudantil',
   'acessibilidade',
   'acoes-afirmativas',
   'assedio',
   'integridade-riscos',
   'seguranca-informacao',
   'sustentabilidade'
 )
   AND `status_curadoria` = 'rascunho';

-- 2) CONFERIR (aba SQL, não Importar). Esperado: 7 publicadas, 0 rascunho.
--    Se alguma continuar em rascunho, ela não estava na lista acima.
SELECT `status_curadoria`, COUNT(*) AS politicas
  FROM `politica`
 GROUP BY `status_curadoria`;

-- 3) VOLTAR ATRÁS, se publicou cedo demais. O selo reaparece na hora seguinte
--    (o cache da rota dura 10 min, ou some no próximo import).
-- UPDATE `politica` SET `status_curadoria` = 'rascunho'
--  WHERE `status_curadoria` = 'publicada';
