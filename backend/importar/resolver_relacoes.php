<?php
// ============================================================================
//  resolver_relacoes.php — Resolve relações cross-ano e recalcula vigência
//
//  Cada importação diária rescreve ato_relacoes zerando ato_destino_id.
//  Este script relê todas as relações pendentes e tenta casar o texto citado
//  com atos já no banco (de qualquer ano), completando o link cross-ano.
//  Em seguida atualiza atos.status (Ativo/Alterado/Revogado) de acordo.
//
//  É incluído automaticamente pelo importar.php — mas pode rodar sozinho:
//
//  CLI:
//    /usr/local/bin/ea-php83 /home2/fanara87/uff.fanara.com.br/importar/resolver_relacoes.php
//
//  Web (com token do config.php):
//    https://uff.fanara.com.br/importar/resolver_relacoes.php?token=SEU_SEGREDO
// ============================================================================

if (!function_exists('log_')) {
    function log_(string $m): void { echo $m . "\n"; @flush(); }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mapeia texto de ato_destino_texto → ['tipo', 'sigla', 'numero'].
 * Retorna null se o formato não for reconhecido.
 */
function parse_destino(string $texto): ?array
{
    // Separa em "tudo antes de nº" e "número depois"
    if (!preg_match('/^(.+?)\s+n[ºo°]\s*(.+)$/u', $texto, $m)) return null;

    $prefix = mb_strtolower(trim($m[1]), 'UTF-8');
    $numero = trim($m[2]);

    // Mapa: prefixo em minúsculas → tipo canônico (maiúsculas, igual a atos.tipo)
    // Ordenado do mais longo ao mais curto para evitar match parcial de "OS" em "ORDEM DE SERVIÇO"
    $tipos = [
        'determinação de serviço' => 'DETERMINAÇÃO DE SERVIÇO',
        'instrução normativa'      => 'INSTRUÇÃO NORMATIVA',
        'norma de serviço'         => 'NORMA DE SERVIÇO',
        'ordem de serviço'         => 'ORDEM DE SERVIÇO',
        'resumo de despachos e decisões' => 'RESUMO DE DESPACHOS E DECISÕES',
        'resumo de despachos'      => 'RESUMO DE DESPACHOS',
        'deliberação'              => 'DELIBERAÇÃO',
        'comunicado'               => 'COMUNICADO',
        'resolução'                => 'RESOLUÇÃO',
        'portaria'                 => 'PORTARIA',
        'decisão'                  => 'DECISÃO',
        'edital'                   => 'EDITAL',
        'dts'                      => 'DETERMINAÇÃO DE SERVIÇO',
        'in'                       => 'INSTRUÇÃO NORMATIVA',
        'ns'                       => 'NORMA DE SERVIÇO',
        'os'                       => 'ORDEM DE SERVIÇO',
    ];

    $tipo_canonico = null;
    $sigla = '';
    foreach ($tipos as $pattern => $canonico) {
        $plen = mb_strlen($pattern, 'UTF-8');
        if (mb_substr($prefix, 0, $plen, 'UTF-8') === $pattern) {
            $tipo_canonico = $canonico;
            $sigla = mb_strtoupper(trim(mb_substr($prefix, $plen, null, 'UTF-8'), " /.,"), 'UTF-8');
            break;
        }
    }
    if (!$tipo_canonico) return null;

    return ['tipo' => $tipo_canonico, 'sigla' => $sigla, 'numero' => $numero];
}

/**
 * Gera variantes do número para busca tolerante a zeros iniciais e pontos.
 * Ex.: "026" → ["026","26"]   "65.784" → ["65.784","65784"]
 */
function numero_variantes(string $num): array
{
    $sem_zeros  = ltrim(preg_replace('/^0+(\d)/', '$1', $num), '') ?: $num;
    $sem_pontos = str_replace('.', '', $num);
    $sem_ambos  = ltrim(str_replace('.', '', $num), '0') ?: $sem_pontos;
    return array_values(array_unique([$num, $sem_zeros, $sem_pontos, $sem_ambos]));
}

/**
 * Tenta encontrar o id do ato destino na tabela atos.
 * Retorna o id (string) ou null se não encontrado.
 */
function buscar_destino(PDO $pdo, array $parsed): ?string
{
    $nums = numero_variantes($parsed['numero']);
    $ph   = implode(',', array_fill(0, count($nums), '?'));
    $sql  = "SELECT id, sigla FROM atos WHERE tipo=? AND numero IN ($ph)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge([$parsed['tipo']], $nums));
    $rows = $stmt->fetchAll();

    if (!$rows) return null;
    if (count($rows) === 1) return $rows[0]['id'];

    // Múltiplos resultados: tenta afinar pela sigla
    if ($parsed['sigla'] !== '') {
        $sigla_sem_uff = str_ireplace('/UFF', '', $parsed['sigla']);
        foreach ($rows as $r) {
            $s = mb_strtoupper($r['sigla'], 'UTF-8');
            if ($s === $parsed['sigla'] || $s === $sigla_sem_uff) {
                return $r['id'];
            }
        }
    }

    // Melhor esforço: retorna o primeiro (mais recente, pois ORDER não foi definida)
    return $rows[0]['id'];
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

function resolver_cross_ano(PDO $pdo): void
{
    // 1. Relações ainda sem destino resolvido
    $pendentes = $pdo->query(
        "SELECT r.id, r.ato_id, r.tipo_relacao, r.ato_destino_texto
         FROM ato_relacoes r
         WHERE r.ato_destino_id IS NULL
           AND r.ato_destino_texto <> ''
         ORDER BY r.ato_id"
    )->fetchAll();

    if (!$pendentes) {
        log_("Relações cross-ano: nenhuma pendente.");
        return;
    }

    log_("Relações cross-ano: " . count($pendentes) . " pendentes. Resolvendo...");

    $upd = $pdo->prepare(
        "UPDATE ato_relacoes SET ato_destino_id=? WHERE id=?"
    );

    $n_ok  = 0;
    $n_miss = 0;
    $destinos_novos = []; // id_destino → tipo_relacao mais forte

    foreach ($pendentes as $rel) {
        $parsed = parse_destino($rel['ato_destino_texto']);
        if (!$parsed) { $n_miss++; continue; }

        $dest_id = buscar_destino($pdo, $parsed);
        if (!$dest_id) { $n_miss++; continue; }

        $upd->execute([$dest_id, $rel['id']]);
        if ($upd->rowCount() > 0) {
            $n_ok++;
            // Guarda a relação mais forte que afeta este destino
            $anterior = $destinos_novos[$dest_id] ?? null;
            $atual    = $rel['tipo_relacao'];
            // Prioridade: REVOGA > TORNA SEM EFEITO > ANULA > ALTERA > resto
            $prio = ['REVOGA' => 4, 'TORNA SEM EFEITO' => 3, 'ANULA' => 3, 'ALTERA' => 2];
            if (!$anterior || ($prio[$atual] ?? 0) > ($prio[$anterior] ?? 0)) {
                $destinos_novos[$dest_id] = $atual;
            }
        }
    }

    log_("  resolvidas: $n_ok | não encontradas: $n_miss");

    if (!$destinos_novos) return;

    // 2. Atualiza status apenas dos atos que acabaram de receber um link
    //    Revogado tem prioridade sobre Alterado.
    $ids_q = implode(',', array_map(fn($id) => $pdo->quote($id), array_keys($destinos_novos)));

    // Marca Revogado (qualquer relação forte existente no banco, não só as de hoje)
    $pdo->exec(
        "UPDATE atos SET status='Revogado'
         WHERE id IN ($ids_q)
           AND EXISTS (
               SELECT 1 FROM ato_relacoes
               WHERE ato_destino_id = atos.id
                 AND tipo_relacao IN ('REVOGA','TORNA SEM EFEITO','ANULA')
           )"
    );

    // Marca Alterado só se ainda Ativo
    $pdo->exec(
        "UPDATE atos SET status='Alterado'
         WHERE id IN ($ids_q)
           AND status = 'Ativo'
           AND EXISTS (
               SELECT 1 FROM ato_relacoes
               WHERE ato_destino_id = atos.id
                 AND tipo_relacao = 'ALTERA'
           )"
    );

    log_("Status atualizado para " . count($destinos_novos) . " atos.");
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
