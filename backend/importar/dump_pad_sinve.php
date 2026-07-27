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
//
//  SOMENTE CLI -- e isto e uma guarda de seguranca, nao conveniencia.
//  Ate 27/07/2026 este arquivo respondia por HTTP sem token nenhum e devolvia
//  4,5 MB de JSON com o texto_original de todo ato de PAD/sindicancia: nomes,
//  SIAPE e o teor de processos disciplinares, para quem digitasse a URL. O
//  nome do arquivo esta no repositorio publico, entao nao havia nem o que
//  adivinhar. Os outros scripts desta pasta checam `import_token`; este ficou
//  de fora porque nasceu como diagnostico de uso unico -- exatamente o
//  endpoint esquecido que uma varredura procura.
//
//  Nao troque por checagem de token: esta rota nao tem motivo para existir na
//  web. Ela contorna de proposito o limite da API publica, que nunca expoe
//  texto_original. Se precisar do dump de novo, rode pelo cron/SSH.
// ============================================================================

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    exit("Este script e somente CLI.\n");
}

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
