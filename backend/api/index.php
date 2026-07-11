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
    case 'stats':    stats($pdo); break;
    case 'filtros':  filtros($pdo); break;
    case 'chefias':  chefias($pdo); break;
    case 'insights': insights($pdo); break;
    case 'analitico': analitico($pdo); break;
    case 'prazos':   prazos($pdo); break;
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

    $sql = "SELECT a.id, a.tipo, a.sigla, a.numero, a.ano, a.data_ato, a.ementa, a.ementa_inferida,
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
        'ementaInferida' => (bool)$a['ementa_inferida'],
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
    // "Atualização mais recente": dá visibilidade de atraso na rotina diária.
    // A data é MAX(atos.criado_em) — gravado só no INSERT, então marca quando
    // o último ato NOVO entrou (reimportação de ato existente não conta).
    // O link é o boletim de numeração mais alta já indexado (data_pub e
    // importado_em não servem: um é NULL, o outro é carimbado em massa).
    $ultData = $pdo->query("SELECT DATE(MAX(criado_em)) FROM atos")->fetchColumn();
    $ult = $pdo->query("
        SELECT b.arquivo, b.numero, b.ano,
               COALESCE(b.url_pdf, (SELECT a.link_boletim FROM atos a
                                    WHERE a.boletim_id = b.id
                                      AND a.link_boletim IS NOT NULL LIMIT 1)) AS link
        FROM boletins b
        ORDER BY b.ano DESC, CAST(b.numero AS UNSIGNED) DESC
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
            '_k' => $k,                     // interno (removido antes da resposta)
        ];
    }

    // Situação ATUAL de cada pessoa: seu último evento de função (designação
    // OU dispensa) em QUALQUER unidade. Uma pessoa só permanece titular se o
    // último evento dela for exatamente a designação exibida (mesma unidade e
    // cargo). Isso resolve dois problemas que o pareamento por unidade não vê:
    //   1. Unidade RENOMEADA: a exoneração cita o nome novo (chave diferente)
    //      e nunca casaria com a designação antiga — ex.: Nóbrega, designado
    //      Pró-Reitor de "Pesquisa e Pós-Graduação" (2009) e exonerado de
    //      "Pesquisa, Pós-Graduação e Inovação" (2014).
    //   2. Pessoa que MUDOU de cargo, mas cuja designação nova foi superada
    //      por titular mais recente na unidade nova (some da lista em vez de
    //      aparecer com o cargo velho).
    // Também subsome a regra anterior de 1 cargo por SIAPE (a mesma pessoa não
    // pode ocupar dois cargos ao mesmo tempo): no máximo UMA entrada por
    // pessoa casa com o seu último evento.
    $ult = [];   // siape => ['data', 'acao', 'k']
    $ev = $pdo->query("
        SELECT f.siape, f.acao, f.unidade_chave, LOWER(f.cargo) AS cargo, a.data_ato
        FROM ato_funcoes f
        JOIN atos a ON a.id = f.ato_id
        WHERE f.siape <> '' AND a.data_ato IS NOT NULL");
    while ($e = $ev->fetch()) {
        $s = $e['siape'];
        $m = $ult[$s] ?? null;
        // empate de data: designação vence dispensa (dispensa+redesignação no
        // mesmo dia significa que a pessoa segue, no cargo novo).
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
            if ($u['acao'] !== 'designar') continue;   // último evento: deixou a função
            if ($u['k'] !== $c['_k']) continue;        // designação mais recente é outra
        }
        unset($c['_k']);
        $chefiasFiltradas[] = $c;
    }
    // Corte de mandato: designações com mais de 4 anos, sem redesignação nem
    // dispensa registrada desde então, são descartadas. A maioria das chefias
    // (Chefe/Coordenador de setor) não tem mandato fixo — mas passado esse
    // tempo sem nenhum ato novo, é mais provável que a chave da unidade tenha
    // mudado de grafia entre boletins (o mesmo problema do caso Nóbrega) do
    // que a pessoa seguir de fato no posto há tantos anos sem qualquer
    // republicação — melhor omitir do que arriscar mostrar um titular errado.
    // EXCEÇÃO — alta administração (Pró-Reitor, Superintendente, Vice-Reitor):
    // o titular fica o mandato da gestão inteira, que passa fácil de 4 anos
    // (SOMA tem superintendente designado em 2015 até hoje, cf. página oficial
    // de dirigentes da UFF). Aí o corte escondia titular real; a proteção
    // contra fantasma continua sendo o último-evento-por-pessoa acima.
    $limiteMandato = date('Y-m-d', strtotime('-4 years'));
    $chefiasFiltradas = array_values(array_filter(
        $chefiasFiltradas,
        fn($c) => $c['desde'] >= $limiteMandato
                  || preg_match('/pró-?reitor|superintendente|vice-?reitor/iu', $c['cargo'])
    ));

    // Reitor é nomeado por ato externo (decreto presidencial no DOU), nunca
    // pelo Boletim de Serviço — o sistema nunca vai captar essa designação,
    // então não faz sentido exibir o cargo aqui (ficaria sempre errado ou
    // vazio). Vice-Reitor e Pró-Reitor continuam, pois esses SÃO designados
    // por ato interno (Portaria/Resolução) publicado no boletim.
    $chefiasFiltradas = array_values(array_filter(
        $chefiasFiltradas, fn($c) => mb_strtolower(trim($c['cargo'])) !== 'reitor'
    ));

    // --- Curadoria da alta administração (fonte: página oficial de dirigentes,
    // uff.br/sobre/dirigentes-da-uff). Corrige dois casos que a projeção a
    // partir do Boletim não resolve sozinha:
    //
    //  (a) Designação ÓRFÃ de 2011 de unidade depois RENOMEADA: o titular saiu
    //      por ato não capturado e a unidade hoje tem outro nome, com titular
    //      atual já projetado corretamente. A designação velha, isenta do corte
    //      de mandato por ser alta administração, sobrava como setor-fantasma.
    //      Removida por ato_id (o ato histórico continua indexado e buscável;
    //      só deixa de ser projetado como titular vigente):
    //        - "Tecnologia da Informação" (Superintendente, 2011)
    //          -> Superintendência de Tecnologia da Informação (Douglas, 2026)
    //        - "Planejamento da Pró-Reitoria de Planejamento" (Pró-Reitor, 2011)
    //          -> Pró-Reitoria de Planejamento (Julio, 2022)
    //        - "Engenharia e Projetos - SUEP" (Superintendente, 2011)
    //          -> Superintendência de Arquitetura, Engenharia e Patrimônio
    //             (Renata, 2024)
    $suprimir = [
        '094-2011-portaria-ato-44-558-2011' => 1,
        '147-2011-portaria-ato-43-984-2011' => 1,
        '147-2011-portaria-ato-43-991-2011' => 1,
    ];
    $chefiasFiltradas = array_values(array_filter(
        $chefiasFiltradas, fn($c) => empty($suprimir[$c['atoId'] ?? ''])
    ));
    // Vera Cajazeiras (PROAD, Portaria 62.922/2019) e Aline da Silva Marques
    // (PROGEPE, Portaria 1.149/2021) NÃO precisam de cadastro manual: eram
    // perdidas por dois bugs de extração já corrigidos (sufixo "(a)" no cargo
    // e nomeação de convidado sem vírgula) e agora entram do ato real após o
    // reprocessamento dos blocos de backfill.

    usort($chefiasFiltradas, fn($a, $b) => strcmp($a['unidade'] ?? '', $b['unidade'] ?? ''));
    $chefias = $chefiasFiltradas;

    responder_json([
        'total' => count($chefias),
        'atualizadoEm' => date('Y-m-d'),
        'chefias' => $chefias,
    ]);
}

