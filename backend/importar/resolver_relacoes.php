<?php
// ============================================================================
//  resolver_relacoes.php — Resolve relações cross-ano e recalcula vigência
//
//  Cada importação diária reescreve ato_relacoes zerando ato_destino_id e
//  o status dos atos. Este script roda DEPOIS e:
//
//    1. Marca relações que citam ÓRGÃOS FEDERAIS EXTERNOS (MEC, DOU, SGP/ME…)
//       — esses atos nunca estarão no Boletim da UFF, então saem da fila de
//       pendentes (coluna `externo`) em vez de serem tentados todo dia.
//    2. Liga as demais relações pendentes a atos de QUALQUER ano já no banco,
//       casando tipo + número (tolerante a zeros/pontos) + sigla. Em caso de
//       AMBIGUIDADE sem sigla que desempate, NÃO adivinha (deixa pendente) —
//       é melhor ficar sem link do que apontar para o ato errado.
//    3. Recalcula o status de vigência (Ativo/Alterado/Revogado) de forma
//       idempotente, derivado SÓ das relações resolvidas, respeitando a regra
//       temporal: um ato só afeta outro se for de data igual/posterior.
//
//  É incluído automaticamente pelo importar.php. Também roda sozinho:
//    CLI: /usr/local/bin/ea-php83 .../importar/resolver_relacoes.php
//    Web: https://uff.fanara.com.br/importar/resolver_relacoes.php?token=SEGREDO
// ============================================================================

if (!function_exists('log_')) {
    function log_(string $m): void { echo $m . "\n"; @flush(); }
}

// Órgãos federais externos: se a citação traz uma destas siglas, o ato vive
// fora do Boletim da UFF e nunca será resolvido contra a nossa base.
const ORGAOS_EXTERNOS_RE =
    '/\b(MEC|SGP|SEDGG|SEGES|MGI|MPOG|MPDG|MP\/SLTI|SLTI|DOU|CGU|AGU|TCU|STF|STJ|'
    . 'CNE|CES|CAPES|CNPq|INEP|FNDE|PNUD|CONFEA|CONSUNI)\b/iu';

// Relações que afetam vigência e seus valores reais na base (normalizados pelo
// gerar_dados_portal.py — "Complementa" é mera citação e NÃO afeta vigência).
const REL_REVOGA = 'Revoga';
const REL_ALTERA = 'Altera';

// ---------------------------------------------------------------------------
// Helpers de parsing
// ---------------------------------------------------------------------------

function eh_externo(string $texto): bool
{
    return (bool) preg_match(ORGAOS_EXTERNOS_RE, $texto);
}

/**
 * "Resolução CUV nº 104" → ['tipo'=>'Resolução','sigla'=>'CUV','numero'=>'104']
 * Retorna null se o formato não for reconhecido.
 */
function parse_destino(string $texto): ?array
{
    if (!preg_match('/^(.+?)\s+n[ºo°]\s*(.+)$/u', $texto, $m)) return null;

    $prefix = mb_strtolower(trim($m[1]), 'UTF-8');
    $numero = trim($m[2]);

    // prefixo (minúsculas) → tipo canônico (Title Case, igual a atos.tipo).
    // Mais longos primeiro para não casar "os" dentro de "ordem de serviço".
    $tipos = [
        'determinação de serviço' => 'Determinação de Serviço',
        'instrução normativa'     => 'Instrução Normativa',
        'norma de serviço'        => 'Norma de Serviço',
        'ordem de serviço'        => 'Ordem de Serviço',
        'deliberação'             => 'Deliberação',
        'comunicado'              => 'Comunicado',
        'resolução'               => 'Resolução',
        'portaria'                => 'Portaria',
        'decisão'                 => 'Decisão',
        'edital'                  => 'Edital',
        'dts'                     => 'Determinação de Serviço',
        'in'                      => 'Instrução Normativa',
        'ns'                      => 'Norma de Serviço',
        'os'                      => 'Ordem de Serviço',
    ];

    foreach ($tipos as $pat => $canon) {
        $plen = mb_strlen($pat, 'UTF-8');
        if (mb_substr($prefix, 0, $plen, 'UTF-8') === $pat) {
            $sigla = mb_strtoupper(trim(mb_substr($prefix, $plen, null, 'UTF-8'), " /.,"), 'UTF-8');
            return ['tipo' => $canon, 'sigla' => $sigla, 'numero' => $numero];
        }
    }
    return null;
}

