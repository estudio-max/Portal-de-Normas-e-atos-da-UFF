<?php
// ============================================================================
//  consulta_cli.php — roda SQL de VERIFICAÇÃO em produção sem expor a senha
//  em lugar nenhum: nem no comando, nem em log, nem na saída deste script.
//
//  Uso (só CLI, por SSH):
//    php ~/inteligencia.fanara.com.br/importar/consulta_cli.php "SELECT ..."
//
//  Existe porque phpMyAdmin tem duas armadilhas documentadas no CLAUDE.md: a
//  aba Importar DESCARTA o resultado de SELECT (só mostra "N consultas
//  executadas"), e uma referência a information_schema no meio de um arquivo
//  troca o banco corrente das consultas SEGUINTES do mesmo arquivo. As duas
//  desaparecem rodando a mesma consulta por aqui.
//
//  ⚠️ SÓ LEITURA, DE PROPÓSITO. Isto é ferramenta de VERIFICAÇÃO, não de
//  escrita — os scripts de import/backfill já cobrem escrita, com o token
//  e o `&recomecar=1` que essa tarefa pede. Permitir escrita aqui abriria um
//  segundo caminho para a mesma coisa, sem o cuidado que os outros têm
//  (idempotência, invalidação de cache, log de quantas linhas mudaram).
//
//  ⚠️ NUNCA reachable por HTTP, em circunstância nenhuma — nem com token. A
//  guarda abaixo é a primeira linha executável do arquivo, sem exceção.
// ============================================================================

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('CLI only.');
}

if ($argc < 2 || trim($argv[1]) === '') {
    fwrite(STDERR, "uso: php consulta_cli.php \"SELECT ...\"\n");
    exit(1);
}

$sql = trim($argv[1]);

// Só os quatro verbos de leitura. Sem isso vira um segundo caminho de escrita
// sem os cuidados dos scripts de import (idempotência, invalidação de cache).
if (!preg_match('/^(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i', $sql)) {
    fwrite(STDERR, "Recusado: só SELECT/SHOW/DESCRIBE/EXPLAIN. "
        . "Para escrever, use os scripts de import/backfill com token.\n");
    exit(1);
}

$raiz = dirname(__DIR__);
require $raiz . '/api/db.php';

try {
    $cfg = carregar_config();
    $pdo = conectar($cfg);
    $st = $pdo->query($sql);
} catch (Throwable $e) {
    // A mensagem do PDO pode ecoar parte da consulta, nunca a senha (ela não
    // passa pelo PDOException — vive só em $cfg['db']['senha'], local).
    fwrite(STDERR, 'Erro: ' . $e->getMessage() . "\n");
    exit(1);
}

if ($st === false) {
    echo "OK (sem resultado tabular)\n";
    exit(0);
}

$linhas = $st->fetchAll(PDO::FETCH_ASSOC);
if (!$linhas) {
    echo "(0 linhas)\n";
    exit(0);
}

// Tabela de texto simples, sem dependência de biblioteca — é saída de
// terminal, não JSON de API.
echo implode("\t", array_keys($linhas[0])) . "\n";
foreach ($linhas as $linha) {
    echo implode("\t", array_map(static fn($v) => $v ?? 'NULL', $linha)) . "\n";
}
