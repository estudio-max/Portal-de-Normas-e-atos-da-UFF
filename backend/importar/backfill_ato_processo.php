<?php
// ============================================================================
//  Backfill (uso pontual): popula `ato_processo` com TODOS os números de
//  processo citados no texto de cada ato do acervo.
//
//  Por que existe: `ato.processo_sei` guarda UM número, o primeiro do texto.
//  Medido no dump de produção, o texto dos atos traz 156.290 menções contra
//  49.667 atos com a coluna preenchida — a coluna única descartava a maioria
//  das referências. Um ato que revoga outro cita o processo do revogado; uma
//  designação de fiscal cita o do contrato. Sem esta tabela, "quais atos falam
//  deste processo" só achava aqueles em que ele calhou de vir primeiro.
//
//  Por que em PHP e não em SQL: o banco é Percona 5.7, e REGEXP_SUBSTR /
//  REGEXP_REPLACE só existem no MySQL 8. Em 5.7 não há como extrair N
//  ocorrências de um padrão dentro de um TEXT em SQL puro.
//
//  O import diário já grava esta tabela (importar_v2.php). Este script é a
//  passada única sobre o que já está no banco, e usa O MESMO padrão, então os
//  dois produzem linhas idênticas por construção.
//
//  Uso (navegador, protegido por token):
//    https://SEU_SITE/importar/backfill_ato_processo.php?token=SEU_TOKEN
//  Retomar de onde parou, se estourar o tempo:
//    ...&desde=45000
//  Uso (CLI):
//    php backfill_ato_processo.php
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
    if ($token === '' || ($_GET['token'] ?? '') !== $token) {
        http_response_code(403);
        exit("Acesso negado. Use ?token=...\n");
    }
}
function log_($m) { echo $m . "\n"; @flush(); }

// MESMO padrão do extrator (PROC_RE em tools/extrair_boletim.py), com o
// separador afrouxado: o OCR troca ponto por barra, duplica a barra ou come o
// separador inteiro. Medido no dump: afrouxar acha 560 processos a mais
// ("23069072996/2011-27", "23069.030603/2008/11"), todos legítimos.
const PROC_RE = '/23069[^0-9A-Za-z]{0,2}\d{6}[^0-9A-Za-z]{0,2}\d{4}[^0-9A-Za-z]{0,2}\d{2}/';

$pdo = conectar($cfg);

$desde = (int)($_GET['desde'] ?? ($argv[1] ?? 0));
$LOTE  = 2000;

$ins = $pdo->prepare("INSERT IGNORE INTO ato_processo (ato_id,numero,digitos,ordem)
                      VALUES (:id,:num,:dig,:ord)");

if ($desde === 0) {
    $n = $pdo->exec("DELETE FROM ato_processo");
    log_("Recomeço limpo: $n linhas removidas de ato_processo.");
} else {
    log_("Retomando a partir do ato_id $desde (não apaga o que já foi feito).");
}

$total = (int)$pdo->query("SELECT COUNT(*) FROM ato_texto")->fetchColumn();
log_("Atos com texto: $total");

$ultimoId = $desde;
$vistos = 0; $inseridos = 0; $comProc = 0; $multi = 0;
$t0 = microtime(true);

while (true) {
    $st = $pdo->prepare("SELECT ato_id, texto_busca FROM ato_texto
                          WHERE ato_id > :desde ORDER BY ato_id LIMIT $LOTE");
    $st->execute([':desde' => $ultimoId]);
    $linhas = $st->fetchAll(PDO::FETCH_ASSOC);
    if (!$linhas) break;

    $pdo->beginTransaction();
    foreach ($linhas as $r) {
        $ultimoId = (int)$r['ato_id'];
        $vistos++;
        if (!preg_match_all(PROC_RE, (string)$r['texto_busca'], $m)) continue;

        $ordem = 0; $ja = [];
        foreach ($m[0] as $achado) {
            $dig = preg_replace('/\D/', '', $achado);
            // NUP tem 17 dígitos. Menos que isso é recorte de OCR: indexar
            // viraria lixo que casa com meia dúzia de processos diferentes.
            if (strlen($dig) !== 17 || isset($ja[$dig])) continue;
            $ja[$dig] = true;
            $ins->execute([':id' => $ultimoId, ':num' => mb_substr($achado, 0, 32),
                           ':dig' => $dig, ':ord' => ++$ordem]);
            $inseridos++;
        }
        if ($ordem > 0) $comProc++;
        if ($ordem > 1) $multi++;
    }
    $pdo->commit();

    log_(sprintf('  ... %d/%d atos | %d menções | último id %d | %.0fs',
                 $vistos, $total, $inseridos, $ultimoId, microtime(true) - $t0));
}

log_('');
log_("OK. atos varridos=$vistos | com processo=$comProc | citam 2+=$multi | menções gravadas=$inseridos");
log_(sprintf('Tempo: %.0fs', microtime(true) - $t0));
log_('');
log_('Confira em: SELECT COUNT(*) FROM ato_processo;');
log_('Se o navegador cortou no meio, releia o último "último id" acima e rode');
log_('de novo com &desde=ESSE_ID — o INSERT IGNORE torna a repetição inofensiva.');
