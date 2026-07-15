# Portal de Normas e Atos da UFF — estado atual

Indexador do Boletim de Serviço da UFF: baixa os PDFs, extrai os atos, carrega
num MySQL e serve um portal de busca e análise.

**Este arquivo descreve só o presente.** Nada de histórico entra aqui — a história
está no `git log` e em `docs/CHANGELOG-*.md`. Se algo aqui deixou de ser verdade,
corrija a linha, não acrescente uma nota dizendo que mudou.

## O que está no ar

- **Site:** https://inteligencia.fanara.com.br/ (`uff.fanara.com.br` redireciona
  para lá — é um domínio antigo, não use como referência).
- **Host:** HostGator (cPanel). **Sem acesso SSH** — todo deploy é upload manual
  pelo Gerenciador de Arquivos, e todo SQL roda pelo phpMyAdmin.
- **Banco:** `fanara87_governanca`, schema **v2 normalizado**.
- **Frontend:** React + TypeScript (Vite). **Backend:** PHP + MySQL (só leitura).

## Fonte canônica

**Esta pasta (`repo/`) é a única fonte.** É um clone git de
`estudio-max/Portal-de-Normas-e-atos-da-UFF`. Nunca edite fora daqui.

A pasta-mãe tem só mais dois itens, e nenhum é código vivo: `dados/` (PDFs dos
boletins, cargas, dumps — bancada de trabalho) e `_arquivo/` (morto, não
alimenta produção). Mapa em [`../LEIA-ME.md`](../LEIA-ME.md).

A indexação diária **não roda nesta máquina** — roda no GitHub Actions
(`.github/workflows/indexar.yml`, cron 22:10), que baixa os próprios boletins.
Não há tarefa agendada local.

Regra de fechamento: **todo trabalho termina em `git commit` + `git push`.** O
GitHub é o espelho único; se não foi empurrado, não aconteceu.

## Armadilhas de nome (leia antes de editar qualquer arquivo)

| Arquivo | O que é |
|---|---|
| `backend/api/index_v2.php` | **A API viva.** É este que você edita. |
| `backend/api/index.php` | API do v1, **morta**. Não edite, não faça deploy. |
| `backend/db/schema_v2.sql` | O schema vivo. |
| `backend/db/schema.sql`, `gerar_sql.py`, `importar/importar.php`, `resolver_relacoes.php` | v1, mortos. |
| `backend/importar/importar_v2.php`, `resolver_relacoes_v2.php` | Os vivos. |

**Regra de deploy da API:** `index_v2.php` sobe para o servidor **renomeado como
`api/index.php`**. O `.htaccess` roteia `/api/*` para `index.php`; subir com o
nome `index_v2.php` deixa a API inerte e o portal cai para o modo estático sem
avisar.

## Schema v2 (essencial)

Modelo em estrela. PK substituta `ato.id` (BIGINT, estável) + `ato.uid` (slug
legível). **A API expõe `uid AS id`** — o `id` público em URLs é o `uid`, nunca o
BIGINT interno.

**Uma rota é fechada: `/api/dossie`** (aba Dossiê do servidor). É a única que
reúne a vida funcional de uma pessoa num lugar só — as outras devolvem atos
avulsos, públicos por natureza. Senha no `config.php`, conferida no PHP. Gate no
React não serviria: o bundle é público e a rota continuaria aberta pela URL.

- Dimensões: `orgao`, `orgao_alias`, `tipo_ato`, `pessoa`, `boletim`
- Núcleo: `ato`, `ato_texto` (`texto_original` exibe, `texto_busca` é o FULLTEXT)
- Fatos: `relacao`, `ato_funcao`, `ato_pessoa`, `ato_tag`, `ato_aposentadoria`,
  `ato_deslocamento`, `prazo`
- Proveniência: `extracao`

Consequência prática: **análise nova vira `INSERT` numa tabela-fato, não coluna
nova.** Se você está pensando em `ALTER TABLE ato ADD COLUMN`, parou no modelo
errado — era assim no v1 e foi justamente o que se abandonou.

Racional completo: `docs/ARQUITETURA-BASE-DADOS.md`.

## Como fazer deploy

```bash
npm install
npm run build      # gera dist/ (dist/ é gitignored — não vem do GitHub)
```

Suba pelo Gerenciador de Arquivos da HostGator:

1. **Frontend:** conteúdo de `dist/` → raiz do site.
2. **API:** `backend/api/index_v2.php` → `api/index.php` (renomeando).

**Se o formato de resposta da API mudou, `dist/` e `api/index.php` sobem juntos,
na mesma janela.** Subir só um dos dois quebra o painel afetado.

`backend/api/config.php` mora só no servidor (está no `.gitignore` e contém as
credenciais do banco). Não versione, não imprima o conteúdo.

**A aba Dossiê exige `dossie_token` no `config.php`.** É a senha da Gestão de
Pessoal, conferida pelo PHP (`dossie_autorizado()`). A rota **falha fechado**:
sem a chave preenchida no servidor, `/api/dossie` responde 401 e a aba não abre —
de propósito, para deploy pela metade não virar dossiê aberto. Ao subir o
`config.php` novo, preencha, senão a aba fica morta sem erro visível no resto do
portal.

## Regras do domínio que já custaram retrabalho

- **CEP ≠ CEPEx.** CEP é o Comitê de Ética em Pesquisa (3 instâncias), órgão
  totalmente diferente do CEPEx. Nunca mesclar.
