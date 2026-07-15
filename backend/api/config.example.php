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

    // Segredo exigido em ?token=... pelos endpoints de importação/correção
    // (api-importar/, importar/corrigir_siapes.php, importar/resolver_relacoes.php).
    // Gere um valor forte (ex.: `openssl rand -base64 32` ou um gerenciador de senhas)
    // e preencha só no servidor — nunca reaproveite o exemplo abaixo.
    'import_token' => 'SEU_TOKEN_FORTE_AQUI',

    // Senha da aba "Dossiê do servidor" (rota /api/dossie), entregue à Gestão de
    // Pessoal. É a ÚNICA rota que reúne a vida funcional de uma pessoa num lugar
    // só — por isso é a única fechada.
    //
    // Enquanto esta linha não for preenchida no servidor, a rota responde 401 e
    // a aba não abre. É de propósito: um deploy pela metade tem que falhar
    // fechado, não virar dossiê aberto na internet.
    //
    // Use um valor forte e trate como senha de verdade: quem tiver isto lê o
    // histórico de qualquer servidor. Trocar aqui invalida a senha de todo mundo
    // na hora (é o jeito de revogar).
    'dossie_token' => '',
];
