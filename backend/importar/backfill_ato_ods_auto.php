<?php
// ============================================================================
//  Backfill AUTOMÁTICO da `ato_ods`: reclassifica o acervo já no banco com o
//  MESMO classificador que roda no import (ods_match.php).
//
//  Diferente do backfill_ato_ods.php, que carrega um JSON produzido offline,
//  este não depende de arquivo nenhum: lê o corpo dos atos do próprio banco e
//  aplica o recorte + clusters. Serve para dar UMA passada uniforme no acervo
//  antigo depois que a classificação automática entrou (03/08/2026) — os atos
//  importados antes disso carregam a carga original, gerada em rodadas
//  diferentes.
//
//  A CURADORIA HUMANA É PRESERVADA em qualquer modo. Nunca se apaga nem se
//  sobrescreve linha `metodo='curadoria'`.
//
//  POR QUE EM LOTES: são ~69 mil atos normativos e o classificador precisa do
//  texto completo de cada um. Puxar tudo numa requisição estoura tempo e
//  memória no shared hosting. O cursor é `ato.id`, então dá para retomar de
//  onde parou — e repetir um lote é inofensivo (regrava o mesmo resultado).
//
//  Uso (navegador, protegido por token):
//    .../importar/backfill_ato_ods_auto.php?token=SEU_TOKEN&limpar=1&auto=1
//  Com `&auto=1` ele encadeia os lotes sozinho (meta-refresh) até o fim — é o
//  modo recomendado: o acervo inteiro custaria ~52 cliques manuais, e cada
//  clique é uma chance de perder o cursor. Sem `auto`, o script imprime a URL
//  do próximo lote e você continua à mão. `&lote=` (100..10000) ajusta o
//  tamanho; se um lote estourar o tempo do servidor, reduza.
//
//  `&limpar=1` (só na PRIMEIRA chamada): apaga todas as linhas metodo='ia'
//  antes de começar. Use quando quiser trocar a carga antiga inteira pela nova
//  classificação; sem ele, atos fora do recorte mantêm o que já tinham.
//
//  Uso (CLI, faz tudo de uma vez):
//    php backfill_ato_ods_auto.php --tudo [--limpar]
// ============================================================================

set_time_limit(0);
@ini_set('memory_limit', '512M');

$raiz = dirname(__DIR__);
require $raiz . '/api/db.php';
require_once __DIR__ . '/ods_match.php';
$cfg = carregar_config();

$cli = (PHP_SAPI === 'cli');
$auto = false;
if (!$cli) {
    ignore_user_abort(true);
    // `&auto=1` encadeia os lotes sozinho por meta-refresh. Sem ele o acervo
    // inteiro custa ~52 cliques manuais, e cada clique é uma chance de perder
    // o cursor. Em HTML só por causa do refresh; o conteúdo continua texto.
    $auto = !empty($_GET['auto']);
    header('Content-Type: ' . ($auto ? 'text/html' : 'text/plain') . '; charset=utf-8');
    header('X-Accel-Buffering: no');
    while (ob_get_level()) { @ob_end_flush(); }
    $token = $cfg['import_token'] ?? '';
    if ($token === '' || !hash_equals($token, (string)($_GET['token'] ?? ''))) {
        http_response_code(403);
        exit("Acesso negado. Use ?token=...\n");
    }
    $desde  = max((int)($_GET['desde'] ?? 0), 0);
    $lote   = min(max((int)($_GET['lote'] ?? 1500), 100), 10000);
    $limpar = !empty($_GET['limpar']);
    $tudo   = false;
    if ($auto) echo "<!doctype html><meta charset=\"utf-8\"><title>Backfill ODS</title><pre>\n";
} else {
    $desde  = 0;
    $lote   = 1500;
    $limpar = in_array('--limpar', $argv, true);
    $tudo   = in_array('--tudo', $argv, true);
}
function log_($m) { echo $m . "\n"; @flush(); }

$pdo = conectar($cfg);

// Os tipos que o recorte aceita. Filtrar no SQL evita puxar o texto de ~60 mil
// atos de pessoal que o classificador descartaria de qualquer jeito.
$TIPOS = ['Resolução', 'Resolução ad referendum', 'Decisão',
          'Instrução Normativa', 'Norma de Serviço', 'Portaria'];
$inTipos = implode(',', array_fill(0, count($TIPOS), '?'));

$antes = (int)$pdo->query("SELECT COUNT(*) FROM ato_ods")->fetchColumn();
$curadas = (int)$pdo->query("SELECT COUNT(*) FROM ato_ods WHERE metodo='curadoria'")->fetchColumn();
log_("ato_ods antes: $antes linha(s), das quais $curadas de curadoria.");

if ($limpar) {
    $n = $pdo->exec("DELETE FROM ato_ods WHERE metodo <> 'curadoria'");
    log_("Limpeza: $n linha(s) automáticas removidas. Curadoria intacta ($curadas).");
}

