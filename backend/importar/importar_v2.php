<?php
// ============================================================================
//  Importador v2: le o JSON publicado pela extracao e faz UPSERT no schema
//  normalizado (fanara87_governanca). Adaptado de importar.php (v1).
//  Idempotente por CHAVE NATURAL -- o `id` do JSON e um slug de estilo v1
//  (ex.: "01-26-determina-o-de-servi-o-gqa-29-2025"), NAO o `uid` v2; o
//  casamento usa (boletim_id,tipo_id,sigla_orig,numero_norm,ano), igual ao
//  ETL da Fase A. O `uid` v2 e recalculado a cada rodada de forma pura (mesmas
//  entradas -> mesma saida), entao a atualizacao de um ato ja existente nunca
//  colide com uq_uid.
//
//  Diferenca deliberada vs. Fase A/B (offline): a resolucao de ORGAO aqui e
//  SIMPLES (sigla exata ou alias ja conhecido; cria orgao novo com tipo=
//  'outro' e orgao_origem='cabecalho' se a sigla for inedita) -- NAO tenta
//  replicar a derivacao por texto (resolver_orgaos.py) em cada requisicao,
//  que roda a cada minuto e precisa ser rapida/robusta. A qualidade "derivada
//  do texto" (nome completo, hierarquia, cargo do signatario) fica para uma
//  rodada periodica OFFLINE do pipeline completo (nao construida ainda).
//
//  Uso (CLI, cron):
//      php importar_v2.php
//      php importar_v2.php /caminho/para/portal-data.json    (arquivo local)
// ============================================================================

$raiz = dirname(__DIR__);
require $raiz . '/api/db.php';
require_once __DIR__ . '/extrair_prazos.php';                // Radar genérico
require_once __DIR__ . '/extrair_prazos_pad_sinve.php';      // PAD/SINVE (alta confiança)
$cfg = carregar_config();

$cli = (PHP_SAPI === 'cli');
if (!$cli) {
    header('Content-Type: text/plain; charset=utf-8');
    $token = $cfg['import_token'] ?? '';
    if ($token === '' || ($_GET['token'] ?? '') !== $token) {
        http_response_code(403);
        exit("Acesso negado. Configure 'import_token' e use ?token=...\n");
    }
    // O caminho rotineiro (feed diário do ano corrente, ~3,2k atos / 11 MB)
    // cabe folgado nos limites padrão. Um backfill via ?arquivo= sobe um lote
    // maior e pode raspar o teto — sem SSH, o navegador é o único jeito de
    // rodar isto, então vale pedir a folga. @ e sem checar retorno de
    // propósito: hospedagem compartilhada pode recusar, e aí seguimos com o
    // que houver (é por isso que os lotes são fatiados no tamanho que o feed
    // diário já prova todo dia, em vez de depender destas linhas).
    @set_time_limit(0);
    @ini_set('memory_limit', '512M');
    @ini_set('zlib.output_compression', '0');
    @ob_implicit_flush(true);
}
function log_($m) { echo $m . "\n"; @flush(); }

$pdo = conectar($cfg);

// ---------------------------------------------------------------------------
// Helpers de normalizacao (espelham etl_v2.py / resolver_relacoes_v2.php)
// ---------------------------------------------------------------------------
function strip_ac(string $s): string {
    $s = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
    return $s === false ? $s : $s;
}
function slugify(string $s): string {
    $s = mb_strtolower(strip_ac($s), 'UTF-8');
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-');
}
function normkey(string $dest): string {
    $d = mb_strtolower(strip_ac($dest), 'UTF-8');
    $d = preg_replace('/\b\d{4}\b/', '', $d);
    $d = preg_replace('/[^a-z0-9]/', '', $d);
    return $d;
}
function digits(?string $s): string {
    return preg_replace('/\D/', '', (string)$s);
}
const SIGLA_TIPO = [
    'Determinação de Serviço' => 'dts', 'Portaria' => 'port', 'Resolução' => 'res',
    'Decisão' => 'dec', 'Ordem de Serviço' => 'os', 'Resumo de Despachos' => 'rd',
    'Edital' => 'ed', 'Comunicado' => 'com', 'Norma de Serviço' => 'ns',
    'Instrução Normativa' => 'in',
];
const TIPOS_OK_RELACAO = ['Revoga', 'Altera', 'Complementa'];