- **A identidade do boletim é o ARQUIVO, não o número impresso.** O arquivo
  `57-26.pdf` traz "BS nº 113"; chavear pelo número duplica atos.
- **A identidade do ato é a `sigla_orig`** (a do cabeçalho). O órgão derivado do
  texto é enriquecimento, não identidade.
- **Classifique pelo dispositivo do ato, não por menção.** Uma retificação que
  cita uma concessão anterior ("…portaria X, **que concedeu** aposentadoria…")
  não é uma concessão nova. O marcador é o "que" antes do verbo.
- **Collation do MySQL ≠ dedup do Python.** `DECISOES` == `DECISÕES` e
  `'001'` == `'01'` == `'1'` para o MySQL. Qualquer ETL precisa considerar isso.
- Órgão tem ~1.162 grafias de sigla no corpus. Consolidar é **curadoria** (via
  `orgao_alias`), não regex.
- **O mesmo servidor é DUAS pessoas quando o SIAPE varia no zero à esquerda.**
  `pessoa.siape` é UNIQUE, então `0307221` e `307221` são duas linhas com atos
  separados (medido: 1.462 servidores partidos assim). Quem consulta por
  matrícula tem que normalizar com `TRIM(LEADING '0' FROM ...)` — **nunca
  `LPAD`**, que trunca no MySQL (`LPAD('12345678',7,'0')` = `'1234567'`) e
  fundiria matrículas diferentes.
- **Um SIAPE pode carregar duas pessoas, e o v2 não sabe disso.** O importador
  chaveia pessoa por `"s:$siape"`, então nomes divergentes colapsam numa linha
  com o primeiro nome visto (`'3369546'` = Bárbara Sena **e** Simone Lemos). Como
  `ato_pessoa` só guarda `ato_id`+`pessoa_id`, o nome grafado em cada ato se
  perdeu: não dá para detectar nem desfazer por SQL. Separar é curadoria.
- **`ato_pessoa` é menção, não participação.** Numa banca, o avaliado também é
  citado. Membro é quem o dispositivo designa — mesma regra do "classifique pelo
  dispositivo".
- **Só 30–70% dos atos registram SIAPE** (34% em 2001, ~65% em 2025), e o
  extrator só cria pessoa quando acha um. Logo, quem não tem matrícula no ato
  não está em `pessoa`/`ato_pessoa` — está só no corpo, e só o FULLTEXT de
  `ato_texto` o alcança. Buscar pessoa sem siape em `pessoa` devolve zero,
  sempre.

## Documentos que NÃO são confiáveis

`DEPLOY.md` e `backend/README.md` descrevem o mundo v1 (Cloud Run, `app-fonte/`,
banco `fanara87_uffnormas`). Estão marcados com aviso no topo. **Este arquivo
manda neles.**

## Pendências

- **Aposentadoria 2001-2014 parece ter entrado sem o fix de retificação.**
  `/api/analitico` em produção mostra **689 "Indefinida" em 2001-2014 e ~0 de
  2015 em diante**. O classificador corrigido (o marcador "que" antes do verbo,
  que separa retificação de concessão) produzia **zero** indefinidas nesse
  período — então o bloco antigo provavelmente foi gerado por uma cópia do
  extrator sem o fix — a cópia que ficava solta na pasta-mãe estava **4 dias e
  147 linhas atrás** desta. Confirme no phpMyAdmin antes de agir; se confirmado,
  o conserto é regerar o bloco 2001-2014 com `tools/extrair_boletim.py` **daqui**.
  ⚠️ Os SQLs `corrigir_*.sql` em `../dados/cargas/_out/` **são do v1 e não rodam
  aqui** (escrevem em `atos`/`ato_corpo`, que não existem no v2) — ignore-os.
- Curadoria fina de órgãos: identificar o CEP no corpus; ~35 nomes com sigla
  embutida entre parênteses.
- Fase B: re-extração dos PDFs em caixa natural (habilitada pela PK estável).
- Cutover para o domínio oficial da UFF.
- **Fase 2 do Dossiê (Decreto 13.048/2026, RSC do PCCTAE).** A aba de hoje
  localiza atos; ela não sabe quem participou de quê. Falta:
  - `colegiado` como entidade + membros com papel (presidente/titular/suplente)
    extraídos do **dispositivo**, e composição ao longo do tempo. Hoje o
    `ato_funcao` vem vazio nos atos de comissão e o papel está só em prosa
    ("sob a presidência do primeiro" é anáfora: depende da ordem dos nomes).
  - Colegiado **permanente** reaproveita `orgao` (`tipo='comite_comissao'`,
    `parent_id` → Reitoria), o que dá "destaque das criadas pela reitoria" pelo
    roll-up que já existe. **Comissão efêmera não vira órgão** — são milhares
    (banca, inventário, eleitoral) contra dezenas de colegiados, e viraria uma
    explosão do problema das 1.162 grafias.
  - Merge curado das 1.462 pessoas fragmentadas + os SIAPEs com duas pessoas.
  - Fix do `signatario` (~10–13% vazio ou capturado errado, ex.: `RESOLVE:`) é
    **pré-requisito** de "quem designou".
  - "Comissão abandonada" é indecidível pela mesma razão dos Mandatos: o fim não
    gera ato. A que entregou em silêncio é idêntica à esquecida. O máximo honesto
    é "prazo venceu e não há ato posterior desde X".
