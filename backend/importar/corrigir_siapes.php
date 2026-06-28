<?php
// ============================================================================
//  corrigir_siapes.php — Correção pontual de SIAPEs faltantes no banco
//
//  O regex antigo não capturava o padrão "SIAPE:1234567" (com dois-pontos).
//  Este script relê ato_corpo.texto e insere os SIAPEs que passaram em branco.
//  Usa INSERT IGNORE → idempotente: pode rodar mais de uma vez sem duplicar.
//
//  Uso (CLI — recomendado):
//    /usr/local/bin/ea-php83 /home2/fanara87/uff.fanara.com.br/importar/corrigir_siapes.php
//    ... corrigir_siapes.php --dry-run    (lista o que seria inserido, sem alterar)
//
//  Uso (web, com token do config.php):
//    https://uff.fanara.com.br/importar/corrigir_siapes.php?token=SEU_SEGREDO
//
//  Após confirmar que os números fazem sentido, delete este arquivo do servidor.
// ============================================================================

$raiz = dirname(__DIR__);
require $raiz . '/api/db.php';
$cfg = carregar_config();

$cli = (PHP_SAPI === 'cli');
$dry = $cli && in_array('--dry-run', $argv ?? []);

if (!$cli) {
    header('Content-Type: text/plain; charset=utf-8');
    $token = $cfg['import_token'] ?? '';
    if ($token === '' || ($_GET['token'] ?? '') !== $token) {
        http_response_code(403);
        exit("Acesso negado.\n");
    }
}

function out(string $m): void { echo $m . "\n"; @flush(); }

$pdo = conectar($cfg);

// Regex equivalente ao Python corrigido:
// (?:SIAPE|Matrícula SIAPE)[:\s]*n?[ºo°]?\.?\s*(\d{6,7})
// Flags: i = case-insensitive (texto no banco está em minúsculas)
//        u = UTF-8 (para í, º, °)
$RE = '/(?:SIAPE|Matr[íi]cula\s+SIAPE)[:\s]*n?[ºo°]?\.?\s*(\d{6,7})/iu';

$ins = $dry ? null : $pdo->prepare(
    'INSERT IGNORE INTO ato_siapes (ato_id, siape) VALUES (?, ?)'
);

$n_atos = $n_novos = $n_existiam = 0;
$offset = 0;
$lote   = 500;

out(($dry ? '[DRY RUN] ' : '') . 'Iniciando varredura em ato_corpo...');

while (true) {
    $q = $pdo->prepare('SELECT ato_id, texto FROM ato_corpo LIMIT ? OFFSET ?');
    $q->bindValue(1, $lote, PDO::PARAM_INT);
    $q->bindValue(2, $offset, PDO::PARAM_INT);
    $q->execute();
    $rows = $q->fetchAll();
    if (!$rows) break;

    foreach ($rows as $row) {
        $n_atos++;
        if (!preg_match_all($RE, $row['texto'], $m)) continue;

        foreach (array_unique($m[1]) as $siape) {
            // INSERT IGNORE retorna rowCount=0 se a linha já existia
            if ($dry) {
                $chk = $pdo->prepare(
                    'SELECT 1 FROM ato_siapes WHERE ato_id=? AND siape=? LIMIT 1'
                );
                $chk->execute([$row['ato_id'], $siape]);
                if ($chk->fetch()) { $n_existiam++; continue; }
                out("  NOVO | {$row['ato_id']} | $siape");
                $n_novos++;
            } else {
                $ins->execute([$row['ato_id'], $siape]);
                if ($ins->rowCount() > 0) {
                    out("  NOVO | {$row['ato_id']} | $siape");
                    $n_novos++;
                } else {
                    $n_existiam++;
                }
            }
        }
    }
    $offset += $lote;
}

out('');
out('=== ' . ($dry ? 'DRY RUN — nenhuma alteração feita' : 'Concluído') . ' ===');
out("Atos varridos    : $n_atos");
out("SIAPEs inseridos : $n_novos");
out("Já existiam      : $n_existiam");
