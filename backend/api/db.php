<?php
// Conexão PDO + utilitários compartilhados pela API e pelo importador.

// ---- Compatibilidade PHP 7.4 ----------------------------------------------
// str_starts_with / str_contains / str_ends_with nasceram no PHP 8.0, e o
// index_v2.php as usa (roteamento + classificação de atos). O piso real do
// código é o 7.4 (usa arrow functions `fn()`), então garantimos que rode em
// 7.4→8.x. Todos os scripts do backend requerem este db.php, então definir
// aqui cobre a API e a esteira de importação. Em PHP 8+, o function_exists
// pula tudo — zero efeito. Motivo: a migração p/ servidores da UFF pode cair
// num PHP 7.x e, sem isto, a API quebra inteira (tela branca). Ver docs/MIGRACAO-UFF.md.
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $h, string $n): bool {
        return $n === '' || strncmp($h, $n, strlen($n)) === 0;
    }
}
if (!function_exists('str_contains')) {
    function str_contains(string $h, string $n): bool {
        return $n === '' || strpos($h, $n) !== false;
    }
}
if (!function_exists('str_ends_with')) {
    function str_ends_with(string $h, string $n): bool {
        return $n === '' || ($len = strlen($n)) === 0 || substr($h, -$len) === $n;
    }
}

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
