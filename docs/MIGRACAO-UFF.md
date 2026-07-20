# Runbook — migração do Portal para os servidores da UFF

Passo a passo para trocar de host (HostGator → UFF) e de domínio sem quebrar o
portal. Escrito para **este** projeto, não genérico. Enquanto a migração não
acontece, este arquivo é a única parte do repo que fala do futuro — quando o
corte terminar, o que virou presente vai para o `CLAUDE.md` e o resto sai daqui.

> **Rede de segurança que já existe:** se a API nova não responder, o front cai
> sozinho para o **modo estático** (lê `portal-data.json` do GitHub) — o site
> não fica em branco durante o corte. E o **frontend não tem URL fixa** (usa
> `/api` relativo), então trocar de domínio **não exige rebuild**. Os dois
> maiores riscos de migração já estão neutralizados.

---

## 0. O que levantar com a TI da UFF (antes de marcar o dia)

Sem estas respostas o plano não fecha:

- [ ] **PHP**: qual versão? (o código roda em **7.4+**; o polyfill em `api/db.php`
      cobre o que era exclusivo do 8.0). Extensões: **pdo_mysql** e **mbstring**
      ligadas?
- [ ] **MySQL/MariaDB**: versão e, crucial, o **`innodb_ft_min_token_size`**
      (default 3). Se for maior que o do HostGator, siglas curtas somem da busca.
- [ ] **Servidor web**: **Apache** (usa os `.htaccess` que já temos) ou
      **nginx** (precisa do bloco da seção 5)?
- [ ] **Acesso**: tem **SSH/shell**? (muda deploy e cron — hoje é tudo manual)
- [ ] Como se **sobe arquivo** e como se **roda SQL** (phpMyAdmin? Adminer? CLI?).
- [ ] Quem faz **backup** e com que frequência.
- [ ] O **repositório** GitHub continua em `estudio-max` ou vai para uma org da
      UFF? (afeta o fallback estático e a Action de indexação — seção 7).
- [ ] Qual será a **URL nova** e quem controla o **DNS**.

**Privacidade e perímetro (infactíveis na HostGator, obrigatórios na UFF):**

- [ ] **Validação LGPD institucional do Meu SIAPE.** A rota `/api/dossie` é
      pública por decisão documentada do mantenedor (justificativa na aba
      Privacidade). Num domínio `.uff.br` essa decisão deixa de ser só do
      projeto: submeter ao **encarregado de dados (DPO) da UFF** antes do
      cutover, com a documentação já escrita.
- [ ] **Rate limiting / anti-enumeração** no perímetro (WAF/proxy institucional
      da STI). Sem SSH na HostGator não há como fazer isso de verdade; na UFF é
      pedir a regra pronta — alvo: limitar rajadas em `/api/dossie` sem afetar
      navegação normal.
- [ ] **Logs de acesso**: definir retenção e mascaramento de query string (o
      SIAPE viaja em `?siape=` — o access log do servidor o grava; decidir
      retenção curta ou mascarar o parâmetro no log).
- [ ] A API já envia `Cache-Control: no-store` + `Referrer-Policy: no-referrer`
      no dossiê (lado aplicação, feito em 20/07/2026); o que falta é só o
      perímetro acima.

---

## 1. Inventário — o que move e o que não move

**Move (precisa de ação):**

| Item | Onde está hoje | O que fazer |
|---|---|---|
| Banco `fanara87_governanca` | MySQL HostGator | dump → importar no MySQL da UFF (seção 3) |
| `config.php` | só no servidor (fora do Git) | recriar com credenciais novas (seção 4) |
| `api/` (a API PHP) | raiz do site | subir `index_v2.php` como `api/index.php` |
| `dist/` (o frontend) | raiz do site | subir o conteúdo do build |
| `.htaccess` (2×) | raiz e `api/` | Apache: subir igual. nginx: converter (seção 5) |
| Cron de atualização do banco | cPanel | reconfigurar no ambiente novo (seção 6) |
| DNS + redirect do domínio antigo | HostGator/registrador | seção 8 |

**NÃO move (continua igual):**

- A **Action de indexação** (`.github/workflows/indexar.yml`) roda no GitHub,
  baixa do site de boletins da UFF e gera o `portal-data.json`. Independe do host.
