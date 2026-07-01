<?php
// ============================================================================
//  API REST (somente leitura) do Portal de Normas e Atos da UFF.
//  Rotas (via reescrita .htaccess OU ?r=):
//    GET /api/stats                 -> totais para o painel
//    GET /api/filtros               -> listas distintas (tipos, órgãos, anos)
//    GET /api/atos?...              -> lista paginada com filtros/busca
//    GET /api/atos/{id}  (ou ?r=ato&id=) -> ficha completa de um ato
//  Todas as consultas usam prepared statements (PDO).
// ============================================================================

require __DIR__ . '/db.php';
$cfg = carregar_config();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ($cfg['cors_origin'] ?? '*'));
header('Access-Control-Allow-Methods: GET, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { exit; }

try {
    $pdo = conectar($cfg);
} catch (Throwable $e) {
    responder_json(['erro' => 'Falha ao conectar no banco.'], 500);
}

// ---- roteamento -----------------------------------------------------------
$recurso = $_GET['r'] ?? '';
$id = $_GET['id'] ?? '';
$path = trim($_SERVER['PATH_INFO'] ?? '', '/');   // ex.: "atos/56-26-portaria-1004-2026"
if ($path !== '') {
    $partes = explode('/', $path);
    $recurso = $partes[0];
    if ($recurso === 'atos' && isset($partes[1])) { $recurso = 'ato'; $id = $partes[1]; }
}

switch ($recurso) {
    case 'stats':   stats($pdo); break;
    case 'filtros': filtros($pdo); break;
    case 'chefias': chefias($pdo); break;
    case 'ato':     ficha($pdo, $id); break;
    case 'atos':
    default:        listar($pdo); break;
}

// ===========================================================================
function booleanize(string $s): string {
    $tokens = preg_split('/\s+/', trim($s));
    $out = [];
    foreach ($tokens as $t) {
        $t = preg_replace('/[+\-><()~*"@]/u', '', $t);
        if (mb_strlen($t) >= 3) $out[] = '+' . $t . '*';
    }
    return $out ? implode(' ', $out) : '';
}

// ---- LISTA paginada -------------------------------------------------------
function listar(PDO $pdo): void {
    $where = [];
    $p = [];

    $q = trim($_GET['busca'] ?? '');
    if ($q !== '') {
        $ft = booleanize($q);
        if ($ft !== '') {
            $where[] = "(a.numero LIKE :qlike OR a.identificador LIKE :qlike OR a.processo_sei LIKE :qlike "
                     . "OR MATCH(a.ementa,a.conteudo_resumido) AGAINST(:qft IN BOOLEAN MODE))";
            $p[':qft'] = $ft;
        } else {
            $where[] = "(a.numero LIKE :qlike OR a.identificador LIKE :qlike OR a.processo_sei LIKE :qlike)";
        }
        $p[':qlike'] = '%' . $q . '%';
    }
    foreach (['tipo' => 'a.tipo', 'orgao' => 'a.sigla', 'status' => 'a.status'] as $par => $col) {
        $v = trim($_GET[$par] ?? '');
        if ($v !== '' && $v !== 'todos') { $where[] = "$col = :$par"; $p[":$par"] = $v; }
    }
    if (($ano = trim($_GET['ano'] ?? '')) !== '' && $ano !== 'todos') { $where[] = "a.ano = :ano"; $p[':ano'] = (int)$ano; }

    $nome = trim($_GET['nome'] ?? '');
    if ($nome !== '') {
        $nft = booleanize($nome);
        if ($nft !== '') {
            $where[] = "EXISTS (SELECT 1 FROM ato_corpo c WHERE c.ato_id=a.id AND MATCH(c.texto) AGAINST(:nft IN BOOLEAN MODE))";
            $p[':nft'] = $nft;
        } else {
            $where[] = "EXISTS (SELECT 1 FROM ato_corpo c WHERE c.ato_id=a.id AND c.texto LIKE :nlike)";
            $p[':nlike'] = '%' . mb_strtolower($nome) . '%';
        }
    }
    $siape = preg_replace('/\D/', '', $_GET['siape'] ?? '');
    if ($siape !== '') {
        $where[] = "EXISTS (SELECT 1 FROM ato_siapes s WHERE s.ato_id=a.id AND s.siape LIKE :siape)";
        $p[':siape'] = '%' . $siape . '%';
    }
    if (!empty($_GET['com_sei']))  { $where[] = "a.processo_sei IS NOT NULL AND a.processo_sei <> ''"; }
    if (!empty($_GET['com_relacoes'])) {
        $where[] = "(EXISTS(SELECT 1 FROM ato_relacoes r WHERE r.ato_id=a.id) "
                 . "OR EXISTS(SELECT 1 FROM ato_relacoes r WHERE r.ato_destino_id=a.id))";
    }

    $sql_where = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    // total
    $st = $pdo->prepare("SELECT COUNT(*) FROM atos a $sql_where");
    $st->execute($p);
    $total = (int)$st->fetchColumn();

    // ordenação (whitelist) e paginação
    $cols = ['data_ato' => 'a.data_ato', 'ano' => 'a.ano', 'tipo' => 'a.tipo',
             'sigla' => 'a.sigla', 'numero' => 'a.numero', 'status' => 'a.status'];
    $ord = $cols[$_GET['ordenar'] ?? 'data_ato'] ?? 'a.data_ato';
    $dir = strtolower($_GET['dir'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';
    $por = min(max((int)($_GET['por_pagina'] ?? 50), 1), 200);
    $pag = max((int)($_GET['pagina'] ?? 1), 1);
    $off = ($pag - 1) * $por;

    $sql = "SELECT a.id, a.tipo, a.sigla, a.numero, a.ano, a.data_ato, a.ementa,
                   a.status, a.processo_sei,
              (SELECT GROUP_CONCAT(DISTINCT r.tipo_relacao) FROM ato_relacoes r WHERE r.ato_id=a.id) AS rel_tipos,
              (SELECT COUNT(*) FROM ato_relacoes r2 WHERE r2.ato_destino_id=a.id) AS ref_count
            FROM atos a $sql_where
            ORDER BY $ord $dir, a.id ASC
            LIMIT $off, $por";
    $st = $pdo->prepare($sql);
    $st->execute($p);
    $atos = array_map(function ($r) {
        return [
            'id' => $r['id'], 'tipo' => $r['tipo'], 'sigla' => $r['sigla'],
            'numero' => $r['numero'], 'ano' => (int)$r['ano'],
            'dataAssinatura' => $r['data_ato'], 'ementa' => $r['ementa'],
            'status' => $r['status'], 'processoSei' => $r['processo_sei'],
            'relTipos' => $r['rel_tipos'] ? explode(',', $r['rel_tipos']) : [],
            'refCount' => (int)$r['ref_count'],
        ];
    }, $st->fetchAll());

    responder_json([
        'total' => $total, 'pagina' => $pag, 'por_pagina' => $por,
        'paginas' => (int)ceil($total / $por), 'atos' => $atos,
    ]);
}

// ---- FICHA de um ato ------------------------------------------------------
function ficha(PDO $pdo, string $id): void {
    if ($id === '') responder_json(['erro' => 'id ausente'], 400);
    $st = $pdo->prepare("SELECT * FROM atos WHERE id = :id");
    $st->execute([':id' => $id]);
    $a = $st->fetch();
    if (!$a) responder_json(['erro' => 'ato não encontrado'], 404);

    $st = $pdo->prepare("SELECT siape, nome FROM ato_siapes WHERE ato_id=:id
                         ORDER BY nome IS NULL, nome, siape");
    $st->execute([':id' => $id]);
    $rowsSiape = $st->fetchAll();
    $siapes = array_column($rowsSiape, 'siape');
    $pessoas = array_map(fn($r) => ['nome' => $r['nome'], 'siape' => $r['siape']], $rowsSiape);

    $st = $pdo->prepare("SELECT tipo_relacao, ato_destino_texto, ato_destino_id, detalhes
                         FROM ato_relacoes WHERE ato_id=:id");
    $st->execute([':id' => $id]);
    $relacoes = $st->fetchAll();

    $st = $pdo->prepare("SELECT r.tipo_relacao, r.ato_id AS por_id, r.detalhes,
                                a.tipo, a.sigla, a.numero, a.ano
                         FROM ato_relacoes r JOIN atos a ON a.id=r.ato_id
                         WHERE r.ato_destino_id=:id");
    $st->execute([':id' => $id]);
    $refs = array_map(function ($r) {
        return [
            'relacao' => $r['tipo_relacao'], 'porId' => $r['por_id'],
            'porLabel' => trim("{$r['tipo']} {$r['sigla']} nº {$r['numero']}/{$r['ano']}"),
            'detalhes' => $r['detalhes'],
        ];
    }, $st->fetchAll());

    $st = $pdo->prepare("SELECT tag FROM ato_tags WHERE ato_id=:id");
    $st->execute([':id' => $id]);
    $tags = array_column($st->fetchAll(), 'tag');

    responder_json([
        'id' => $a['id'], 'tipoAto' => $a['tipo'], 'sigla' => $a['sigla'],
        'orgaoEmissor' => $a['sigla'], 'numero' => $a['numero'], 'ano' => (int)$a['ano'],
        'dataAssinatura' => $a['data_ato'], 'ementa' => $a['ementa'],
        'conteudoResumido' => $a['conteudo_resumido'], 'signatario' => $a['signatario'],
        'status' => $a['status'], 'processoSei' => $a['processo_sei'],
        'seiDocumento' => $a['sei_documento'],
        'linkSeiProcesso' => $a['link_sei_processo'],
        'linkSeiDocumento' => $a['link_sei_documento'],
        'linkBoletim' => $a['link_boletim'], 'secao' => $a['secao'], 'pagina' => $a['pagina'],
        'siapes' => $siapes, 'pessoas' => $pessoas, 'tags' => $tags,
        'relacoes' => array_map(fn($r) => [
            'tipoRelacao' => $r['tipo_relacao'], 'atoDestino' => $r['ato_destino_texto'],
            'atoDestinoId' => $r['ato_destino_id'], 'detalhes' => $r['detalhes'],
        ], $relacoes),
        'referenciadoPor' => $refs,
    ]);
}

// ---- ESTATÍSTICAS ---------------------------------------------------------
function stats(PDO $pdo): void {
    $row = $pdo->query("SELECT
        COUNT(*) total,
        SUM(status='Ativo') vigentes,
        SUM(status='Revogado') revogados,
        SUM(status='Alterado') alterados,
        COUNT(DISTINCT sigla) orgaos,
        SUM(processo_sei IS NOT NULL AND processo_sei<>'') com_sei
      FROM atos")->fetch();
    $boletins = (int)$pdo->query("SELECT COUNT(*) FROM boletins")->fetchColumn();
    responder_json([
        'total' => (int)$row['total'], 'vigentes' => (int)$row['vigentes'],
        'revogados' => (int)$row['revogados'], 'alterados' => (int)$row['alterados'],
        'orgaos' => (int)$row['orgaos'], 'comSei' => (int)$row['com_sei'],
        'boletins' => $boletins,
    ]);
}

// ---- FILTROS (listas para os menus) --------------------------------------
function filtros(PDO $pdo): void {
    responder_json([
        'tipos'  => array_column($pdo->query("SELECT DISTINCT tipo FROM atos ORDER BY tipo")->fetchAll(), 'tipo'),
        'orgaos' => array_column($pdo->query("SELECT DISTINCT sigla FROM atos WHERE sigla<>'' ORDER BY sigla")->fetchAll(), 'sigla'),
        'anos'   => array_map('intval', array_column($pdo->query("SELECT DISTINCT ano FROM atos WHERE ano IS NOT NULL ORDER BY ano DESC")->fetchAll(), 'ano')),
    ]);
}

// ---- CHEFIAS (titular atual por unidade + cargo) -------------------------
// Projeção temporal: para cada (cargo, unidade), vale a designação MAIS
// RECENTE não substituída. Se o evento mais novo da posição é uma dispensa,
// a posição fica vaga (não listada). Tudo rastreável ao ato de origem.
function chefias(PDO $pdo): void {
    // a tabela pode não existir ainda (base antiga) — responde vazio nesse caso.
    try {
        $existe = $pdo->query("SHOW TABLES LIKE 'ato_funcoes'")->fetch();
    } catch (Throwable $e) { $existe = false; }
    if (!$existe) { responder_json(['total' => 0, 'atualizadoEm' => date('Y-m-d'), 'chefias' => []]); }

    $rows = $pdo->query("
        SELECT f.cargo, f.unidade, f.unidade_chave, f.siape,
               COALESCE(NULLIF(f.nome,''), s.nome) AS nome,
               a.id AS ato_id, a.data_ato, a.tipo, a.numero, a.ano, a.link_boletim
        FROM ato_funcoes f
        JOIN atos a ON a.id = f.ato_id
        LEFT JOIN ato_siapes s ON s.ato_id = f.ato_id AND s.siape = f.siape
        JOIN (
            SELECT f2.unidade_chave, f2.cargo, MAX(a2.data_ato) AS dmax
            FROM ato_funcoes f2 JOIN atos a2 ON a2.id = f2.ato_id
            WHERE a2.data_ato IS NOT NULL
            GROUP BY f2.unidade_chave, f2.cargo
        ) u ON u.unidade_chave = f.unidade_chave AND u.cargo = f.cargo AND a.data_ato = u.dmax
        WHERE f.acao = 'designar'
        ORDER BY f.unidade, f.cargo, a.id DESC
    ")->fetchAll();

    // dedupe por (unidade_chave|cargo): trata empate de data (ex.: boletim
    // retificado repete a designação na mesma data) ficando com o ato mais novo.
    $vistos = [];
    $chefias = [];
    foreach ($rows as $r) {
        $k = $r['unidade_chave'] . '|' . mb_strtolower($r['cargo']);
        if (isset($vistos[$k])) continue;
        $vistos[$k] = true;
        $chefias[] = [
            'cargo' => $r['cargo'],
            'unidade' => $r['unidade'],
            'nome' => $r['nome'],
            'siape' => $r['siape'],
            'desde' => $r['data_ato'],
            'atoId' => $r['ato_id'],
            'atoLabel' => trim("{$r['tipo']} nº {$r['numero']}/{$r['ano']}"),
            'linkBoletim' => $r['link_boletim'],
        ];
    }

    // Deduplica por SIAPE: a mesma pessoa não pode ocupar dois cargos ao mesmo tempo.
    // Ordena por data desc → fica com a designação mais recente; descarta as antigas.
    usort($chefias, fn($a, $b) => strcmp($b['desde'] ?? '', $a['desde'] ?? ''));
    $vistosSiape = [];
    $chefiasFiltradas = [];
    foreach ($chefias as $c) {
        $s = $c['siape'] ?? '';
        if ($s === '' || !isset($vistosSiape[$s])) {
            if ($s !== '') $vistosSiape[$s] = true;
            $chefiasFiltradas[] = $c;
        }
    }
    usort($chefiasFiltradas, fn($a, $b) => strcmp($a['unidade'] ?? '', $b['unidade'] ?? ''));
    $chefias = $chefiasFiltradas;

    responder_json([
        'total' => count($chefias),
        'atualizadoEm' => date('Y-m-d'),
        'chefias' => $chefias,
    ]);
}
