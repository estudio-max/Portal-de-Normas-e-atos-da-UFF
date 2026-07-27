<?php
// ============================================================================
//  Backfill (uso pontual): carrega `ato_ods` a partir do JSON rotulado
//  (classificação híbrida IA + curadoria — ver docs/METODOLOGIA-ODS.md).
//
//  Diferente dos outros backfills, este NÃO deriva nada do texto no banco:
//  a classificação aconteceu offline (corpus completo lido pelo corpo,
//  clusters auditados, uid resolvido contra o dump). Aqui só se grava o
//  resultado, casando por `ato.uid` — o id público estável.
//
//  Upsert: INSERT ... ON DUPLICATE KEY UPDATE sobre a UNIQUE (ato_id, ods).
//  Linha marcada metodo='curadoria' NUNCA é sobrescrita pela IA — a curadoria
//  humana é a palavra final (regra do METODOLOGIA-ODS.md §8).
//
//  Uso (navegador, protegido por token; o JSON precisa estar NESTA pasta):
//    https://SEU_SITE/importar/backfill_ato_ods.php?token=SEU_TOKEN&arquivo=ato_ods_backfill.json
//  Opcional &recomecar=1: apaga antes as linhas metodo='ia' (preserva curadoria).
//  Uso (CLI):
//    php backfill_ato_ods.php ato_ods_backfill.json [--recomecar]
// ============================================================================

set_time_limit(0);
@ini_set('memory_limit', '512M');

$raiz = dirname(__DIR__);
require $raiz . '/api/db.php';
$cfg = carregar_config();

$cli = (PHP_SAPI === 'cli');
if (!$cli) {
    ignore_user_abort(true);
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Accel-Buffering: no');
    while (ob_get_level()) { @ob_end_flush(); }
    $token = $cfg['import_token'] ?? '';
    if ($token === '' || !hash_equals($token, (string)($_GET['token'] ?? ''))) {
        http_response_code(403);
        exit("Acesso negado. Use ?token=...\n");
    }
    $arquivo   = basename($_GET['arquivo'] ?? 'ato_ods_backfill.json');
    $recomecar = !empty($_GET['recomecar']);
} else {
    $arquivo   = basename($argv[1] ?? 'ato_ods_backfill.json');
    $recomecar = in_array('--recomecar', $argv, true);
}
function log_($m) { echo $m . "\n"; @flush(); }

$caminho = __DIR__ . '/' . $arquivo;   // basename() acima: só aceita arquivo desta pasta
if (!is_file($caminho)) {
    http_response_code(404);
    exit("Arquivo não encontrado em importar/: $arquivo\n");
}
$linhas = json_decode(file_get_contents($caminho), true);
if (!is_array($linhas)) exit("JSON inválido em $arquivo\n");
log_("Lidas " . count($linhas) . " linhas de $arquivo.");

$pdo = conectar($cfg);

if ($recomecar) {
    $n = $pdo->exec("DELETE FROM ato_ods WHERE metodo = 'ia'");
    log_("Recomeço: $n linhas metodo='ia' removidas (curadoria preservada).");
}

$selAto = $pdo->prepare("SELECT id FROM ato WHERE uid = :uid");
// Precedência: a CURADORIA vence sempre.
//   - linha nova marcada 'curadoria' -> sobrescreve o que estiver lá;
//   - linha nova 'ia' sobre uma 'curadoria' existente -> não toca em nada;
//   - 'ia' sobre 'ia' -> atualiza normalmente.
// `metodo` sem VALUES() é o valor JÁ GRAVADO; com VALUES(), o que está
// chegando. O assign de `metodo` fica por ÚLTIMO de propósito: o MySQL avalia
// as atribuições da esquerda para a direita, então as linhas acima ainda
// enxergam o método antigo.
$ins = $pdo->prepare(
    "INSERT INTO ato_ods (ato_id, ods, vinculo, confianca, meta, justificativa, metodo)
     VALUES (:ato_id, :ods, :vinculo, :confianca, :meta, :justificativa, :metodo)
     ON DUPLICATE KEY UPDATE
       vinculo       = IF(VALUES(metodo) = 'curadoria' OR metodo <> 'curadoria', VALUES(vinculo),       vinculo),
       confianca     = IF(VALUES(metodo) = 'curadoria' OR metodo <> 'curadoria', VALUES(confianca),     confianca),
       meta          = IF(VALUES(metodo) = 'curadoria' OR metodo <> 'curadoria', VALUES(meta),          meta),
       justificativa = IF(VALUES(metodo) = 'curadoria' OR metodo <> 'curadoria', VALUES(justificativa), justificativa),
       metodo        = IF(VALUES(metodo) = 'curadoria', 'curadoria', metodo)");

$ok = 0; $curados = 0; $semUid = []; $invalidas = 0;
$cacheUid = [];   // o mesmo uid aparece em várias linhas (1 por ODS)
foreach ($linhas as $l) {
    $uid = trim($l['uid'] ?? '');
    $ods = (int)($l['ods'] ?? 0);
    $vin = $l['vinculo'] ?? '';
    if ($uid === '' || $ods < 1 || $ods > 17 ||
        !in_array($vin, ['proposta', 'execucao', 'pesquisa', 'ensino'], true)) {
        $invalidas++;
        continue;
    }
    if (!array_key_exists($uid, $cacheUid)) {
        $selAto->execute([':uid' => $uid]);
        $cacheUid[$uid] = $selAto->fetchColumn() ?: null;
    }
    $atoId = $cacheUid[$uid];
    if ($atoId === null) { $semUid[$uid] = true; continue; }
    $ins->execute([
        ':ato_id'        => $atoId,
        ':ods'           => $ods,
        ':vinculo'       => $vin,
        ':confianca'     => in_array($l['confianca'] ?? '', ['alta', 'media', 'baixa'], true)
                              ? $l['confianca'] : 'baixa',
        ':meta'          => mb_substr($l['meta'] ?? '', 0, 40),
        ':justificativa' => mb_substr($l['justificativa'] ?? '', 0, 400),
        ':metodo'        => in_array($l['metodo'] ?? '', ['ia', 'curadoria', 'ia+curadoria'], true)
                              ? $l['metodo'] : 'ia',
    ]);
    $ok++;
    if (($l['metodo'] ?? '') === 'curadoria') $curados++;
}

log_("Gravadas/atualizadas: $ok linhas" . ($curados ? " (destas, $curados de curadoria)." : "."));
if ($invalidas) log_("Linhas inválidas ignoradas: $invalidas.");
if ($semUid) {
    log_("uids não encontrados no banco (" . count($semUid) . ") — vão para curadoria:");
    foreach (array_slice(array_keys($semUid), 0, 30) as $u) log_("  $u");
    if (count($semUid) > 30) log_("  … e mais " . (count($semUid) - 30));
}

// Invalida o cache de resposta (mesmo gesto do importador e dos outros
// backfills): a rota /api/ods é diário-estática e cacheada em disco.
$cacheDir = dirname(__DIR__) . '/api/cache';
if (is_dir($cacheDir)) {
    $limpos = 0;
    foreach (glob($cacheDir . '/*.json') ?: [] as $f) { if (@unlink($f)) $limpos++; }
    log_("Cache da API invalidado: $limpos arquivo(s).");
}

log_('');
log_('Confira: SELECT ods, vinculo, COUNT(*) FROM ato_ods GROUP BY ods, vinculo ORDER BY ods;');