- Os **links externos** do portal (boletimdeservico.uff.br, sei.uff.br).
- O **frontend** não muda de código pela troca de URL (`API_BASE = /api`).

---

## 2. Ensaio (fazer ANTES do dia do corte)

O objetivo é pegar problema de **FULLTEXT** e **collation** com calma, não na hora.

1. Peça (ou gere) um **dump** do `fanara87_governanca`.
2. Importe num **banco limpo** de teste (pode ser o próprio MySQL da UFF, num
   schema temporário, ou um MySQL local).
3. Rode [`backend/db/verificar_migracao.sql`](../backend/db/verificar_migracao.sql)
   **no banco atual** (anote os números) e **no banco de teste** (compare).
   Os pontos que mais pegam:
   - **Bloco 5**: `MATCH … AGAINST` tem que devolver > 0. Se der 0 num banco com
     linhas, o índice FULLTEXT veio vazio → reconstrua (o próprio SQL diz como).
   - **Bloco 2**: qualquer coluna fora de `utf8mb4` = acento vai quebrar.
   - **Bloco 6**: `innodb_ft_min_token_size` igual ao de origem.
4. Suba o `api/` de teste apontando pro banco de teste e bata os endpoints da
   seção 9. Se todos responderem, o dia do corte é só repetir com o DNS.

> Dica: importe com `mysql --default-character-set=utf8mb4`. Se for phpMyAdmin,
> confirme "utf8mb4" no seletor de charset da importação — importar como latin1
> é o erro clássico que transforma "ção" em "Ã§Ã£o".

---

## 3. Migrar o banco

```bash
# origem (se tiver shell no HostGator; senão, exporte pelo phpMyAdmin)
mysqldump --single-transaction --default-character-set=utf8mb4 \
  -u USUARIO -p fanara87_governanca > governanca.sql

# destino (UFF)
mysql --default-character-set=utf8mb4 -u NOVO_USUARIO -p NOVO_BANCO < governanca.sql
```

Sem shell: exporte pelo phpMyAdmin (formato SQL, charset utf8mb4) e importe pelo
phpMyAdmin do destino. O dump já traz `ENGINE=InnoDB` e os `FULLTEXT` — mas
**confirme com o bloco 4/5 do script de verificação** que os índices vieram e
respondem.

---

## 4. Recriar o `config.php`

No servidor novo, copie `api/config.example.php` para `api/config.php` e preencha:

- `db.host` — **pode não ser mais `localhost`** (a UFF pode ter o MySQL em outro
  host; pergunte).
- `db.nome`, `db.usuario`, `db.senha` — as credenciais novas.
- `db.charset` — mantenha `utf8mb4`.
- `import_token` — **gere um novo** (`openssl rand -base64 32`). Nunca reaproveite.
- `cors_origin` — pode deixar `*` (API só-leitura, mesma origem) ou travar na
  URL nova.

O `config.php` **não vai para o Git** e o `.htaccess` do `api/` já bloqueia o
acesso a ele por HTTP. Confirme que continua bloqueado no servidor novo (seção 9).

---

## 5. Roteamento `/api/*`

O frontend chama `/api/atos`, `/api/atos/{id}`, `/api/jornada` etc. — depende do
roteamento que joga esses caminhos no `index.php` como `PATH_INFO`.

**Apache** (o que já usamos): suba o [`api/.htaccess`](../backend/api/.htaccess)
igual. Precisa de `mod_rewrite` ligado. Nada a fazer além de subir o arquivo.

**nginx** (se for o caso na UFF): `.htaccess` é ignorado. Peça à TI algo assim:

```nginx
# assets do front com hash no nome: cache longo; index.html sempre revalida
location = /index.html { add_header Cache-Control "no-cache, must-revalidate"; }
location ~* -[A-Za-z0-9_-]{6,}\.(js|css)$ { add_header Cache-Control "public, max-age=31536000, immutable"; }

# API: manda /api/<qualquer coisa> pro index.php como PATH_INFO
location /api/ {
    try_files $uri $uri/ /api/index.php$is_args$args;
}
location ~ ^/api/index\.php(/|$) {
    include fastcgi_params;
    fastcgi_split_path_info ^(/api/index\.php)(/.*)$;
    set $php_path_info $fastcgi_path_info;
    fastcgi_param SCRIPT_FILENAME $document_root/api/index.php;
    fastcgi_param PATH_INFO $php_path_info;
    fastcgi_pass unix:/run/php/php-fpm.sock;   # ajustar ao socket da UFF
}
location = /api/config.php { deny all; }        # protege as credenciais
```