// ---- INSIGHTS (agregações para a aba de painéis) --------------------------
// Tudo é computado ao vivo sobre índices já existentes (ix_sigla, ix_data,
// ix_ano, ix_status, ix_proc). Aceita ?ano=YYYY para recortar por ano; sem o
// parâmetro (ou ?ano=todos) agrega o acervo inteiro. A lista de anos volta
// sempre completa, para alimentar o seletor no front.
function insights(PDO $pdo): void {
    $anoParam = trim($_GET['ano'] ?? '');
    $temAno   = ($anoParam !== '' && $anoParam !== 'todos');
    $anoInt   = (int)$anoParam;

    // executa uma consulta ligando :ano só quando há recorte de ano
    $rodar = function (string $sql) use ($pdo, $temAno, $anoInt) {
        $st = $pdo->prepare($sql);
        if ($temAno && strpos($sql, ':ano') !== false) {
            $st->bindValue(':ano', $anoInt, PDO::PARAM_INT);
        }
        $st->execute();
        return $st;
    };
    $wAtos = $temAno ? 'WHERE ano = :ano' : '';                 // p/ tabela atos
    $andData = $temAno ? 'AND ano = :ano' : '';                 // após "data_ato IS NOT NULL"

    // KPIs
    $k = $rodar("SELECT
        COUNT(*) total,
        SUM(processo_sei IS NOT NULL AND processo_sei<>'') com_sei,
        SUM(status='Revogado') revogados,
        SUM(status='Alterado') alterados,
        COUNT(DISTINCT NULLIF(sigla,'')) orgaos,
        MIN(data_ato) dmin, MAX(data_ato) dmax
      FROM atos $wAtos")->fetch();

    // relações cujo ATO DE ORIGEM cai no recorte
    $relacoes = (int)$rodar(
        "SELECT COUNT(*) FROM ato_relacoes r JOIN atos a ON a.id = r.ato_id "
        . ($temAno ? 'WHERE a.ano = :ano' : '')
    )->fetchColumn();

    // atividade por dia (data do ato) -> heatmap
    $porDia = $rodar(
        "SELECT data_ato d, COUNT(*) n FROM atos
         WHERE data_ato IS NOT NULL $andData GROUP BY data_ato ORDER BY data_ato"
    )->fetchAll(PDO::FETCH_ASSOC);

    // volume por mês -> série temporal
    $porMes = $rodar(
        "SELECT DATE_FORMAT(data_ato,'%Y-%m') ym, COUNT(*) n FROM atos
         WHERE data_ato IS NOT NULL $andData GROUP BY ym ORDER BY ym"
    )->fetchAll(PDO::FETCH_ASSOC);

    // ranking de órgãos emissores (top 12) + fatia com vínculo SEI
    $porOrgao = $rodar(
        "SELECT sigla, COUNT(*) n,
                SUM(processo_sei IS NOT NULL AND processo_sei<>'') com_sei
         FROM atos WHERE sigla<>'' $andData
         GROUP BY sigla ORDER BY n DESC LIMIT 12"
    )->fetchAll(PDO::FETCH_ASSOC);

    // composição por tipo de ato
    $porTipo = $rodar(
        "SELECT tipo, COUNT(*) n FROM atos $wAtos GROUP BY tipo ORDER BY n DESC"
    )->fetchAll(PDO::FETCH_ASSOC);

    // anos disponíveis (sempre global) p/ o seletor
    $anos = array_map('intval', array_column(
        $pdo->query("SELECT DISTINCT ano FROM atos WHERE ano IS NOT NULL ORDER BY ano DESC")->fetchAll(),
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
// Cross-tempo (não usa recorte de ano). Rotatividade projeta a SEQUÊNCIA de
// titulares por posição (dedup por SIAPE p/ não contar republicação/retificação
// como troca) e mede a permanência entre titulares sucessivos. Citações
// defasadas = atos que referenciam uma norma DEPOIS de ela ter sido revogada
// (compara a data do citante com a data da revogação; exclui a própria relação
// que revogou). São candidatos a citação a norma sem efeito — não veredito.
function analitico(PDO $pdo): void {
    // --- Rotatividade ---
    $existe = false;
    try { $existe = (bool)$pdo->query("SHOW TABLES LIKE 'ato_funcoes'")->fetch(); } catch (Throwable $e) {}
    $cadeiras = [];
    $permanencias = [];   // em meses, entre titulares sucessivos
    $totalEventos = 0;
    if ($existe) {
        $rows = $pdo->query("
            SELECT f.unidade_chave, f.cargo, f.unidade, f.acao, f.siape,
                   COALESCE(NULLIF(f.nome,''), s.nome) AS nome, a.data_ato
            FROM ato_funcoes f
            JOIN atos a ON a.id = f.ato_id
            LEFT JOIN ato_siapes s ON s.ato_id = f.ato_id AND s.siape = f.siape
            WHERE a.data_ato IS NOT NULL
            ORDER BY f.unidade_chave, f.cargo, a.data_ato
        ")->fetchAll(PDO::FETCH_ASSOC);
        $totalEventos = count($rows);
        $pos = [];
        foreach ($rows as $r) {
            $k = $r['unidade_chave'] . '|' . mb_strtolower($r['cargo']);
            $pos[$k] = $pos[$k] ?? ['cargo' => $r['cargo'], 'unidade' => $r['unidade'], 'ev' => []];
            $pos[$k]['ev'][] = $r;
        }
        foreach ($pos as $p) {
            // sequência de titulares (colapsa designações do mesmo SIAPE/nome)
            $titulares = [];
            foreach ($p['ev'] as $e) {
                if ($e['acao'] !== 'designar') continue;
                $ident = $e['siape'] !== '' ? $e['siape'] : mb_strtolower($e['nome'] ?? '');
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
    }
    sort($permanencias);
    $mediana = $permanencias ? round($permanencias[intdiv(count($permanencias), 2)], 1) : null;

    // --- Citações defasadas: atos que referenciam uma norma DEPOIS da
    // revogação dela. Pivota no ATO CITANTE (o item acionável). A data de
    // revogação é a data_ato do ato que a revogou (a mais antiga, se houver
    // mais de um). Exclui a própria relação 'Revoga' e citantes sem data.
    $zumbis = $pdo->query("
        SELECT cit.id AS cit_id, cit.tipo AS cit_tipo, cit.numero AS cit_numero,
               cit.ano AS cit_ano, cit.sigla AS cit_sigla, cit.data_ato AS cit_data,
               cit.link_boletim AS cit_link, r.tipo_relacao AS relacao,
               alvo.tipo AS alvo_tipo, alvo.numero AS alvo_numero,
               alvo.ano AS alvo_ano, alvo.sigla AS alvo_sigla,
               rev.revogado_em AS revogado_em
        FROM ato_relacoes r
        JOIN atos cit  ON cit.id  = r.ato_id
        JOIN atos alvo ON alvo.id = r.ato_destino_id
        JOIN (
            SELECT rr.ato_destino_id AS alvo_id, MIN(o.data_ato) AS revogado_em
            FROM ato_relacoes rr
            JOIN atos o ON o.id = rr.ato_id
            WHERE rr.tipo_relacao = 'Revoga'
              AND rr.ato_destino_id IS NOT NULL
              AND o.data_ato IS NOT NULL
            GROUP BY rr.ato_destino_id
        ) rev ON rev.alvo_id = alvo.id
        WHERE alvo.status = 'Revogado'
          AND r.tipo_relacao <> 'Revoga'
          AND r.ato_destino_id IS NOT NULL
          AND cit.data_ato IS NOT NULL
          AND cit.id <> alvo.id
          AND cit.data_ato > rev.revogado_em
        ORDER BY cit.data_ato DESC
        LIMIT 60
    ")->fetchAll(PDO::FETCH_ASSOC);

    // --- Mortalidade (evidência do porquê a meia-vida ainda não vale) ---
    $m = $pdo->query("SELECT COUNT(*) total, SUM(status<>'Ativo') mexidos FROM atos")->fetch();

    // --- RH: aposentadorias concedidas + vacâncias por posse em outro cargo --
    // Aposentadoria: lê a coluna ESTRUTURADA aposentadoria_tipo (classificada na
    // EXTRAÇÃO por extrai_aposentadoria() — dispositivo "conced.../declara...
    // aposentad[oa]" + rótulo voluntária/compulsória/invalidez, com fallback pra
    // base legal art. 40 §1º I/II/III CF quando o ato só cita o dispositivo legal;
    // exclui menção retrospectiva tipo "a vacância corresponde à aposentadoria
    // voluntária de fulano"). Um LIKE textual aqui subestimava a compulsória do
    // legado (2014-2015 escrevia "declara aposentado, compulsoriamente" — verbo+
    // advérbio, não "aposentadoria compulsória" — e ficava quase invisível).
    // Vacância art. 33 VIII segue por LIKE (fraseado estável, sem esse problema):
    // "declarar vago/vacância" + causa (inciso viii | posse em outro cargo
    // inacumulável | tendo em vista a posse); inciso IX/falecimento fica de fora.
    // Série = ano do ATO. Conta o que foi PUBLICADO NO BS (parte das concessões
    // antigas saía só no DOU).
    $rh = [];
    try {
        $apos = $pdo->query("
            SELECT ano,
                   SUM(aposentadoria_tipo = 'Voluntária')  AS vol,
                   SUM(aposentadoria_tipo = 'Compulsória') AS comp,
                   SUM(aposentadoria_tipo = 'Invalidez')   AS inval,
                   SUM(aposentadoria_tipo = 'Indefinida')  AS indef
            FROM atos
            WHERE aposentadoria_tipo IS NOT NULL AND ano BETWEEN 1990 AND 2100
            GROUP BY ano
        ")->fetchAll(PDO::FETCH_ASSOC);

        $vac = $pdo->query("
            SELECT a.ano, COUNT(*) AS n
            FROM atos a
            JOIN ato_corpo c ON c.ato_id = a.id
            WHERE a.ano BETWEEN 1990 AND 2100
              AND MATCH(c.texto) AGAINST('vago vacância' IN BOOLEAN MODE)
              AND (c.texto LIKE '%declarar vago%'  OR c.texto LIKE '%declara vago%'
                OR c.texto LIKE '%declarar a vacância%' OR c.texto LIKE '%declarada a vacância%')
              AND (c.texto LIKE '%inciso viii, do artigo 33%'
                OR c.texto LIKE '%inciso viii do artigo 33%'
                OR c.texto LIKE '%posse em outro cargo inacumul%'
                OR c.texto LIKE '%tendo em vista a posse%')
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
        foreach ($porAno as $y => $v) {
            $rh[] = ['ano' => $y] + $v;
        }
    } catch (Throwable $e) { /* sem ato_corpo/coluna ainda migrada: painel fica vazio */ }

    // --- Deslocamento de servidor: remoção (interna) × redistribuição -------
    // Lê as colunas ESTRUTURADAS deslocamento_* (classificadas na extração por
    // extrai_deslocamento()). Série anual + motivos da remoção + setores de
    // destino (rotatividade). A redistribuição de SAÍDA é sub-registrada nesta
    // fonte (consuma-se em portaria do MEC no DOU) — por isso entrada e saída
    // vêm separadas, sem fingir um saldo líquido.
    $desl = ['serie' => [], 'motivos' => [], 'setores' => []];
    try {
        $ds = $pdo->query("
            SELECT ano,
                   SUM(deslocamento_tipo = 'Remoção') AS remocao,
                   SUM(deslocamento_tipo = 'Redistribuição' AND deslocamento_dir = 'Entrada') AS red_entra,
                   SUM(deslocamento_tipo = 'Redistribuição' AND deslocamento_dir = 'Saída')   AS red_saida
            FROM atos
            WHERE deslocamento_tipo IS NOT NULL AND ano BETWEEN 1990 AND 2100
            GROUP BY ano ORDER BY ano
        ")->fetchAll(PDO::FETCH_ASSOC);
        $desl['serie'] = array_map(fn($r) => [
            'ano' => (int)$r['ano'], 'remocao' => (int)$r['remocao'],
            'redEntra' => (int)$r['red_entra'], 'redSaida' => (int)$r['red_saida'],
        ], $ds);

        $mv = $pdo->query("
            SELECT COALESCE(NULLIF(deslocamento_motivo, ''), 'Não especificado') AS motivo, COUNT(*) AS n
            FROM atos WHERE deslocamento_tipo = 'Remoção'
            GROUP BY motivo ORDER BY n DESC
        ")->fetchAll(PDO::FETCH_ASSOC);
        $desl['motivos'] = array_map(fn($r) => ['motivo' => $r['motivo'], 'n' => (int)$r['n']], $mv);

        // Setores CRUS e POR ANO, sem LIMIT: o front unifica sigla × nome por
        // extenso (setorCanonico, ex.: HUAP = Hospital Universitário Antônio
        // Pedro) e filtra pelo slider de intervalo de anos — dedup num lugar só.
        $st = $pdo->query("
            SELECT deslocamento_setor AS setor, ano, COUNT(*) AS n
            FROM atos WHERE deslocamento_tipo = 'Remoção' AND deslocamento_setor <> ''
              AND ano BETWEEN 1990 AND 2100
            GROUP BY deslocamento_setor, ano
        ")->fetchAll(PDO::FETCH_ASSOC);
        $desl['setores'] = array_map(fn($r) => ['setor' => $r['setor'], 'ano' => (int)$r['ano'], 'n' => (int)$r['n']], $st);
    } catch (Throwable $e) { /* colunas ainda não migradas: painel fica vazio */ }

    responder_json([
        'rotatividade' => [
            'posicoesComTroca' => count($cadeiras) < 15 ? count($cadeiras) : null, // null = truncado no top 15
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

// meses entre duas datas YYYY-MM-DD (aproximação por 30.44 dias)
function meses_entre(string $a, string $b): float {
    $ta = strtotime($a); $tb = strtotime($b);
    if (!$ta || !$tb) return 0.0;
    return round(($tb - $ta) / (86400 * 30.44), 1);
}

// ---- PRAZOS (radar de datas-limite) ---------------------------------------
// O PHP só ENTREGA os atos-candidatos (que têm sinais de prazo no corpo, via
// FULLTEXT). A EXTRAÇÃO das datas roda no cliente (mesma lógica do modo
// estático). O corpo é curto (≤ ~7 KB): mandamos INTEIRO — truncar em 2800
// perdia >60% dos prazos (o cronograma de editais vem no fim do texto).
//
// IMPORTANTE: o acervo já cobre o legado inteiro (2001-2026, 127 mil+ atos).
// Sem filtro de data, o LIMIT pega uma fatia ARBITRÁRIA de 25 anos de história
// (MATCH sem ORDER BY não garante ordem) — na prática, quase só atos antigos,
// cujos prazos (se houver) já venceram há muito. Resultado: zero prazo futuro.
// Fix: restringe a atos assinados nos últimos 3 anos (cobre até os prazos
// relativos mais longos vistos no corpo, tipo "5 anos a contar da assinatura")
// e ordena do mais recente — o candidato relevante nunca fica de fora do LIMIT.
function prazos(PDO $pdo): void {
    // termos-âncora de prazo; NATURAL LANGUAGE traz os atos que os contêm.
    $termos = 'inscrição inscrições recurso recursos prazo requerimento impugnação credenciamento matrícula contar entrega';
    $st = $pdo->prepare("
        SELECT a.id, a.tipo, a.numero, a.ano, a.sigla, a.data_ato, a.link_boletim, a.status,
               a.ementa, LEFT(COALESCE(c.texto,''), 12000) AS texto,
               EXISTS(SELECT 1 FROM ato_relacoes r
                      WHERE r.ato_destino_id = a.id AND r.tipo_relacao IN ('Altera','Revoga')) AS mexido
        FROM atos a
        JOIN ato_corpo c ON c.ato_id = a.id
        WHERE MATCH(c.texto) AGAINST(:termos IN NATURAL LANGUAGE MODE)
          AND a.data_ato >= DATE_SUB(CURDATE(), INTERVAL 3 YEAR)
        ORDER BY a.data_ato DESC
        LIMIT 3000");
    $st->bindValue(':termos', $termos);
    $st->execute();
    $cand = array_map(fn($r) => [
        'id' => $r['id'], 'tipo' => $r['tipo'], 'numero' => $r['numero'], 'ano' => (int)$r['ano'],
        'sigla' => $r['sigla'], 'dataAto' => $r['data_ato'], 'linkBoletim' => $r['link_boletim'],
        'status' => $r['status'], 'ementa' => $r['ementa'], 'texto' => $r['texto'],
        'mexidoDepois' => (bool)$r['mexido'],
    ], $st->fetchAll(PDO::FETCH_ASSOC));
    responder_json(['candidatos' => $cand]);
}
