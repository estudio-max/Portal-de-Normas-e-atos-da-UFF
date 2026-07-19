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
// X-Dossie-Token: a senha do dossiê viaja em cabeçalho, não em ?token=, pra não
// ficar gravada no access log do servidor nem no histórico do navegador. Em
// produção o front é da mesma origem e nem há preflight; isto é p/ o mock local.
header('Access-Control-Allow-Headers: X-Dossie-Token');
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
    case 'mandatos': mandatos($pdo); break;
    case 'insights': insights($pdo); break;
    case 'analitico': analitico($pdo); break;
    case 'prazos':   prazos($pdo); break;
    case 'jornada':  jornada($pdo); break;
    case 'cooperacao': cooperacao($pdo); break;
    case 'pad_cadeia': pad_cadeia($pdo, $_GET['processo'] ?? ''); break;
    case 'dossie':   dossie($pdo, $cfg, $_GET['siape'] ?? '', $_GET['nome'] ?? ''); break;
    // Resquício do tempo em que a aba (hoje "Meu SIAPE") era fechada por senha.
    // A rota fica no ar devolvendo ok para não quebrar um bundle antigo do
    // frontend que ainda chame a conferência antes de liberar a tela.
    case 'dossie_auth':
        responder_json(['ok' => true]);
        break;
    case 'ato':      ficha($pdo, $id); break;
    case 'atos':
    default:        listar($pdo); break;
}

// ===========================================================================
// Converte a busca do usuário para a sintaxe BOOLEAN MODE do MySQL.
//   "frase exata"  -> vira UMA unidade obrigatória, casada como frase literal
//                      adjacente (+"frase exata"), sem wildcard — é o que
//                      diferencia de digitar as mesmas palavras soltas, que
//                      casam em qualquer ordem/posição.
//   +palavra / palavra -> as duas formas são obrigatórias (E lógico). O "+"
//                      é aceito como sintaxe explícita mas não muda o
//                      resultado: toda palavra solta já é obrigatória por
//                      padrão (decisão: manter o comportamento de hoje pra
//                      quem não usa nenhum operador, sem risco de regressão).
function booleanize(string $s): string {
    $out = [];
    // 1) frases entre aspas primeiro — extraídas ANTES do split por palavra,
    // senão cada palavra da frase vira um token solto e a ordem/adjacência
    // se perde (era exatamente esse o defeito: aspas eram só ignoradas).
    $semAspas = preg_replace_callback('/"([^"]{1,})"/u', function ($m) use (&$out) {
        $frase = trim(preg_replace('/[+\-><()~*@]/u', '', $m[1]));
        if ($frase !== '') $out[] = '+"' . $frase . '"';
        return ' ';
    }, $s);
    // 2) o que sobra fora das aspas: palavras soltas, cada uma obrigatória
    // (o "+" de "+palavra" já é removido por esta regex, então produz o
    // mesmo token que a palavra sem prefixo — mesmo resultado, de propósito).
    $tokens = preg_split('/\s+/', trim($semAspas));
    foreach ($tokens as $t) {
        $t = preg_replace('/[+\-><()~*"@]/u', '', $t);
        if (mb_strlen($t) >= 3) $out[] = '+' . $t . '*';
    }
    return $out ? implode(' ', $out) : '';
}