// ---------------------------------------------------------------------------
// Caches (evitam 1 SELECT por ato para dimensoes que se repetem no lote)
// ---------------------------------------------------------------------------
$cacheTipo = [];
function tipo_id(PDO $pdo, array &$cache, string $nome) {
    if (isset($cache[$nome])) return $cache[$nome];
    $id = $pdo->prepare("SELECT id FROM tipo_ato WHERE nome = ?");
    $id->execute([$nome]);
    $v = $id->fetchColumn();
    return $cache[$nome] = ($v !== false ? (int)$v : null);
}

$cacheBoletim = [];
function boletim_id(PDO $pdo, array &$cache, string $arquivo, ?string $boletimNumero, ?string $linkBoletim) {
    // IDENTIDADE do boletim = ARQUIVO (nome do arquivo), estavel e identico no
    // v2 (boletim.arquivo) e no JSON (a['arquivo']). O NUMERO IMPRESSO diverge
    // do numero do arquivo (ex.: arquivo "57-26.pdf" traz "BS nº 113"), e o ANO
    // do boletim != ano do ato -- por isso NAO se pode chavear por (numero,ano):
    // duplicaria o boletim e, em cascata, os atos. v1 tambem chaveava por arquivo.
    $arquivo = trim($arquivo);
    if ($arquivo !== '') {
        if (isset($cache[$arquivo])) return $cache[$arquivo];
        $st = $pdo->prepare("SELECT id FROM boletim WHERE arquivo = ?");
        $st->execute([$arquivo]);
        $id = $st->fetchColumn();
        if ($id !== false) return $cache[$arquivo] = (int)$id;
    }
    // nao existe -> cria. numero/ano do boletimNumero ("BS nº 57/2026"), senao
    // do proprio arquivo ("57-26.pdf" -> 57/2026).
    $numero = $anoBol = null;
    if (preg_match('#(\d+)\s*/\s*(\d{4})#', (string)$boletimNumero, $m)) {
        $numero = (int)$m[1]; $anoBol = (int)$m[2];
    } elseif (preg_match('#(\d+)\s*-\s*(\d{2,4})#', $arquivo, $m)) {
        $numero = (int)$m[1]; $anoBol = (int)($m[2] < 100 ? 2000 + $m[2] : $m[2]);
    }
    if ($numero === null || $anoBol === null) return null;
    // ON DUPLICATE protege contra colisao de uq_num_ano (numero,ano) c/ arquivo
    // diferente; nao sobrescreve arquivo/url ja gravados.
    $pdo->prepare("INSERT INTO boletim (numero,ano,arquivo,url_pdf) VALUES (:n,:a,:arq,:u)
                   ON DUPLICATE KEY UPDATE arquivo=COALESCE(arquivo,VALUES(arquivo)), url_pdf=COALESCE(url_pdf,VALUES(url_pdf))")
        ->execute([':n' => $numero, ':a' => $anoBol, ':arq' => $arquivo ?: null, ':u' => $linkBoletim ?: null]);
    $st = $pdo->prepare("SELECT id FROM boletim WHERE numero=? AND ano=?");
    $st->execute([$numero, $anoBol]);
    $id = (int)$st->fetchColumn();
    if ($arquivo !== '') $cache[$arquivo] = $id;
    return $id;
}

$cacheOrgao = [];
function orgao_id(PDO $pdo, array &$cache, string $siglaRaw) {
    $sigla = trim($siglaRaw);
    if ($sigla === '') $sigla = 'N/D';
    if (isset($cache[$sigla])) return $cache[$sigla];
    // 1) sigla canonica exata
    $st = $pdo->prepare("SELECT id FROM orgao WHERE sigla = ?");
    $st->execute([$sigla]);
    $id = $st->fetchColumn();
    if ($id !== false) return $cache[$sigla] = (int)$id;
    // 2) alias conhecido (drift de sigla ja mapeado)
    $st = $pdo->prepare("SELECT orgao_id FROM orgao_alias WHERE alias = ?");
    $st->execute([$sigla]);
    $id = $st->fetchColumn();
    if ($id !== false) return $cache[$sigla] = (int)$id;
    // 3) sigla inedita -> cria orgao novo (qualidade "cabecalho", sem derivacao
    //    de texto; uma rodada offline periodica do resolver pode enriquecer depois)
    $pdo->prepare("INSERT INTO orgao (sigla, tipo) VALUES (?, 'outro')")->execute([$sigla]);
    return $cache[$sigla] = (int)$pdo->lastInsertId();
}

$cachePessoa = [];
function pessoa_id(PDO $pdo, array &$cache, ?string $siape, ?string $nome) {
    $siape = mb_substr(digits($siape), 0, 10);
    $nome = mb_substr(trim((string)$nome), 0, 160, 'UTF-8');
    $chave = $siape !== '' ? "s:$siape" : ($nome !== '' ? 'n:' . mb_strtolower(strip_ac($nome), 'UTF-8') : null);
    if ($chave === null) return null;
    if (isset($cache[$chave])) return $cache[$chave];
    if ($siape !== '') {
        $st = $pdo->prepare("SELECT id FROM pessoa WHERE siape = ?");
        $st->execute([$siape]);
        $id = $st->fetchColumn();
        if ($id !== false) {
            if ($nome !== '') {
                $pdo->prepare("UPDATE pessoa SET nome = ? WHERE id = ? AND (nome IS NULL OR nome = '')")
                    ->execute([$nome, $id]);
            }
            return $cache[$chave] = (int)$id;
        }
    } elseif ($nome !== '') {
        $st = $pdo->prepare("SELECT id FROM pessoa WHERE siape IS NULL AND nome = ?");
        $st->execute([$nome]);
        $id = $st->fetchColumn();
        if ($id !== false) return $cache[$chave] = (int)$id;
    }
    $pdo->prepare("INSERT INTO pessoa (siape, nome) VALUES (?, ?)")
        ->execute([$siape !== '' ? $siape : null, $nome !== '' ? $nome : null]);
    return $cache[$chave] = (int)$pdo->lastInsertId();
}

$cacheTag = [];
function tag_id(PDO $pdo, array &$cache, string $nome) {
    $nome = trim($nome);
    if ($nome === '') return null;
    if (isset($cache[$nome])) return $cache[$nome];
    $st = $pdo->prepare("SELECT id FROM tag WHERE nome = ?");
    $st->execute([$nome]);
    $id = $st->fetchColumn();
    if ($id !== false) return $cache[$nome] = (int)$id;
    $pdo->prepare("INSERT INTO tag (nome) VALUES (?)")->execute([$nome]);
    return $cache[$nome] = (int)$pdo->lastInsertId();
}

// ---------------------------------------------------------------------------
// Upsert de 1 ato. IDENTIDADE = chave natural (boletim,tipo,sigla_orig,
// numero_norm,ano) -- SELECT-first, depois UPDATE-ou-INSERT.
//
// NAO usa "INSERT ... ON DUPLICATE KEY UPDATE": o `uid` NAO inclui o boletim
// (dois atos de mesmo tipo/sigla/numero/ano em boletins DIFERENTES geram o
// mesmo uid-base), entao um upsert por uq_uid sequestraria a linha errada e o
// id devolvido nao casaria com a chave natural. Aqui o uid e so um slug de
// exibicao: quando um ato NOVO colide no uid-base, adiciona sufixo -2/-3 (mesma
// logica do ETL da Fase A). sigla_orig e numero_norm sao comparados null-safe
// (<=>), consistente com N/D=NULL gravado na Fase A.
// @return array{0:int,1:int} [ato_id, 1=novo | 2=atualizado c/ mudanca | 0=igual]
// ---------------------------------------------------------------------------
function upsert_ato(PDO $pdo, int $boletimId, int $tipoId, string $tipoNome, int $orgaoId,
                     string $siglaOrig, string $numero, int $ano, array $a): array {
    $numeroNorm = digits($numero);
    $numeroNormSql = $numeroNorm !== '' ? (int)$numeroNorm : null;
    $siglaSql = ($siglaOrig === 'N/D' || $siglaOrig === '') ? null : $siglaOrig;  // N/D -> NULL (igual Fase A)

    $data = null;
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($a['dataAssinatura'] ?? ''))
        && substr($a['dataAssinatura'], 0, 4) !== '0000') {
        $data = $a['dataAssinatura'];
    }
    $status = in_array($a['status'] ?? '', ['Ativo', 'Alterado', 'Revogado'], true) ? $a['status'] : 'Ativo';
    $ementa = mb_substr((string)($a['ementa'] ?? ''), 0, 600, 'UTF-8');
    $einf = !empty($a['ementaInferida']) ? 1 : 0;

    // 1) já existe? (identidade natural, null-safe)
    $sel = $pdo->prepare(
        "SELECT id FROM ato WHERE boletim_id=:bol AND tipo_id=:tipo
         AND (sigla_orig <=> :sigla) AND (numero_norm <=> :numnorm) AND ano=:ano"
    );
    $sel->execute([':bol' => $boletimId, ':tipo' => $tipoId, ':sigla' => $siglaSql,
                   ':numnorm' => $numeroNormSql, ':ano' => $ano]);
    $id = $sel->fetchColumn();

    if ($id !== false) {
        // UPDATE dos campos mutáveis; uid fica estável (não regenera).
        $upd = $pdo->prepare(
            "UPDATE ato SET numero=:num, data_ato=:data, ementa=:ementa, ementa_inferida=:einf,
                status=:status, processo_sei=:proc, sei_documento=:seidoc, secao=:secao,
                pagina=:pagina, orgao_id=:org
             WHERE id=:id"
        );
        $upd->execute([
            ':num' => $numero, ':data' => $data, ':ementa' => $ementa, ':einf' => $einf,
            ':status' => $status, ':proc' => $a['processoSei'] ?? null, ':seidoc' => $a['seiDocumento'] ?? null,
            ':secao' => $a['secao'] ?? null, ':pagina' => $a['pagina'] ?? null, ':org' => $orgaoId,
            ':id' => (int)$id,
        ]);
        return [(int)$id, $upd->rowCount() > 0 ? 2 : 0];
    }

    // 2) novo -> uid único (sufixo -2/-3 se o uid-base já existir de OUTRO ato)
    $prefixo = SIGLA_TIPO[$tipoNome] ?? 'ato';
    $base = slugify("$prefixo-$siglaOrig-" . ($numeroNorm !== '' ? $numeroNorm : 'sn') . "-$ano");
    $uid = $base; $n = 1;
    $chk = $pdo->prepare("SELECT 1 FROM ato WHERE uid=? LIMIT 1");
    while (true) {
        $chk->execute([$uid]);
        if ($chk->fetchColumn() === false) break;
        $uid = $base . '-' . (++$n);
    }

    $ins = $pdo->prepare(
        "INSERT INTO ato (uid,boletim_id,tipo_id,orgao_id,numero,numero_norm,ano,sigla_orig,
            data_ato,ementa,ementa_inferida,status,processo_sei,sei_documento,secao,pagina,orgao_origem)
         VALUES (:uid,:bol,:tipo,:org,:num,:numnorm,:ano,:sigla,:data,:ementa,:einf,:status,:proc,:seidoc,:secao,:pagina,'cabecalho')"
    );
    $ins->execute([
        ':uid' => $uid, ':bol' => $boletimId, ':tipo' => $tipoId, ':org' => $orgaoId,
        ':num' => $numero, ':numnorm' => $numeroNormSql, ':ano' => $ano, ':sigla' => $siglaSql,
        ':data' => $data, ':ementa' => $ementa, ':einf' => $einf,
        ':status' => $status, ':proc' => $a['processoSei'] ?? null, ':seidoc' => $a['seiDocumento'] ?? null,
        ':secao' => $a['secao'] ?? null, ':pagina' => $a['pagina'] ?? null,
    ]);
    return [(int)$pdo->lastInsertId(), 1];
}

