<?php
// ============================================================================
//  Backfill de `ato_politica` — liga ato→política em TODO o acervo, com o
//  MESMO classificador do import diário (politicas_match.php).
//
//  POR QUE ELE EXISTE (custou uma perda medida, em 04/08/2026)
//
//  `ato_politica` era a única tabela-fato mantida pelo import que NÃO tinha
//  backfill — comissões, ODS, processos e prazos tinham. A consequência
//  apareceu ao reaplicar o seed em produção: o `seed_politica.sql` apaga tudo
//  que é automático (`metodo NOT IN ('curadoria',...)`) antes de recarregar a
//  lista offline, e a lista offline tem só os atos que estavam em
//  `dados/propostas.json` quando ela foi gerada. Resultado medido no
//  phpMyAdmin: **127 linhas excluídas, 93 inseridas** — 34 vínculos que o
//  import diário havia descoberto desde 04/08 foram embora, e o import não os
//  recria, porque ele só processa boletim NOVO.
//
//  Este script é o caminho de volta. Roda o classificador sobre o acervo
//  inteiro e devolve o que o seed offline não conhece.
//
//  ---------------------------------------------------------------------------
//  A CURADORIA É SOBERANA, como em ODS e comissões: o DELETE aqui exclui só
//  `metodo NOT IN ('curadoria','regra+curadoria','ia+curadoria')`, e o INSERT é
//  IGNORE contra a UNIQUE (ato_id, politica_id, papel). Linha revisada por mão
//  humana nunca é sobrescrita.
//
//  ---------------------------------------------------------------------------
//  POR QUE NÃO É UM `INSERT ... SELECT` COMO O DE COMISSÕES
//
//  O de comissões casa frase e grava — o LIKE resolve tudo no MySQL. Aqui não
//  dá: além de casar a política, é preciso decidir o PAPEL do ato (regex
//  ordenada sobre a ementa) e aplicar três guardas que vivem no PHP — ementa
//  inutilizável, exclusão de sindicância e a limpeza da cláusula do emissor.
//  Reescrever isso em SQL criaria um QUARTO espelho da mesma regra para manter
//  em acordo; o projeto já paga esse preço em `extrair_prazos`, e a lição é não
//  repetir.
//
//  A saída é filtrar no BANCO e classificar no PHP: o SQL traz só os atos cuja
//  ementa contém alguma frase do catálogo OU cujo emissor está na lista — uns
//  poucos milhares em vez de 128 mil. O `politicas_do_ato()` decide o resto.
//
//  ---------------------------------------------------------------------------
//  Compatível com Percona/MySQL 5.7. Uso:
//    https://SEU_SITE/importar/backfill_ato_politica.php?token=SEU_TOKEN
//    php backfill_ato_politica.php            (CLI)
//
//  `&manter=1` NÃO apaga nada antes: só acrescenta o que faltar. É o modo certo
//  para consertar a perda de um seed reaplicado sem mexer no que já está certo.
// ============================================================================

set_time_limit(0);
@ini_set('memory_limit', '512M');

$raiz = dirname(__DIR__);
require $raiz . '/api/db.php';
require_once __DIR__ . '/politicas_match.php';
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
}
function log_($m) { echo $m . "\n"; @flush(); }

$manter = (($_GET['manter'] ?? '') === '1') || in_array('--manter', $argv ?? [], true);
$pdo = conectar($cfg);

log_('Backfill de ato_politica — classificador do import diário.');
log_($manter
    ? 'Modo ACRESCENTAR: nada é apagado; só entra o que faltar.'
    : 'Modo REFAZER: a passada automática é recriada (a curadoria sobrevive).');
log_('');

