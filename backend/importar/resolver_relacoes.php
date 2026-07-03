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
//    2. Liga as demais relações a atos de QUALQUER ano já no banco, casando
//       tipo + número (tolerante a zeros/pontos) + sigla e respeitando a ordem
//       temporal (não liga a um homônimo mais NOVO que o ato citante). Se a
//       AMBIGUIDADE persistir, NÃO adivinha (deixa pendente) — melhor sem link
//       do que apontando para o ato errado.
//    3. Recalcula o status de vigência (Ativo/Alterado/Revogado) de forma
//       idempotente, derivado SÓ das relações resolvidas, respeitando a regra
//       temporal: um ato só afeta outro se for de data igual/posterior.
//
//  DESEMPENHO (hospedagem compartilhada): com a base em dezenas de milhares de
//  atos, o desenho antigo (1 SELECT por relação + 1 UPDATE por link) estourava
//  o tempo da requisição web e o proxy devolvia 503. Agora o índice de atos é
//  carregado UMA vez em memória (1 SELECT) e os UPDATEs saem em LOTES de 500
//  — o total cai de milhares de comandos SQL para poucas dezenas.
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

// ---------------------------------------------------------------------------
// Índice em memória de todos os atos, para resolver sem 1 SELECT por relação.
// Chave "tipo|variante-do-número" → lista de candidatos [id, sigla, data_ato].
// Indexar o número do BANCO pelas suas próprias variantes torna o casamento
// simétrico: "65.784" no banco casa a citação "65784" e vice-versa (o SQL
// antigo só casava numa direção).
// ---------------------------------------------------------------------------
function carregar_indice_atos(PDO $pdo): array
{
    $indice = [];
    $st = $pdo->query("SELECT id, tipo, numero, sigla, data_ato FROM atos");
    while ($a = $st->fetch(PDO::FETCH_ASSOC)) {
        $cand = [$a['id'], (string)($a['sigla'] ?? ''), (string)($a['data_ato'] ?? '')];
        foreach (numero_variantes((string)$a['numero']) as $v) {
            $indice[$a['tipo'] . '|' . $v][] = $cand;
        }
    }
    return $indice;
}

/**
 * Procura o ato destino no índice em memória, respeitando a GUARDA TEMPORAL
 * (um ato não referencia algo de data posterior à sua) e com desambiguação
 * SEGURA: se sobrar mais de um candidato e a sigla não desempatar para
 * exatamente um, devolve 'ambiguo'.
 * @return array{id:?string,status:'ok'|'ambiguo'|'nao_encontrado'}
 */