// ---------------------------------------------------------------------------
// 1) Carrega o JSON
// ---------------------------------------------------------------------------
if ($cli && isset($argv[1])) {
    $origem = $argv[1];
} elseif (!$cli && isset($_GET['arquivo'])) {
    // modo navegador: só arquivo local por nome (sem caminho), na própria pasta
    $origem = __DIR__ . '/' . basename($_GET['arquivo']);
} else {
    $origem = $cfg['fonte_json'] ?? '';
}
log_("Lendo dados de: $origem");
$bruto = ler_origem($origem);
$dados = json_decode($bruto, true);
if (!is_array($dados)) { exit("ERRO: JSON inválido.\n"); }
log_(count($dados) . " atos recebidos. Importando...");

$pdo->beginTransaction();
try {
    $pdo->exec("INSERT INTO extracao (versao,escopo,n_atos,observacao) VALUES "
              . "('importar-diario','sync JSON->v2'," . count($dados) . ",'importar_v2.php')");
    $extracaoId = (int)$pdo->lastInsertId();

    $insTexto = $pdo->prepare("INSERT INTO ato_texto (ato_id,texto_original,texto_busca) VALUES (:id,:t,:t2)
                                ON DUPLICATE KEY UPDATE texto_original=VALUES(texto_original), texto_busca=VALUES(texto_busca)");
    $delPessoa = $pdo->prepare("DELETE FROM ato_pessoa WHERE ato_id=:id");
    $insPessoa = $pdo->prepare("INSERT IGNORE INTO ato_pessoa (ato_id,pessoa_id) VALUES (:id,:p)");
    $delTag = $pdo->prepare("DELETE FROM ato_tag WHERE ato_id=:id");
    $insTag = $pdo->prepare("INSERT IGNORE INTO ato_tag (ato_id,tag_id) VALUES (:id,:t)");
    $delRel = $pdo->prepare("DELETE FROM relacao WHERE ato_id=:id");
    $insRel = $pdo->prepare("INSERT INTO relacao (ato_id,tipo,destino_ato_id,destino_texto,destino_norm,externo,trecho,metodo,extracao_id)
                              VALUES (:id,:tipo,NULL,:dt,:dn,0,:tr,'importar-diario',:ex)");
    $delFunc = $pdo->prepare("DELETE FROM ato_funcao WHERE ato_id=:id");
    $insFunc = $pdo->prepare("INSERT INTO ato_funcao
                               (ato_id,acao,cargo,unidade,unidade_chave,orgao_id,pessoa_id,
                                prazo_meses,data_inicio,inicio_origem)
                               VALUES (:id,:ac,:ca,:un,:uk,NULL,:p,:pm,:di,:io)");
    $delApos = $pdo->prepare("DELETE FROM ato_aposentadoria WHERE ato_id=:id");
    $insApos = $pdo->prepare("INSERT INTO ato_aposentadoria (ato_id,tipo,base_legal) VALUES (:id,:t,:b)");
    $delDesl = $pdo->prepare("DELETE FROM ato_deslocamento WHERE ato_id=:id");
    $insDesl = $pdo->prepare("INSERT INTO ato_deslocamento (ato_id,tipo,direcao,motivo,setor) VALUES (:id,:t,:d,:m,:s)");
    $delPrazo = $pdo->prepare("DELETE FROM prazo WHERE ato_id=:id");
    $insPrazo = $pdo->prepare("INSERT INTO prazo (ato_id,tipo,data_limite,conf,base,publico,trecho)
                               VALUES (:id,:tp,:dl,:cf,:bs,:pb,:tr)");

    $novos = 0; $atualizados = 0;
    foreach ($dados as $a) {
        $tipoNome = $a['tipoAto'] ?? '';
        $tipoId = tipo_id($pdo, $cacheTipo, $tipoNome);
        if ($tipoId === null) { log_("  aviso: tipo desconhecido '$tipoNome', ato ignorado (id={$a['id']})"); continue; }
        $ano = (int)($a['ano'] ?? 0);
        if ($ano <= 0) { log_("  aviso: ano ausente/invalido, ato ignorado (id={$a['id']})"); continue; }

        $siglaOrig = mb_substr(trim((string)($a['orgaoEmissor'] ?? ($a['sigla'] ?? ''))), 0, 60, 'UTF-8');
        if ($siglaOrig === '') $siglaOrig = 'N/D';
        $orgaoId = orgao_id($pdo, $cacheOrgao, $siglaOrig);
        $bolId = boletim_id($pdo, $cacheBoletim, (string)($a['arquivo'] ?? ''),
                             $a['boletimNumero'] ?? null, $a['linkBoletim'] ?? null);
        if ($bolId === null) { log_("  aviso: boletim nao identificado, ato ignorado (id={$a['id']})"); continue; }

        [$atoId, $rc] = upsert_ato($pdo, $bolId, $tipoId, $tipoNome, $orgaoId, $siglaOrig,
                                    (string)($a['numero'] ?? ''), $ano, $a);
        if ($rc === 1) $novos++; elseif ($rc === 2) $atualizados++;

        $texto = (string)($a['textoBusca'] ?? '');
        $insTexto->execute([':id' => $atoId, ':t' => $texto, ':t2' => $texto]);

        // pessoas citadas (siapes/pessoas)
        $delPessoa->execute([':id' => $atoId]);
        $nomeDe = [];
        foreach (($a['pessoas'] ?? []) as $pz) {
            $sp = digits($pz['siape'] ?? '');
            if ($sp !== '') $nomeDe[$sp] = $pz['nome'] ?? '';
        }
        $todosSiapes = array_unique(array_merge(
            array_map('digits', $a['siapes'] ?? []), array_keys($nomeDe)
        ));
        $pids = [];
        foreach ($todosSiapes as $s) {
            if ($s === '') continue;
            $pid = pessoa_id($pdo, $cachePessoa, $s, $nomeDe[$s] ?? null);
            if ($pid) $pids[$pid] = true;
        }
        foreach (array_keys($pids) as $pid) $insPessoa->execute([':id' => $atoId, ':p' => $pid]);

        // tags
        $delTag->execute([':id' => $atoId]);
        $tids = [];
        foreach (($a['tags'] ?? []) as $t) {
            $tid = tag_id($pdo, $cacheTag, (string)$t);
            if ($tid) $tids[$tid] = true;
        }
        foreach (array_keys($tids) as $tid) $insTag->execute([':id' => $atoId, ':t' => $tid]);

        // relacoes (destino_ato_id fica NULL; resolver liga depois)
        $delRel->execute([':id' => $atoId]);
        $vistos = [];
        foreach (($a['relacoes'] ?? []) as $r) {
            $tipo = $r['tipoRelacao'] ?? '';
            if (!in_array($tipo, TIPOS_OK_RELACAO, true)) continue;
            $dest = mb_substr((string)($r['atoDestino'] ?? ''), 0, 200, 'UTF-8');
            if ($dest === '') continue;
            $dn = mb_substr(normkey($dest), 0, 200, 'UTF-8');
            $k = "$tipo|$dn";
            if (isset($vistos[$k])) continue;
            $vistos[$k] = true;
            $insRel->execute([':id' => $atoId, ':tipo' => $tipo, ':dt' => $dest, ':dn' => $dn,
                               ':tr' => mb_substr((string)($r['detalhes'] ?? ''), 0, 255, 'UTF-8'),
                               ':ex' => $extracaoId]);
        }

        // funcoes (chefias)
        $delFunc->execute([':id' => $atoId]);
        foreach (($a['funcoes'] ?? []) as $fz) {
            $acao = ($fz['acao'] ?? '') === 'dispensar' ? 'dispensar' : 'designar';
            $pid = pessoa_id($pdo, $cachePessoa, $fz['siape'] ?? null, $fz['nome'] ?? null);
            // Mandato só na designação: a dispensa encerra o mandato de outro
            // ato, não abre um. O extrator já respeita isso, mas o importador
            // não deve depender disso para não gravar prazo em dispensa.
            $desig = $acao === 'designar';
            $ini = $desig ? ($fz['data_inicio'] ?? '') : '';
            $org = $desig ? ($fz['inicio_origem'] ?? '') : '';
            $insFunc->execute([':id' => $atoId, ':ac' => $acao,
                ':ca' => mb_substr((string)($fz['cargo'] ?? ''), 0, 60, 'UTF-8'),
                ':un' => mb_substr((string)($fz['unidade'] ?? ''), 0, 180, 'UTF-8'),
                ':uk' => mb_substr((string)($fz['unidade_chave'] ?? ''), 0, 180, 'UTF-8'),
                ':p' => $pid,
                ':pm' => $desig && !empty($fz['prazo_meses']) ? (int)$fz['prazo_meses'] : null,
                ':di' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$ini) ? $ini : null,
                ':io' => in_array($org, ['declarado', 'tampao', 'data_ato'], true) ? $org : null]);
        }

        // aposentadoria / deslocamento
        $delApos->execute([':id' => $atoId]);
        if (!empty($a['aposentadoria']['tipo'])) {
            $insApos->execute([':id' => $atoId, ':t' => $a['aposentadoria']['tipo'],
                                ':b' => $a['aposentadoria']['baseLegal'] ?? null]);
        }
        $delDesl->execute([':id' => $atoId]);
        if (!empty($a['deslocamento']['tipo'])) {
            $insDesl->execute([':id' => $atoId, ':t' => $a['deslocamento']['tipo'],
                ':d' => $a['deslocamento']['direcao'] ?? null,
                ':m' => ($a['deslocamento']['motivo'] ?? '') ?: null,
                ':s' => ($a['deslocamento']['setor'] ?? '') ?: null]);
        }

        // prazos (Radar): extrai datas-limite do texto (mesma lógica do frontend)
        $delPrazo->execute([':id' => $atoId]);
        $ementaP = (string)($a['ementa'] ?? '');
        $textoP = $ementaP . ' . ' . mb_substr($texto, 0, 12000, 'UTF-8');
        $dataP = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($a['dataAssinatura'] ?? '')) ? $a['dataAssinatura'] : null;

        // 1) Prazos genéricos (padrão)
        foreach (extrair_prazos($textoP, $dataP) as $pz) {
            $insPrazo->execute([
                ':id' => $atoId, ':tp' => mb_substr($pz['tipo'], 0, 30, 'UTF-8'),
                ':dl' => $pz['dataLimite'], ':cf' => $pz['conf'], ':bs' => $pz['base'],
                ':pb' => mb_substr(inferir_publico($ementaP, $pz['ctx']), 0, 60, 'UTF-8'),
                ':tr' => mb_substr($pz['origem'], 0, 255, 'UTF-8'),
            ]);
        }

        // 2) Prazos PAD/SINVE (alta confiança, estruturados por lei). `publico` é
        //    determinístico (vem do extrator), garantindo que o import diário e o
        //    backfill (backfill_prazos_pad_sinve.php) gerem linhas idênticas.
        foreach (extrair_prazos_pad_sinve($ementaP, $texto, $dataP) as $pz) {
            $insPrazo->execute([
                ':id' => $atoId, ':tp' => mb_substr($pz['tipo'], 0, 30, 'UTF-8'),
                ':dl' => $pz['dataLimite'], ':cf' => $pz['conf'], ':bs' => $pz['base'],
                ':pb' => mb_substr($pz['publico'], 0, 60, 'UTF-8'),
                ':tr' => mb_substr($pz['origem'], 0, 255, 'UTF-8'),
            ]);
        }
    }

    $pdo->commit();
    $n = $pdo->query("SELECT COUNT(*) FROM ato")->fetchColumn();
    log_("OK. novos=$novos | atualizados-c-mudanca=$atualizados | Banco agora com $n atos.");

    // 2) Resolve TODAS as relacoes e recalcula vigencia (autoridade unica).
    require_once __DIR__ . '/resolver_relacoes_v2.php';
    resolver_cross_ano_v2($pdo);
} catch (Throwable $e) {
    $pdo->rollBack();
    exit("ERRO na importação: " . $e->getMessage() . " (linha " . $e->getLine() . ")\n");
}

// ---------------------------------------------------------------------------
function ler_origem(string $origem): string {
    if ($origem === '') exit("ERRO: origem dos dados não definida.\n");
    if (preg_match('#^https?://#', $origem)) {
        $ch = curl_init($origem);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120,
            CURLOPT_FOLLOWLOCATION => true, CURLOPT_USERAGENT => 'UFF-Importador-v2/1.0']);
        $r = curl_exec($ch);
        if ($r === false) exit("ERRO ao baixar: " . curl_error($ch) . "\n");
        curl_close($ch);
        return $r;
    }
    $r = @file_get_contents($origem);
    if ($r === false) exit("ERRO: não consegui ler $origem\n");
    return $r;
}