$antes = (int)$pdo->query("SELECT COUNT(*) FROM ato_politica")->fetchColumn();
$curados = (int)$pdo->query(
    "SELECT COUNT(*) FROM ato_politica
      WHERE metodo IN ('curadoria','regra+curadoria','ia+curadoria')")->fetchColumn();
log_("Antes: $antes vínculos ($curados de curadoria, " . ($antes - $curados) . ' automáticos).');

if (!$manter) {
    $st = $pdo->exec(
        "DELETE FROM ato_politica
          WHERE metodo NOT IN ('curadoria','regra+curadoria','ia+curadoria')");
    log_("Passada automática removida: $st linha(s). A curadoria ficou.");
}

// ---- filtro no banco -------------------------------------------------------
// Um OR de LIKE por frase do catálogo, mais os emissores. utf8mb4_unicode_ci
// já ignora acento e caixa, então a frase vai como está no registro.
$ors = [];
$par = [];
$i = 0;
foreach (politicas_termos() as $slug => $termos) {
    foreach (explode('|', $termos) as $t) {
        $ors[] = "a.ementa LIKE :t$i";
        $par[":t$i"] = '%' . trim($t) . '%';
        $i++;
    }
}
$sigs = array_keys(politicas_emissores());
foreach ($sigs as $k => $s) {
    $ors[] = "o.sigla = :s$k";
    $par[":s$k"] = $s;
}

$sql = "SELECT a.id, a.ementa, o.sigla
          FROM ato a
          JOIN orgao o ON o.id = a.orgao_id
         WHERE " . implode(' OR ', $ors);
$st = $pdo->prepare($sql);
$st->execute($par);
$candidatos = $st->fetchAll(PDO::FETCH_ASSOC);
log_('Candidatos trazidos do banco: ' . count($candidatos) . ' ato(s).');

// ---- classificação no PHP --------------------------------------------------
$politicaId = [];
foreach ($pdo->query("SELECT id, slug FROM politica")->fetchAll(PDO::FETCH_ASSOC) as $p) {
    $politicaId[$p['slug']] = (int)$p['id'];
}

$ins = $pdo->prepare(
    "INSERT IGNORE INTO ato_politica
        (ato_id, politica_id, papel, confianca, metodo, justificativa)
     VALUES (:ato, :pol, :papel, :conf, 'regra', :just)");

$gravados = 0;
$porSlug = [];
$semCatalogo = [];
foreach ($candidatos as $a) {
    foreach (politicas_do_ato((string)$a['ementa'], (string)$a['sigla']) as $v) {
        $pid = $politicaId[$v['politica']] ?? null;
        if ($pid === null) { $semCatalogo[$v['politica']] = true; continue; }
        $ins->execute([
            ':ato' => (int)$a['id'], ':pol' => $pid, ':papel' => $v['papel'],
            ':conf' => $v['confianca'], ':just' => $v['justificativa'],
        ]);
        if ($ins->rowCount() > 0) {
            $gravados++;
            $porSlug[$v['politica']] = ($porSlug[$v['politica']] ?? 0) + 1;
        }
    }
}

log_('');
ksort($porSlug);
foreach ($porSlug as $slug => $n) log_(sprintf('  %-24s %4d vínculo(s) novo(s)', $slug, $n));
if ($semCatalogo) {
    log_('');
    log_('ATENÇÃO: o classificador citou política(s) fora do catálogo do banco: '
         . implode(', ', array_keys($semCatalogo)));
    log_('  Aplique o seed_politica.sql — o matcher e o catálogo divergiram.');
}

$depois = (int)$pdo->query("SELECT COUNT(*) FROM ato_politica")->fetchColumn();
log_('');
log_("Gravados agora: $gravados. Total na tabela: $depois (era $antes).");

// O cache serve /api/politicas e /api/mudancas; os dois leem ato_politica.
$cacheDir = dirname(__DIR__) . '/api/cache';
if (is_dir($cacheDir)) {
    $limpos = 0;
    foreach (glob($cacheDir . '/*.json') ?: [] as $f) { if (@unlink($f)) $limpos++; }
    log_("Cache da API invalidado: $limpos arquivo(s).");
}

log_('');
log_('Confira: SELECT p.slug, COUNT(*) FROM ato_politica ap');
log_('           JOIN politica p ON p.id = ap.politica_id GROUP BY p.slug;');
