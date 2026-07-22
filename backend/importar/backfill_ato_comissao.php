<?php
// ============================================================================
//  Backfill (uso pontual): preenche `ato_comissao` — liga cada ato aos
//  colegiados permanentes que ele menciona — para todo o acervo de uma vez.
//
//  Usa o MESMO casamento por frase do import diário (comissoes_match.php),
//  então backfill e import produzem linhas idênticas. Aqui, porém, o LIKE roda
//  no MySQL: é uma junção INSERT ... SELECT por corpo, direto no banco, o que
//  é muito mais rápido que puxar 128 mil textos para o PHP.
//
//  Compatível com Percona/MySQL 5.7 (só LIKE; nada de 8.0).
//
//  Uso (navegador, protegido por token):
//    https://SEU_SITE/importar/backfill_ato_comissao.php?token=SEU_TOKEN
//  Uso (CLI):
//    php backfill_ato_comissao.php
// ============================================================================

set_time_limit(0);
@ini_set('memory_limit', '512M');

$raiz = dirname(__DIR__);
require $raiz . '/api/db.php';
require_once __DIR__ . '/comissoes_match.php';
$cfg = carregar_config();

$cli = (PHP_SAPI === 'cli');
if (!$cli) {
    ignore_user_abort(true);
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Accel-Buffering: no');
    while (ob_get_level()) { @ob_end_flush(); }
    $token = $cfg['import_token'] ?? '';
    if ($token === '' || ($_GET['token'] ?? '') !== $token) {
        http_response_code(403);
        exit("Acesso negado. Use ?token=...\n");
    }
}
function log_($m) { echo $m . "\n"; @flush(); }

$pdo = conectar($cfg);

$n = $pdo->exec("DELETE FROM ato_comissao");
log_("Recomeço limpo: $n linhas removidas de ato_comissao.");

// Uma junção por corpo. O LIKE bate SÓ na EMENTA (a ementa declara o que o ato
// é; casar o corpo trazia falso positivo — "segurança da informação" no corpo
// de currículos, "ações afirmativas" em editais). E uma GUARDA: a ementa tem
// que citar um colegiado, senão "Política de Segurança da Informação"
// (documento, não o Comitê) entraria. utf8mb4_unicode_ci já ignora acento/caixa.
// Cada corpo pode ter VÁRIAS frases (o nome mudou ao longo dos anos); o termo
// vem separado por '|'. Monto um OR de LIKE por variante, mais a guarda.
$guarda = "(a.ementa LIKE '%comiss%' OR a.ementa LIKE '%comit%'"
        . " OR a.ementa LIKE '%câmara%' OR a.ementa LIKE '%conselho%')";

$total = 0;
foreach (comissoes_termos() as $slug => $termos) {
    $variantes = explode('|', $termos);
    $ors = implode(' OR ', array_map(fn($i) => "a.ementa LIKE :t$i", array_keys($variantes)));
    $ins = $pdo->prepare("INSERT IGNORE INTO ato_comissao (ato_id, comissao)
        SELECT a.id, :slug FROM ato a WHERE ($ors) AND $guarda");
    $params = [':slug' => $slug];
    foreach ($variantes as $i => $v) $params[":t$i"] = '%' . trim($v) . '%';
    $ins->execute($params);
    $n = $ins->rowCount();
    $total += $n;
    log_(sprintf('  %-14s %5d atos  «%s»', $slug, $n, $termos));
}

log_('');
log_("OK. $total ligações ato→comissão gravadas para " . count(comissoes_termos()) . " corpos.");
log_('Confira: SELECT comissao, COUNT(*) FROM ato_comissao GROUP BY comissao;');
