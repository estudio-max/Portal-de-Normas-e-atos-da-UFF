# Tarefa: varredura dos ~100 atos com `ano < 2001` (boletim de 2001)

> **Como usar este arquivo:** abra um chat novo **na pasta `repo/`** (assim o
> `CLAUDE.md` carrega sozinho) e cole o conteúdo da seção "PROMPT" abaixo, ou
> diga "execute `docs/TAREFA-varredura-anos-boletim-2001.md`". O resto do arquivo
> é contexto que o próprio prompt manda ler.

---

## PROMPT (cole isto no chat novo)

Você vai auditar os atos do Portal de Normas da UFF que têm **`ano < 2001`** e
vêm do **boletim de 2001** (o único ano digitalizado/OCR do corpus). O objetivo é
separar, ato a ato, **backlog legítimo** (ato realmente de 1998-2000, publicado
no boletim de 2001 — ano CORRETO, não mexer) de **erro de leitura de ano do OCR**
(ano/data errados — corrigir), e produzir **SQL de correção** para rodar no
phpMyAdmin. Não é re-extração (isso é a Fase B); é curadoria pontual no banco ao
vivo.

**Antes de tudo, leia:** o `CLAUDE.md` (regras de domínio e a pendência "Anos
impossíveis / fantasmas de citação", que descreve esta classe) e os três SQLs já
feitos em `backend/importar/`: `corrigir_anos_impossiveis.sql`,
`corrigir_fantasmas_citacao.sql`, `corrigir_ano_gqo.sql`. Eles são o **padrão de
entrega** (cabeçalho explicando + PREVIEW + UPDATE/DELETE + VERIFICAÇÃO) e mostram
o que **já foi resolvido** — não refaça.

**Princípio:** rigor com dado real, como o resto do projeto. **Nunca corrija um
ano sem confirmar a data real impressa no PDF do boletim.** Na dúvida, **deixe o
ato como está e liste para revisão humana** — errar apagando/alterando ato real é
pior que deixar um ano suspeito. Não apague ato real; exclusão é só para fantasma
comprovado (citação/referência virada em ato — ver regra "classifique pelo
dispositivo, não por menção" do CLAUDE.md).

### O que já foi resolvido nesta classe (NÃO reprocessar)

Dos 108 atos com `ano < 2001`, estes 10 já foram tratados (podem já ter sido
rodados no phpMyAdmin, então talvez nem apareçam mais):

- Apagados (impossíveis/fantasmas): `res-mgn-02-1014`, `dec-uff-41-1771`,
  `port-reitoria-2203-1996`, `port-reitoria-280-1999`, `in-sedap-205-1988`,
  `port-reitoria-29-1998`, `port-reitoria-29-1998-2`, `ns-uff-504-2000`.
- Ano corrigido para 2007: `dts-gqo-3-2000` → `dts-gqo-3-2007`,
  `dts-gqo-4-2000` → `dts-gqo-4-2007`.

Restam ~100, todos do boletim de 2001. **Eles são o alvo desta tarefa.**

### Passo 1 — montar a lista atual

Puxe da produção (a API ordena por ano, então os < 2001 vêm primeiro):

```bash
curl -sL "https://inteligencia.fanara.com.br/api/atos?ordenar=ano&dir=asc&por_pagina=250" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(a['id'] for a in d['atos'] if a.get('ano') and a['ano']<2001))"
```

Exclua os 10 uids já tratados acima. Para cada uid restante, a ficha traz o
boletim de origem:

```bash
curl -sL "https://inteligencia.fanara.com.br/api/ato?id=<UID>"
# campos úteis: numero, ano, dataAssinatura, linkBoletim, ementa, conteudoResumido
```

O ano do boletim está no `linkBoletim`, em **dois formatos**: `/bs/AAAA/...` ou
`.../NNN-AAAA.pdf`. Confirme que todos são de **2001** (se algum for de outro ano,
é da classe "fantasma de citação" já auditada — trate como os anteriores).

### Passo 2 — ler a data real no PDF (o que decide)

**Agrupe por boletim** (`NNN-2001.pdf`) e baixe cada boletim UMA vez — vários
atos compartilham o mesmo. Assim você lê todos os atos daquele boletim juntos.

```bash
# ATENÇÃO: o http redireciona para https (301) — sempre use -L
curl -sL -o /tmp/bol.pdf "http://www.noticias.uff.br/bs/2001/xx/NNN-2001.pdf"
```

Extraia o texto com pymupdf (o `pip` do sistema está bloqueado — instale no user):

```bash
python3 -m pip install --user --quiet pymupdf     # uma vez
python3 -c "import fitz; print('\n'.join(p.get_text() for p in fitz.open('/tmp/bol.pdf')))"
```

Ache o cabeçalho de cada ato — algo como
`DETERMINAÇÃO DE SERVIÇO ... Nº 003 de 23 de agosto de 2001.` — e leia a **data
real impressa**. Compare com o `ano`/`dataAssinatura` do banco:

- **Batem** → ano correto (backlog legítimo ou OCR que acertou). **Não mexer.**
- **Diferem** → o ano do banco está errado. **Corrigir** para a data real.
- **Data impressa é lixo** (ex.: `20007` = 2007 pegando 4 dígitos; ou ano
  ausente) → deduza pelo próprio boletim (`NNN-2001` ⇒ contexto de 2001) e pelo
  corpo do ato; se não der pra ter certeza, **deixe e liste**.
- **Não é ato** (a "ementa" é citação/referência, ou fragmento sem dispositivo)
  → fantasma, candidato a **DELETE** (confirme lendo o PDF).

Expectativa realista: **boa parte deve ser backlog legítimo** de fim de 2000
publicado nos primeiros boletins de 2001 — ano 2000 CORRETO, nada a fazer. A
tarefa é confirmar isso e pescar os poucos que estão errados.

### Passo 3 — pegadinhas de execução (já custaram tempo)

- **`-L` no curl** para os PDFs e para a API — o `noticias.uff.br` faz 301
  http→https; sem `-L` vêm 259 bytes de HTML, não o PDF.
- **`urllib` falha silenciosamente** aqui (volta sem `linkBoletim`). Use `curl`.
- **uids lidos de arquivo têm `\r`** (CRLF do Windows) — dê `sed -i 's/\r$//'` ou
  faça `.strip()`, senão a URL fica inválida e a API responde erro.
- **Não** faça `while read ... done < arquivo` com `curl | python` lendo stdin
  dentro (conflito de stdin). Use `for uid in $(cat uids.txt)` + arquivo temp.

### Passo 4 — regras de correção (schema v2)

- **uid** = `<tipo>-<sigla>-<numero_norm>-<ano>` (ex.: `dts-uff-17-2001`). Ao
  corrigir o ano, o certo é `UPDATE ato SET ano=..., data_ato='AAAA-MM-DD',
  uid='<novo>'` — **cheque a colisão** do uid novo antes (`/api/ato?id=<novo>`
  tem que dar erro/livre). Se colidir, o ato já existe correto → então o de ano
  errado é DUPLICATA (apague, como no caso 1014). `data_ato` **não** pode virar
  NULL — use a data real.
- **DELETE** de fantasma é seguro: `ON DELETE CASCADE` limpa
  `ato_texto/ato_pessoa/ato_funcao/prazo/...`; `relacao.destino_ato_id` vira NULL
  (preserva o texto da citação). Antes de apagar, cheque `referenciadoPor` na
  ficha (só para saber o impacto; SET NULL é aceitável).
- O **cron diário não reprocessa boletins antigos**, então a correção no banco é
  estável (só voltaria numa re-extração da Fase B).

### Passo 5 — entrega

- Um ou mais SQLs em `backend/importar/` (ex.: `corrigir_anos_boletim2001.sql`),
  **separando UPDATE (correção de ano) de DELETE (fantasma)**, cada bloco com
  PREVIEW + ação + VERIFICAÇÃO, no padrão dos SQLs existentes.
- **Antes de qualquer DELETE**, mostre ao usuário a tabela de classificação
  (uid | ano banco | ano real | boletim | veredito) e confirme.
- Liste à parte os **ambíguos** (data ilegível no PDF) — não decida por conta.
- Atualize a pendência no `CLAUDE.md` com o resultado (quantos corretos, quantos
  corrigidos, quantos fantasmas) e feche com `git commit` + `git push`.

---

## Referência rápida (contexto do projeto)

- **Site ao vivo:** https://inteligencia.fanara.com.br/ · **Banco:**
  `fanara87_governanca` (schema v2) · **Sem SSH:** todo SQL roda no phpMyAdmin.
- **Fonte canônica:** a pasta `repo/`. O `CLAUDE.md` manda.
- **Boletins de origem:** `http://www.noticias.uff.br/bs/AAAA/mm/NNN-AAAA.pdf`
  (redireciona p/ https) ou `http://boletimdeservico.uff.br/wp-content/uploads/...`.
- **Por que isto importa:** com o RSC, servidores procuram seus atos antigos no
  portal; ano errado atrapalha achar e citar o ato certo.
