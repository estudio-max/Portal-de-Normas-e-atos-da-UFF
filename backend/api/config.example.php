<?php
// ============================================================================
//  MODELO de configuração. NO SERVIDOR, copie este arquivo para `config.php`
//  e preencha com as credenciais reais. O `config.php` NÃO vai para o Git
//  (está no .gitignore) — é onde mora a senha do banco.
// ============================================================================

return [
    // Banco de dados (na HostGator, host é sempre 'localhost')
    'db' => [
        'host'    => 'localhost',
        'nome'    => 'fanara87_uffnormas',     // nome do banco
        'usuario' => 'SEU_USUARIO_DO_BANCO',   // ex.: fanara87_xxxx
        'senha'   => 'SUA_SENHA_DO_BANCO',      // <-- preencher só no servidor
        'charset' => 'utf8mb4',
    ],

    // Origem dos dados para o importador (JSON publicado pela extração)
    'fonte_json' => 'https://raw.githubusercontent.com/estudio-max/'
                  . 'Portal-de-Normas-e-atos-da-UFF/main/public/portal-data.json',

    // CORS: domínios autorizados a consumir a API ('*' = qualquer; uso interno)
    'cors_origin' => '*',
];
