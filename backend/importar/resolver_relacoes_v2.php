<?php
// ============================================================================
//  resolver_relacoes_v2.php — Resolve relações e recalcula vigência (schema v2)
//
//  Opera sobre o schema normalizado v2. O mapa de nomes da geração anterior,
//  mantido porque explica os nomes de coluna que sobraram:
//    atos          -> ato            (id BIGINT, tipo_id FK, sigla_orig, numero_norm INT)
//    ato_relacoes  -> relacao        (tipo ENUM Revoga/Altera/Complementa,
//                                     destino_texto, destino_ato_id, trecho)
//
//  Mesmos 3 passos do v1:
//    1. Marca relações citando ÓRGÃOS FEDERAIS EXTERNOS (nunca resolvem).
//    2. Liga as demais a atos de QUALQUER ano, casando tipo+número (+ano da
//       citação quando presente, novo em v2 — ver abaixo) + sigla, com guarda
//       temporal. Ambíguo persistente = NÃO adivinha, fica pendente.
//    3. Recalcula vigência (Ativo/Alterado/Revogado), idempotente.
//
//  MELHORIA v2 sobre o v1: numero_norm já é INT (canônico, sem variantes de
//  zero/ponto para gerenciar) — o casamento de número fica direto. E o parser
//  agora separa um "/AAAA" opcional dentro do número citado ("nº 267/2013")
//  como filtro extra de desambiguação; no v1 esse sufixo ficava colado ao
//  número e a citação nunca casava com nada (o índice usa só dígitos).
//
//  Roda contra o banco `uffnormas_v2` (ainda em staging, apontado abaixo) —
//  não mexe na produção v1 enquanto o cutover não acontecer.
// ============================================================================

if (!function_exists('log_')) {
    function log_(string $m): void { echo $m . "\n"; @flush(); }
}

const ORGAOS_EXTERNOS_RE =
    '/\b(MEC|SGP|SEDGG|SEGES|MGI|MPOG|MPDG|MP\/SLTI|SLTI|DOU|CGU|AGU|TCU|STF|STJ|'
    . 'CNE|CES|CAPES|CNPq|INEP|FNDE|PNUD|CONFEA|CONSUNI)\b/iu';

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
 * "Resolução CUV nº 104" → ['tipo'=>'Resolução','sigla'=>'CUV','numero'=>104,'ano'=>null]
 * "Resolução nº 267/2013" → ['tipo'=>'Resolução','sigla'=>'','numero'=>267,'ano'=>2013]
 * Retorna null se o formato não for reconhecido ou não houver dígito no número.
 */
