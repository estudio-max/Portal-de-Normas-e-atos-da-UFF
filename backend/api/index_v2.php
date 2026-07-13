<?php
// ============================================================================
//  API REST (somente leitura) do Portal de Normas e Atos da UFF — schema v2.
//  Adaptado de index.php (v1) para o banco normalizado (ato/relacao/orgao/...).
//  Mesmas rotas e MESMO formato de JSON de resposta que o v1 — o frontend
//  (dist/) roda SEM alteração, só apontando pra este backend.
//
//  Mapeamento de schema (v1 -> v2):
//    atos -> ato (tipo string -> tipo_id FK; sigla -> orgao_id FK + sigla_orig)
//    ato_relacoes -> relacao (tipo_relacao->tipo; ato_destino_texto->destino_texto;
//                              ato_destino_id->destino_ato_id; detalhes->trecho)
//    ato_corpo -> ato_texto (texto -> texto_busca p/ FULLTEXT, texto_original p/ exibir)
//    ato_siapes -> ato_pessoa + pessoa (JOIN)
//    ato_funcoes -> ato_funcao
//    ato_tags -> (v2 nao migrou; v1 so repetia o tipo — sintetizado abaixo)
//
//  IMPORTANTE: o "id" público (usado em URLs, ?id=, referenciadoPor etc.) é
//  `ato.uid` (slug legível), NÃO o `ato.id` interno (BIGINT). Todo SELECT
//  expõe `uid AS id` pra manter o contrato com o frontend intacto.
//
//  3 campos existiam em atos (v1) e não têm coluna própria em v2 porque são
//  DERIVÁVEIS (não precisaram de schema novo — ver repo/docs, achado 12/07):
//    link_sei_processo / link_sei_documento -> função determinística de
//      processo_sei / sei_documento (mesma URL do SEI que o extrator gerava)
//    link_boletim -> idêntico a boletim.url_pdf (era só uma cópia por ato)
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
$path = trim($_SERVER['PATH_INFO'] ?? '', '/');
if ($path !== '') {
    $partes = explode('/', $path);
    $recurso = $partes[0];
    if ($recurso === 'atos' && isset($partes[1])) { $recurso = 'ato'; $id = $partes[1]; }
}