Teste decisivo depois de configurar: `curl .../api/atos/algum-uid` tem que
devolver a ficha (isso exercita o `PATH_INFO`, não só a query string).

---

## 6. Esteira que mantém o banco atualizado

A Action do GitHub atualiza só o `portal-data.json` (modo estático). O **banco
ao vivo** é alimentado por outra via: um **cron** que chama o endpoint de
importação com `?token=`. Ao migrar:

- [ ] Recriar o cron no ambiente novo (cPanel cron, `crontab`, ou o agendador da
      UFF), apontando para a URL nova do endpoint de importação.
- [ ] Usar o **`import_token` novo** (o do `config.php` recriado).
- [ ] Se houver SSH/CLI, dá pra rodar o importador por linha de comando em vez de
      wget — mais limpo. Sem isso, mantenha o padrão wget-com-token.
- [ ] Rodar uma vez **na mão** e conferir que novos atos entram, antes de confiar
      no agendamento.

> Enquanto a esteira nova não estiver validada, não desligue a antiga: as duas
> podem coexistir apontando para bancos diferentes durante a transição.

---

## 7. Repositório GitHub (se mudar de org)

Se o repo sair de `estudio-max` para uma org da UFF, dois pontos param de apontar
para o lugar certo e precisam ser atualizados:

- `src/config.ts` → `JSON_FALLBACK` (URL raw do `portal-data.json`) — **exige
  rebuild** do front depois de mudar.
- `api/config.example.php` → `fonte_json` (o importador lê daí).
- A Action `indexar.yml` segue funcionando na nova org, mas confira os
  `permissions: contents: write` e o push.

Se o repo **continuar** em `estudio-max`, nada disso muda.

---

## 8. DNS e redirect do domínio antigo

- [ ] Apontar a URL nova (`*.uff.br`) para o servidor novo.
- [ ] Manter `inteligencia.fanara.com.br` no ar com um **301** para a URL nova,
      pra não quebrar links, favoritos e o histórico do Google:

  ```apache
  # no .htaccess do domínio ANTIGO, depois que o novo estiver validado
  RewriteEngine On
  RewriteRule ^(.*)$ https://NOVA-URL.uff.br/$1 [R=301,L]
  ```

- [ ] Atualizar o **Search Console** (propriedade nova + "mudança de endereço").
- [ ] Deixar o 301 no ar por vários meses — o Google leva tempo pra migrar o
      ranking.

---

## 9. Verificação pós-corte (checklist de `curl`)

Rode contra a URL nova. Todos têm que responder **200 + JSON** (menos o último):

```bash
BASE=https://NOVA-URL.uff.br
curl -s $BASE/api/stats            | head -c 200   # totais gerais
curl -s "$BASE/api/atos?por_pagina=3"               # listagem
curl -s $BASE/api/atos/ALGUM-UID   | head -c 200   # ficha (exercita PATH_INFO)
curl -s $BASE/api/jornada          | head -c 200   # painel novo (flex + PGD)
curl -s $BASE/api/prazos           | head -c 200
curl -s $BASE/api/chefias          | head -c 200
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/config.php   # tem que dar 403
```

Depois, no navegador: abrir o site, checar que **não** aparece o aviso de "modo
estático" (isso significaria que a API não respondeu e caiu pro JSON), e abrir
uma ficha de ato pra confirmar o `PATH_INFO`.

---

## 10. Rollback

O corte só é irreversível quando você **desliga o HostGator**. Até lá:

1. **Não desligue o servidor antigo** enquanto o novo não passar na seção 9.
2. O DNS antigo ainda aponta pro HostGator: se o novo falhar, é só **não virar o
   DNS** (ou reverter o apontamento) e o site velho continua servindo.
3. O modo estático é a última rede: mesmo sem API nenhuma, o front serve o
   `portal-data.json` do GitHub — funciona para consulta, sem o banco.

Ordem segura do dia: **subir banco → config → api → dist → validar por IP/host
interno → só então virar o DNS.** Nunca virar o DNS antes de a seção 9 passar.