function buscar_destino(array $indice, array $p, ?string $origem_data): array
{
    // candidatos únicos (por id) somando todas as variantes do número citado
    $rows = [];
    foreach (numero_variantes($p['numero']) as $v) {
        foreach ($indice[$p['tipo'] . '|' . $v] ?? [] as $c) {
            $rows[$c[0]] = $c;   // [id, sigla, data_ato]
        }
    }
    if (!$rows) return ['id' => null, 'status' => 'nao_encontrado'];

    // Guarda temporal: o alvo não pode ser mais NOVO que o ato citante. Se o único
    // homônimo é posterior, o alvo real é uma versão anterior (legado) ainda não
    // indexada — melhor deixar pendente do que ligar ao homônimo recente.
    if ($origem_data) {
        $rows = array_filter($rows, fn($r) => $r[2] === '' || $r[2] <= $origem_data);
        if (!$rows) return ['id' => null, 'status' => 'nao_encontrado'];
    }

    if (count($rows) === 1) {
        $r = reset($rows);
        return ['id' => $r[0], 'status' => 'ok'];
    }

    // múltiplos: só resolve se a sigla citada casar EXATAMENTE um candidato
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
// UPDATEs em lote (500 por comando) — essencial na hospedagem compartilhada.
// ---------------------------------------------------------------------------
function marcar_externos_lote(PDO $pdo, array $ids): void
{
    foreach (array_chunk($ids, 500) as $chunk) {
        $ph = implode(',', array_fill(0, count($chunk), '?'));
        $pdo->prepare("UPDATE ato_relacoes SET externo = 1 WHERE id IN ($ph)")
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
        $pdo->prepare("UPDATE ato_relacoes SET ato_destino_id = CASE id{$case} END
                       WHERE id IN ($ph)")
            ->execute(array_merge($params, $ids));
    }
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
    $indice = carregar_indice_atos($pdo);
    log_("Índice: " . count($indice) . " chaves tipo|número em memória.");

    // O resolver é a AUTORIDADE ÚNICA de resolução de destino: a cada execução
    // ele zera e reprocessa TODAS as relações com a mesma lógica segura. Assim
    // não há divergência entre caminhos, e qualquer link incorreto de uma
    // rodada anterior (ex.: chute em caso ambíguo) é corrigido retroativamente.
    // Tudo numa transação: ninguém vê a base "zerada" no meio do caminho.
    $pdo->beginTransaction();
    try {
        $pdo->exec("UPDATE ato_relacoes SET ato_destino_id = NULL, externo = 0");

        $todas = $pdo->query(
            "SELECT r.id, r.ato_destino_texto, o.data_ato AS origem_data
             FROM ato_relacoes r
             JOIN atos o ON o.id = r.ato_id
             WHERE r.ato_destino_texto <> ''"
        )->fetchAll();

        if (!$todas) {
            $pdo->commit();
            log_("Links: nenhuma relação a processar.");
            return;
        }
        log_("Links: " . count($todas) . " relações. Reprocessando...");

        $externos = [];   // ids de relações que citam órgão externo
        $ligacoes = [];   // rel_id => destino_id
        $n_amb = $n_miss = $n_naoparseou = 0;

        foreach ($todas as $rel) {
            $texto = $rel['ato_destino_texto'];

            if (eh_externo($texto)) { $externos[] = $rel['id']; continue; }

            $p = parse_destino($texto);
            if (!$p) { $n_naoparseou++; continue; }

            $r = buscar_destino($indice, $p, $rel['origem_data']);
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

    $pdo->beginTransaction();
    try {
        // aplica em lote, separado por status-alvo
        $n_marcados = 0;
        foreach (['Revogado', 'Alterado'] as $st) {
            $ids = array_keys(array_filter($alvo, fn($s) => $s === $st));
            foreach (array_chunk($ids, 500) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $q = $pdo->prepare("UPDATE atos SET status = ?
                                    WHERE id IN ($ph) AND status <> ?");
                $q->execute(array_merge([$st], $chunk, [$st]));
                $n_marcados += $q->rowCount();
            }
        }

        // Reverte para 'Ativo' quem está marcado mas não tem mais relação válida.
        $naoAtivos = $pdo->query("SELECT id FROM atos WHERE status <> 'Ativo'")
                         ->fetchAll(PDO::FETCH_COLUMN);
        $reverter = array_values(array_filter($naoAtivos, fn($id) => !isset($alvo[$id])));
        $n_revert = 0;
        foreach (array_chunk($reverter, 500) as $chunk) {
            $ph = implode(',', array_fill(0, count($chunk), '?'));
            $q = $pdo->prepare("UPDATE atos SET status = 'Ativo' WHERE id IN ($ph)");
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
// Orquestração (chamada pelo importar.php e pela execução autônoma)
// ---------------------------------------------------------------------------
function resolver_cross_ano(PDO $pdo): void
{
    @set_time_limit(0);          // o proxy da hospedagem ainda impõe teto, mas
    @ini_set('memory_limit', '512M');  // o índice em memória pede folga
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
        ignore_user_abort(true);           // termina mesmo se o navegador desistir
        header('Content-Type: text/plain; charset=utf-8');
        header('X-Accel-Buffering: no');   // streaming do progresso
        while (ob_get_level()) { @ob_end_flush(); }
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