function parse_destino(string $texto): ?array
{
    if (!preg_match('/^(.+?)\s+n[ºo°]\s*(.+)$/u', $texto, $m)) return null;

    $prefix = mb_strtolower(trim($m[1]), 'UTF-8');
    $numTxt = trim($m[2]);

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

            // separa "/AAAA" opcional no final do número citado
            $ano = null;
            if (preg_match('/^(.*?)\s*\/\s*(\d{4})$/u', $numTxt, $mm)) {
                $numTxt = trim($mm[1]);
                $ano = (int) $mm[2];
            }
            $numero = (int) preg_replace('/\D/u', '', $numTxt);
            if ($numero === 0 && !preg_match('/\d/', $numTxt)) return null;

            return ['tipo' => $canon, 'sigla' => $sigla, 'numero' => $numero, 'ano' => $ano];
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Índice em memória: tipo_id|numero_norm(INT) → lista de candidatos
// [id, sigla_orig, data_ato, ano]. numero_norm já é canônico (sem variantes
// de zero/ponto a gerenciar, ao contrário do v1).
// ---------------------------------------------------------------------------
function carregar_tipos(PDO $pdo): array
{
    $st = $pdo->query("SELECT id, nome FROM tipo_ato");
    $map = [];
    while ($t = $st->fetch(PDO::FETCH_ASSOC)) {
        $map[$t['nome']] = (int) $t['id'];
    }
    return $map;
}

function carregar_indice_atos(PDO $pdo): array
{
    $indice = [];
    $st = $pdo->query("SELECT id, tipo_id, numero_norm, sigla_orig, data_ato, ano FROM ato
                        WHERE numero_norm IS NOT NULL");
    while ($a = $st->fetch(PDO::FETCH_ASSOC)) {
        $chave = $a['tipo_id'] . '|' . $a['numero_norm'];
        $indice[$chave][] = [
            (int) $a['id'],
            (string) ($a['sigla_orig'] ?? ''),
            (string) ($a['data_ato'] ?? ''),
            (int) $a['ano'],
        ];
    }
    return $indice;
}

/**
 * Procura o ato destino no índice, respeitando a GUARDA TEMPORAL (não
 * referencia algo de data posterior à origem) e desambiguação SEGURA: se
 * sobrar >1 candidato, tenta o ANO citado (quando presente) e depois a sigla;
 * se nenhum desempatar para exatamente um, devolve 'ambiguo' (não adivinha).
 * @return array{id:?int,status:'ok'|'ambiguo'|'nao_encontrado'}
 */
function buscar_destino(array $indice, int $tipoId, array $p, ?string $origem_data): array
{
    $chave = $tipoId . '|' . $p['numero'];
    $rows = $indice[$chave] ?? [];
    if (!$rows) return ['id' => null, 'status' => 'nao_encontrado'];

    // Guarda temporal
    if ($origem_data) {
        $rows = array_filter($rows, fn($r) => $r[2] === '' || $r[2] <= $origem_data);
        if (!$rows) return ['id' => null, 'status' => 'nao_encontrado'];
    }

    if (count($rows) === 1) {
        $r = reset($rows);
        return ['id' => $r[0], 'status' => 'ok'];
    }

    // >1 candidato: 1º desempate pelo ANO citado (novidade v2 — separado do
    // número na hora do parse), 2º pela sigla, como no v1.
    if ($p['ano'] !== null) {
        $porAno = array_values(array_filter($rows, fn($r) => $r[3] === $p['ano']));
        if (count($porAno) === 1) return ['id' => $porAno[0][0], 'status' => 'ok'];
        if (count($porAno) > 0) $rows = $porAno;  // ano ajuda mas não decide sozinho -> tenta sigla no subconjunto
    }

    if ($p['sigla'] !== '') {
        $alvo = mb_strtoupper(str_ireplace('/UFF', '', $p['sigla']), 'UTF-8');
        $cands = [];
        foreach ($rows as $r) {
            $s = mb_strtoupper(str_ireplace('/UFF', '', $r[1]), 'UTF-8');
            if ($s !== '' && $s === $alvo) $cands[] = $r[0];
        }
        if (count($cands) === 1) return ['id' => $cands[0], 'status' => 'ok'];
    }
    return ['id' => null, 'status' => 'ambiguo'];
}

// ---------------------------------------------------------------------------
// UPDATEs em lote (500 por comando)
// ---------------------------------------------------------------------------
function marcar_externos_lote(PDO $pdo, array $ids): void
{
    foreach (array_chunk($ids, 500) as $chunk) {
        $ph = implode(',', array_fill(0, count($chunk), '?'));
        $pdo->prepare("UPDATE relacao SET externo = 1 WHERE id IN ($ph)")
            ->execute($chunk);
    }
}

/** $pares: rel_id => destino_id */
function ligar_destinos_lote(PDO $pdo, array $pares): void
{
    foreach (array_chunk($pares, 500, true) as $chunk) {
        $case = '';
        $params = [];
        $ids = [];
        foreach ($chunk as $rid => $did) {
            $case    .= ' WHEN ? THEN ?';
            $params[] = $rid;
            $params[] = $did;
            $ids[]    = $rid;
        }
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $pdo->prepare("UPDATE relacao SET destino_ato_id = CASE id{$case} END
                       WHERE id IN ($ph)")
            ->execute(array_merge($params, $ids));
    }
}

// ---------------------------------------------------------------------------
// 1+2) Resolve links pendentes
// ---------------------------------------------------------------------------
function resolver_links(PDO $pdo): void
{
    $tipos = carregar_tipos($pdo);
    $indice = carregar_indice_atos($pdo);
    log_("Tipos: " . count($tipos) . " | Índice: " . count($indice) . " chaves tipo|número em memória.");

    // Autoridade única: zera e reprocessa TUDO a cada execução (idempotente).
    $pdo->beginTransaction();
    try {
        $pdo->exec("UPDATE relacao SET destino_ato_id = NULL, externo = 0");

        $todas = $pdo->query(
            "SELECT r.id, r.destino_texto, o.data_ato AS origem_data
             FROM relacao r
             JOIN ato o ON o.id = r.ato_id
             WHERE r.destino_texto <> ''"
        )->fetchAll();

        if (!$todas) {
            $pdo->commit();
            log_("Links: nenhuma relação a processar.");
            return;
        }
        log_("Links: " . count($todas) . " relações. Reprocessando...");

        $externos = [];
        $ligacoes = [];
        $n_amb = $n_miss = $n_naoparseou = $n_tiposemid = 0;

        foreach ($todas as $rel) {
            $texto = $rel['destino_texto'];

            if (eh_externo($texto)) { $externos[] = $rel['id']; continue; }

            $p = parse_destino($texto);
            if (!$p) { $n_naoparseou++; continue; }

            $tipoId = $tipos[$p['tipo']] ?? null;
            if ($tipoId === null) { $n_tiposemid++; continue; }

            $r = buscar_destino($indice, $tipoId, $p, $rel['origem_data']);
            if ($r['status'] === 'ok')          { $ligacoes[$rel['id']] = $r['id']; }
            elseif ($r['status'] === 'ambiguo') { $n_amb++; }
            else                                { $n_miss++; }
        }

        marcar_externos_lote($pdo, $externos);
        ligar_destinos_lote($pdo, $ligacoes);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    log_("  resolvidos: " . count($ligacoes) . " | externos: " . count($externos)
         . " | ambíguos (não chutados): $n_amb"
         . " | legado a indexar: $n_miss"
         . ($n_naoparseou ? " | sem parse: $n_naoparseou" : "")
         . ($n_tiposemid ? " | tipo sem correspondência: $n_tiposemid" : ""));
}

// ---------------------------------------------------------------------------
// 3) Recalcula vigência — idempotente, respeitando a guarda temporal.
// ---------------------------------------------------------------------------
function recalcular_status(PDO $pdo): void
{
    $rows = $pdo->query(
        "SELECT a.id,
                SUM(r.tipo = '" . REL_REVOGA . "') AS n_rev,
                SUM(r.tipo = '" . REL_ALTERA . "') AS n_alt
         FROM ato a
         JOIN relacao r ON r.destino_ato_id = a.id
         JOIN ato o     ON o.id = r.ato_id
         WHERE r.tipo IN ('" . REL_REVOGA . "','" . REL_ALTERA . "')
           AND (o.data_ato IS NULL OR a.data_ato IS NULL OR o.data_ato >= a.data_ato)
         GROUP BY a.id"
    )->fetchAll();

    $alvo = [];
    foreach ($rows as $r) {
        $alvo[$r['id']] = ($r['n_rev'] > 0) ? 'Revogado' : 'Alterado';
    }

    $pdo->beginTransaction();
    try {
        $n_marcados = 0;
        foreach (['Revogado', 'Alterado'] as $st) {
            $ids = array_keys(array_filter($alvo, fn($s) => $s === $st));
            foreach (array_chunk($ids, 500) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $q = $pdo->prepare("UPDATE ato SET status = ?
                                    WHERE id IN ($ph) AND status <> ?");
                $q->execute(array_merge([$st], $chunk, [$st]));
                $n_marcados += $q->rowCount();
            }
        }

        $naoAtivos = $pdo->query("SELECT id FROM ato WHERE status <> 'Ativo'")
                         ->fetchAll(PDO::FETCH_COLUMN);
        $reverter = array_values(array_filter($naoAtivos, fn($id) => !isset($alvo[$id])));
        $n_revert = 0;
        foreach (array_chunk($reverter, 500) as $chunk) {
            $ph = implode(',', array_fill(0, count($chunk), '?'));
            $q = $pdo->prepare("UPDATE ato SET status = 'Ativo' WHERE id IN ($ph)");
            $q->execute($chunk);
            $n_revert += $q->rowCount();
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $n_rev = count(array_filter($alvo, fn($s) => $s === 'Revogado'));
    $n_alt = count(array_filter($alvo, fn($s) => $s === 'Alterado'));
    log_("Vigência: Revogados=$n_rev | Alterados=$n_alt"
         . " (mudaram agora: $n_marcados; revertidos p/ Ativo: $n_revert)");
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------
function resolver_cross_ano_v2(PDO $pdo): void
{
    @set_time_limit(0);
    @ini_set('memory_limit', '512M');
    resolver_links($pdo);
    recalcular_status($pdo);
}

// ---------------------------------------------------------------------------
// Execução autônoma. Lê api/config.php (mesmo padrão do db.php/index.php) —
// nesta instância (deploy próprio em subdomínio separado, não convive com o
// config.php do v1) não há colisão de nome. Copie config.example.php para
// config.php e preencha, se ainda não existir.
// ---------------------------------------------------------------------------
if (!isset($pdo)) {
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
            exit("Acesso negado.\n");
        }
    }

    $pdo = conectar($cfg);
    log_("Conectado a: " . $cfg['db']['nome']);
    resolver_cross_ano_v2($pdo);
    log_("Concluído.");
}
