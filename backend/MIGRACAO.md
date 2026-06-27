# Migração para outro servidor

O sistema foi desenhado para **não depender da HostGator**. Mudar de hospedagem
exige apenas recriar o banco, copiar os arquivos e ajustar **um** arquivo de
configuração. Nada de código muda.

## Requisitos do novo servidor
- **MySQL 5.7+** ou **MariaDB 10.2+** (InnoDB com FULLTEXT).
- **PHP 7.4+ ou 8.x** com extensões **PDO/pdo_mysql** e **curl**.
- Apache/Nginx servindo a pasta do site; PHP-CLI disponível para o cron.

## Passos

1. **Banco**
   - Crie um banco vazio (qualquer nome) e um usuário com permissão nele.
   - Importe `db/schema.sql` (phpMyAdmin ou `mysql < db/schema.sql`).
   - *(Opcional)* migrar os dados existentes: exporte o banco antigo
     (`mysqldump`) e importe no novo — ou simplesmente **rode o importador**,
     que repopula tudo a partir do JSON no GitHub.

2. **Arquivos**
   - Copie as pastas `api/` e `importar/` para o novo servidor.
   - Copie `config.example.php` → `config.php` e ajuste:
     - `db.host` (no mesmo servidor do banco: `localhost`),
     - `db.nome`, `db.usuario`, `db.senha`,
     - `fonte_json` (mantém o GitHub, salvo se você mudar a origem),
     - `cors_origin` (domínio do novo site, ou `*`).

3. **Rotas / reescrita**
   - Apache: o `.htaccess` em `api/` já cuida das rotas. Garanta `mod_rewrite`
     habilitado. Se não houver reescrita, a API funciona via `?r=` (ex.:
     `/api/?r=atos`).
   - Nginx: aponte `/api/` para `index.php` com `PATH_INFO`, **ou** use só `?r=`.

4. **Front-end**
   - No site (React), há **um** ponto de configuração: a constante
     `API_BASE` (URL da API). Aponte para o novo domínio, rebuild e publique.
     *(enquanto a Fase 3 do front-end não estiver concluída, o site usa o JSON
     do GitHub — então ele continua funcionando mesmo sem a API)*

5. **Automação**
   - Recrie o **cron** chamando `php .../importar/importar.php` 1×/dia.
   - A extração na nuvem (GitHub Actions) é independente do servidor — segue
     publicando o JSON. Só o destino do importador muda.

## O que NÃO precisa mudar
- O esquema do banco, a API e o importador são genéricos (LAMP padrão).
- A extração dos PDFs (Python/GitHub Actions) não conhece o servidor.
- Os dados podem ser repovoados a qualquer momento a partir do JSON público.

## Plano B (sem banco)
Se um servidor não tiver MySQL, o portal ainda funciona no modo **estático**
(lendo o `portal-data.json` do GitHub). Basta publicar a pasta do site. A API/
banco são uma camada de performance/escala — não um ponto único de falha.
