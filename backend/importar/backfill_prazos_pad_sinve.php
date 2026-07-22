<?php
// ============================================================================
//  Backfill (uso pontual): popula TODOS os prazos PAD/SINVE do acervo de uma
//  vez, usando o MESMO extrator do import diário (extrair_prazos_pad_sinve.php)
//  -- então backfill e import diário produzem linhas idênticas por construção.
//
//  Necessário porque o import diário só processa os atos do lote do dia; os
//  atos históricos de PAD/SINVE (2001-2026, espalhados por todos os boletins)
//  precisam de uma passada única sobre o que já está no banco.
//
//  Namespace isolado: mexe SÓ nas linhas base='PAD_SINVE'. Os prazos genéricos
//  (Radar comum) ficam intactos.
//
//  Uso (navegador, protegido por token):
//    https://SEU_SITE/importar/backfill_prazos_pad_sinve.php?token=SEU_TOKEN
//  Uso (CLI):
//    php backfill_prazos_pad_sinve.php
// ============================================================================

set_time_limit(0);

$raiz = dirname(__DIR__);
require $raiz . '/api/db.php';
require_once __DIR__ . '/extrair_prazos_pad_sinve.php';
$cfg = carregar_config();

$cli = (PHP_SAPI === 'cli');
if (!$cli) {
    header('Content-Type: text/plain; charset=utf-8');
    $token = $cfg['import_token'] ?? '';
    if ($token === '' || ($_GET['token'] ?? '') !== $token) {
        http_response_code(403);
        exit("Acesso negado. Use ?token=...\n");
    }
}
function log_($m) { echo $m . "\n"; @flush(); }

$pdo = conectar($cfg);

// Candidatos: mesma seleção FULLTEXT do dump_pad_sinve.php (usa índice ft_busca)
$sql = "
    SELECT a.id, a.data_ato, a.ementa, tx.texto_original
    FROM ato a
    JOIN ato_texto tx ON tx.ato_id = a.id
    WHERE MATCH(tx.texto_busca) AGAINST('+processo +administrativo +disciplinar' IN BOOLEAN MODE)
       OR MATCH(tx.texto_busca) AGAINST('+sindicancia +investigat*' IN BOOLEAN MODE)
       OR MATCH(tx.texto_busca) AGAINST('+sindicância +investigat*' IN BOOLEAN MODE)
       OR a.ementa LIKE '%processo administrativo disciplinar%'
       OR a.ementa LIKE '%sindic%investigat%'
";
$candidatos = $pdo->query($sql)->fetchAll();
log_("Candidatos PAD/SINVE no acervo: " . count($candidatos));

$del = $pdo->prepare("DELETE FROM prazo WHERE base='PAD_SINVE'");
$ins = $pdo->prepare("INSERT INTO prazo (ato_id,tipo,data_limite,conf,base,publico,trecho)
                      VALUES (:id,:tp,:dl,:cf,:bs,:pb,:tr)");

$pdo->beginTransaction();
try {
    $removidos = $del->execute() ? $del->rowCount() : 0;
    log_("Linhas base='PAD_SINVE' removidas (recomeço limpo): $removidos");

    $inseridos = 0;
    $por_tipo = ['PAD' => 0, 'PAD_SUMARIO' => 0, 'SINVE' => 0, 'SINDACUS' => 0];
    foreach ($candidatos as $a) {
        $ementaP = (string)($a['ementa'] ?? '');
        $textoP  = (string)($a['texto_original'] ?? '');
        $dataP   = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($a['data_ato'] ?? '')) ? $a['data_ato'] : null;
        foreach (extrair_prazos_pad_sinve($ementaP, $textoP, $dataP) as $pz) {
            $ins->execute([
                ':id' => $a['id'], ':tp' => mb_substr($pz['tipo'], 0, 30, 'UTF-8'),
                ':dl' => $pz['dataLimite'], ':cf' => $pz['conf'], ':bs' => $pz['base'],
                ':pb' => mb_substr($pz['publico'], 0, 60, 'UTF-8'),
                ':tr' => mb_substr($pz['origem'], 0, 255, 'UTF-8'),
            ]);
            $inseridos++;
            if (isset($por_tipo[$pz['tipo']])) $por_tipo[$pz['tipo']]++;
        }
    }
    $pdo->commit();
    log_("OK. Prazos PAD/SINVE inseridos: $inseridos");
    log_("  PAD=$por_tipo[PAD] | PAD_SUMARIO=$por_tipo[PAD_SUMARIO] | SINVE=$por_tipo[SINVE] | SINDACUS=$por_tipo[SINDACUS]");
    $tot = (int)$pdo->query("SELECT COUNT(*) FROM prazo")->fetchColumn();
    $ps  = (int)$pdo->query("SELECT COUNT(*) FROM prazo WHERE base='PAD_SINVE'")->fetchColumn();
    log_("Tabela prazo agora: $tot total | $ps com base='PAD_SINVE'.");
} catch (Throwable $e) {
    $pdo->rollBack();
    http_response_code(500);
    log_("ERRO (rollback): " . $e->getMessage());
}
