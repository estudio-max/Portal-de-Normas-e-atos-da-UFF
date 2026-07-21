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

    // CORS: origem autorizada a consumir a API pelo navegador. Em PRODUÇÃO,
    // use a origem do próprio portal (front e API são same-origin, então nada
    // quebra) — '*' fica só para desenvolvimento local com o mock:
    //   'cors_origin' => 'https://inteligencia.fanara.com.br',
    'cors_origin' => '*',

    // Segredo exigido em ?token=... pelos endpoints de importação/correção
    // (importar/importar_v2.php, importar/resolver_relacoes_v2.php,
    //  importar/corrigir_siapes.php).
    // Gere um valor forte (ex.: `openssl rand -base64 32` ou um gerenciador de senhas)
    // e preencha só no servidor — nunca reaproveite o exemplo abaixo.
    'import_token' => 'SEU_TOKEN_FORTE_AQUI',

    // SEM USO desde 18/07/2026 — a rota /api/dossie (aba "Meu SIAPE") foi
    // aberta por decisão do mantenedor (justificativa LGPD na aba Privacidade;
    // ver CLAUDE.md). A chave fica aqui só para não quebrar config.php antigo
    // que ainda a tenha; pode remover.
    'dossie_token' => '',
];