/** "026"→["026","26"]   "65.784"→["65.784","65784"] */
function numero_variantes(string $num): array
{
    $base       = trim($num);
    $sem_pontos = str_replace('.', '', $base);
    $sem_zeros  = ltrim($sem_pontos, '0');
    if ($sem_zeros === '') $sem_zeros = $sem_pontos;
    return array_values(array_unique([$base, $sem_pontos, $sem_zeros]));
}

/**
 * Procura o ato destino. Desambiguação SEGURA: se houver mais de um candidato
 * e a sigla não desempatar para exatamente um, devolve 'ambiguo' (não chuta).
 * @return array{id:?string,status:'ok'|'ambiguo'|'nao_encontrado'}
 */
function buscar_destino(PDO $pdo, array $p): array
{
    $nums = numero_variantes($p['numero']);
    $ph   = implode(',', array_fill(0, count($nums), '?'));
    $stmt = $pdo->prepare("SELECT id, sigla FROM atos WHERE tipo=? AND numero IN ($ph)");
    $stmt->execute(array_merge([$p['tipo']], $nums));
    $rows = $stmt->fetchAll();

    if (!$rows)                return ['id' => null,           'status' => 'nao_encontrado'];
    if (count($rows) === 1)    return ['id' => $rows[0]['id'], 'status' => 'ok'];

    // múltiplos: só resolve se a sigla citada casar EXATAMENTE um candidato
    if ($p['sigla'] !== '') {
        $alvo = mb_strtoupper(str_ireplace('/UFF', '', $p['sigla']), 'UTF-8');
        $cands = [];
        foreach ($rows as $r) {
            $s = mb_strtoupper(str_ireplace('/UFF', '', $r['sigla'] ?? ''), 'UTF-8');
            if ($s !== '' && $s === $alvo) $cands[] = $r['id'];
        }
        if (count($cands) === 1) return ['id' => $cands[0], 'status' => 'ok'];
    }
    return ['id' => null, 'status' => 'ambiguo'];
}

