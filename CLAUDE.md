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

O catálogo completo está em [`docs/GUIA-EXTRACAO-BS.md`](docs/GUIA-EXTRACAO-BS.md)
— a **linha do tempo do corpus** (o BS é vários formatos em sequência: o marcador
de fim de ato nasce em 2002 com cinco `#`, vira seis em 2004; o SIGAEx aparece em
2018; 2020 sai em Title Case), os números de cada armadilha, os erros que já
cometemos e as sugestões à equipe que produz o Boletim. As regras abaixo são o
resumo operacional.

- **CEP ≠ CEPEx.** CEP é o Comitê de Ética em Pesquisa (3 instâncias), órgão
  totalmente diferente do CEPEx. Nunca mesclar.
- **A identidade do boletim é o ARQUIVO, não o número impresso.** O arquivo
  `57-26.pdf` traz "BS nº 113"; chavear pelo número duplica atos.
- **A identidade do ato é a `sigla_orig`** (a do cabeçalho). O órgão derivado do
  texto é enriquecimento, não identidade.
- **Classifique pelo dispositivo do ato, não por menção.** Uma retificação que
  cita uma concessão anterior ("…portaria X, **que concedeu** aposentadoria…")
  não é uma concessão nova. O marcador é o "que" antes do verbo. Vale igual para
  função: "dispensar, **em virtude de sua nomeação** para diretor…" é uma
  DISPENSA — o substantivo só explica o motivo (por isso o `(?!c)` em
  `_VERBO_FUNC`, que casa o verbo "nomear" e recusa o substantivo "nomeação").
- **Nomear/exonerar ≠ designar/dispensar.** No serviço público, *nomeação* e
  *exoneração* são o par dos **cargos de direção (CD)**; *designação* e
  *dispensa*, o das funções e chefias. `ato_funcao.acao` só tem
  `designar`/`dispensar`, então a nomeação de CD entra como `designar`.