switch ($recurso) {
    case 'stats':    stats($pdo); break;
    case 'filtros':  filtros($pdo); break;
    case 'chefias':  chefias($pdo); break;
    case 'insights': insights($pdo); break;
    case 'analitico': analitico($pdo); break;
    case 'prazos':   prazos($pdo); break;
    case 'pad_cadeia': pad_cadeia($pdo, $_GET['processo'] ?? ''); break;
    case 'ato':      ficha($pdo, $id); break;
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

// Links deterministicos (ver cabecalho) — replicam link_sei_processo() /
// link_sei_documento() de repo/tools/extrair_boletim.py.
function link_sei_processo(string $proc): string {
    if ($proc === '') return '';
    return 'https://sei.uff.br/sei/modulos/pesquisa/'
         . 'md_pesq_processo_pesquisar.php?acao_externa=protocolo_pesquisar'
         . '&acao_origem_externa=protocolo_pesquisar'
         . '&id_orgao_acesso_externo=0&txtProtocoloPesquisa=' . $proc;
}
function link_sei_documento(string $cod): string {
    if ($cod === '') return '';
    return 'https://sei.uff.br/sei/controlador_externo.php?'
         . 'acao=documento_conferir&id_orgao_acesso_externo=0&id_documento=' . $cod;
}

// ---- LISTA paginada -------------------------------------------------------
function listar(PDO $pdo): void {
    $where = ["1=1"];
    $p = [];

    $q = trim($_GET['busca'] ?? '');
    if ($q !== '') {
        $ft = booleanize($q);
        if ($ft !== '') {
            $where[] = "(a.numero LIKE :qlike OR a.processo_sei LIKE :qlike "
                     . "OR MATCH(a.ementa) AGAINST(:qft IN BOOLEAN MODE))";
            $p[':qft'] = $ft;
        } else {
            $where[] = "(a.numero LIKE :qlike OR a.processo_sei LIKE :qlike)";
        }
        $p[':qlike'] = '%' . $q . '%';
    }
    if (($v = trim($_GET['tipo'] ?? '')) !== '' && $v !== 'todos') { $where[] = "t.nome = :tipo"; $p[':tipo'] = $v; }
    if (($v = trim($_GET['orgao'] ?? '')) !== '' && $v !== 'todos') { $where[] = "o.sigla = :orgao"; $p[':orgao'] = $v; }
    if (($v = trim($_GET['status'] ?? '')) !== '' && $v !== 'todos') { $where[] = "a.status = :status"; $p[':status'] = $v; }
    if (($ano = trim($_GET['ano'] ?? '')) !== '' && $ano !== 'todos') { $where[] = "a.ano = :ano"; $p[':ano'] = (int)$ano; }

    $nome = trim($_GET['nome'] ?? '');
    if ($nome !== '') {
        $nft = booleanize($nome);
        if ($nft !== '') {
            $where[] = "EXISTS (SELECT 1 FROM ato_texto tx WHERE tx.ato_id=a.id AND MATCH(tx.texto_busca) AGAINST(:nft IN BOOLEAN MODE))";
            $p[':nft'] = $nft;
        } else {
            $where[] = "EXISTS (SELECT 1 FROM ato_texto tx WHERE tx.ato_id=a.id AND tx.texto_busca LIKE :nlike)";
            $p[':nlike'] = '%' . mb_strtolower($nome) . '%';
        }
    }
    $siape = preg_replace('/\D/', '', $_GET['siape'] ?? '');
    if ($siape !== '') {
        $where[] = "EXISTS (SELECT 1 FROM ato_pessoa ap JOIN pessoa ps ON ps.id=ap.pessoa_id WHERE ap.ato_id=a.id AND ps.siape LIKE :siape)";
        $p[':siape'] = '%' . $siape . '%';
    }
    if (!empty($_GET['com_sei']))  { $where[] = "a.processo_sei IS NOT NULL AND a.processo_sei <> ''"; }
    if (!empty($_GET['com_relacoes'])) {
        $where[] = "(EXISTS(SELECT 1 FROM relacao r WHERE r.ato_id=a.id) "
                 . "OR EXISTS(SELECT 1 FROM relacao r WHERE r.destino_ato_id=a.id))";
    }

    $sql_where = 'WHERE ' . implode(' AND ', $where);
    $sql_from  = "FROM ato a JOIN tipo_ato t ON t.id=a.tipo_id JOIN orgao o ON o.id=a.orgao_id";

    $st = $pdo->prepare("SELECT COUNT(*) $sql_from $sql_where");
    $st->execute($p);
    $total = (int)$st->fetchColumn();

    $cols = ['data_ato' => 'a.data_ato', 'ano' => 'a.ano', 'tipo' => 't.nome',
             'sigla' => 'o.sigla', 'numero' => 'a.numero_norm', 'status' => 'a.status'];
    $ord = $cols[$_GET['ordenar'] ?? 'data_ato'] ?? 'a.data_ato';
    $dir = strtolower($_GET['dir'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';
    $por = min(max((int)($_GET['por_pagina'] ?? 50), 1), 200);
    $pag = max((int)($_GET['pagina'] ?? 1), 1);
    $off = ($pag - 1) * $por;

    $sql = "SELECT a.uid AS id, t.nome AS tipo, o.sigla AS sigla, a.numero, a.ano, a.data_ato,
                   a.ementa, a.ementa_inferida, a.status, a.processo_sei,
              (SELECT GROUP_CONCAT(DISTINCT r.tipo) FROM relacao r WHERE r.ato_id=a.id) AS rel_tipos,
              (SELECT COUNT(*) FROM relacao r2 WHERE r2.destino_ato_id=a.id) AS ref_count
            $sql_from $sql_where
            ORDER BY $ord $dir, a.id ASC
            LIMIT $off, $por";
    $st = $pdo->prepare($sql);
    $st->execute($p);
    $atos = array_map(function ($r) {
        return [
            'id' => $r['id'], 'tipo' => $r['tipo'], 'sigla' => $r['sigla'],
            'numero' => $r['numero'], 'ano' => (int)$r['ano'],
            'dataAssinatura' => $r['data_ato'], 'ementa' => $r['ementa'],
            'ementaInferida' => (bool)$r['ementa_inferida'],
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

    $st = $pdo->prepare("
        SELECT a.*, t.nome AS tipo_nome, o.sigla AS orgao_sigla, o.nome AS orgao_nome,
               b.url_pdf AS link_boletim, ps.nome AS signatario_nome
        FROM ato a
        JOIN tipo_ato t ON t.id = a.tipo_id
        JOIN orgao o    ON o.id = a.orgao_id
        LEFT JOIN boletim b ON b.id = a.boletim_id
        LEFT JOIN pessoa ps ON ps.id = a.signatario_id
        WHERE a.uid = :id");
    $st->execute([':id' => $id]);
    $a = $st->fetch();
    if (!$a) responder_json(['erro' => 'ato não encontrado'], 404);
    $aid = $a['id'];   // id interno (BIGINT), p/ os JOINs abaixo

    $st = $pdo->prepare("
        SELECT ps.siape, ps.nome FROM ato_pessoa ap JOIN pessoa ps ON ps.id=ap.pessoa_id
        WHERE ap.ato_id=:id ORDER BY ps.nome IS NULL, ps.nome, ps.siape");
    $st->execute([':id' => $aid]);
    $rowsSiape = $st->fetchAll();
    $siapes = array_column($rowsSiape, 'siape');
    $pessoas = array_map(fn($r) => ['nome' => $r['nome'], 'siape' => $r['siape']], $rowsSiape);

    // relações de SAÍDA (este ato -> outros); destino_uid p/ o front poder linkar
    $st = $pdo->prepare("
        SELECT r.tipo, r.destino_texto, du.uid AS destino_uid, r.trecho
        FROM relacao r LEFT JOIN ato du ON du.id = r.destino_ato_id
        WHERE r.ato_id=:id");
    $st->execute([':id' => $aid]);
    $relacoes = $st->fetchAll();

    // relações de ENTRADA (quem cita este ato)
    $st = $pdo->prepare("
        SELECT r.tipo, ao.uid AS por_uid, r.trecho,
               ot.nome AS ao_tipo, oo.sigla AS ao_sigla, ao.numero, ao.ano
        FROM relacao r
        JOIN ato ao        ON ao.id = r.ato_id
        JOIN tipo_ato ot   ON ot.id = ao.tipo_id
        JOIN orgao oo      ON oo.id = ao.orgao_id
        WHERE r.destino_ato_id=:id");
    $st->execute([':id' => $aid]);
    $refs = array_map(function ($r) {
        return [
            'relacao' => $r['tipo'], 'porId' => $r['por_uid'],
            'porLabel' => trim("{$r['ao_tipo']} {$r['ao_sigla']} nº {$r['numero']}/{$r['ano']}"),
            'detalhes' => $r['trecho'],
        ];
    }, $st->fetchAll());

    // v2 não migrou ato_tags (v1 só repetia o tipo, sem valor próprio) —
    // sintetiza o mesmo comportamento prático sem depender de tabela vazia.
    $tags = [$a['tipo_nome']];

    $ementa = $a['ementa'] ?: '';
    responder_json([
        'id' => $a['uid'], 'tipoAto' => $a['tipo_nome'], 'sigla' => $a['orgao_sigla'],
        'orgaoEmissor' => $a['orgao_nome'] ?: $a['orgao_sigla'],
        'numero' => $a['numero'], 'ano' => (int)$a['ano'],
        'dataAssinatura' => $a['data_ato'], 'ementa' => $ementa,
        'ementaInferida' => (bool)$a['ementa_inferida'],
        'conteudoResumido' => $ementa ?: 'Ato administrativo publicado no Boletim de Serviço da UFF.',
        'signatario' => $a['signatario_nome'],
        'status' => $a['status'], 'processoSei' => $a['processo_sei'],
        'seiDocumento' => $a['sei_documento'],
        'linkSeiProcesso' => link_sei_processo((string)($a['processo_sei'] ?? '')),
        'linkSeiDocumento' => link_sei_documento((string)($a['sei_documento'] ?? '')),
        'linkBoletim' => $a['link_boletim'], 'secao' => $a['secao'], 'pagina' => $a['pagina'],
        'siapes' => $siapes, 'pessoas' => $pessoas, 'tags' => $tags,
        'relacoes' => array_map(fn($r) => [
            'tipoRelacao' => $r['tipo'], 'atoDestino' => $r['destino_texto'],
            'atoDestinoId' => $r['destino_uid'], 'detalhes' => $r['trecho'],
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
        COUNT(DISTINCT orgao_id) orgaos,
        SUM(processo_sei IS NOT NULL AND processo_sei<>'') com_sei
      FROM ato")->fetch();
    $boletins = (int)$pdo->query("SELECT COUNT(*) FROM boletim")->fetchColumn();
    // "Atualização mais recente" — ver nota original no v1 (index.php): marca
    // quando o último ato NOVO entrou, e linka o boletim de maior numeração.
    $ultData = $pdo->query("SELECT DATE(MAX(criado_em)) FROM ato")->fetchColumn();
    $ult = $pdo->query("
        SELECT b.arquivo, b.numero, b.ano, b.url_pdf AS link
        FROM boletim b
        ORDER BY b.ano DESC, b.numero DESC
        LIMIT 1")->fetch();
    responder_json([
        'total' => (int)$row['total'], 'vigentes' => (int)$row['vigentes'],
        'revogados' => (int)$row['revogados'], 'alterados' => (int)$row['alterados'],
        'orgaos' => (int)$row['orgaos'], 'comSei' => (int)$row['com_sei'],
        'boletins' => $boletins,
        'ultimaAtualizacao' => $ultData ?: null,
        'ultimoBoletim' => $ult ? [
            'arquivo' => $ult['arquivo'],
            'numero'  => $ult['numero'],
            'ano'     => (int)$ult['ano'],
            'link'    => $ult['link'],
        ] : null,
    ]);
}

// ---- FILTROS (listas para os menus) --------------------------------------
function filtros(PDO $pdo): void {
    responder_json([
        'tipos'  => array_column($pdo->query("SELECT nome FROM tipo_ato ORDER BY nome")->fetchAll(), 'nome'),
        'orgaos' => array_column($pdo->query(
            "SELECT DISTINCT o.sigla FROM orgao o JOIN ato a ON a.orgao_id=o.id ORDER BY o.sigla")->fetchAll(), 'sigla'),
        'anos'   => array_map('intval', array_column($pdo->query("SELECT DISTINCT ano FROM ato WHERE ano IS NOT NULL ORDER BY ano DESC")->fetchAll(), 'ano')),
    ]);
}

// ---- CHEFIAS (titular atual por unidade + cargo) -------------------------
function chefias(PDO $pdo): void {
    // ps.nome já é a fusão canônica (feita na ETL, dimensão pessoa) do nome
    // livre da designação com o nome indexado por SIAPE — v1 fazia esse
    // COALESCE aqui na query porque tinha 2 tabelas soltas; v2 já resolve na
    // dimensão, 1 JOIN só.
    $rows = $pdo->query("
        SELECT f.cargo, f.unidade, f.unidade AS unidade_chave, ps.siape, ps.nome,
               a.uid AS ato_id, a.data_ato, t.nome AS tipo, a.numero, a.ano, b.url_pdf AS link_boletim
        FROM ato_funcao f
        JOIN ato a       ON a.id = f.ato_id
        JOIN tipo_ato t  ON t.id = a.tipo_id
        LEFT JOIN boletim b ON b.id = a.boletim_id
        LEFT JOIN pessoa ps  ON ps.id = f.pessoa_id
        JOIN (
            SELECT f2.unidade AS unidade_chave, f2.cargo, MAX(a2.data_ato) AS dmax
            FROM ato_funcao f2 JOIN ato a2 ON a2.id = f2.ato_id
            WHERE a2.data_ato IS NOT NULL
            GROUP BY f2.unidade, f2.cargo
        ) u ON u.unidade_chave = f.unidade AND u.cargo = f.cargo AND a.data_ato = u.dmax
        WHERE f.acao = 'designar'
        ORDER BY f.unidade, f.cargo, a.id DESC
    ")->fetchAll();

    $vistos = [];
    $chefias = [];
    foreach ($rows as $r) {
        $k = $r['unidade_chave'] . '|' . mb_strtolower($r['cargo']);
        if (isset($vistos[$k])) continue;
        $vistos[$k] = true;
        $chefias[] = [
            'cargo' => $r['cargo'], 'unidade' => $r['unidade'], 'nome' => $r['nome'],
            'siape' => $r['siape'], 'desde' => $r['data_ato'], 'atoId' => $r['ato_id'],
            'atoLabel' => trim("{$r['tipo']} nº {$r['numero']}/{$r['ano']}"),
            'linkBoletim' => $r['link_boletim'], '_k' => $k,
        ];
    }

    // Situação ATUAL de cada pessoa (ver nota completa no v1/index.php) —
    // último evento (designar/dispensar) por SIAPE, em qualquer unidade.
    $ult = [];
    $ev = $pdo->query("
        SELECT ps.siape, f.acao, f.unidade AS unidade_chave, LOWER(f.cargo) AS cargo, a.data_ato
        FROM ato_funcao f
        JOIN ato a ON a.id = f.ato_id
        LEFT JOIN pessoa ps ON ps.id = f.pessoa_id
        WHERE ps.siape IS NOT NULL AND ps.siape <> '' AND a.data_ato IS NOT NULL");
    while ($e = $ev->fetch()) {
        $s = $e['siape'];
        $m = $ult[$s] ?? null;
        if (!$m || $e['data_ato'] > $m['data']
                || ($e['data_ato'] === $m['data'] && $e['acao'] === 'designar')) {
            $ult[$s] = ['data' => $e['data_ato'], 'acao' => $e['acao'],
                        'k' => $e['unidade_chave'] . '|' . $e['cargo']];
        }
    }
    $chefiasFiltradas = [];
    foreach ($chefias as $c) {
        $s = $c['siape'] ?? '';
        if ($s !== '' && isset($ult[$s])) {
            $u = $ult[$s];
            if ($u['acao'] !== 'designar') continue;
            if ($u['k'] !== $c['_k']) continue;
        }
        unset($c['_k']);
        $chefiasFiltradas[] = $c;
    }
    // Corte de mandato (ver nota completa no v1) — 4 anos, exceto alta
    // administração (Pró-Reitor/Superintendente/Vice-Reitor).
    $limiteMandato = date('Y-m-d', strtotime('-4 years'));
    $chefiasFiltradas = array_values(array_filter(
        $chefiasFiltradas,
        fn($c) => $c['desde'] >= $limiteMandato
                  || preg_match('/pró-?reitor|superintendente|vice-?reitor/iu', $c['cargo'])
    ));
    // Reitor é nomeado por decreto presidencial (fora do Boletim) — nunca sai certo daqui.
    $chefiasFiltradas = array_values(array_filter(
        $chefiasFiltradas, fn($c) => mb_strtolower(trim($c['cargo'])) !== 'reitor'
    ));

    // Curadoria da alta administração (ver nota completa no v1) — mesmas 3
    // designações órfãs suprimidas, traduzidas do id v1 (slug) pro uid v2:
    //   v1 094-2011-portaria-ato-44-558-2011 -> v2 port-reitoria-44558-2011
    //   v1 147-2011-portaria-ato-43-984-2011 -> v2 port-reitoria-43984-2011
    //   v1 147-2011-portaria-ato-43-991-2011 -> v2 port-reitoria-43991-2011
    $suprimir = [
        'port-reitoria-44558-2011' => 1,
        'port-reitoria-43984-2011' => 1,
        'port-reitoria-43991-2011' => 1,
    ];
    $chefiasFiltradas = array_values(array_filter(
        $chefiasFiltradas, fn($c) => empty($suprimir[$c['atoId'] ?? ''])
    ));

    usort($chefiasFiltradas, fn($a, $b) => strcmp($a['unidade'] ?? '', $b['unidade'] ?? ''));
    $chefias = $chefiasFiltradas;

    responder_json([
        'total' => count($chefias),
        'atualizadoEm' => date('Y-m-d'),
        'chefias' => $chefias,
    ]);
}

// ---- INSIGHTS (agregações para a aba de painéis) --------------------------
function insights(PDO $pdo): void {
    $anoParam = trim($_GET['ano'] ?? '');
    $temAno   = ($anoParam !== '' && $anoParam !== 'todos');
    $anoInt   = (int)$anoParam;

    $rodar = function (string $sql) use ($pdo, $temAno, $anoInt) {
        $st = $pdo->prepare($sql);
        if ($temAno && strpos($sql, ':ano') !== false) {
            $st->bindValue(':ano', $anoInt, PDO::PARAM_INT);
        }
        $st->execute();
        return $st;
    };
    $wAto = $temAno ? 'WHERE ano = :ano' : '';
    $andData = $temAno ? 'AND ano = :ano' : '';

    $k = $rodar("SELECT
        COUNT(*) total,
        SUM(processo_sei IS NOT NULL AND processo_sei<>'') com_sei,
        SUM(status='Revogado') revogados,
        SUM(status='Alterado') alterados,
        COUNT(DISTINCT orgao_id) orgaos,
        MIN(data_ato) dmin, MAX(data_ato) dmax
      FROM ato $wAto")->fetch();

    $relacoes = (int)$rodar(
        "SELECT COUNT(*) FROM relacao r JOIN ato a ON a.id = r.ato_id "
        . ($temAno ? 'WHERE a.ano = :ano' : '')
    )->fetchColumn();

    $porDia = $rodar(
        "SELECT data_ato d, COUNT(*) n FROM ato
         WHERE data_ato IS NOT NULL $andData GROUP BY data_ato ORDER BY data_ato"
    )->fetchAll(PDO::FETCH_ASSOC);

    $porMes = $rodar(
        "SELECT DATE_FORMAT(data_ato,'%Y-%m') ym, COUNT(*) n FROM ato
         WHERE data_ato IS NOT NULL $andData GROUP BY ym ORDER BY ym"
    )->fetchAll(PDO::FETCH_ASSOC);

    $porOrgao = $rodar(
        "SELECT o.sigla, COUNT(*) n,
                SUM(a.processo_sei IS NOT NULL AND a.processo_sei<>'') com_sei
         FROM ato a JOIN orgao o ON o.id=a.orgao_id
         WHERE 1=1 $andData
         GROUP BY o.sigla ORDER BY n DESC LIMIT 12"
    )->fetchAll(PDO::FETCH_ASSOC);

    $porTipo = $rodar(
        "SELECT t.nome AS tipo, COUNT(*) n FROM ato a JOIN tipo_ato t ON t.id=a.tipo_id $wAto GROUP BY t.nome ORDER BY n DESC"
    )->fetchAll(PDO::FETCH_ASSOC);

    $anos = array_map('intval', array_column(
        $pdo->query("SELECT DISTINCT ano FROM ato WHERE ano IS NOT NULL ORDER BY ano DESC")->fetchAll(),
        'ano'
    ));

    $total = (int)$k['total'];
    $revog = (int)$k['revogados'];
    $alter = (int)$k['alterados'];

    responder_json([
        'ano'  => $temAno ? $anoInt : null,
        'anos' => $anos,
        'kpis' => [
            'total'     => $total,
            'comSei'    => (int)$k['com_sei'],
            'revogados' => $revog,
            'alterados' => $alter,
            'vigentes'  => $total - $revog - $alter,
            'orgaos'    => (int)$k['orgaos'],
            'relacoes'  => $relacoes,
            'dataMin'   => $k['dmin'],
            'dataMax'   => $k['dmax'],
        ],
        'porDia'   => array_map(fn($r) => ['d' => $r['d'], 'n' => (int)$r['n']], $porDia),
        'porMes'   => array_map(fn($r) => ['ym' => $r['ym'], 'n' => (int)$r['n']], $porMes),
        'porOrgao' => array_map(fn($r) => ['sigla' => $r['sigla'], 'n' => (int)$r['n'], 'comSei' => (int)$r['com_sei']], $porOrgao),
        'porTipo'  => array_map(fn($r) => ['tipo' => $r['tipo'], 'n' => (int)$r['n']], $porTipo),
    ]);
}

// ---- ANALÍTICO / FASE 2 (rotatividade de chefias + citações defasadas) -----
function analitico(PDO $pdo): void {
    // --- Rotatividade ---
    $cadeiras = [];
    $permanencias = [];
    $rows = $pdo->query("
        SELECT f.unidade AS unidade_chave, f.cargo, f.unidade, f.acao, ps.siape,
               ps.nome, a.data_ato
        FROM ato_funcao f
        JOIN ato a ON a.id = f.ato_id
        LEFT JOIN pessoa ps ON ps.id = f.pessoa_id
        WHERE a.data_ato IS NOT NULL
        ORDER BY f.unidade, f.cargo, a.data_ato
    ")->fetchAll(PDO::FETCH_ASSOC);
    $totalEventos = count($rows);
    $pos = [];
    foreach ($rows as $r) {
        $k = $r['unidade_chave'] . '|' . mb_strtolower($r['cargo']);
        $pos[$k] = $pos[$k] ?? ['cargo' => $r['cargo'], 'unidade' => $r['unidade'], 'ev' => []];
        $pos[$k]['ev'][] = $r;
    }
    foreach ($pos as $p) {
        $titulares = [];
        foreach ($p['ev'] as $e) {
            if ($e['acao'] !== 'designar') continue;
            $ident = $e['siape'] !== null && $e['siape'] !== '' ? $e['siape'] : mb_strtolower($e['nome'] ?? '');
            $ult = end($titulares);
            if (!$ult || $ident !== $ult['ident']) $titulares[] = ['ident' => $ident, 'inicio' => $e['data_ato']];
        }
        if (count($titulares) < 2) continue;
        $durs = [];
        for ($i = 0; $i < count($titulares) - 1; $i++) {
            $m = meses_entre($titulares[$i]['inicio'], $titulares[$i + 1]['inicio']);
            $durs[] = $m; $permanencias[] = $m;
        }
        $cadeiras[] = [
            'unidade' => $p['unidade'], 'cargo' => $p['cargo'],
            'titulares' => count($titulares),
            'permMedia' => round(array_sum($durs) / count($durs), 1),
        ];
    }
    usort($cadeiras, fn($a, $b) => $b['titulares'] <=> $a['titulares'] ?: $a['permMedia'] <=> $b['permMedia']);
    $cadeiras = array_slice($cadeiras, 0, 15);
    sort($permanencias);
    $mediana = $permanencias ? round($permanencias[intdiv(count($permanencias), 2)], 1) : null;

    // --- Citações defasadas ---
    $zumbis = $pdo->query("
        SELECT cit.uid AS cit_id, citT.nome AS cit_tipo, cit.numero AS cit_numero,
               cit.ano AS cit_ano, citO.sigla AS cit_sigla, cit.data_ato AS cit_data,
               citB.url_pdf AS cit_link, r.tipo AS relacao,
               alvoT.nome AS alvo_tipo, alvo.numero AS alvo_numero,
               alvo.ano AS alvo_ano, alvoO.sigla AS alvo_sigla,
               rev.revogado_em AS revogado_em
        FROM relacao r
        JOIN ato cit          ON cit.id  = r.ato_id
        JOIN tipo_ato citT    ON citT.id = cit.tipo_id
        JOIN orgao citO       ON citO.id = cit.orgao_id
        LEFT JOIN boletim citB ON citB.id = cit.boletim_id
        JOIN ato alvo         ON alvo.id = r.destino_ato_id
        JOIN tipo_ato alvoT   ON alvoT.id = alvo.tipo_id
        JOIN orgao alvoO      ON alvoO.id = alvo.orgao_id
        JOIN (
            SELECT rr.destino_ato_id AS alvo_id, MIN(orev.data_ato) AS revogado_em
            FROM relacao rr
            JOIN ato orev ON orev.id = rr.ato_id
            WHERE rr.tipo = 'Revoga'
              AND rr.destino_ato_id IS NOT NULL
              AND orev.data_ato IS NOT NULL
            GROUP BY rr.destino_ato_id
        ) rev ON rev.alvo_id = alvo.id
        WHERE alvo.status = 'Revogado'
          AND r.tipo <> 'Revoga'
          AND r.destino_ato_id IS NOT NULL
          AND cit.data_ato IS NOT NULL
          AND cit.id <> alvo.id
          AND cit.data_ato > rev.revogado_em
        ORDER BY cit.data_ato DESC
        LIMIT 60
    ")->fetchAll(PDO::FETCH_ASSOC);

    $m = $pdo->query("SELECT COUNT(*) total, SUM(status<>'Ativo') mexidos FROM ato")->fetch();

    // --- RH: aposentadorias + vacâncias art. 33 VIII ---
    $rh = [];
    try {
        $apos = $pdo->query("
            SELECT a.ano,
                   SUM(ap.tipo = 'Voluntária')  AS vol,
                   SUM(ap.tipo = 'Compulsória') AS comp,
                   SUM(ap.tipo = 'Invalidez')   AS inval,
                   SUM(ap.tipo = 'Indefinida')  AS indef
            FROM ato_aposentadoria ap JOIN ato a ON a.id = ap.ato_id
            WHERE a.ano BETWEEN 1990 AND 2100
            GROUP BY a.ano
        ")->fetchAll(PDO::FETCH_ASSOC);

        $vac = $pdo->query("
            SELECT a.ano, COUNT(*) AS n
            FROM ato a
            JOIN ato_texto tx ON tx.ato_id = a.id
            WHERE a.ano BETWEEN 1990 AND 2100
              AND MATCH(tx.texto_busca) AGAINST('vago vacancia' IN BOOLEAN MODE)
              AND (tx.texto_busca LIKE '%declarar vago%'  OR tx.texto_busca LIKE '%declara vago%'
                OR tx.texto_busca LIKE '%declarar a vacancia%' OR tx.texto_busca LIKE '%declarada a vacancia%')
              AND (tx.texto_busca LIKE '%inciso viii, do artigo 33%'
                OR tx.texto_busca LIKE '%inciso viii do artigo 33%'
                OR tx.texto_busca LIKE '%posse em outro cargo inacumul%'
                OR tx.texto_busca LIKE '%tendo em vista a posse%')
            GROUP BY a.ano
        ")->fetchAll(PDO::FETCH_ASSOC);

        $vazio = ['vol' => 0, 'comp' => 0, 'inval' => 0, 'indef' => 0, 'vac8' => 0];
        $porAno = [];
        foreach ($apos as $r) {
            $porAno[(int)$r['ano']] = ['vol' => (int)$r['vol'], 'comp' => (int)$r['comp'],
                'inval' => (int)$r['inval'], 'indef' => (int)$r['indef'], 'vac8' => 0];
        }
        foreach ($vac as $r) {
            $y = (int)$r['ano'];
            $porAno[$y] = ($porAno[$y] ?? $vazio);
            $porAno[$y]['vac8'] = (int)$r['n'];
        }
        ksort($porAno);
        foreach ($porAno as $y => $v) { $rh[] = ['ano' => $y] + $v; }
    } catch (Throwable $e) { /* ato_texto/ato_aposentadoria ainda vazias nesta base: painel fica vazio */ }

    // --- Deslocamento de servidor ---
    $desl = ['serie' => [], 'motivos' => [], 'setores' => []];
    try {
        $ds = $pdo->query("
            SELECT a.ano,
                   SUM(d.tipo = 'Remoção') AS remocao,
                   SUM(d.tipo = 'Redistribuição' AND d.direcao = 'Entrada') AS red_entra,
                   SUM(d.tipo = 'Redistribuição' AND d.direcao = 'Saída')   AS red_saida
            FROM ato_deslocamento d JOIN ato a ON a.id = d.ato_id
            WHERE a.ano BETWEEN 1990 AND 2100
            GROUP BY a.ano ORDER BY a.ano
        ")->fetchAll(PDO::FETCH_ASSOC);
        $desl['serie'] = array_map(fn($r) => [
            'ano' => (int)$r['ano'], 'remocao' => (int)$r['remocao'],
            'redEntra' => (int)$r['red_entra'], 'redSaida' => (int)$r['red_saida'],
        ], $ds);

        $mv = $pdo->query("
            SELECT COALESCE(NULLIF(d.motivo, ''), 'Não especificado') AS motivo, COUNT(*) AS n
            FROM ato_deslocamento d WHERE d.tipo = 'Remoção'
            GROUP BY motivo ORDER BY n DESC
        ")->fetchAll(PDO::FETCH_ASSOC);
        $desl['motivos'] = array_map(fn($r) => ['motivo' => $r['motivo'], 'n' => (int)$r['n']], $mv);

        $st = $pdo->query("
            SELECT d.setor AS setor, a.ano, COUNT(*) AS n
            FROM ato_deslocamento d JOIN ato a ON a.id = d.ato_id
            WHERE d.tipo = 'Remoção' AND d.setor <> '' AND a.ano BETWEEN 1990 AND 2100
            GROUP BY d.setor, a.ano
        ")->fetchAll(PDO::FETCH_ASSOC);
        $desl['setores'] = array_map(fn($r) => ['setor' => $r['setor'], 'ano' => (int)$r['ano'], 'n' => (int)$r['n']], $st);
    } catch (Throwable $e) { /* ato_deslocamento ainda vazia nesta base: painel fica vazio */ }

    responder_json([
        'rotatividade' => [
            'posicoesComTroca' => count($cadeiras) < 15 ? count($cadeiras) : null,
            'totalEventos'     => $totalEventos,
            'permanenciasMedidas' => count($permanencias),
            'medianaMeses'     => $mediana,
            'cadeiras'         => array_map(fn($c) => [
                'unidade' => $c['unidade'], 'cargo' => $c['cargo'],
                'titulares' => $c['titulares'], 'permMedia' => $c['permMedia'],
            ], $cadeiras),
        ],
        'zumbis' => array_map(fn($z) => [
            'citLabel' => trim("{$z['cit_tipo']} nº {$z['cit_numero']}/{$z['cit_ano']}"),
            'citSigla' => $z['cit_sigla'], 'citData' => $z['cit_data'],
            'citLink'  => $z['cit_link'], 'relacao' => $z['relacao'],
            'alvoLabel' => trim("{$z['alvo_tipo']} nº {$z['alvo_numero']}/{$z['alvo_ano']}"),
            'alvoSigla' => $z['alvo_sigla'], 'revogadoEm' => $z['revogado_em'],
        ], $zumbis),
        'mortalidade' => [
            'total'   => (int)$m['total'],
            'mexidos' => (int)$m['mexidos'],
        ],
        'seriesRh' => $rh,
        'deslocamento' => $desl,
    ]);
}

function meses_entre(string $a, string $b): float {
    $ta = strtotime($a); $tb = strtotime($b);
    if (!$ta || !$tb) return 0.0;
    return round(($tb - $ta) / (86400 * 30.44), 1);
}

// ---- PRAZOS (radar de datas-limite) ---------------------------------------
// v2: lê os prazos JÁ EXTRAÍDOS da tabela `prazo` (populada pelo importador com
// a mesma lógica do frontend). Acaba com o ponto cego do v1 (que só via os 3000
// atos mais recentes ~11 meses e perdia contratos/validades longos de atos
// antigos) e com o payload de ~8MB (mandava o texto cru de 3000 atos p/ extração
// no cliente). Agora entrega só os prazos relevantes, já prontos, em poucos KB.
// Janela: >= hoje-90d (todos os futuros, de qualquer idade + vencidos recentes
// p/ o toggle "incluir vencidos"). Retorno já no formato Prazo do frontend.
function prazos(PDO $pdo): void {
    // cc = quantos atos PAD/SINVE compartilham o mesmo processo SEI (tamanho da
    // cadeia instauração→prorrogações). Derivado sobre a `prazo` (pequena),
    // ligado só às linhas base='PAD_SINVE'.
    $st = $pdo->query("
        SELECT a.uid AS ato_id,
               CONCAT(t.nome, ' nº ', a.numero, '/', a.ano) AS ato_label,
               o.sigla, p.tipo, p.data_limite, p.conf, p.base, p.publico,
               p.trecho, b.url_pdf AS link_boletim, a.data_ato, a.status, a.ementa,
               a.processo_sei,
               COALESCE(cc.c, 0) AS cadeia_total,
               EXISTS(SELECT 1 FROM relacao r
                      WHERE r.destino_ato_id = a.id AND r.tipo IN ('Altera','Revoga')) AS mexido
        FROM prazo p
        JOIN ato a          ON a.id = p.ato_id
        JOIN tipo_ato t     ON t.id = a.tipo_id
        JOIN orgao o        ON o.id = a.orgao_id
        LEFT JOIN boletim b ON b.id = a.boletim_id
        LEFT JOIN (
            SELECT a2.processo_sei AS sei,
                   COUNT(DISTINCT a2.tipo_id, COALESCE(a2.sigla_orig,''), a2.numero_norm, a2.ano) AS c
            FROM prazo p2 JOIN ato a2 ON a2.id = p2.ato_id
            WHERE p2.base='PAD_SINVE' AND a2.processo_sei IS NOT NULL AND a2.processo_sei <> ''
            GROUP BY a2.processo_sei
        ) cc ON cc.sei = a.processo_sei AND p.base = 'PAD_SINVE'
        WHERE p.data_limite >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        ORDER BY p.data_limite ASC");
    $prazos = array_map(fn($r) => [
        'atoId' => $r['ato_id'], 'atoLabel' => $r['ato_label'], 'sigla' => $r['sigla'] ?? '',
        'tipo' => $r['tipo'], 'dataLimite' => $r['data_limite'], 'conf' => $r['conf'],
        'base' => $r['base'], 'textoOrigem' => $r['trecho'], 'linkBoletim' => $r['link_boletim'],
        'dataAto' => $r['data_ato'], 'mexidoDepois' => (bool)$r['mexido'],
        'status' => $r['status'], 'ementa' => $r['ementa'] ?? '', 'publico' => $r['publico'] ?? '',
        'processoSei' => $r['processo_sei'] ?? '', 'cadeiaTotal' => (int)$r['cadeia_total'],
    ], $st->fetchAll(PDO::FETCH_ASSOC));
    responder_json(['prazos' => $prazos]);
}

// ---- CADEIA de um processo PAD/SINVE (instauração -> prorrogações) ---------
// Âncora = processo SEI: agrupa TODOS os atos PAD/SINVE do mesmo processo, em
// ordem cronológica. Sem filtro de data (mostra o histórico completo). Cada nó
// é um ato_id real (uid), clicável. O papel vem do trecho já materializado.
function pad_cadeia(PDO $pdo, string $proc): void {
    $proc = trim($proc);
    if ($proc === '') responder_json(['erro' => 'processo ausente'], 400);
    $st = $pdo->prepare("
        SELECT a.uid, CONCAT(t.nome, ' nº ', a.numero, '/', a.ano) AS ato_label,
               o.sigla, a.data_ato, a.ementa, a.status,
               p.tipo, p.data_limite, p.publico, p.trecho, b.url_pdf AS link_boletim
        FROM prazo p
        JOIN ato a          ON a.id = p.ato_id
        JOIN tipo_ato t     ON t.id = a.tipo_id
        JOIN orgao o        ON o.id = a.orgao_id
        LEFT JOIN boletim b ON b.id = a.boletim_id
        WHERE p.base = 'PAD_SINVE' AND a.processo_sei = :proc
        ORDER BY a.data_ato ASC, a.id ASC");
    $st->execute([':proc' => $proc]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);
    // Colapsa duplicatas de chave natural (mesma portaria republicada em mais de
    // um boletim => uids -2/-3): é um só ato lógico na cadeia.
    $vistos = [];
    $rows = array_values(array_filter($rows, function ($r) use (&$vistos) {
        $sig = ($r['ato_label'] ?? '') . '|' . ($r['sigla'] ?? '') . '|' . ($r['data_ato'] ?? '');
        if (isset($vistos[$sig])) return false;
        $vistos[$sig] = true;
        return true;
    }));
    $n = count($rows);
    $atos = [];
    foreach ($rows as $idx => $r) {
        $tr = mb_strtolower((string)($r['trecho'] ?? ''), 'UTF-8');
        $papel = strpos($tr, 'sobrest') !== false ? 'Sobrestamento'
               : ((strpos($tr, 'prorrog') !== false || strpos($tr, 'recondu') !== false) ? 'Prorrogação/recondução'
               : (strpos($tr, 'instaura') !== false ? 'Instauração' : '—'));
        $atos[] = [
            'id' => $r['uid'], 'atoLabel' => $r['ato_label'], 'sigla' => $r['sigla'] ?? '',
            'tipo' => $r['tipo'], 'papel' => $papel,
            'dataAto' => $r['data_ato'], 'dataLimite' => $r['data_limite'],
            'ementa' => $r['ementa'] ?? '', 'status' => $r['status'],
            'textoOrigem' => $r['trecho'], 'linkBoletim' => $r['link_boletim'],
            'vigente' => ($idx === $n - 1),   // o mais recente carrega o prazo vigente
        ];
    }
    responder_json(['processo' => $proc, 'total' => $n, 'atos' => $atos]);
}