// ---------------------------------------------------------------------------
// Garante a coluna `externo` (idempotente; nada faz se já existe)
// ---------------------------------------------------------------------------
function garantir_coluna_externo(PDO $pdo): void
{
    $col = $pdo->query("SHOW COLUMNS FROM ato_relacoes LIKE 'externo'")->fetch();
    if (!$col) {
        $pdo->exec("ALTER TABLE ato_relacoes
                    ADD COLUMN externo TINYINT(1) NOT NULL DEFAULT 0");
        log_("  (coluna 'externo' criada em ato_relacoes)");
    }
}

// ---------------------------------------------------------------------------
// 1+2) Resolve links pendentes
// ---------------------------------------------------------------------------
function resolver_links(PDO $pdo): void
{
    // O resolver é a AUTORIDADE ÚNICA de resolução de destino: a cada execução
    // ele zera e reprocessa TODAS as relações com a mesma lógica segura. Assim
    // não há divergência entre caminhos, e qualquer link incorreto de uma
    // rodada anterior (ex.: chute em caso ambíguo) é corrigido retroativamente.
    $pdo->exec("UPDATE ato_relacoes SET ato_destino_id = NULL, externo = 0");

    $todas = $pdo->query(
        "SELECT id, ato_destino_texto FROM ato_relacoes WHERE ato_destino_texto <> ''"
    )->fetchAll();

    if (!$todas) { log_("Links: nenhuma relação a processar."); return; }
    log_("Links: " . count($todas) . " relações. Reprocessando...");

    $marcaExterno = $pdo->prepare("UPDATE ato_relacoes SET externo = 1 WHERE id = ?");
    $ligaDestino  = $pdo->prepare("UPDATE ato_relacoes SET ato_destino_id = ? WHERE id = ?");

    $n_ext = $n_ok = $n_amb = $n_miss = $n_naoparseou = 0;

    foreach ($todas as $rel) {
        $texto = $rel['ato_destino_texto'];

        if (eh_externo($texto)) { $marcaExterno->execute([$rel['id']]); $n_ext++; continue; }

        $p = parse_destino($texto);
        if (!$p) { $n_naoparseou++; continue; }

        $r = buscar_destino($pdo, $p);
        if ($r['status'] === 'ok')          { $ligaDestino->execute([$r['id'], $rel['id']]); $n_ok++; }
        elseif ($r['status'] === 'ambiguo') { $n_amb++; }
        else                                { $n_miss++; }
    }

    log_("  resolvidos: $n_ok | externos: $n_ext | ambíguos (não chutados): $n_amb"
         . " | legado a indexar: $n_miss" . ($n_naoparseou ? " | sem parse: $n_naoparseou" : ""));
}

// ---------------------------------------------------------------------------
// 3) Recalcula vigência — idempotente, portável (sem UPDATE...JOIN na mesma
//    tabela), respeitando a regra temporal (origem.data >= destino.data).
// ---------------------------------------------------------------------------
function recalcular_status(PDO $pdo): void
{
    // Status-alvo de cada ato que é destino de relação de vigência resolvida.
    $rows = $pdo->query(
        "SELECT a.id,
                SUM(r.tipo_relacao = '" . REL_REVOGA . "') AS n_rev,
                SUM(r.tipo_relacao = '" . REL_ALTERA . "') AS n_alt
         FROM atos a
         JOIN ato_relacoes r ON r.ato_destino_id = a.id
         JOIN atos o         ON o.id = r.ato_id
         WHERE r.tipo_relacao IN ('" . REL_REVOGA . "','" . REL_ALTERA . "')
           AND (o.data_ato IS NULL OR a.data_ato IS NULL OR o.data_ato >= a.data_ato)
         GROUP BY a.id"
    )->fetchAll();

    $alvo = [];  // id => 'Revogado' | 'Alterado'
    foreach ($rows as $r) {
        $alvo[$r['id']] = ($r['n_rev'] > 0) ? 'Revogado' : 'Alterado';
    }

    $set = $pdo->prepare("UPDATE atos SET status = ? WHERE id = ? AND status <> ?");
    $n_marcados = 0;
    foreach ($alvo as $id => $st) {
        $set->execute([$st, $id, $st]);
        $n_marcados += $set->rowCount();
    }

    // Reverte para 'Ativo' quem está marcado mas não tem mais relação válida.
    $naoAtivos = $pdo->query("SELECT id FROM atos WHERE status <> 'Ativo'")
                     ->fetchAll(PDO::FETCH_COLUMN);
    $revert = $pdo->prepare("UPDATE atos SET status = 'Ativo' WHERE id = ?");
    $n_revert = 0;
    foreach ($naoAtivos as $id) {
        if (!isset($alvo[$id])) { $revert->execute([$id]); $n_revert += $revert->rowCount(); }
    }

    $n_rev = count(array_filter($alvo, fn($s) => $s === 'Revogado'));
    $n_alt = count(array_filter($alvo, fn($s) => $s === 'Alterado'));
    log_("Vigência: Revogados=$n_rev | Alterados=$n_alt"
         . " (mudaram agora: $n_marcados; revertidos p/ Ativo: $n_revert)");
}

// ---------------------------------------------------------------------------
// Orquestração (chamada pelo importar.php e pela execução autônoma)
// ---------------------------------------------------------------------------
function resolver_cross_ano(PDO $pdo): void
{
    garantir_coluna_externo($pdo);
    resolver_links($pdo);
    recalcular_status($pdo);
}

// ---------------------------------------------------------------------------
// Execução autônoma (quando NÃO incluído pelo importar.php)
// ---------------------------------------------------------------------------
if (!isset($pdo)) {
    $raiz = dirname(__DIR__);
    require $raiz . '/api/db.php';
    $cfg = carregar_config();

    $cli = (PHP_SAPI === 'cli');
    if (!$cli) {
        header('Content-Type: text/plain; charset=utf-8');
        $token = $cfg['import_token'] ?? '';
        if ($token === '' || ($_GET['token'] ?? '') !== $token) {
            http_response_code(403);
            exit("Acesso negado.\n");
        }
    }

    $pdo = conectar($cfg);
    resolver_cross_ano($pdo);
    log_("Concluído.");
}
