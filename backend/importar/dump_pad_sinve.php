<?php
// ============================================================================
//  Diagnóstico (uso único, não faz parte do pipeline regular): extrai TODOS
//  os atos que mencionam "processo administrativo disciplinar" ou "sindicância
//  investigat(iva|ória)" com o TEXTO INTEGRAL (ementa + corpo), para análise
//  offline (desenho da categoria PAD/SINVE do Radar de Prazos). A API pública
//  nunca expõe texto_original (só ementa) -- este script é o único jeito de
//  obter o corpo completo em lote sem sobrecarregar o endpoint público.
//
//  Uso (CLI, uma vez):
//      php dump_pad_sinve.php > pad_sinve.json
// ============================================================================

set_time_limit(0);

$raiz = dirname(__DIR__);
require $raiz . '/api/db.php';
$cfg = carregar_config();
$pdo = conectar($cfg);

// FULLTEXT (usa o índice ft_busca) em vez de LIKE '%...%' -- um scan completo
// do MEDIUMTEXT em 128 mil linhas estourava o tempo de execução via navegador.
$sql = "
    SELECT a.uid, t.nome AS tipo, o.sigla, a.numero, a.numero_norm, a.ano, a.data_ato,
           a.ementa, a.processo_sei, a.status, b.arquivo AS boletim_arquivo,
           tx.texto_original
    FROM ato a
    JOIN tipo_ato t   ON t.id = a.tipo_id
    JOIN orgao o      ON o.id = a.orgao_id
    JOIN ato_texto tx ON tx.ato_id = a.id
    LEFT JOIN boletim b ON b.id = a.boletim_id
    WHERE MATCH(tx.texto_busca) AGAINST('+processo +administrativo +disciplinar' IN BOOLEAN MODE)
       OR MATCH(tx.texto_busca) AGAINST('+sindicancia +investigat*' IN BOOLEAN MODE)
       OR MATCH(tx.texto_busca) AGAINST('+sindicância +investigat*' IN BOOLEAN MODE)
       OR a.ementa LIKE '%processo administrativo disciplinar%'
       OR a.ementa LIKE '%sindic%investigat%'
    ORDER BY a.data_ato ASC, a.id ASC
";
$st = $pdo->query($sql);
$linhas = $st->fetchAll();

if (PHP_SAPI === 'cli') {
    fwrite(STDERR, "encontrados: " . count($linhas) . "\n");
} else {
    header('Content-Type: application/json; charset=utf-8');
}
echo json_encode($linhas, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
