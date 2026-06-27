<?php
// Conexão PDO + utilitários compartilhados pela API e pelo importador.

function carregar_config(): array {
    $cfg = __DIR__ . '/config.php';
    if (!file_exists($cfg)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['erro' => 'config.php ausente. Copie config.example.php '
            . 'para config.php e preencha as credenciais.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    return require $cfg;
}

function conectar(array $cfg): PDO {
    $d = $cfg['db'];
    $dsn = "mysql:host={$d['host']};dbname={$d['nome']};charset={$d['charset']}";
    return new PDO($dsn, $d['usuario'], $d['senha'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // emulação LIGADA: permite reutilizar um mesmo parâmetro nomeado várias
        // vezes na mesma consulta (ex.: :qlike na busca). Continua seguro —
        // o PDO faz o escaping dos valores.
        PDO::ATTR_EMULATE_PREPARES   => true,
    ]);
}

function responder_json($dados, int $status = 200): void {
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
