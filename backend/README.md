# Backend (MySQL + PHP) — instalação

API somente-leitura + importador para o Portal de Normas e Atos da UFF.
Arquitetura e decisões: ver [ARQUITETURA.md](ARQUITETURA.md).
Trocar de servidor: ver [MIGRACAO.md](MIGRACAO.md).

```
backend/
  db/schema.sql            # cria todas as tabelas
  api/
    config.example.php     # modelo de config (copie p/ config.php no servidor)
    db.php                 # conexão PDO + utilitários
    index.php             # a API (rotas: atos, ato, stats, filtros)
    .htaccess             # rotas amigáveis + protege config.php
  importar/importar.php    # carrega o JSON no MySQL (idempotente)
```

## Instalação na HostGator (cPanel) — uma vez

1. **Criar as tabelas**
   - cPanel → **phpMyAdmin** → selecione o banco `fanara87_uffnormas`
   - aba **SQL** → cole o conteúdo de `db/schema.sql` → **Executar**.

2. **Subir os arquivos**
   - Suba a pasta `api/` para `.../uff.fanara.com.br/api/`
   - Suba `importar/importar.php` para um local protegido (ex.: `.../uff.fanara.com.br/api-importar/`).

3. **Configurar credenciais (sem expor no Git)**
   - Em `api/`, copie `config.example.php` para **`config.php`**.
   - Preencha usuário/senha do banco. *(o `.htaccess` já bloqueia o acesso web a ele)*
   - O importador usa o mesmo `config.php` (caminho relativo `../api/config.php`).

4. **Carga inicial dos dados** — escolha UM caminho:

   **(A) Importar o SQL pronto pelo phpMyAdmin (mais simples, sem PHP):**
   - Gere o arquivo: `python backend/db/gerar_sql.py` (cria `backend/db/carga_inicial.sql.gz`).
   - phpMyAdmin → selecione o banco → aba **Importar** → escolha o **`carga_inicial.sql.gz`** → Executar.
   - O arquivo é idempotente (limpa e recarrega) — pode reimportar quando quiser.

   **(B) Rodar o importador PHP (puxa o JSON do GitHub):**
   - Via SSH/cron CLI: `php api-importar/importar.php`
   - Ou no navegador (defina `import_token` no config): `…/api-importar/?token=SEU_SEGREDO`
   - Deve terminar com “OK. Banco agora com N atos.”

   > Use **(A)** para a carga inicial agora, e **(B)** no cron diário para manter atualizado.

5. **Atualização automática diária** (cron do cPanel)
   - cPanel → **Cron Jobs** → adicionar, ex. todo dia às 20h:
     ```
     /usr/local/bin/php /home/SEU_USUARIO/public_html/uff.fanara.com.br/api-importar/importar.php >/dev/null 2>&1
     ```
   - Assim: a extração na nuvem publica o JSON → o cron importa para o MySQL.

## Testar a API
- `https://uff.fanara.com.br/api/stats` → deve responder os totais em JSON.
- `https://uff.fanara.com.br/api/atos?por_pagina=5` → 5 atos.
- `https://uff.fanara.com.br/api/atos?nome=rita` → atos que citam “rita”.
- `https://uff.fanara.com.br/api/atos?siape=1642620` → atos da matrícula.
- Sem rotas amigáveis, use `…/api/?r=stats`, `…/api/?r=atos&...`.

## Segurança
- `config.php` (senha) **nunca** vai para o Git e é bloqueado pelo `.htaccess`.
- API é só leitura, com PDO *prepared statements*.
- **Troque a senha do banco** no cPanel (a que foi compartilhada no chat).