- **A whitelist de cargos (`_NUC_CARGO`) é branca de propósito.** O gatilho
  aceita "cargo de X" sem o "de direção", então todo nome ali também passa a
  casar **cargo efetivo**. `professor`, `assistente`, `técnico`, `secretário`
  solto e `procurador` solto ficam fora: são o emprego da pessoa. "Secretário"
  traria 60 eliminações de concurso ("para o cargo de secretário executivo, por
  não apresentar documentação") como designações. Antes de acrescentar um cargo,
  **meça** quantas vezes ele aparece após "cargo de direção de" versus após
  "cargo de" solto — `tools/teste_funcoes_cd.py` fixa os casos.
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
- **Um ato sem cabeçalho reconhecido depois dele "engole" o que vem a seguir**
  até o próximo título real. Achado por dois caminhos: o Extrato de Instrumento
  Convenial (557 atos) e as seções sem cabeçalho de ato próprio — "Resumo de
  Despachos e Decisões", "Alteração de Carga Horária", "Auxílio Funeral"
  (2.414 atos, 3,1% do corpus; caso-prova: a Portaria 64.814/2019 nomeia 9
  servidores e a base lhe atribuía 22). `BOUNDARY_NAO_ATO_RE` corrige isso —
  entradas nesse regex só servem de FRONTEIRA (cortam o ato anterior), nunca
  viram ato próprio. **Ao adicionar um marcador novo, exija caixa alta pura,
  sempre.** É o único motivo pelo qual uma citação real em Title Case
  ("Autorizo o cancelamento dos efeitos do **Resumo de Despachos e
  Decisões** n° 62/2012…", achado real de 2015) não vira um corte falso no meio
  de um ato legítimo. Duas âncoras óbvias JÁ foram tentadas e reprovadas — não
  repita: `# # # # # #` é peça estrutural (`TITULO_CURTO_RE` já o usa),
  somá-lo à fronteira sumiu com 7 atos e truncou 10; o bloco "Assinado com
  senha por" do SIGAEx é carimbo de rodapé de PÁGINA, não fim de documento, e
  decapitou um ato de várias páginas. Regressão obrigatória antes de mexer
  aqui de novo: `tools/teste_fronteira_ato.py`, e comparar extrator velho ×
  novo sobre uma amostra ampla do corpus (`dados/boletins/`) — não confie só
  no PDF que motivou a mudança.

## Documentos que NÃO são confiáveis

`DEPLOY.md` e `backend/README.md` descrevem o mundo v1 (Cloud Run, `app-fonte/`,
banco `fanara87_uffnormas`). Estão marcados com aviso no topo. **Este arquivo
manda neles.**

## Pendências

- **Reprocessamento pendente do extrator.** `tools/extrair_boletim.py` já captura
  cargo de direção/assessoramento (Assessor, Prefeito, Corregedor,
  Secretário-Geral), o verbo `nomear`, e não deixa mais um ato engolir a seção
  seguinte (ver abaixo) — mas **os dados importados não mudaram**. A Action
  diária aplica isso só aos boletins novos; o histórico (ex.: a nomeação de
  Assessor de 2022, que não aparece no Dossiê) só entra com **reprocessamento +
  reimport**. Este lote soma aos fixes de captura anteriores que também esperam
  a mesma rodada — **incluindo o bloco de aposentadoria 2001-2014** (confirmado
  abaixo).

  Mecanismo de reimport (lido em `backend/importar/importar_v2.php`): não é
  SQL pronto — é um endpoint PHP que lê um **JSON** (schema do
  `portal-data.json`) e faz UPSERT idempotente por chave natural. Roda via
  navegador, `?token=...&arquivo=nome.json`, com o arquivo **subido antes** para
  `backend/importar/` no servidor (sem SSH, sem outro jeito). É uma transação
  única por chamada — o comentário do próprio código diz que o feed diário
  (~3.200 atos/11 MB) "cabe folgado", e que um lote maior "pode raspar o teto"
  do hosting compartilhado. Um reprocessamento completo (128k+ atos) precisa
  ser **fatiado por ano** — e alguns anos sozinhos (2013: 6.929 atos, 2015:
  7.113) já passam do que o feed diário prova ser seguro, podendo exigir
  sub-fatiamento. Os `carga_202X.sql.gz` em `../dados/cargas/` parecem resíduo
  da migração v1→v2 original (`etl_v2.py`), não este mecanismo — não use como
  referência sem confirmar.

- **RDD individual não vira ato próprio (lacuna, não regressão).** O fix de
  fronteira (abaixo) impede que um ato absorva a "Resumo de Despachos e
  Decisões" que vem depois — mas cada decisão INDIVIDUAL dentro dessa seção
  (uma por interessado, repetida várias vezes no boletim) ainda não vira seu
  próprio ato: ela só deixa de contaminar o anterior. Medido: a DTS PROEX
  Nº 06/2005 tinha 24.600 caracteres — 11 decisões de terceiros coladas nela;
  agora ela para na primeira, e as outras 10 pessoas ficam sem registro. É
  melhoria líquida (elas nunca foram capturadas certo antes também — só mal
  atribuídas), mas não é o fim da história. `RDD` já está em `TIPOS` e
  `canon_tipo()` — falta estender `TITULO_CURTO_RE` para reconhecer o formato
  curto (sem data por extenso, `Nº ###/AAAA` bare), como já faz para
  DECISÃO/RESOLUÇÃO. Não é trivial: o número aparece em pelo menos 3 formatos
  (2005: cabeçalho+órgão+`PROCESSO:`+"RDD Nº X"; 2019: cabeçalho+`Nº X/AAAA`
  direto ou inline com órgão; 2023: cabeçalho+`Nº X, de DD de MÊS de AAAA`, já
  capturado por `TITULO_RE`). Cada formato precisa da mesma medição rigorosa
  que o resto deste arquivo documenta.

- **Aposentadoria 2001-2014: 689 "Indefinida", CONFIRMADO (15/07/2026).**
  `/api/analitico` mostrava 689 "Indefinida" em 2001-2014 contra ~0 de 2015 em
  diante. Investigado via phpMyAdmin em 3 passos: (1) a agregação por ano bateu
  exato — soma de 2002-2014 = **689**, igual ao valor já registrado; (2) `SELECT
  ... GROUP BY extracao_id` mostrou que **todos os 4.051 registros** de
  `ato_aposentadoria` (2002-2026, bons e ruins juntos) vêm de **um `extracao_id`
  só** — o `1`, "Reformatação v1→v2 sem perda", rodado em 2026-07-12. Ou seja:
  **não é um lote de extração v2 divergente** — é a migração v1→v2 carregando,
  fiel ao próprio nome ("sem perda"), uma classificação que já estava errada
  **dentro do v1**, de uma época anterior a alguma correção que o v1 recebeu
  (por volta de 2014/2015, a julgar por onde "Indefinida" despenca); (3) amostra
  de 13 dos atos "Indefinida" de 2001-2014 confirmou visualmente: **12 são
  retificações puras** — a ementa inteira é só *"Retifica em parte, a Portaria
  nº X de DD/MM/AAAA"*, sem conteúdo de concessão próprio. É o caso textual da
  regra "classifique pelo dispositivo, não por menção" — o classificador atual
  não geraria `ato_aposentadoria` nenhum para essas. O 13º caso
  (`dts-uff-31-2002-2`, uma DTS de **lotação** de servidor) é outlier na mesma
  família: nada na ementa fala de aposentadoria — o corpo provavelmente
  menciona a aposentadoria de outra pessoa em algum trecho, e o classificador
  velho pegou a menção.

  **Conserto:** regerar o bloco 2001-2014 com `tools/extrair_boletim.py`
  **daqui** e reimportar — entra no mesmo lote do reprocessamento pendente
  acima (cargo de direção, `nomear`, fronteira do ato). Não precisa mais
  confirmar nada; já está confirmado.
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
