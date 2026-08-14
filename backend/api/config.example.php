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

    // Origem dos dados para o importador (JSON publicado pela extração).
    //
    // Aponta para o repositório de DADOS — separado do repositório de código,
    // e PÚBLICO de propósito. Desde 14/08/2026 o pipeline espelha o índice lá
    // a cada publicação. Assim o repositório de código pode ser fechado sem
    // derrubar este import (foi o que aconteceu em 13/08: dois dias parado).
    //
    // Se você mudar isto de volta para o repositório de código, volta junto a
    // dependência de `github_token` abaixo.
    'fonte_json' => 'https://raw.githubusercontent.com/estudio-max/'
                  . 'Portal-de-Normas-e-atos-da-UFF-dados/main/portal-data.json',

    // Token do GitHub para o cron ler `fonte_json`. DEIXE VAZIO — desde
    // 14/08/2026 o `fonte_json` acima aponta para o repositório de DADOS, que
    // é público por desenho, então não há o que autenticar.
    //
    // Só volta a ser necessário se alguém apontar o `fonte_json` de volta para
    // um repositório privado. Nesse caso, preencha ANTES de fechar o repo:
    // `raw.githubusercontent.com` não responde a requisição anônima para repo
    // privado (dá 404, não 403 — não revela nem que o repo existe), e o import
    // diário passa a FALHAR EM SILÊNCIO. Foi o que aconteceu em 13/08/2026:
    // dois dias sem atualização até alguém estranhar.
    //
    // Gere um "fine-grained personal access token" (github.com → Settings →
    // Developer settings → Fine-grained tokens):
    //   - Repository access: SÓ este repositório (não "All repositories")
    //   - Permissions: Contents = Read-only (nada além disso)
    //   - Expiration: defina um prazo e agende renovar — token expirado é o
    //     mesmo defeito silencioso, só que mais tarde
    // Nunca use aqui um token de escopo amplo (o do `gh` da sua máquina,
    // por exemplo) — se este arquivo vazar, o estrago fica limitado ao
    // necessário.
    'github_token' => '',

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
