<?php
// ============================================================================
//  Importador: lê o JSON publicado pela extração e carrega no MySQL.
//  Idempotente (UPSERT por chave estável) — pode rodar todo dia sem duplicar.
//
//  Uso (CLI, recomendado para o cron da HostGator):
//      php importar.php
//      php importar.php /caminho/para/portal-data.json    (arquivo local)
//
//  Uso (web, opcional): https://uff.fanara.com.br/api-importar/?token=SEGREDO
//      (defina 'import_token' no config.php)
// ============================================================================

$raiz = dirname(__DIR__);
require $raiz . '/api/db.php';
$cfg = carregar_config();

$cli = (PHP_SAPI === 'cli');
if (!$cli) {
    header('Content-Type: text/plain; charset=utf-8');
    $token = $cfg['import_token'] ?? '';
    if ($token === '' || ($_GET['token'] ?? '') !== $token) {
        http_response_code(403);
        exit("Acesso negado. Configure 'import_token' e use ?token=...\n");
    }
}
function log_($m) { echo $m . "\n"; @flush(); }

$pdo = conectar($cfg);

// Garante a coluna 'nome' em ato_siapes (idempotente; bases antigas não a têm).
if (!$pdo->query("SHOW COLUMNS FROM ato_siapes LIKE 'nome'")->fetch()) {
    $pdo->exec("ALTER TABLE ato_siapes ADD COLUMN nome VARCHAR(120) NULL AFTER siape");
}
// Garante a coluna 'ementa_inferida' em atos (1 = ementa é resumo automático).
if (!$pdo->query("SHOW COLUMNS FROM atos LIKE 'ementa_inferida'")->fetch()) {
    $pdo->exec("ALTER TABLE atos ADD COLUMN ementa_inferida TINYINT(1) NOT NULL DEFAULT 0 AFTER ementa");
}
// Garante as colunas de aposentadoria em atos (classificação pelo dispositivo).
if (!$pdo->query("SHOW COLUMNS FROM atos LIKE 'aposentadoria_tipo'")->fetch()) {
    $pdo->exec("ALTER TABLE atos ADD COLUMN aposentadoria_tipo VARCHAR(20) NULL AFTER pagina,
                ADD COLUMN aposentadoria_base_legal VARCHAR(60) NULL AFTER aposentadoria_tipo");
}
// Garante a tabela de chefias (mesma DDL do gerar_sql.py; bases antigas não a têm).
$pdo->exec("CREATE TABLE IF NOT EXISTS ato_funcoes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ato_id VARCHAR(191) NOT NULL,
    acao ENUM('designar','dispensar') NOT NULL,
    cargo VARCHAR(40) NOT NULL,
    unidade VARCHAR(180) NOT NULL,
    unidade_chave VARCHAR(180) NOT NULL,
    siape VARCHAR(10) NULL, nome VARCHAR(120) NULL,
    PRIMARY KEY (id), KEY ix_chave (unidade_chave, cargo), KEY ix_ato (ato_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// 1) Carrega o JSON (arquivo local no CLI, senão a URL configurada)
$origem = ($cli && isset($argv[1])) ? $argv[1] : ($cfg['fonte_json'] ?? '');
log_("Lendo dados de: $origem");
$bruto = ler_origem($origem);
$dados = json_decode($bruto, true);
if (!is_array($dados)) { exit("ERRO: JSON inválido.\n"); }
log_(count($dados) . " atos recebidos. Importando...");

$pdo->beginTransaction();
try {
    // cache de boletins (arquivo -> id) para não consultar a cada ato
    $boletins = [];
    $upAto = $pdo->prepare(
        "INSERT INTO atos (id,boletim_id,tipo,sigla,numero,ano,data_ato,identificador,
            tipo_acao,ementa,ementa_inferida,conteudo_resumido,signatario,status,processo_sei,sei_documento,
            link_sei_processo,link_sei_documento,link_boletim,secao,pagina,aposentadoria_tipo,aposentadoria_base_legal)
         VALUES (:id,:bol,:tipo,:sigla,:numero,:ano,:data,:ident,:acao,:ementa,:einf,:resumo,:sign,
            :status,:proc,:seidoc,:lproc,:ldoc,:lbol,:secao,:pagina,:apostipo,:aposbase)
         ON DUPLICATE KEY UPDATE boletim_id=VALUES(boletim_id),tipo=VALUES(tipo),sigla=VALUES(sigla),
            numero=VALUES(numero),ano=VALUES(ano),data_ato=VALUES(data_ato),identificador=VALUES(identificador),
            tipo_acao=VALUES(tipo_acao),ementa=VALUES(ementa),ementa_inferida=VALUES(ementa_inferida),
            conteudo_resumido=VALUES(conteudo_resumido),
            signatario=VALUES(signatario),status=VALUES(status),processo_sei=VALUES(processo_sei),
            sei_documento=VALUES(sei_documento),link_sei_processo=VALUES(link_sei_processo),
            link_sei_documento=VALUES(link_sei_documento),link_boletim=VALUES(link_boletim),
            secao=VALUES(secao),pagina=VALUES(pagina),aposentadoria_tipo=VALUES(aposentadoria_tipo),
            aposentadoria_base_legal=VALUES(aposentadoria_base_legal)");
    $upCorpo = $pdo->prepare("INSERT INTO ato_corpo (ato_id,texto) VALUES (:id,:t)
                              ON DUPLICATE KEY UPDATE texto=VALUES(texto)");
    $delSiape = $pdo->prepare("DELETE FROM ato_siapes WHERE ato_id=:id");
    $insSiape = $pdo->prepare("INSERT IGNORE INTO ato_siapes (ato_id,siape,nome) VALUES (:id,:s,:n)");
    $delTag = $pdo->prepare("DELETE FROM ato_tags WHERE ato_id=:id");
    $insTag = $pdo->prepare("INSERT INTO ato_tags (ato_id,tag) VALUES (:id,:t)");
    $delRel = $pdo->prepare("DELETE FROM ato_relacoes WHERE ato_id=:id");
    $insRel = $pdo->prepare("INSERT INTO ato_relacoes (ato_id,tipo_relacao,ato_destino_texto,detalhes)
                             VALUES (:id,:tr,:dest,:det)");
    $delFunc = $pdo->prepare("DELETE FROM ato_funcoes WHERE ato_id=:id");
    $insFunc = $pdo->prepare("INSERT INTO ato_funcoes (ato_id,acao,cargo,unidade,unidade_chave,siape,nome)
                              VALUES (:id,:ac,:ca,:un,:uk,:si,:no)");

    foreach ($dados as $a) {
        $bid = boletim_id($pdo, $boletins, $a);
        $upAto->execute([
            ':id' => $a['id'], ':bol' => $bid, ':tipo' => $a['tipoAto'] ?? '', ':sigla' => $a['sigla'] ?? ($a['orgaoEmissor'] ?? ''),
            ':numero' => $a['numero'] ?? '', ':ano' => intval($a['ano'] ?? 0) ?: null,
            ':data' => valida_data($a['dataAssinatura'] ?? ''), ':ident' => $a['identificador'] ?? null,
            ':acao' => $a['tipoAcao'] ?? null, ':ementa' => $a['ementa'] ?? '',
            ':einf' => !empty($a['ementaInferida']) ? 1 : 0, ':resumo' => $a['conteudoResumido'] ?? '',
            ':sign' => $a['signatario'] ?? null, ':status' => in_array($a['status'] ?? '', ['Ativo','Alterado','Revogado']) ? $a['status'] : 'Ativo',
            ':proc' => $a['processoSei'] ?? null, ':seidoc' => $a['seiDocumento'] ?? null,
            ':lproc' => $a['linkSeiProcesso'] ?? null, ':ldoc' => $a['linkSeiDocumento'] ?? null,
            ':lbol' => $a['linkBoletim'] ?? null, ':secao' => $a['secao'] ?? null, ':pagina' => $a['pagina'] ?? null,
            ':apostipo' => $a['aposentadoria']['tipo'] ?? null,
            ':aposbase' => $a['aposentadoria']['baseLegal'] ?? null,
        ]);
        $upCorpo->execute([':id' => $a['id'], ':t' => $a['textoBusca'] ?? '']);
        $delSiape->execute([':id' => $a['id']]);
        $nomeDe = [];                       // siape -> nome (quando a extração achou)
        foreach (($a['pessoas'] ?? []) as $pz) {
            $sp = $pz['siape'] ?? '';
            if ($sp !== '') $nomeDe[$sp] = ($pz['nome'] ?? '') ?: null;
        }
        $todosSiapes = array_unique(array_merge($a['siapes'] ?? [], array_keys($nomeDe)));
        foreach ($todosSiapes as $s) {
            $insSiape->execute([':id' => $a['id'], ':s' => $s, ':n' => $nomeDe[$s] ?? null]);
        }
        $delTag->execute([':id' => $a['id']]);
        foreach (($a['tags'] ?? []) as $t) $insTag->execute([':id' => $a['id'], ':t' => $t]);
        $delRel->execute([':id' => $a['id']]);
        foreach (($a['relacoes'] ?? []) as $r) {
            $insRel->execute([':id' => $a['id'], ':tr' => $r['tipoRelacao'] ?? '',
                ':dest' => $r['atoDestino'] ?? '', ':det' => $r['detalhes'] ?? null]);
        }
        // Chefias: eventos de designação/dispensa do dispositivo (aba Chefias).
        $delFunc->execute([':id' => $a['id']]);
        foreach (($a['funcoes'] ?? []) as $fz) {
            $acao = ($fz['acao'] ?? '') === 'dispensar' ? 'dispensar' : 'designar';
            $insFunc->execute([':id' => $a['id'], ':ac' => $acao,
                ':ca' => $fz['cargo'] ?? '', ':un' => $fz['unidade'] ?? '',
                ':uk' => $fz['unidade_chave'] ?? '', ':si' => $fz['siape'] ?? null,
                ':no' => $fz['nome'] ?? null]);
        }
    }

    $pdo->commit();
    $n = $pdo->query("SELECT COUNT(*) FROM atos")->fetchColumn();
    log_("OK. Banco agora com $n atos.");

    // 2) Resolve TODAS as relações (intra e cross-ano) e recalcula a vigência.
    //    O resolver é a autoridade única: zera e reprocessa os destinos com
    //    desambiguação segura, marca citações a órgãos externos e deriva o
    //    status (Ativo/Alterado/Revogado) das relações resolvidas.
    require_once __DIR__ . '/resolver_relacoes.php';
    resolver_cross_ano($pdo);
} catch (Throwable $e) {
    $pdo->rollBack();
    exit("ERRO na importação: " . $e->getMessage() . "\n");
}

// ---------------------------------------------------------------------------
function ler_origem(string $origem): string {
    if ($origem === '') exit("ERRO: origem dos dados não definida.\n");
    if (preg_match('#^https?://#', $origem)) {
        $ch = curl_init($origem);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120,
            CURLOPT_FOLLOWLOCATION => true, CURLOPT_USERAGENT => 'UFF-Importador/1.0']);
        $r = curl_exec($ch);
        if ($r === false) exit("ERRO ao baixar: " . curl_error($ch) . "\n");
        curl_close($ch);
        return $r;
    }
    $r = @file_get_contents($origem);
    if ($r === false) exit("ERRO: não consegui ler $origem\n");
    return $r;
}
function valida_data($s) { return preg_match('/^\d{4}-\d{2}-\d{2}$/', $s ?? '') ? $s : null; }
function boletim_id(PDO $pdo, array &$cache, array $a) {
    $arq = $a['arquivo'] ?? '';
    if ($arq === '') return null;
    if (isset($cache[$arq])) return $cache[$arq];
    $bnum = $a['boletimNumero'] ?? '';
    preg_match('/(\d+)/', $bnum, $m);
    $pdo->prepare("INSERT INTO boletins (arquivo,numero,ano,url_pdf) VALUES (:a,:n,:y,:u)
                   ON DUPLICATE KEY UPDATE numero=VALUES(numero),ano=VALUES(ano),url_pdf=VALUES(url_pdf)")
        ->execute([':a' => $arq, ':n' => $m[1] ?? null, ':y' => intval($a['ano'] ?? 0) ?: null,
                   ':u' => $a['linkBoletim'] ?? null]);
    $id = (int)$pdo->query("SELECT id FROM boletins WHERE arquivo=" . $pdo->quote($arq))->fetchColumn();
    return $cache[$arq] = $id;
}