// Tira acento p/ comparar nome (espelha strip_ac() de importar/importar_v2.php,
// que por sua vez espelha etl_v2.py). Só para COMPARAÇÃO — o que se exibe é
// sempre o nome como saiu do boletim.
function nome_ascii(string $s): string {
    $r = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
    return $r === false ? $s : $r;
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

// ---- MANDATOS: setores sem chefia formalmente constituída ------------------
// Regra de mandato da UFF, confirmada no corpus (5.555 designações, 2001-2026):
//   Departamento (Chefe, Subchefe) .................... 2 anos
//   Curso/Programa e Unidade (Coordenador, Vice-
//   Coordenador, Diretor, Vice-Diretor) ............... 4 anos
// Não é estatística, é estrutural: o cargo decide o prazo. Onde o ato declara,
// a pureza é 100% (Chefe 898/898 em 2 anos; Coordenador 897/897 em 4) e em
// 128 mil atos NÃO existe um único mandato que não seja 2 ou 4 anos.
// Pró-Reitor/Superintendente/Gerente ficam fora de propósito: 181 designações,
// ZERO com prazo — servem a gestão, não a mandato fixo.
//
// A regra mora AQUI, na projeção, e não na importação: ato_funcao registra o
// que o ato disse. Gravar 24 meses num ato que não declarou nada apagaria para
// sempre a diferença entre lei e dedução, e a próxima sincronização
// reescreveria a dedução como se fosse fato.
//
// Função, não `const` de topo de arquivo: um `const` no nível do script roda
// na ordem em que a instrução aparece — não é "hoisted" como função. O roteador
// (`switch`) fica no topo do arquivo e chama mandatos() antes de o interpretador
// alcançar esta linha, então o `const` ainda não existiria quando a função
// precisasse dele. Foi exatamente esse o erro em produção (undefined constant).
function regra_mandato(): array {
    return [
        'chefe' => 24, 'subchefe' => 24,
        'coordenador' => 48, 'vice-coordenador' => 48,
        'diretor' => 48, 'vice-diretor' => 48,
    ];
}

// Cobertura do Boletim. O painel afirma "o setor X está sem chefia desde D" —
// isso só se sustenta se a base cobriu o BS INTEIRO de D até hoje: da beirada
// de dentro, um ano mal carregado é indistinguível de um ano em que ninguém
// foi designado. Sem este guarda o painel acusaria de acefalia setores que só
// estão mal indexados.
// O esperado não é constante mágica: a numeração do BS é sequencial dentro do
// ano, então o MAIOR número do ano diz quantos existiram (auto-calibra: 2025
// fechou em 153, 2023 em 242). Aqui a tabela `boletim` já traz numero/ano como
// inteiros — sem depender de OCR de cabeçalho nem de nome de arquivo.
function cobertura_por_ano(PDO $pdo): array {
    $rows = $pdo->query("
        SELECT ano, COUNT(*) AS carregados, MAX(numero) AS ultimo
        FROM boletim WHERE ano > 0 GROUP BY ano ORDER BY ano")->fetchAll();
    $anoAtual = (int)date('Y');
    $cob = [];
    foreach ($rows as $r) {
        $ano = (int)$r['ano'];
        $carregados = (int)$r['carregados'];
        $ultimo = (int)$r['ultimo'];
        // Ponto cego: se a base tivesse só o COMEÇO de um ano (boletins 1..16
        // de 245), o maior seria 16 e a cobertura pareceria 100%. Nas cargas
        // parciais reais isso não ocorre — elas pegaram o FIM do ano — mas,
        // como é sorte e não garantia, ano FECHADO cujo maior número seja
        // implausível (< 100, contra uma série histórica de ~150 a ~245) é
        // dado como não-confiável: a base não sabe nem quantos existiram.
        // O ano corrente é isento: ainda está sendo publicado.
        $corrente = $ano >= $anoAtual;
        $cob[$ano] = [
            'ano' => $ano,
            'carregados' => $carregados,
            'publicados' => $ultimo,
            'pct' => $ultimo > 0 ? (int)round(100 * $carregados / $ultimo) : 0,
            'confiavel' => ($ultimo >= 100 || $corrente) && $ultimo > 0
                           && $carregados >= 0.9 * $ultimo,
        ];
    }
    return $cob;
}

function janela_coberta(array $cob, string $desde): bool {
    for ($a = (int)substr($desde, 0, 4); $a <= (int)date('Y'); $a++) {
        if (empty($cob[$a]['confiavel'])) return false;
    }
    return true;
}

function mandatos(PDO $pdo): void {
    $regra = regra_mandato();
    $cob = cobertura_por_ano($pdo);
    $cargos = "'" . implode("','", array_keys($regra)) . "'";

    // Mesma projeção da aba Chefias: vale a designação MAIS RECENTE de cada
    // (unidade_chave, cargo) — a chave normalizada, não o texto cru, senão a
    // unidade que mudou de grafia vira duas posições e a antiga aparece aqui
    // como fantasma de mandato vencido.
    $rows = $pdo->query("
        SELECT f.cargo, f.unidade, f.unidade_chave, ps.siape, ps.nome,
               f.prazo_meses, f.data_inicio, f.inicio_origem,
               a.uid AS ato_id, a.data_ato, t.nome AS tipo, a.numero, a.ano,
               b.url_pdf AS link_boletim
        FROM ato_funcao f
        JOIN ato a       ON a.id = f.ato_id
        JOIN tipo_ato t  ON t.id = a.tipo_id
        LEFT JOIN boletim b ON b.id = a.boletim_id
        LEFT JOIN pessoa ps ON ps.id = f.pessoa_id
        JOIN (
            SELECT f2.unidade_chave, f2.cargo, MAX(a2.data_ato) AS dmax
            FROM ato_funcao f2 JOIN ato a2 ON a2.id = f2.ato_id
            WHERE a2.data_ato IS NOT NULL AND f2.acao = 'designar'
              AND LOWER(f2.cargo) IN ($cargos)
            GROUP BY f2.unidade_chave, f2.cargo
        ) u ON u.unidade_chave = f.unidade_chave AND u.cargo = f.cargo
           AND a.data_ato = u.dmax
        WHERE f.acao = 'designar' AND LOWER(f.cargo) IN ($cargos)
        ORDER BY f.unidade, f.cargo, a.id DESC
    ")->fetchAll();

    $vistos = [];
    $cand = [];
    foreach ($rows as $r) {
        $k = $r['unidade_chave'] . '|' . mb_strtolower($r['cargo']);
        if (isset($vistos[$k])) continue;
        $vistos[$k] = true;
        $r['_k'] = $k;
        $cand[] = $r;
    }

    // Só permanece titular quem tem esta designação como ÚLTIMO evento seu, em
    // qualquer unidade (resolve unidade renomeada e quem mudou de cargo).
    $ult = [];
    $ev = $pdo->query("
        SELECT ps.siape, f.acao, f.unidade_chave, LOWER(f.cargo) AS cargo, a.data_ato
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

    $hoje = date('Y-m-d');
    $setores = [];
    foreach ($cand as $c) {
        $s = $c['siape'] ?? '';
        if ($s !== '' && isset($ult[$s])) {
            if ($ult[$s]['acao'] !== 'designar') continue;
            if ($ult[$s]['k'] !== $c['_k']) continue;
        }
        $declarado = (int)($c['prazo_meses'] ?? 0);
        $prazo = $declarado ?: ($regra[mb_strtolower(trim($c['cargo']))] ?? 0);
        if (!$prazo) continue;
        $inicio = $c['data_inicio'] ?: $c['data_ato'];
        if (!$inicio) continue;
        $fim = date('Y-m-d', strtotime("$inicio +$prazo months"));

        if ($fim >= $hoje)                       $situacao = 'em_dia';
        elseif (!janela_coberta($cob, $fim))     $situacao = 'sem_cobertura';
        else                                     $situacao = 'sem_chefia';

        $setores[] = [
            'unidade' => $c['unidade'],
            'cargo' => $c['cargo'],
            'nome' => $c['nome'],
            'siape' => $c['siape'],
            'inicio' => $inicio,
            'inicioOrigem' => $c['inicio_origem'] ?: 'data_ato',
            'prazoMeses' => $prazo,
            // Lei x dedução, na linha: sem isto o gabinete lê uma data e não
            // sabe qual das duas está olhando.
            'prazoOrigem' => $declarado ? 'declarado' : 'presumido_cargo',
            'fim' => $fim,
            'diasVago' => $situacao === 'sem_chefia'
                ? (int)((strtotime($hoje) - strtotime($fim)) / 86400) : 0,
            'situacao' => $situacao,
            'atoId' => $c['ato_id'],
            'atoLabel' => trim("{$c['tipo']} nº {$c['numero']}/{$c['ano']}"),
            'linkBoletim' => $c['link_boletim'],
        ];
    }

    usort($setores, fn($a, $b) => strcmp($a['fim'], $b['fim']));
    $conta = array_count_values(array_column($setores, 'situacao'));

    responder_json([
        'total' => count($setores),
        'atualizadoEm' => $hoje,
        'resumo' => [
            'semChefia' => $conta['sem_chefia'] ?? 0,
            'emDia' => $conta['em_dia'] ?? 0,
            'semCobertura' => $conta['sem_cobertura'] ?? 0,
        ],
        'cobertura' => array_values($cob),
        'setores' => $setores,
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

// Gate do dossiê. Restrito à Gestão de Pessoal: é a única rota que reúne a vida
// funcional de UMA pessoa num lugar só — as outras devolvem atos avulsos, que
// são públicos por natureza.
//
// Por que a conferência mora aqui e não no React: senha checada no front não
// protege nada. O bundle é público (a senha estaria lá, legível), e /api/dossie
// continuaria respondendo pra quem digitasse a URL na barra do navegador. Gate
// no cliente é enfeite; o dado só fica fechado se o servidor recusar.
//
// FALHA FECHADO: sem 'dossie_token' no config.php a rota responde 401 e a aba
// não abre. Um deploy pela metade tem que virar aba quebrada, não dossiê aberto.
// hash_equals compara em tempo constante (não vaza a senha por cronometragem).
// ---- JORNADA DE TRABALHO (Flexibilização × Programa de Gestão) ------------
// A UFF adotou dois modelos de organização da jornada, ambos registrados no BS:
//   FLEXIBILIZAÇÃO DA JORNADA (30h, turnos contínuos) — onda a partir de 2019;
//   PROGRAMA DE GESTÃO / PGD (teletrabalho, IN 65/2020) — explode em 2022, e
//   a maioria dos setores flexibilizados migrou para ele.
// Medido no corpus (extração 07/2026, linhas de corpo_busca): flexibilização
// 2019=45, 2020=57, 2022=66, caindo depois; "programa de gestão" 2022=150,
// 2023=283, 2024=184. Antes de 2016 a frase é ruído raro (1-3/ano, "programa
// de gestão ambiental") — daí o piso ano>=2016.
//
// LADO FLEX USA STATUS REAL, NÃO SÓ MENÇÃO — validado em 17/07/2026 contra uma
// planilha independente de RH (25 pares portaria-de-flexibilização/portaria-
// revogadora): 24 de 24 pares válidos (1 tinha erro de digitação na própria
// planilha) bateram exato contra o `status` e a `relacao` tipo Revoga que o
// extrator já capturava sozinho — 100%, zero divergência. Isso deu confiança
// pra usar o grafo de relações de verdade em vez de só contar menção: cada
// portaria de flexibilização (a "entrada" de um setor) é ligada, via
// `relacao.destino_ato_id`, à portaria que a revogou (a "saída"), se houver.
// Exclui a própria revogadora do lado das entradas (ementa começa com
// "Revoga"/"Revogar") — sem isso ela contava duas vezes: como entrada dela
// mesma E como saída da que revogou.
//
// LADO PGD CONTINUA POR MENÇÃO (FULLTEXT), não por status: o Programa de
// Gestão funciona por edital/ciclo recorrente, não por 1 portaria-por-setor
// que se revoga uma vez só — o padrão de entrada/saída da flexibilização não
// se aplica igual. "Servidores" aqui é piso (ato_pessoa é menção; 30-70% dos
// atos não trazem SIAPE), não censo — a aba diz isso na tela.
// Junta letras isoladas separadas por espaço — artefato de OCR comum nesta
// faixa do corpus ("t r a b a l h o" = "trabalho"). Só runs de 3+ letras
// isoladas, pra não colar sigla real ("CBI", "SDC" ficam). Reconstrução
// PARCIAL: quando o OCR quebra em fragmentos de 2+ letras ("adm inistrativos",
// "Bibliot eca"), isto não conserta — por isso a extração de setor prefere o
// CORPO (texto corrido, mais limpo) à ementa (mais sujeita a esse defeito).
function normaliza_ocr_letras(string $s): string {
    $e = preg_replace_callback('/(?:\b[a-zA-ZÀ-ÿ]\b ?){3,}/u',
        fn($m) => str_replace(' ', '', $m[0]), $s);
    return preg_replace('/\s+/u', ' ', $e);
}

// Detecta o verbo de abertura ("Aprova...") mesmo com o OCR quebrando a palavra
// de forma IRREGULAR ("Ap r o va", não "A p r o v a"): reconstruir letra a letra
// falhava (testado real, 68.704/2024). Solução bruta: tira TODO espaço do
// prefixo e compara. Validado contra 61 portarias reais (ano≥2019).
function flex_comeca_aprova(string $ementa): bool {
    $inicio = mb_strtolower(preg_replace('/\s+/u', '', mb_substr($ementa, 0, 20)));
    return str_starts_with($inicio, 'aprova');
}

// Classifica a portaria de flexibilização pelo DISPOSITIVO (verbo de abertura):
//   adesao      = "Aprova o plano de flexibilização..." (entrada do setor)
//   manutencao  = "Aprova a manutenção do plano..."     (renovação anual — a
//                 CPFJ reavalia o setor todo ano; é alteração, não nova adesão)
//   retificacao = "Retificação..."                      (troca de membros da equipe)
//   outro       = norma geral, criação da CPFJ, suspensão etc. — NÃO é setor
function flex_classe(string $ementa): string {
    if (flex_comeca_aprova($ementa)) {
        $ini = nome_ascii(mb_strtolower(preg_replace('/\s+/u', '', mb_substr($ementa, 0, 45))));
        return str_contains($ini, 'manuten') ? 'manutencao' : 'adesao';
    }
    $ini = nome_ascii(mb_strtolower(preg_replace('/\s+/u', '', mb_substr($ementa, 0, 18))));
    return str_starts_with($ini, 'retific') ? 'retificacao' : 'outro';
}

// Apara o nome do setor: corta caudas de boilerplate que vazam do corpo
// ("... O Reitor da UFF", "; art. 2º ...", "conforme consta") e da ementa
// ("e dá outras providências" — tolerante ao OCR "e dá out ras"); junta a
// barra ("CBI/ SDC" -> "CBI/SDC") e troca "?" solto por travessão.
function flex_limpa_setor(string $s): string {
    $s = trim($s);
    $s = preg_split('/\s+O\s+Reitor/iu', $s)[0];
    $s = preg_split('/\s*;\s*art/iu', $s)[0];
    $s = preg_split('/\s+conforme\b/iu', $s)[0];
    $s = preg_split('/\s+e\s+d[aá]\s+o\s*u\s*t\s*r/iu', $s)[0];
    $s = preg_replace('/\s*\/\s*/u', '/', $s);
    $s = preg_replace('/\s+\?\s+/u', ' - ', $s);
    $s = preg_replace('/^[-(\s]+/u', '', $s);
    $s = preg_replace("/[\\s.,']+$/u", '', $s);
    return trim($s);
}

// Extrai o SETOR flexibilizado. O emissor da portaria é sempre a Reitoria — o
// setor de verdade mora no texto. Prefere o CORPO ("...lotados na/no <SETOR>,
// conforme...") porque é texto corrido e mais limpo, e é o ÚNICO lugar onde as
// portarias-modelo de 2019 (ementa genérica) trazem o setor. Cai pra ementa
// ("...administrativos d[aeo]s <SETOR> e dá outras...") quando o corpo não bate.
// A âncora "administrativ" é tolerante ao OCR "adm inistrativos".
function flex_setor(string $ementa, string $corpo): string {
    $c = normaliza_ocr_letras($corpo);
    if (preg_match('/lotad[oa]s?\s+n[ao]\s+(.{5,160}?)(?:,|;|\s+conforme\b|\s+O\s+Reitor)/iu', $c, $m)) {
        $s = flex_limpa_setor($m[1]);
        if ($s !== '') return $s;
    }
    $e = normaliza_ocr_letras($ementa);
    if (preg_match('/adm\s?inistrativ\w*\s+d[aeo]s?\s+(.+)$/iu', $e, $m)) {
        $s = flex_limpa_setor($m[1]);
        if ($s !== '') return $s;
    }
    return '';
}

function jornada(PDO $pdo): void {
    // ---- Flexibilização (Norma de Serviço 672/2019 em diante) --------------
    // Um SETOR entra com "Aprova o plano de flexibilização...", renova todo ano
    // ("Aprova a manutenção..." — reavaliação da CPFJ), troca membros da equipe
    // ("Retificação...") e sai quando uma portaria o REVOGA. O painel espelha
    // isso: agrupa as portarias de um mesmo setor e mostra aprovação →
    // alterações → revogação, cada uma com sua data.
    //
    // AGRUPAMENTO por PROCESSO SEI, não por nome: o nome vem do texto e o OCR o
    // quebra diferente a cada ano ("Bibliot eca", "adm inistrativos") — não
    // serve de chave. O processo é o MESMO em todas as portarias do setor
    // (medido no corpus: adesão 2019 + manutenção 2023 + retificações
    // compartilham o processo). Sem processo (poucos atos 2022-2024) cai pro
    // nome normalizado; por fim, solo.
    //
    // STATUS vem do pipeline (ato.status), não recalculado: a adesão velha fica
    // "Revogado" quando a MANUTENÇÃO a substitui — isso é renovação, não saída.
    // Logo o status do SETOR é o do ato de aprovação MAIS RECENTE: se o mais
    // novo está Ativo, o setor segue ativo; se foi revogado, aí sim saiu.
    $st = $pdo->query("
        SELECT a.id, a.numero, a.ano, a.ementa, a.status, a.data_ato,
               a.processo_sei, b.url_pdf AS link, t.texto_original AS corpo
          FROM ato a
          JOIN ato_texto t  ON t.ato_id = a.id
          JOIN tipo_ato tt  ON tt.id = a.tipo_id
          JOIN boletim b    ON b.id = a.boletim_id
         WHERE MATCH(t.texto_busca) AGAINST('+flexibiliza* +jornada' IN BOOLEAN MODE)
           AND tt.nome = 'Portaria'
           AND a.ano BETWEEN 2019 AND 2100
         ORDER BY a.data_ato");
    $flexAtos = $st->fetchAll(PDO::FETCH_ASSOC);

    // Quem REVOGA cada uma dessas portarias (grafo de relações). A revogação
    // cita só o número ("Revogar a Portaria 66.470/2020 e suas retificações"),
    // sem repetir "flexibilização" — por isso vem do grafo, não da busca.
    $revogaPor = [];
    $ids = array_column($flexAtos, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $rs = $pdo->prepare("
            SELECT r.destino_ato_id AS alvo, a2.numero, a2.ano, a2.data_ato, b2.url_pdf AS link
              FROM relacao r
              JOIN ato a2     ON a2.id = r.ato_id
              JOIN boletim b2 ON b2.id = a2.boletim_id
             WHERE r.tipo = 'Revoga' AND r.destino_ato_id IN ($ph)
             ORDER BY a2.data_ato");
        $rs->execute($ids);
        foreach ($rs->fetchAll(PDO::FETCH_ASSOC) as $r) {
            if (!isset($revogaPor[$r['alvo']]))     // a revogação mais antiga por alvo
                $revogaPor[$r['alvo']] = ['numero' => $r['numero'], 'ano' => (int)$r['ano'],
                                          'data' => $r['data_ato'], 'link' => $r['link']];
        }
    }

    // Agrupa as portarias por setor (chave = processo; senão nome; senão solo).
    $grupos = [];
    foreach ($flexAtos as $a) {
        $classe = flex_classe($a['ementa'] ?? '');
        if ($classe === 'outro') continue;              // norma geral / CPFJ / suspensão
        $setor = flex_setor($a['ementa'] ?? '', $a['corpo'] ?? '');
        $chave = trim($a['processo_sei'] ?? '');
        if ($chave === '') {
            $nk = mb_strtolower(preg_replace('/[^a-z0-9]/i', '', nome_ascii($setor)));
            $chave = $nk !== '' ? 'nome:' . $nk : 'solo:' . $a['numero'] . '/' . $a['ano'];
        }
        $grupos[$chave]['portarias'][] = [
            'numero' => $a['numero'], 'ano' => (int)$a['ano'], 'data' => $a['data_ato'],
            'link' => $a['link'], 'classe' => $classe, 'status' => $a['status'],
            'revogacao' => $revogaPor[$a['id']] ?? null,
        ];
        if ($setor !== '' && mb_strlen($setor) > mb_strlen($grupos[$chave]['setor'] ?? ''))
            $grupos[$chave]['setor'] = $setor;          // guarda o melhor nome (mais longo) do grupo
    }

    // Monta cada setor: aprovação (adesão mais antiga), alterações (o resto, em
    // ordem), revogação (a que encerrou o setor).
    $setoresFlex = [];
    foreach ($grupos as $g) {
        $ports = $g['portarias'];
        usort($ports, fn($x, $y) => strcmp($x['data'], $y['data']));
        $aprovas = array_values(array_filter($ports, fn($p) => $p['classe'] !== 'retificacao'));
        if (!$aprovas) continue;
        $adesao = null;
        foreach ($aprovas as $p) if ($p['classe'] === 'adesao') { $adesao = $p; break; }
        if (!$adesao) $adesao = $aprovas[0];            // grupo só de manutenção

        // Setor saiu se QUALQUER portaria do grupo foi revogada — a revogação
        // costuma mirar o ATO ORIGINAL ("Revogar a Portaria 65.397/2019 e suas
        // retificações"), não a manutenção mais nova, então checar só a última
        // aprovação deixava passar setores já revogados. Neste domínio toda
        // revogação é saída explícita (manutenção COMPLEMENTA, não revoga).
        // Saída = a revogação mais recente do grupo.
        $revog = null;
        $temRevogado = false;
        foreach ($ports as $p) {
            if ($p['status'] === 'Revogado') $temRevogado = true;
            if ($p['revogacao'] && (!$revog || $p['revogacao']['data'] > $revog['data']))
                $revog = $p['revogacao'];
        }
        $status = ($revog || $temRevogado) ? 'Revogado' : 'Ativo';

        $alteracoes = [];
        foreach ($ports as $p) {
            if ($p['numero'] === $adesao['numero'] && $p['ano'] === $adesao['ano']) continue;
            $alteracoes[] = ['numero' => $p['numero'], 'ano' => $p['ano'], 'data' => $p['data'],
                             'link' => $p['link'],
                             'tipo' => $p['classe'] === 'retificacao' ? 'Retificação' : 'Manutenção'];
        }

        $setoresFlex[] = [
            'setor' => $g['setor'] ?? '(setor não identificado no ato)',
            'status' => $status,
            'entrada' => $adesao['data'], 'saida' => $revog['data'] ?? null,
            'aprovacao' => ['numero' => $adesao['numero'], 'ano' => $adesao['ano'],
                            'data' => $adesao['data'], 'link' => $adesao['link']],
            'alteracoes' => $alteracoes,
            'revogacao' => $revog,
        ];
    }
    usort($setoresFlex, fn($a, $b) => strcmp($b['entrada'], $a['entrada']));   // entrada mais recente no topo

    // Série anual pro gráfico: entrada = ano da adesão; saída = ano da revogação.
    $porAno = [];
    foreach ($setoresFlex as $s) {
        $ae = (int)substr($s['entrada'], 0, 4);
        $porAno[$ae]['entradas'] = ($porAno[$ae]['entradas'] ?? 0) + 1;
        if ($s['saida']) {
            $as = (int)substr($s['saida'], 0, 4);
            $porAno[$as]['saidas'] = ($porAno[$as]['saidas'] ?? 0) + 1;
        }
    }
    ksort($porAno);
    $serieFlex = [];
    $acumulado = 0;
    foreach ($porAno as $ano => $v) {
        $acumulado += ($v['entradas'] ?? 0) - ($v['saidas'] ?? 0);
        $serieFlex[] = ['ano' => $ano, 'entradas' => (int)($v['entradas'] ?? 0),
                         'saidas' => (int)($v['saidas'] ?? 0), 'ativos' => $acumulado];
    }

    // ---- PGD (Programa de Gestão e Desempenho, Decreto 11.072/2022): por
    // menção, a partir de 2022 (quando a UFF o implementou, IN 28/2022). O
    // modelo funciona por edital/ciclo recorrente, não por portaria-por-setor
    // revogável, então não cabe o mesmo padrão de entrada/saída da flex.
    // Exige "desempenho" junto — decisão do mantenedor: o nome oficial é
    // Programa de Gestão E DESEMPENHO (Decreto 11.072/2022), e não há motivo
    // pra outros "programa de gestão" homônimos (Gestão Ambiental, de
    // Documentos etc.) entrarem na conta só por citar a frase mais curta.
    $ft = '+"programa de gestão" +desempenho';
    $st = $pdo->prepare("
        SELECT a.ano,
               COUNT(DISTINCT a.id)        AS atos,
               COUNT(DISTINCT a.orgao_id)  AS setores,
               COUNT(DISTINCT ap.pessoa_id) AS servidores
          FROM ato a
          JOIN ato_texto t   ON t.ato_id = a.id
          LEFT JOIN ato_pessoa ap ON ap.ato_id = a.id
         WHERE MATCH(t.texto_busca) AGAINST(:ft IN BOOLEAN MODE)
           AND a.ano BETWEEN 2022 AND 2100
         GROUP BY a.ano ORDER BY a.ano");
    $st->execute([':ft' => $ft]);
    $seriePgd = array_map(fn($r) => [
        'ano' => (int)$r['ano'], 'atos' => (int)$r['atos'],
        'setores' => (int)$r['setores'], 'servidores' => (int)$r['servidores'],
    ], $st->fetchAll(PDO::FETCH_ASSOC));

    $st = $pdo->prepare("
        SELECT o.sigla,
               COUNT(DISTINCT a.id)        AS atos,
               MIN(a.data_ato)             AS primeiro,
               MAX(a.data_ato)             AS ultimo,
               COUNT(DISTINCT ap.pessoa_id) AS servidores
          FROM ato a
          JOIN ato_texto t   ON t.ato_id = a.id
          JOIN orgao o       ON o.id = a.orgao_id
          LEFT JOIN ato_pessoa ap ON ap.ato_id = a.id
         WHERE MATCH(t.texto_busca) AGAINST(:ft IN BOOLEAN MODE)
           AND a.ano BETWEEN 2022 AND 2100
         GROUP BY o.sigla ORDER BY atos DESC, o.sigla
         LIMIT 500");
    $st->execute([':ft' => $ft]);
    $setoresPgd = array_map(fn($r) => [
        'sigla' => $r['sigla'], 'atos' => (int)$r['atos'],
        'primeiro' => $r['primeiro'], 'ultimo' => $r['ultimo'],
        'servidores' => (int)$r['servidores'],
    ], $st->fetchAll(PDO::FETCH_ASSOC));

    responder_json([
        'flex' => ['serie' => $serieFlex, 'setores' => $setoresFlex],
        'pgd'  => ['serie' => $seriePgd, 'setores' => $setoresPgd],
    ]);
}

// ---- COOPERAÇÃO (acordos, protocolos, cotutelas) ---------------------------
// A ementa desses atos é MUITO estruturada e carrega tudo que a aba precisa:
//   "Dispõe sobre a aprovação do Acordo de Cooperação Internacional celebrado
//    entre a UFF - UFF e a Oslo New University College (Noruega)."
// Daí saem a CATEGORIA (o qualificador do acordo), a INSTITUIÇÃO parceira e o
// PAÍS (entre parênteses). Por isso a rota lê `a.ementa` (que tem FULLTEXT
// próprio, ft_ementa) e não o corpo — o corpo só traria ruído.
//
// "Internacional" NÃO é categoria paralela às outras: é qualificador, e muito
// acordo internacional está registrado como "Cooperação Acadêmica ... (Espanha)".
// O sinal confiável de internacionalidade é o PAÍS reconhecido, não a palavra.

// Categorias, da MAIS específica para a mais genérica — a ordem importa:
// "Técnico-Científica" tem de casar antes de "Técnica", e os qualificadores
// antes do "Cooperação" genérico. O último padrão é a rede de segurança.
const COOP_CATEGORIAS = [
    ['Cotutela',                           '/cotutela/iu'],
    ['Dupla Diplomação',                   '/dupla\s+diploma/iu'],
    ['Memorando de Entendimento',          '/memorando\s+de\s+entendimento/iu'],
    ['Protocolo de Intenções',             '/protocolo\s+de\s+inten/iu'],
    ['Cooperação Técnico-Científica',      '/coopera\w*\s+t[ée]cnico[-\s]*cient[íi]f/iu'],
    ['Cooperação Técnico-Científica',      '/coopera\w*\s+t[ée]cnica\s+e\s+cient[íi]f/iu'],
    ['Cooperação Científica e Tecnológica','/coopera\w*\s+cient[íi]fica\s+e\s+tecnol/iu'],
    ['Cooperação Técnica',                 '/coopera\w*\s+t[ée]cnic/iu'],
    ['Cooperação Internacional',           '/coopera\w*\s+internacional/iu'],
    ['Cooperação Acadêmica',               '/coopera\w*\s+acad[êe]mica/iu'],
    ['Cooperação Multilateral',            '/coopera\w*\s+multilateral/iu'],
    ['Cooperação de Pesquisa',             '/coopera\w*\s+de\s+pesquisa/iu'],
    ['Cooperação Geral',                   '/coopera\w*\s+geral/iu'],
    ['Cooperação Específica',              '/coopera\w*\s+espec[íi]fic/iu'],
    ['Convênio de Cooperação',             '/conv[êe]nio\s+de\s+coopera/iu'],
    ['Termo de Cooperação',                '/termo\s+de\s+coopera/iu'],
    ['Acordo de Cooperação',               '/coopera/iu'],
];

// País (pt-BR) -> [lat, lon]. Serve a DOIS propósitos: plotar no mapa e VALIDAR
// — só é país o que está aqui, o que descarta sozinho o lixo que cai entre
// parênteses na ementa ("(GENI/UFF)", "(PPGH)"). Coordenadas aproximadas do
// centro do país; o mapa é de leitura, não cartografia.
function coop_paises(): array {
    static $p = [
        'África do Sul'=>[-30.6,22.9], 'Alemanha'=>[51.2,10.5], 'Angola'=>[-11.2,17.9],
        'Arábia Saudita'=>[23.9,45.1], 'Argélia'=>[28.0,1.7], 'Argentina'=>[-38.4,-63.6],
        'Austrália'=>[-25.3,133.8], 'Áustria'=>[47.5,14.6], 'Bélgica'=>[50.5,4.5],
        'Bolívia'=>[-16.3,-63.6], 'Brasil'=>[-14.2,-51.9], 'Bulgária'=>[42.7,25.5],
        'Cabo Verde'=>[16.0,-24.0], 'Camarões'=>[7.4,12.4], 'Canadá'=>[56.1,-106.3],
        'Chile'=>[-35.7,-71.5], 'China'=>[35.9,104.2], 'Chipre'=>[35.1,33.4],
        'Colômbia'=>[4.6,-74.3], 'Coreia do Sul'=>[35.9,127.8], 'Costa Rica'=>[9.7,-83.8],
        'Croácia'=>[45.1,15.2], 'Cuba'=>[21.5,-77.8], 'Dinamarca'=>[56.3,9.5],
        'Egito'=>[26.8,30.8], 'El Salvador'=>[13.8,-88.9], 'Equador'=>[-1.8,-78.2],
        'Eslovênia'=>[46.2,15.0], 'Espanha'=>[40.5,-3.7], 'Estados Unidos'=>[37.1,-95.7],
        'Estônia'=>[58.6,25.0], 'Etiópia'=>[9.1,40.5], 'Filipinas'=>[12.9,121.8],
        'Finlândia'=>[61.9,25.7], 'França'=>[46.2,2.2], 'Gana'=>[7.9,-1.0],
        'Grécia'=>[39.1,21.8], 'Guatemala'=>[15.8,-90.2], 'Guiné-Bissau'=>[11.8,-15.2],
        'Holanda'=>[52.1,5.3], 'Hungria'=>[47.2,19.5], 'Índia'=>[20.6,79.0],
        'Indonésia'=>[-0.8,113.9], 'Irlanda'=>[53.4,-8.2], 'Israel'=>[31.0,34.9],
        'Itália'=>[41.9,12.6], 'Japão'=>[36.2,138.3], 'Letônia'=>[56.9,24.6],
        'Líbano'=>[33.9,35.9], 'Lituânia'=>[55.2,23.9], 'Luxemburgo'=>[49.8,6.1],
        'Macau'=>[22.2,113.5], 'Marrocos'=>[31.8,-7.1], 'México'=>[23.6,-102.6],
        'Moçambique'=>[-18.7,35.5], 'Namíbia'=>[-22.96,18.5], 'Nigéria'=>[9.1,8.7],
        'Noruega'=>[60.5,8.5], 'Nova Zelândia'=>[-40.9,174.9], 'Panamá'=>[8.5,-80.8],
        'Paraguai'=>[-23.4,-58.4], 'Peru'=>[-9.2,-75.0], 'Polônia'=>[51.9,19.1],
        'Portugal'=>[39.4,-8.2], 'Quênia'=>[-0.02,37.9], 'Reino Unido'=>[55.4,-3.4],
        'República Tcheca'=>[49.8,15.5], 'Romênia'=>[45.9,25.0], 'Rússia'=>[61.5,105.3],
        'São Tomé e Príncipe'=>[0.2,6.6], 'Senegal'=>[14.5,-14.5], 'Sérvia'=>[44.0,21.0],
        'Singapura'=>[1.35,103.8], 'Suécia'=>[60.1,18.6], 'Suíça'=>[46.8,8.2],
        'Tailândia'=>[15.9,101.0], 'Timor-Leste'=>[-8.9,125.7], 'Tunísia'=>[33.9,9.5],
        'Turquia'=>[39.0,35.2], 'Ucrânia'=>[48.4,31.2], 'Uruguai'=>[-32.5,-55.8],
        'Venezuela'=>[6.4,-66.6], 'Vietnã'=>[14.1,108.3],
    ];
    return $p;
}

// Normaliza o que veio entre parênteses e devolve o país canônico, ou '' se não
// for país. Trata as variações reais do corpus: "EUA", "Lisboa – Portugal"
// (cidade + travessão), acento/caixa trocados e o fecha-parêntese perdido no OCR.
function coop_normaliza_pais(string $bruto): string {
    $p = trim($bruto, " \t.,;:–—-");
    if ($p === '') return '';
    if (preg_match('/[–—-]\s*([^–—-]+)$/u', $p, $m)) $p = trim($m[1]);   // "Lisboa – Portugal"
    $alias = [
        'eua' => 'Estados Unidos', 'usa' => 'Estados Unidos', 'eeuu' => 'Estados Unidos',
        'estados unidos da america' => 'Estados Unidos', 'inglaterra' => 'Reino Unido',
        'escocia' => 'Reino Unido', 'gra-bretanha' => 'Reino Unido', 'uk' => 'Reino Unido',
        'paises baixos' => 'Holanda', 'republica checa' => 'República Tcheca',
        'coreia' => 'Coreia do Sul', 'republica da coreia' => 'Coreia do Sul',
        'costa do marfim' => 'Senegal',
    ];
    $chave = mb_strtolower(nome_ascii($p));
    if (isset($alias[$chave])) return $alias[$chave];
    foreach (array_keys(coop_paises()) as $nome) {          // casa sem acento/caixa
        if (mb_strtolower(nome_ascii($nome)) === $chave) return $nome;
    }
    return '';
}

function coop_categoria(string $ementa): string {
    foreach (COOP_CATEGORIAS as [$rotulo, $rgx]) {
        if (preg_match($rgx, $ementa)) return $rotulo;
    }
    return '';
}

// Instituição parceira. Estratégia: REMOVER a própria UFF do trecho que segue
// "entre" e ficar com o resto — em vez de partir a lista por " e a/o ", que
// falhava em 12% dos casos reais: sem artigo ("e Volkswagen Caminhões"), com
// vírgula ("UFF – UFF, a Fundação Euclides") ou sem conector nenhum, por typo
// ("UFF - UFF Texas Christian University"). Partir por " e " solto seria pior:
// truncaria nomes que contêm "e" ("Ciência e Tecnologia" viraria "Tecnologia").
// Cobre as duas ordens do corpus ("entre a UFF e a X" e "entre a X e a UFF").
function coop_instituicao(string $ementa): string {
    $e = preg_replace('/\s+/u', ' ', trim($ementa));
    $e = preg_replace('/\s*\([^()]*\)?\s*\.?\s*$/u', '', $e);      // tira o país do fim
    if (!preg_match('/\bentre\b(.+)$/iu', $e, $m)) return '';
    $txt = trim($m[1], " \t.,;:–—-");

    $uff = '(?:a\s+|o\s+)?(?:UFF|Universidade\s+Federal\s+Fluminense)(?:\s*[-–—]\s*UFF)?';
    $txt = preg_replace('/^' . $uff . '\s*[,;]?\s*(?:e\s+)?/iu', '', $txt, 1);   // UFF na frente
    $txt = preg_replace('/\s*[,;]?\s*e\s+' . $uff . '\s*$/iu', '', $txt, 1);     // UFF no fim

    // Se ainda restou uma lista com artigo, fica com o último parceiro real.
    $partes = preg_split('/\s+e\s+(?:a|o|as|os|à|ao)\s+|,\s+(?:a|o|as|os)\s+/iu', $txt);
    foreach (array_reverse($partes) as $parte) {
        $p = trim($parte, " \t.,;:–—-");
        // COMEÇA com UFF (não "é igual a"): o corpus traz "…e a UFF - UFF, com
        // interveniência administrativa da Fundação…", em que a parte da UFF
        // carrega uma oração atrás. Exigir igualdade devolvia a UFF como se
        // fosse a parceira, escondendo a instituição real (achado: Petrobras).
        if ($p === '' || preg_match('/^' . $uff . '\b/iu', $p)) continue;
        $p = preg_replace('/^(a|o|as|os)\s+/iu', '', $p);
        if (mb_strlen($p) >= 3) return mb_substr($p, 0, 120);
    }
    return '';
}

// O ato é mesmo um ACORDO, e não um ato que só MENCIONA cooperação? Sem isto
// entram bancas examinadoras e bolsas ("Comissão de Avaliação para Concessão de
// Bolsa no âmbito do Termo de Cooperação do Carrefour"), que citam o acordo mas
// não o celebram — mesma regra de sempre: classifique pelo DISPOSITIVO, não
// pela menção.
function coop_eh_acordo(string $ementa): bool {
    return (bool)preg_match(
        '/celebrad|firmad|(?:acordo|termo|conv[êe]nio|protocolo|instrumento|mem[oó]rando)\s'
        . '|cotutela|dupla\s+diploma/iu', $ementa);
}

function cooperacao(PDO $pdo): void {
    // BOOLEAN MODE sem "+": as expressões são alternativas (basta UMA casar).
    // A triagem fina é o coop_categoria() abaixo — quem não casa categoria
    // nenhuma sai fora, o que remove a menção solta a "cooperação".
    $ft = 'coopera* cotutela "protocolo de intenções" "memorando de entendimento" "dupla diplomação"';
    $st = $pdo->prepare("
        SELECT a.uid AS id, a.numero, a.ano, a.data_ato, a.ementa,
               o.sigla, b.url_pdf AS link
          FROM ato a
          JOIN orgao o        ON o.id = a.orgao_id
          LEFT JOIN boletim b ON b.id = a.boletim_id
         WHERE MATCH(a.ementa) AGAINST(:ft IN BOOLEAN MODE)
         ORDER BY a.ano DESC, a.numero_norm DESC
         LIMIT 4000");
    $st->execute([':ft' => $ft]);

    $coords = coop_paises();
    $acordos = [];
    $porAnoCat = [];      // ano => categoria => n
    $porPais = [];        // país => n
    $cats = [];           // categoria => n
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $ementa = preg_replace('/\s+/u', ' ', trim($r['ementa'] ?? ''));
        $cat = coop_categoria($ementa);
        if ($cat === '' || !coop_eh_acordo($ementa)) continue;   // menção solta, não é acordo

        $pais = '';
        if (preg_match_all('/\(([^()]{2,40})\)?/u', $ementa, $mm)) {
            foreach (array_reverse($mm[1]) as $cand) {   // o país costuma ser o ÚLTIMO
                $n = coop_normaliza_pais($cand);
                if ($n !== '') { $pais = $n; break; }
            }
        }
        $ano = (int)$r['ano'];
        $acordos[] = [
            'id' => $r['id'], 'numero' => $r['numero'], 'ano' => $ano,
            'data' => $r['data_ato'], 'link' => $r['link'], 'sigla' => $r['sigla'],
            'categoria' => $cat,
            'instituicao' => coop_instituicao($ementa),
            'pais' => $pais,
            'lat' => $pais !== '' ? $coords[$pais][0] : null,
            'lon' => $pais !== '' ? $coords[$pais][1] : null,
            'ementa' => mb_substr($ementa, 0, 260),
        ];
        $porAnoCat[$ano][$cat] = ($porAnoCat[$ano][$cat] ?? 0) + 1;
        $cats[$cat] = ($cats[$cat] ?? 0) + 1;
        if ($pais !== '') $porPais[$pais] = ($porPais[$pais] ?? 0) + 1;
    }

    ksort($porAnoCat);
    $serie = [];
    foreach ($porAnoCat as $ano => $porCat) {
        $serie[] = ['ano' => $ano, 'total' => array_sum($porCat), 'categorias' => $porCat];
    }
    arsort($cats);
    arsort($porPais);
    $paises = [];
    foreach ($porPais as $nome => $n) {
        $paises[] = ['pais' => $nome, 'n' => $n,
                     'lat' => $coords[$nome][0], 'lon' => $coords[$nome][1]];
    }

    responder_json([
        'serie'      => $serie,
        'categorias' => array_map(fn($k, $v) => ['categoria' => $k, 'n' => $v],
                                  array_keys($cats), array_values($cats)),
        'paises'     => $paises,
        'acordos'    => $acordos,
    ]);
}

// A rota foi fechada por senha até 18/07/2026 (dossie_autorizado + dossie_token
// no config.php). Foi aberta por decisão do mantenedor: com o RSC, o público
// desta consulta passou a ser o próprio servidor procurando os seus registros
// ("Meu SIAPE"), não só a Gestão de Pessoal. Os atos listados são os mesmos já
// públicos no BS; a rota não grava nada. O dossie_token do config.php ficou
// sem uso (inofensivo se ainda existir lá).

// ---- DOSSIÊ de um servidor (por SIAPE) ------------------------------------
// Serve o Decreto 13.048/2026 (RSC do PCCTAE): o Anexo I pontua participação em
// comissões, comitês, GTs e núcleos, e o servidor precisa ACHAR os atos e citar
// o BS. Este endpoint localiza; quem pontua é a CRSC-PCCTAE. O portal não apura
// — se subnotificasse, o servidor perderia ponto por erro nosso.
//
// Por que a chave é TRIM(LEADING '0'), e não LPAD:
//   O corpus traz o mesmo servidor como '0307221' E '307221' (medido: 1.462
//   pessoas partidas assim). Como pessoa.siape é UNIQUE, são DUAS linhas, cada
//   uma com seus ato_pessoa — quem digita sem o zero recebe metade do dossiê e
//   não tem como saber. LPAD(x,7,'0') resolveria, mas o LPAD do MySQL TRUNCA:
//   LPAD('12345678',7,'0') = '1234567', o que fundiria pessoas diferentes.
//   Tirar zeros à esquerda é seguro em qualquer comprimento.
//   Isto normaliza a CONSULTA, não os dados. O merge das linhas duplicadas de
//   pessoa é curadoria (como orgao_alias), não regex — não se faz por aqui.
//
// Sobre o aviso de nome divergente — e o que ele NÃO alcança:
//   Ele só dispara quando as GRAFIAS do siape ('0303043' e '303043') trazem
//   nomes diferentes. O cross-link mais comum é invisível daqui: importar_v2.php
//   chaveia pessoa por "s:$siape" e pessoa.siape é UNIQUE, então um siape que no
//   corpus carrega duas pessoas (medido: '3369546' = Bárbara Sena E Simone
//   Lemos) já colapsou numa linha com UM nome — o primeiro que entrou. Os atos
//   das duas ficam pendurados nessa linha, e o v2 não guarda o nome grafado em
//   cada ato (ato_pessoa é só ato_id+pessoa_id), então não há como detectar isso
//   por SQL. Quem cobre esse buraco é o rótulo "confira o ato", não este aviso.
//   Separar essas pessoas é curadoria — Fase 2.
function dossie(PDO $pdo, array $cfg, string $siape, string $nome): void {
    $siape = preg_replace('/\D/', '', $siape);
    if ($siape === '') responder_json(['erro' => 'siape ausente'], 400);
    $chave = ltrim($siape, '0');
    if ($chave === '') responder_json(['erro' => 'siape inválido'], 400);

    // 1) Quem é este SIAPE — todas as linhas de pessoa que colapsam na chave.
    $st = $pdo->prepare("
        SELECT id, siape, nome FROM pessoa
        WHERE siape IS NOT NULL AND siape <> ''
          AND TRIM(LEADING '0' FROM siape) = :chave
        ORDER BY nome IS NULL, nome");
    $st->execute([':chave' => $chave]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    $pessoas = array_map(fn($r) => ['siape' => $r['siape'], 'nome' => $r['nome'] ?? ''], $rows);
    $ids = array_map(fn($r) => (int)$r['id'], $rows);

    // Nomes para exibir: deduplicados por chave SEM acento/caixa. Sem isto,
    // "João Marcel" e "Joao Marcel" contam como dois e o aviso de nome
    // divergente dispara para quase todo mundo — variação de acento é o caso
    // COMUM no corpus. Um aviso que sempre pisca é um aviso que ninguém lê, e
    // aí ele não serve pro caso que importa (SIAPE com duas pessoas de fato).
    // Entre as variantes, fica a mais rica (a que tem acento).
    $porChave = [];
    foreach ($pessoas as $p) {
        $n = trim($p['nome']);
        if ($n === '') continue;
        $k = preg_replace('/\s+/', ' ', trim(mb_strtolower(nome_ascii($n), 'UTF-8')));
        if (!isset($porChave[$k]) || strlen($n) > strlen(nome_ascii($n))) $porChave[$k] = $n;
    }
    $nomes = array_values($porChave);

    $funcoes = [];
    $atos = [];
    if ($ids) {
        // ids vêm do nosso próprio SELECT e passam por (int) — interpolar aqui é
        // seguro e é o único jeito de um IN de tamanho variável.
        $in = implode(',', $ids);

        // 2) Funções de chefia — DADO ESTRUTURADO. É a mesma fonte que alimenta
        // Chefias e Mandatos: o extrator identificou cargo, unidade e mandato a
        // partir do dispositivo. Vale mais que a menção e vem separado por isso.
        $st = $pdo->query("
            SELECT f.acao, f.cargo, f.unidade, f.prazo_meses, f.data_inicio, f.inicio_origem,
                   a.uid AS ato_id, CONCAT(t.nome, ' nº ', a.numero, '/', a.ano) AS ato_label,
                   o.sigla, a.data_ato, a.status, b.url_pdf AS link_boletim
            FROM ato_funcao f
            JOIN ato a          ON a.id = f.ato_id
            JOIN tipo_ato t     ON t.id = a.tipo_id
            JOIN orgao o        ON o.id = a.orgao_id
            LEFT JOIN boletim b ON b.id = a.boletim_id
            WHERE f.pessoa_id IN ($in)
            ORDER BY a.data_ato DESC, a.id DESC");
        $funcoes = array_map(fn($r) => [
            'acao' => $r['acao'], 'cargo' => $r['cargo'] ?? '', 'unidade' => $r['unidade'] ?? '',
            'prazoMeses' => $r['prazo_meses'] !== null ? (int)$r['prazo_meses'] : null,
            'dataInicio' => $r['data_inicio'], 'inicioOrigem' => $r['inicio_origem'],
            'atoId' => $r['ato_id'], 'atoLabel' => $r['ato_label'], 'sigla' => $r['sigla'] ?? '',
            'dataAto' => $r['data_ato'], 'status' => $r['status'],
            'linkBoletim' => $r['link_boletim'],
        ], $st->fetchAll(PDO::FETCH_ASSOC));

        // 3) Atos que CITAM o SIAPE — DADO INDICATIVO. ato_pessoa é menção, não
        // participação: numa banca de progressão o avaliado também é citado. O
        // rótulo na tela precisa dizer isso; aqui não dá pra separar sem ler o
        // dispositivo (é a Fase 2).
        $atos = $pdo->query("
            SELECT a.uid AS id, t.nome AS tipo, a.numero, a.ano, o.sigla,
                   a.data_ato, a.ementa, a.status, a.secao, a.pagina,
                   b.numero AS bs_numero, b.ano AS bs_ano, b.url_pdf AS link_boletim
            FROM ato_pessoa ap
            JOIN ato a          ON a.id = ap.ato_id
            JOIN tipo_ato t     ON t.id = a.tipo_id
            JOIN orgao o        ON o.id = a.orgao_id
            LEFT JOIN boletim b ON b.id = a.boletim_id
            WHERE ap.pessoa_id IN ($in)
            ORDER BY a.data_ato DESC, a.id DESC")->fetchAll(PDO::FETCH_ASSOC);
        $atos = array_map(fn($r) => dossie_ato($r), colapsar_republicados($atos));
    }

    // 4) Recall por nome — opcional e SEPARADO. Existe porque a busca por
    // matrícula é incompleta por construção: 30–70% dos atos não registram SIAPE
    // (medido: 34% de cobertura em 2001, ~65% em 2025), e o extrator só cria
    // pessoa quando ACHA um siape — logo o nome de quem não tem matrícula no ato
    // não está em pessoa/ato_pessoa, está só no CORPO do ato. Por isso aqui é
    // FULLTEXT em ato_texto (mesmo mecanismo do filtro `nome` de listar()), e
    // não JOIN em pessoa: consultar pessoa devolveria zero, sempre.
    // Exclui os atos já listados pelo siape — o bloco é complementar, não soma.
    $porNome = null;
    $nome = trim($nome);
    if ($nome !== '' && mb_strlen($nome) >= 4) {
        $nft = booleanize($nome);
        $cond = $nft !== ''
            ? "MATCH(tx.texto_busca) AGAINST(:nft IN BOOLEAN MODE)"
            : "tx.texto_busca LIKE :nlike";
        $pn = $nft !== '' ? [':nft' => $nft] : [':nlike' => '%' . mb_strtolower($nome) . '%'];
        $exclui = $ids ? "AND NOT EXISTS (SELECT 1 FROM ato_pessoa ap
                                          WHERE ap.ato_id = a.id AND ap.pessoa_id IN (" . implode(',', $ids) . "))" : '';
        $st = $pdo->prepare("
            SELECT a.uid AS id, t.nome AS tipo, a.numero, a.ano, o.sigla,
                   a.data_ato, a.ementa, a.status, a.secao, a.pagina,
                   b.numero AS bs_numero, b.ano AS bs_ano, b.url_pdf AS link_boletim
            FROM ato a
            JOIN tipo_ato t     ON t.id = a.tipo_id
            JOIN orgao o        ON o.id = a.orgao_id
            LEFT JOIN boletim b ON b.id = a.boletim_id
            WHERE EXISTS (SELECT 1 FROM ato_texto tx WHERE tx.ato_id = a.id AND $cond)
            $exclui
            ORDER BY a.data_ato DESC, a.id DESC
            LIMIT 300");
        $st->execute($pn);
        $rowsNome = colapsar_republicados($st->fetchAll(PDO::FETCH_ASSOC));
        $porNome = [
            'termo' => $nome,
            'total' => count($rowsNome),
            'atos' => array_map(fn($r) => dossie_ato($r), $rowsNome),
        ];
    }

    responder_json([
        'siape' => $siape,
        'chave' => $chave,
        'pessoas' => $pessoas,
        'nomes' => $nomes,
        'nomesDistintos' => count($nomes),
        'linhasPessoa' => count($pessoas),
        'totalAtos' => count($atos),
        'funcoes' => $funcoes,
        'atos' => $atos,
        'porNome' => $porNome,
    ]);
}

// Mesma portaria republicada em mais de um boletim gera uids -2/-3 (é um só ato
// lógico). No dossiê isso importa mais que nos outros painéis: o servidor
// citaria o mesmo ato duas vezes no processo dele. Mesma chave de colapso já
// usada em pad_cadeia().
function colapsar_republicados(array $rows): array {
    $vistos = [];
    return array_values(array_filter($rows, function ($r) use (&$vistos) {
        $sig = ($r['tipo'] ?? '') . '|' . ($r['sigla'] ?? '') . '|'
             . ($r['numero'] ?? '') . '|' . ($r['ano'] ?? '') . '|' . ($r['data_ato'] ?? '');
        if (isset($vistos[$sig])) return false;
        $vistos[$sig] = true;
        return true;
    }));
}

function dossie_ato(array $r): array {
    return [
        'id' => $r['id'], 'tipo' => $r['tipo'], 'numero' => $r['numero'], 'ano' => (int)$r['ano'],
        'sigla' => $r['sigla'] ?? '', 'dataAto' => $r['data_ato'],
        'ementa' => $r['ementa'] ?? '', 'status' => $r['status'],
        'secao' => $r['secao'] ?? '', 'pagina' => $r['pagina'] ?? '',
        'bsNumero' => $r['bs_numero'] !== null ? (int)$r['bs_numero'] : null,
        'bsAno' => $r['bs_ano'] !== null ? (int)$r['bs_ano'] : null,
        'linkBoletim' => $r['link_boletim'],
    ];
}