$sel = $pdo->prepare(
    "SELECT a.id, a.uid, t.nome AS tipo, a.ementa, tx.texto_original
       FROM ato a
       JOIN tipo_ato t       ON t.id = a.tipo_id
       LEFT JOIN ato_texto tx ON tx.ato_id = a.id
      WHERE a.id > ? AND t.nome IN ($inTipos)
      ORDER BY a.id
      LIMIT $lote");

// Mesma precedência do import: apaga só o automático, e o INSERT IGNORE cede
// para a curadoria quando ela já cravou aquela (ato, ods).
$del = $pdo->prepare("DELETE FROM ato_ods WHERE ato_id = ? AND metodo <> 'curadoria'");
$ins = $pdo->prepare("INSERT IGNORE INTO ato_ods
                        (ato_id, ods, vinculo, confianca, meta, justificativa, metodo)
                        VALUES (?, ?, ?, ?, ?, ?, 'ia')");

$totVistos = 0; $totComVinculo = 0; $totLinhas = 0;
$porOds = array_fill(1, 17, 0);
$porVinculo = ['proposta' => 0, 'execucao' => 0, 'pesquisa' => 0, 'ensino' => 0];
$ultimoId = $desde;

do {
    $sel->execute(array_merge([$ultimoId], $TIPOS));
    $linhas = $sel->fetchAll(PDO::FETCH_ASSOC);
    if (!$linhas) break;

    $pdo->beginTransaction();
    foreach ($linhas as $r) {
        $ultimoId = (int)$r['id'];
        $totVistos++;
        $achados = ods_do_ato((string)$r['tipo'], (string)($r['ementa'] ?? ''),
                              (string)($r['texto_original'] ?? ''));
        $del->execute([$r['id']]);
        if (!$achados) continue;      // sem cluster: resíduo, fica sem rótulo
        $totComVinculo++;
        foreach ($achados as $l) {
            $ins->execute([$r['id'], $l['ods'], $l['vinculo'], $l['confianca'],
                           $l['meta'], mb_substr($l['justificativa'], 0, 400)]);
            $totLinhas++;
            $porOds[$l['ods']]++;
            $porVinculo[$l['vinculo']] = ($porVinculo[$l['vinculo']] ?? 0) + 1;
        }
    }
    $pdo->commit();

    log_(sprintf("lote até id %-8d | vistos %6d | com vínculo %5d | linhas %6d",
                 $ultimoId, $totVistos, $totComVinculo, $totLinhas));
} while ($tudo);

$fim = (int)$pdo->query("SELECT COUNT(*) FROM ato_ods")->fetchColumn();

log_('');
log_("Nesta rodada: $totVistos ato(s) normativo(s) varrido(s), $totComVinculo com vínculo, $totLinhas linha(s) gravada(s).");
log_("ato_ods agora: $fim linha(s) (antes: $antes).");
log_('');
log_('Por vínculo: ' . json_encode($porVinculo, JSON_UNESCAPED_UNICODE));
$resumo = [];
foreach ($porOds as $n => $q) { if ($q) $resumo[] = "ODS $n: $q"; }
log_('Por ODS:     ' . ($resumo ? implode(' · ', $resumo) : '(nenhuma)'));

// Há mais? Só sabe quem olhar adiante do cursor.
$st = $pdo->prepare("SELECT COUNT(*) FROM ato a JOIN tipo_ato t ON t.id = a.tipo_id
                      WHERE a.id > ? AND t.nome IN ($inTipos)");
$st->execute(array_merge([$ultimoId], $TIPOS));
$restam = (int)$st->fetchColumn();

if ($restam > 0) {
    log_('');
    log_("FALTAM $restam ato(s).");
    if ($cli) {
        log_("  php backfill_ato_ods_auto.php --tudo     (faz o resto de uma vez)");
    } else {
        $base = strtok($_SERVER['REQUEST_URI'] ?? '', '?');
        $q = $_GET;
        $q['desde'] = $ultimoId;
        unset($q['limpar']);          // limpar é só da primeira chamada
        $prox = $base . '?' . http_build_query($q);
        if ($auto) {
            $faltam = (int)ceil($restam / max($lote, 1));
            log_("Continuando sozinho — faltam ~$faltam lote(s). Não feche a aba.");
            // O refresh vai no fim do corpo: o navegador só o executa depois de
            // receber a página, então o log do lote fica visível antes de virar.
            echo '</pre><meta http-equiv="refresh" content="2;url='
                 . htmlspecialchars($prox, ENT_QUOTES, 'UTF-8') . '">';
        } else {
            log_("Continue de onde parou:");
            log_("  $prox");
            log_('Dica: acrescente &auto=1 para o script encadear os lotes sozinho,');
            log_('e &lote=10000 para fazer menos rodadas.');
        }
    }
    log_('(o cache da API só é invalidado no lote final)');
    exit(0);
}

// Terminou: invalida o cache de resposta, mesmo gesto do importador.
$cacheDir = dirname(__DIR__) . '/api/cache';
if (is_dir($cacheDir)) {
    $limpos = 0;
    foreach (glob($cacheDir . '/*.json') ?: [] as $f) { if (@unlink($f)) $limpos++; }
    log_("Cache da API invalidado: $limpos arquivo(s).");
}

log_('');
log_('CONCLUÍDO. Confira antes de considerar pronto:');
log_("  SELECT metodo, COUNT(*) FROM ato_ods GROUP BY metodo;");
log_("  SELECT ods, vinculo, COUNT(*) FROM ato_ods GROUP BY ods, vinculo ORDER BY ods;");
log_('');
log_('A curadoria tem de continuar com ' . $curadas . ' linha(s). Se caiu, PARE e investigue.');
