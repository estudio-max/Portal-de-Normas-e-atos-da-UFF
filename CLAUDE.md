# Portal de Normas e Atos da UFF — estado atual

Indexador do Boletim de Serviço da UFF: baixa os PDFs, extrai os atos, carrega
num MySQL e serve um portal de busca e análise.

**Este arquivo descreve só o presente.** Nada de histórico entra aqui — a
história está no `git log`, que é onde ela deve ser procurada. Se algo aqui
deixou de ser verdade, corrija a linha, não acrescente uma nota dizendo que
mudou.

## O que está no ar

- **Site:** https://inteligencia.fanara.com.br/ (`uff.fanara.com.br` redireciona
  para lá — é um domínio antigo, não use como referência).
- **Host:** HostGator (cPanel). **Sem acesso SSH** — todo deploy é upload manual
  pelo Gerenciador de Arquivos, e todo SQL roda pelo phpMyAdmin.
- **Banco:** `fanara87_governanca`, schema **v2 normalizado**. **Percona Server
  5.7** (não MySQL 8) — sem `REGEXP_SUBSTR`, `REGEXP_REPLACE`, CTE recursiva nem
  funções de janela. Confirme a versão em `/api/health` (campo `mysql`) antes de
  escrever qualquer SQL de manutenção; um script que dependia do 8.0 já foi
  escrito e jogado fora por causa disto.
- **Frontend:** React + TypeScript (Vite). **Backend:** PHP 8.3 + MySQL (só leitura).

## Fonte canônica

**Esta pasta (`repo/`) é a única fonte.** É um clone git de
`estudio-max/Portal-de-Normas-e-atos-da-UFF`. Nunca edite fora daqui.

A pasta-mãe tem só mais dois itens, e nenhum é código vivo: `dados/` (PDFs dos
boletins, cargas, dumps — bancada de trabalho) e `_arquivo/` (morto, não
alimenta produção). Mapa em [`../LEIA-ME.md`](../LEIA-ME.md).

**Nada disso roda nesta máquina, e há DOIS agendamentos, não um.**

1. **GitHub Actions** (`.github/workflows/indexar.yml`, cron 22:10 UTC) baixa
   os boletins, extrai os atos e commita `public/portal-data.json`. Isso
   alimenta só o **modo estático de contingência** — não toca o banco.
2. **Cron no cPanel do servidor**, **duas vezes por dia (12h e 20h)**, roda a
   importação e é o que de fato atualiza o portal no ar.

A consequência prática é o que mais se erra aqui: **tudo que o importador
escreve se mantém sozinho** — `ato`, `relacao`, `prazo`, `ato_processo`,
`ato_comissao`, `ato_ods` e, desde 04/08/2026, `ato_politica` e
`politica_indicador`. O que NÃO se mantém sozinho são os **catálogos curados**
(`politica`, `politica_alias`, `comissao`, `obrigacao`): eles são seeds gerados
offline e só mudam quando alguém regera e aplica.

**Corolário que já custou confusão:** o que o importador escreve só aparece
**depois da primeira importação seguinte ao deploy**. Subir o painel de etapas às
15h não enche `politica_indicador` — ele enche às 20h, quando o cron roda. Painel
vazio na tarde do deploy é o esperado, não defeito; confira `banco_atualizado_em`
em `/api/health` antes de investigar.

⚠️ **Não confirmei o que exatamente o cron invoca** (se roda o pipeline
inteiro no servidor ou se busca o JSON já pronto do GitHub), nem por que o
`banco_atualizado_em` de 03/08 marcava 18:00 — não bate com 12h nem com 20h,
e pode ser fuso do servidor. Quem souber, corrija esta linha.

Regra de fechamento: **todo trabalho termina em `git commit` + `git push`.** O
GitHub é o espelho único; se não foi empurrado, não aconteceu.

## Os arquivos que importam

O sufixo `_v2` nos nomes é cicatriz da migração de schema de julho/2026. **Não
existe mais um v1**: os arquivos da geração anterior foram apagados do repo em
21/07/2026 (estão no `git log` se alguém precisar arqueologia). O que sobrou é
tudo vivo.

| Arquivo | O que é |
|---|---|
| `backend/api/index_v2.php` | **A API.** Único arquivo de API. |
| `backend/db/schema_v2.sql` | O schema. |
| `backend/importar/importar_v2.php` | O importador (upsert por chave natural). |
| `backend/importar/resolver_relacoes_v2.php` | Resolve relações + recalcula vigência. Roda sozinho ao fim de cada import. |
| `tools/extrair_boletim.py` | O extrator: PDF → atos. O arquivo mais sensível do projeto. |
| `server.ts` | **Só dev** (`npm run dev`, Vite em middleware). Não existe em produção — lá o front é estático e a API é PHP. No dev, `/api/*` responde 404 de propósito (o modo banco se testa com `?api=http://127.0.0.1:8900` + `tools/mock_api.py`). |

**Regra de deploy da API:** `index_v2.php` sobe para o servidor **renomeado como
`api/index.php`**. O `.htaccess` roteia `/api/*` para `index.php`; subir com o
nome `index_v2.php` deixa a API inerte e o portal cai para o modo estático sem
avisar.

## Schema v2 (essencial)

Modelo em estrela. PK substituta `ato.id` (BIGINT, estável) + `ato.uid` (slug
legível). **A API expõe `uid AS id`** — o `id` público em URLs é o `uid`, nunca o
BIGINT interno.

**Todas as rotas são abertas.** `/api/dossie` (aba **Meu SIAPE**, ex-"Dossiê do
servidor") foi fechada por senha até 18/07/2026 e aberta por decisão do
mantenedor: com o RSC, o público é o próprio servidor consultando os seus
registros. O `dossie_token` do `config.php` ficou sem uso (inofensivo se ainda
existir); a rota `dossie_auth` segue no ar devolvendo `ok` para não quebrar
bundle antigo. A justificativa LGPD da abertura está na aba Privacidade.

- Dimensões: `orgao`, `orgao_alias`, `tipo_ato`, `pessoa`, `boletim`
- Núcleo: `ato`, `ato_texto` (`texto_original` exibe, `texto_busca` é o FULLTEXT)
- Fatos: `relacao`, `ato_funcao`, `ato_pessoa`, `ato_tag`, `ato_aposentadoria`,
  `ato_deslocamento`, `prazo`, `ato_processo` (todos os nºs de processo citados,
  não só o 1º — ver aba de busca por processo), `ato_comissao` (liga o ato ao
  colegiado permanente que ele cita — alimenta a aba Comissões), `ato_ods`
  (liga o ato a uma das 17 ODS, com tipo de vínculo — alimenta a aba ODS),
  `ato_politica` (liga o ato a uma política com o PAPEL que ele cumpre —
  alimenta a aba Políticas; catálogo em `politica`/`politica_alias`)
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
na mesma janela** — e bump em `api_versao()` no `index_v2.php`. Subir só um dos
dois quebra o painel afetado.

**Deploy só está pronto quando `bash tools/smoke_test.sh` passa** (valida
health/versão da API, rotas principais, o roteamento `/api/atos/{id}` e que o
`config.php` segue bloqueado). `GET /api/health` devolve a versão rodando.

`backend/api/config.php` mora só no servidor (está no `.gitignore` e contém as
credenciais do banco). Não versione, não imprima o conteúdo.

**Reimportar um lote grande sem SSH.** O cron diário só processa boletins novos;
para reprocessar anos inteiros (ex.: depois de consertar o extrator), o caminho é
o modo navegador do importador. Suba o JSON gerado por `gerar_dados_portal.py`
para a pasta `importar/` do servidor e visite
`importar/importar_v2.php?token=<import_token>&arquivo=<nome>.json`. O
`basename()` obriga o arquivo a estar naquela pasta — não aceita caminho nem URL.
É seguro repetir: o upsert casa por chave natural
`(boletim_id, tipo_id, sigla_orig, numero_norm, ano)` e nunca duplica. Ao fim ele
chama o `resolver_relacoes_v2.php` sozinho. Confira que **os SEIS** arquivos de
`require_once` estão na mesma pasta — `extrair_prazos.php`,
`extrair_prazos_pad_sinve.php`, `comissoes_match.php`, `ods_match.php`,
`politicas_match.php` e `indicador_politica.php`: **a falta de qualquer um dá
HTTP 500 de corpo vazio**, e com o cron rodando 2x/dia isso significa portal
parado sem ninguém notar. Os três últimos são recentes (`ods_match.php` de
03/08/2026, `politicas_match.php` e `indicador_politica.php` de 04/08/2026):
quem subiu o importador antes dessas datas **não os tem**.
Ao atualizar o importador, suba SEMPRE os auxiliares ANTES dele. Feito assim em 21/07/2026 para os 4.234 atos do buraco do CEPEx.

A aba Meu SIAPE não exige mais configuração nenhuma (o `dossie_token` do
`config.php` era da época em que ela tinha senha; ficou sem uso).

## Painéis derivados da EMENTA (não de tabela-fato)

Duas abas não têm tabela-fato própria: são **calculadas em tempo de consulta**
lendo o texto do ato. É uma escolha — enquanto as regras ainda estão sendo
descobertas, mudar um regex e recarregar é barato; virar `INSERT` só quando a
regra estabilizar (aí sim vale o modelo em estrela).

- **Jornada de trabalho** (`/api/jornada`): flexibilização vs Programa de Gestão
  e Desempenho. Agrupa as portarias de um setor pelo **processo SEI** (o nome do
  setor sai do texto e o OCR o escreve diferente a cada ano — não serve de
  chave). Setor saiu se QUALQUER portaria do grupo foi revogada. A revogação é
  reconhecida por `flex_classe()` retornar `'revogacao'` para ementa que abre com
  "Revogar a Portaria X - Jornada Flexibilizada de…". **Antes disso ela caía em
  `'outro'` e o agrupamento a descartava** — 37 setores ficavam "Ativo" para
  sempre porque o grafo de relações não resolvia (a portaria revogada é de 2019 e
  várias nem estão no acervo). A própria portaria de revogação é a fonte do
  status agora, não o grafo. Guarda de reflexibilização: aprovação com data
  POSTERIOR à revogação reabre o setor (0 casos hoje, mas fica). O processo SEI
  vai no resultado.
- **Cooperação** (`/api/cooperacao`): acordos, protocolos e cotutelas. 16
  nomenclaturas foram fundidas em **5 categorias**, decisão tomada lendo o CORPO
  (o dispositivo), não a ementa: o texto operativo de Acadêmica/Internacional/
  Protocolo de Intenções é o MESMO boilerplate, e "Internacional" nunca foi
  categoria — é qualificador (quem carrega isso é o país). Cotutela fica sozinha
  (outlier extremo: sinal de titulação 22,2 por 1.000 palavras contra 0-2 nas
  outras). Ato que só DESIGNA coordenador não é acordo.
  O **país** vem em cascata: declarado no texto → tabela curada
  instituição→país (`coop_inst_pais_curada`, para as ementas que não declaram
  nada: "…e a Brunel University." e ponto) → propagação da mesma instituição
  vista noutro ato. `paisInferido` marca o que não veio do ato, e a interface
  mostra `*`. A tabela curada é **extensível**: instituição estrangeira sem país
  = uma linha nova ali.

## Cache de resposta

Os painéis diário-estáticos (`stats`, `filtros`, `jornada`, `cooperacao`,
`comissoes`, `politicas`, `insights`, `analitico`, `prazos`, `pad_cadeia`,
`ods`, `mudancas`) são
cacheados em disco (`api/cache/`). Medido: jornada/cooperacao/insights custam ~0,5s de CPU
por requisição, e dão a MESMA resposta para todos entre uma importação e outra
(o acervo muda 1x/dia). Servidos do cache custam ~0,005s e **nem conectam no
banco** — a checagem do cache roda ANTES de `conectar()`. É o que sustenta
centenas de acessos simultâneos.

- **Não cacheáveis, de propósito:** `dossie` (Meu SIAPE — pessoal, `no-store`;
  cache compartilhado entregaria o dossiê de um para outro), `atos`/`ato`
  (espaço de chave enorme e já rápidas), `health`.
- **Invalidação:** o `importar_v2.php` apaga `api/cache/*.json` ao fim de cada
  importação, então a atualização diária é imediata. TTL de 10 min
  (`cache_ttl()`) é a rede de segurança se o apagamento não rodar.
- Como `responder_json()` faz `exit`, a gravação é feita num
  `register_shutdown_function` sobre um `ob_start()` — só grava se o status for
  200. Cabeçalho `X-Cache: HIT|MISS` para conferir.
- A pasta `api/cache/` precisa ser gravável pelo PHP (ele a cria com `mkdir`; se
  o host barrar, `chmod 775`). Um `.htaccess Deny from all` é escrito nela.

## Painéis com tabela-fato + registro curado

Quatro abas ligam um ATO a uma entidade por uma tabela-fato preenchida no import
e no backfill, e a rota só lê o índice pronto (não casa texto ao vivo).

- **Busca por processo** (`/api/atos?processo=…`): casa por DÍGITOS na tabela
  `ato_processo`. O `ato.processo_sei` guarda só o primeiro número do texto; a
  tabela guarda todos (medido: a coluna única descartava 44% das menções).
  Backfill em `importar/backfill_ato_processo.php`.
- **Comissões** (`/api/comissoes`): os 26 colegiados PERMANENTES centrais da
  UFF (CPA, CPPD, CEUA, Governança…). A lista é **curada** em
  `comissoes_registro()` (index) + `comissoes_termos()`
  (`importar/comissoes_match.php`) — os dois nascem de
  `tools/registro_comissoes.py` e não devem divergir. A tabela `ato_comissao`
  liga corpo→ato por FRASE ESTRITA (ver a armadilha do FULLTEXT abaixo).
  Estender = uma linha nos três + rodar `backfill_ato_comissao.php`. É uma
  AMOSTRA curada, não o universo: a UFF constituiu 14 mil comissões em 25 anos,
  a maioria efêmera (banca, eleitoral, sindicância) — essas ficam de fora.
  **Um corpo pode ter VÁRIOS nomes históricos**, separados por `|` no `termos`
  do registro; casa se qualquer variante bater (o backfill vira `OR` de LIKE, e
  `comissoes_do_texto()` faz `explode('|')`). Foi assim que se descobriu que o
  CEP era grafado "em Pesquisa" (58 atos) e não "na Pesquisa" (7) — o termo
  errado escondia 44 atos —, e que "Comissão de Ética da UFF"/"Ética Pública" e
  "CGIRC"/"Comitê de Governança" são cada par um corpo só. Cada corpo carrega uma
  **classificação legal** (`obrig` ∈ `lei` | `controle` | vazio): obrigatória por
  lei, exigida por órgão de controle, ou nenhuma. É curadoria do mantenedor, não
  inferência do texto — a aba mostra o selo e filtra por ele. 7 por lei, 6 por
  controle, 13 sem.
  **Dois sinais ligam ato↔corpo** (`comissoes_do_texto` + `comissoes_do_orgao`,
  unidos no import e no backfill): (1) a **ementa** cita o colegiado — com a
  guarda de colegiado; (2) o **órgão emissor** É o colegiado, para o ato que ele
  ASSINA sem se nomear na ementa (a DECISÃO CGIRC nº 1/2025 "Aprovação do Plano de
  Enfrentamento ao Assédio" só se identifica pelo emissor — o CGIRC emite 13
  decisões e a ementa pegava 8). O 2º sinal casa o **nome canônico do órgão**
  (`orgao.nome`), **nunca a sigla**: `CPS`/`CEP`/`CPT` são siglas de DEPARTAMENTO
  cujos atos (designar professor, alocar vaga) casariam pela sigla — 97 falsos
  positivos —, mas o NOME do órgão deles não bate termo de comissão nenhum
  (medido em 925 órgãos: só o do CGIRC casa, daí sem guarda). Generaliza sozinho:
  colegiado curado como órgão na dimensão passa a ter os atos que assina ligados.
- **Políticas** (`/api/politicas`): o dossiê temático — o assunto e a sequência
  de atos que o construiu. Catálogo CURADO em `tools/gerar_seed_politicas.py`
  (fonte única; o `.sql` é gerado e o CI reprova edição à mão), 7 políticas no
  piloto. **O que a distingue é o `papel`**: o que o ato FAZ pela política —
  fundador, regulamentação, governança, execução, monitoramento. Designar
  comissão é GOVERNANÇA, não execução; sem isso, política com dez designações e
  nenhuma entrega pareceria a mais ativa de todas.
  **Dois sinais ligam ato↔política**, como nas comissões: (1) frase estrita na
  ementa (confiança alta); (2) o ÓRGÃO EMISSOR, quando a ementa não nomeia a
  política — "Fixa as diretrizes para execução do Programa Auxílio Alimentação"
  só se identifica pela PROAES, e **24 dos 37 atos de assistência estudantil
  entram só por aí**.
  Duas guardas medidas: o termo no NOME DO EMISSOR (`integridade` casava a
  cláusula de abertura do CGIRC e trazia o Plano Socioambiental, o Bem Viver e o
  relatório do PDI — exigir `plano/programa/política de integridade` tira os
  três) e a EMENTA INUTILIZÁVEL (15 dos 136: sem ementa formal, OCR espaçado,
  fragmento, rodapé — vão para curadoria, não recebem rótulo).
  **A categoria de cada política é o SUBTEMA do PDI da UFF**, não rótulo do
  portal (desde 04/08/2026). Os três rótulos anteriores — Direitos, Governança,
  Estudantes — não tinham âncora e nem respondiam à mesma pergunta (natureza do
  objeto × destinatário × função), e "Estudantes" era prateleira de um item só.
  O PDI 2023-2027 declara 5 eixos e, dentro deles, subtemas que nomeiam 5 das 7
  políticas quase literalmente. A lista agrupa por **eixo** e etiqueta por
  **subtema** — agrupar por subtema devolveria as prateleiras de um item.
  `pdi_base` diz de onde veio o encaixe e é o que impede a tela de afirmar
  demais: `nome` (o PDI o nomeia, sem marca na interface), `conteudo` (o subtema
  descreve o tema sem usar a palavra — o **assédio**, que o PDI não escreve em
  175 páginas mas cujo objeto está em "Equidade, Diversidade e Inclusão":
  protocolo para violência de gênero, denúncia de discriminação, CPEG/AFIDE) e
  `afinidade` (atribuição nossa — a **segurança da informação**, que o PDI não
  cobre em subtema nenhum). **Buscar o TERMO e concluir ausência do TEMA foi o
  erro que produziu o segundo caso** — a armadilha-mãe da METODOLOGIA-ODS
  aplicada ao documento em vez de ao ato. A âncora é DATADA: `pdi_versao` viaja
  junto, e trocar de PDI obriga a remedir. Migração:
  `backend/db/alterar_politica_pdi.sql` (roda UMA vez — o 5.7 não tem
  `ADD COLUMN IF NOT EXISTS`), depois o seed regerado.
  A interface mostra a etapa sem ato como **"sem evidência localizada no
  Boletim"**, nunca como omissão: o Boletim cobre o que foi publicado nele.
  Critério, limitações e o que ficou de fora em
  [`docs/METODOLOGIA-POLITICAS.md`](docs/METODOLOGIA-POLITICAS.md).
- **ODS** (`/api/ods`): liga o ato a uma das 17 ODS da Agenda 2030 pela tabela
  `ato_ods`. **Não é "17 baldes de atos" — é dossiê de evidência**: cada linha
  carrega um `vinculo` (`proposta` = ato fundador de política, o que rankings e
  controle pedem; `execucao` = staffing/operação; `pesquisa`; `ensino`), a `meta`
  THE/IPEA que a ancora e a `justificativa`. Sem essa separação o painel contaria
  1.368 "evidências" em vez das 191 propostas reais. `metodo='curadoria'` marca a
  linha revisada por humano e o backfill **nunca** a sobrescreve.
  **A classificação roda no IMPORT, desde 03/08/2026** (`importar/ods_match.php`,
  chamado pelo `importar_v2.php`): é determinística — os mesmos clusters
  auditados que geraram a carga original, aplicados ao dispositivo. Antes disso
  a `ato_ods` só era preenchida pelo backfill offline, e boletim novo entrava
  sem vínculo ODS nenhum até alguém rodar a carga à mão.
  **A curadoria humana é soberana:** o import apaga só o que é automático
  (`DELETE ... WHERE metodo <> 'curadoria'`) e o `INSERT IGNORE` respeita a
  UNIQUE `(ato_id, ods)` — linha revisada à mão nunca é sobrescrita.
  **Sem cluster, o ato NÃO recebe rótulo** — vira resíduo para curadoria. É de
  propósito: o painel é dossiê de evidência, e chute contamina. Falso-negativo
  se conserta com um padrão novo; falso-positivo estraga o dossiê inteiro.
  Regressão obrigatória: `php backend/importar/teste_ods_match.php` (roda no CI)
  — cada caso ali é uma isca que já esteve em produção.
  Para dar uma passada uniforme no acervo ANTIGO (importado antes de 03/08/2026,
  que carrega a carga original gerada em rodadas diferentes), use
  `importar/backfill_ato_ods_auto.php` — mesmo classificador, lendo o corpo do
  próprio banco, **em lotes com cursor** (`&desde=`), porque os ~69 mil atos
  normativos não cabem numa requisição. `&limpar=1` na primeira chamada troca a
  carga antiga inteira; a curadoria sobrevive a qualquer modo. O
  `backfill_ato_ods.php` (carga por JSON) segue existindo para reaplicar uma
  curadoria offline; a trilha de auditoria vive em `../backfill-ods/`.
  **Critério, âncoras e armadilhas medidas em [`docs/METODOLOGIA-ODS.md`](docs/METODOLOGIA-ODS.md)** —
  leia antes de mexer. A armadilha-mãe: o termo-ODS costuma estar no NOME de
  alguém (parceiro do convênio, área do concurso, cargo de quem recebe o ato,
  órgão emissor, unidade remanejada), não no dispositivo — 292 atos de pessoal
  entraram assim na primeira carga. Cruzamento com o Relatório ODS oficial da
  UFF em [`docs/CRUZAMENTO-RELATORIO-ODS-2024.md`](docs/CRUZAMENTO-RELATORIO-ODS-2024.md).

## "O que mudou": o feed sai de fato apurado, não de classificador novo

`/api/mudancas` + aba `#/mudancas`. Não tem tabela-fato própria e **não escreve
nada**: soma vínculos que outras abas já apuraram e conferiram — `ato_politica`
(política), `ato_comissao` (colegiado), `relacao` com tipo `Revoga`/`Altera`
(vigência) e `prazo` com data futura. Cada sinal já passou por medição própria; o
feed só os junta e ordena.

**A guarda central é por PRESENÇA de vínculo institucional, não por ausência de
vínculo pessoal.** Medido: 64% dos atos recentes são de efeito individual, e o
filtro óbvio — excluir quem cita SIAPE — vaza, porque só 30–70% dos atos
registram matrícula e "Designa os servidores &lt;nome&gt;" passaria batido. Exigir
laço apurado fecha isso; a regra negativa sozinha, não.

**Nenhum texto é gerado.** Cada item mostra a ementa do próprio ato. O projeto
previa resumo em linguagem simples revisado por humano; enquanto essa revisão não
existir, escrever prosa automática sobre atos que afetam pessoas seria inventar.
A relevância também nunca aparece como número: o que a interface mostra é o
MOTIVO nomeado (política X, colegiado Y, muda vigência), porque o número sozinho
pediria confiança que ele não tem.

Janela padrão de 180 dias, whitelist `[30, 90, 180, 365]` — a entrada nunca é
interpolada no SQL. A rota degrada com `indisponivel: true` se as tabelas do
núcleo analítico não existirem, em vez de dar 500.

## URL por aba (roteamento por hash)

Cada aba tem uma URL própria via **fragmento** (`#comissoes`, `#dossie`,
`#jornada`…), em `src/App.tsx`: `ABAS_VALIDAS` (o conjunto de chaves válidas) +
`abaDoHash()`, e dois efeitos que sincronizam nos dois sentidos (colar/
compartilhar o hash abre a aba; trocar de aba grava o hash, então o "voltar" do
navegador anda entre abas). **É hash de propósito, não caminho limpo:** o
fragmento não chega ao servidor, então funciona em qualquer subcaminho e
sobrevive à migração para o domínio da UFF sem reescrita de rota — caminho limpo
brigaria com o `base: './'` que mantém o bundle portável. A raiz sem hash cai na
aba padrão sem sujar a URL com `#planilha`. Aba nova = uma linha em
`ABAS_VALIDAS`.

## Ajuda contextual: o mapa é total sobre as abas

O `?` do cabeçalho abre a explicação da **aba aberta**: o que é, como usar, o que
não concluir. Conteúdo em `src/components/help/ajudaConteudo.tsx`, modal em
`AjudaModal.tsx`. É complementar à aba **Ajuda** (`HelpGuide.tsx`), que segue
sendo o guia para ler de ponta a ponta.

**Toda aba de `ABAS_VALIDAS` está numa de duas listas** — o mapa `AJUDA` ou a
lista `ABAS_SEM_AJUDA` (Ajuda, Privacidade e Sobre, que já SÃO a explicação) — e
`tools/test_redesign_integrity.mjs` exige essa cobertura total, sem interseção.
Aba nova entra num dos lados por decisão de quem a criou; sem a trava ela iria ao
ar sem explicação e ninguém notaria, porque o botão **some sozinho** quando a aba
não está no mapa (certo em produção, péssimo sem alguém conferindo).

Só descreva controle que EXISTE na tela. Ajuda que manda clicar num botão
inexistente é pior que ajuda nenhuma: ensina a desconfiar de todo o resto. Ao
mexer num painel, passe no `ajudaConteudo.tsx`.

O modal é um `<dialog>` aberto por `showModal()` — daí vêm armadilha de foco, Esc
e camada própria (sem disputa de z-index com o cabeçalho sticky). Abrir pelo
atributo `open` renderiza a mesma caixa **sem nada disso**, e parece funcionar; a
trava reprova. O `::backdrop` não herda da página, então o modo fotofobia tem
regra própria no `index.css`.

## Gráficos: a cor sai de token, nunca de classe

Os gráficos do Dashboard vivem em `src/components/dashboard/Graficos.tsx`
(`AreaPorAno`, `ComposicaoDoBoletim`, `OrgaosDoBoletim`). Quem decide a FAIXA da
série anual é o `Dashboard.tsx` — o gráfico só desenha o que recebe.

**O modo fotofobia age por seletor de CLASSE** (`[class*="bg-white"]` e afins), e
`fill`/`stroke` dentro de SVG não são alcançados por isso: gráfico pintado com
classe do Tailwind ou hex literal fica escuro sobre escuro no tema escuro, sem
erro nenhum no console. Por isso toda marca sai de custom property `--chart-*`
(definidas nos dois temas em `src/index.css`), e o
`tools/test_redesign_integrity.mjs` reprova hex literal em `fill`/`stroke`.

Uma matiz só, de propósito: as três séries medem UMA coisa (quantidade de atos)
ao longo de um eixo. A posição já codifica o valor — pintar cada barra de uma cor
codificaria nada e ainda criaria um problema de daltonismo para resolver.

Os dois painéis do boletim saem de `ultimoBoletim.atos`, que a home já recebe:
tipo, órgão e processo SEI vêm juntos. **Nenhuma chamada nova à API** — a trava
reprova `fetch`/`useEffect` nesse arquivo.

## Regras do domínio que já custaram retrabalho

O catálogo completo está em [`docs/GUIA-EXTRACAO-BS.md`](docs/GUIA-EXTRACAO-BS.md)
— a **linha do tempo do corpus** (o BS é vários formatos em sequência: o marcador
de fim de ato nasce em 2002 com cinco `#`, vira seis em 2004; o SIGAEx aparece em
2018; 2020 sai em Title Case), os números de cada armadilha, os erros que já
cometemos e as sugestões à equipe que produz o Boletim. As regras abaixo são o
resumo operacional.

- **CEP ≠ CEPEx.** CEP é o Comitê de Ética em Pesquisa (3 instâncias), órgão
  totalmente diferente do CEPEx. Nunca mesclar.
- **CIPA ≠ COPAMA.** A CIPA (Comissão Interna de Prevenção de Acidentes **e de
  Assédio**, nome atual pela Lei 14.457/2022 / NR-5) NÃO é a COPAMA (Comissão de
  Prevenção de Acidentes **e Meio Ambiente**), que é um colegiado LOCAL de unidade
  (a da EEIMVR aparece 4×). O termo do corpo `cipa` tem que ser
  `prevenção de acidentes e de assédio` — o `e de assédio` é o discriminador:
  `prevenção de acidentes` sozinho arrastava as 4 COPAMA. Medido: o acervo tem 1
  ato de CIPA de verdade (Faculdade de Medicina, 2026) contra 4 de COPAMA.
- **"AD REFERENDUM" é SÉRIE PRÓPRIA, não qualificador descartável.** O CEPEx
  numera as resoluções ad referendum à parte: a Resolução 010/2021 comum e a AD
  REFERENDUM 010/2021 **coexistem** (medido: a série comum de 2021 usa 6, 7,
  8… ao lado da ad referendum 001-066). Por isso "RESOLUÇÃO AD REFERENDUM" é
  TIPO próprio (entrada em `TIPOS` no extrator + linha na dimensão `tipo_ato`)
  — só trocar a sigla fundiria as duas séries na chave natural. Antes do fix, o
  `TITULO_RE` casava só "RESOLUÇÃO" e "AD REFERENDUM CEPEx" inteiro virava
  órgão, que o `norm_sigla()` reduzia a **"AD"**: REFERENDUM cai pelo filtro de
  comprimento (>8) e **CEPEx cai pelo `p == p.upper()`** — o x minúsculo de
  novo, terceira mordida da mesma armadilha. 68 atos com emissor errado em
  produção (66 "AD" + AD/CEPEX + AD/CAL; grafia caixa-alta sobrevivia ao filtro,
  CEPEx não). Conserto de dados: `backend/db/corrigir_ad_referendum.sql`.
  **Tipo novo exige 4 camadas em sincronia**: `TIPOS` (extrator), `TIPO_MAP`
  (gerar_dados_portal), `SIGLA_TIPO` (importar_v2, prefixo do uid) e a linha na
  dimensão `tipo_ato` — sem a última o importador IGNORA o ato ("tipo
  desconhecido"). Variante "DECISÃO AD REFERENDUM" aparece 1× no corpus como
  citação, nunca como título — no dia em que materializar, precisa do mesmo
  tratamento em 4 camadas.
- **Sigla de órgão NÃO é caixa alta.** "CEPEx" — a grafia real da UFF de ~2021 a
  meados de 2025 — tem um "x" minúsculo. Enquanto o `TITULO_RE` exigiu
  MAIÚSCULAS no nome do órgão, o título inteiro deixava de casar e a resolução
  virava corpo do ato anterior: **4.234 atos sumidos só em 2021-2024** (CEPEx
  2023 tinha 1 ato na base contra 1.488 depois do conserto). Corrigido em
  `42c504d` + backfill de 21/07/2026. Ao mexer nesse grupo do regex, use uma
  classe de caracteres única — a tentativa com alternância de grupos causou
  ReDoS real (>15s por boletim).
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
- **Ato com ano muito atrás do boletim é citação, não ato** (`citacao_recortada()`
  em `extrair_boletim.py`). Uma norma antiga citada no corpo vira "ato" quando o
  recorte a trata como cabeçalho. Medido nos 60 boletins de 2026 (3.250 atos):
  gap 0 = 3.042, gap 1 = 186 (dezembro publicado em janeiro, legítimo), gap 2 = 9,
  **gap ≥ 3 = 13 — todos fragmento/citação** ("que designou…", "considerando
  Processo…", "Art. 2º…", "resolve:", ementa vazia; a Portaria 1.335/2021 aparecia
  4x, recortada de boletins distintos que a citavam). A guarda exige gap ≥ 3
  **E** forma de fragmento (vazio, começa em minúscula, ou abre com
  que/considerando/resolve/a saber/Art). **O `_FRAGMENTO_INI_RE` NÃO pode ter
  `re.IGNORECASE`**: com ele a classe de minúsculas casaria maiúscula, a segunda
  condição viraria letra morta e a guarda degeneraria em "só o gap" — medido,
  passava a derrubar ato legítimo ("DESIGNAR os docentes…"). Regressão que
  fecha a decisão: 2026 perde 10 (todos lixo) e **2001 perde ZERO** — o boletim
  digitalizado publica backlog real de 1998-2000 e precisa continuar entrando.
  A classe de fragmento também cobre **pontuação órfã** (`)`, `]`, `•`, `●`, `▪`,
  `§`): recorte no meio de lista ou parágrafo, acrescentado em 21/07/2026 depois
  que 3 fantasmas escaparam por aí (medido em 27.536 atos de 2021-2024: derruba
  13, todos lixo; 2001 perde +0). **O alcance desta guarda é limitado por
  desenho:** ela só age com gap ≥ 3 anos, então não vê a duplicata por citação
  de gap curto — um boletim de 2022 citando resolução de 2021 passa inteiro.
  Esse é outro problema, tratado na seção de pendências.
- **O ANEXO repete o cabeçalho do ato — e come o ato real.** Um documento
  anexo publicado logo depois do ato que o institui (Plano de Desenvolvimento
  de Unidade, Manual de Atos) abre repetindo o título e, em seguida, a **folha
  de rosto** da UFF (a lista de dirigentes: Reitor, Vice-Reitor, Chefe de
  Gabinete, Pró-Reitorias, Superintendências). Esse bloco vira "ato" com a
  MESMA chave natural do ato real e o importador colapsa os dois — e quem
  sobra é o anexo. Medido: `res-cmb-1-2022` e `res-cmb-5-2025` estão em
  produção com a folha de rosto como ementa; a ementa verdadeira ("Apresenta o
  Plano de Desenvolvimento da Unidade…") não existe na base. Efeito colateral
  que revelou o defeito: a lista de dirigentes entra no índice de busca, então
  **todo ocupante de cargo de direção casa em busca por nome** nesses atos (um
  Superintendente aparecia "citado" num plano de unidade que nunca o
  mencionou). `descarta_anexo_de_folha_rosto()` corrige, com três condições
  cumulativas — irmão de mesma chave, o primeiro NÃO sendo folha de rosto, e
  este sendo (≥3 marcadores distintos nos primeiros 1200 chars). **Sem irmão
  não descarta**, e se o primeiro já for folha de rosto também não mexe: é
  indecidível, e a curadoria do CEPEx já provou que a cópia verdadeira nem
  sempre é a primeira. Medido em 2022+2025 (15.115 atos): remove 3, todos
  anexo; 2001+2005: remove ZERO. Regressão: `tools/teste_folha_rosto.py`.
  **Varredura do corpus inteiro (26 anos, ~4.900 boletins): 4 casos**, todos
  reprocessados e **corrigidos em produção em 29/07/2026** —
  `port-reitoria-47105-2012` (Plano Diretor de TIC), `res-cmb-1-2022` e
  `res-cmb-5-2025` (Planos de Desenvolvimento do Instituto Biomédico) e
  `in-gar-ret-26-2022` (Manual de Atos e Comunicações Oficiais). Conferido
  depois do import: `novos=0` (nenhuma duplicata) e a busca por "Manual de
  Atos e Comunicações Oficiais", que devolvia ZERO, passou a achar a IN — a
  ementa real simplesmente não existia na base. Ferramentas:
  `tools/varrer_folha_rosto.py` (acha) e `tools/reprocessar_boletins.py`
  (gera o portal-data.json dos boletins afetados, para o importador
  idempotente atualizar ementa **e** texto de busca).
- **Um ato não se referencia.** O `destino_norm` descarta o ano
  (`portariano32720`), então quando o texto cita o próprio número — típico de
  **retificação**, que republica sob o número do ato retificado — o índice
  casa de volta na origem. Media 650 auto-referências (2,1% das relações),
  visíveis na ficha como "Complementa: Portaria nº 37.059" na página da
  própria Portaria 37.059. `resolver_relacoes_v2.php` barra por
  `destino_ato_id == ato_id`; é seguro porque não existe caso legítimo, e o
  `destino_texto` continua gravado (a citação não se perde, só deixa de virar
  aresta falsa). O contador sai no log como "auto-referência barrada: N" —
  guarda silenciosa é guarda que ninguém confere.
  **O estrago não era cosmético: era a VIGÊNCIA.** Aplicado em produção
  (29/07/2026), o resolvedor reverteu **515 atos para Ativo** — revogados
  1.241→1.132 e alterados 2.399→1.993. Eles constavam como revogados/alterados
  porque "revogavam a si mesmos", e o cálculo de vigência lia a auto-aresta
  como revogação real. Ou seja, o portal afirmava que 515 normas não valiam
  mais, quando valem — num portal de normas, o pior erro possível. Caso-prova:
  `port-reitoria-37059-2007`, cuja única relação apontava para ele mesmo;
  hoje a citação segue registrada com `destino_ato_id` nulo e o status
  "Revogado" vem de quem de fato o revogou (`ns-uff-659-2017`).
- **Hífen na busca: vira ESPAÇO, nunca vazio.** O FULLTEXT trata `-` como
  separador (`Vice-Reitor` está indexado como `vice`+`reitor`), então apagar o
  caractere colava as metades num token inexistente. Medido antes do fix:
  `Vice-Reitor` = 1 resultado contra 427 de `Vice Reitor`; `pós-graduação` = 3
  contra 4.449. A grafia CERTA em português era a que não achava nada. Vale
  para os travessões Unicode também, e a correção tem que entrar nos três
  lugares que precisam concordar (`booleanize()` no PHP, `buscaCasa()` no
  dataSource.ts, `busca_casa()` no mock).
- **Collation do MySQL ≠ dedup do Python.** `DECISOES` == `DECISÕES` e
  `'001'` == `'01'` == `'1'` para o MySQL. Qualquer ETL precisa considerar isso.
- **FULLTEXT tokeniza; para casar FRASE use LIKE.** O índice `texto_busca`
  quebra em palavras: buscar "segurança da informação" nele casa "informação" em
  qualquer contexto ("Currículo de Engenharia da Informação"). Medido: o termo do
  Comitê de Segurança da Informação dava 83 resultados no FULLTEXT (a maioria
  falso positivo) contra 15 reais no LIKE de frase estrita. E o número de
  processo `23069.154690` vira os tokens `23069`+`154690`, e `23069` é prefixo de
  TODO processo da UFF. Regra: **ligação corpo↔ato precisa/curada = frase estrita
  (LIKE numa tabela-fato), não FULLTEXT.** FULLTEXT serve para busca livre do
  usuário (relevância), não para casamento determinístico. `utf8mb4_unicode_ci`
  já ignora acento e caixa no LIKE — não precisa normalizar o termo.
- **É Percona 5.7, não MySQL 8.** SQL de manutenção não pode usar
  `REGEXP_SUBSTR`/`REGEXP_REPLACE`/CTE recursiva/janela. Quando precisar extrair
  N ocorrências de um padrão de um TEXT, faça em PHP (loop + `preg_match_all`),
  como `backfill_ato_processo.php`. Confirme a versão em `/api/health`.
- **Pergunta sobre o banco se responde CONTANDO NO BANCO.** Custou o dia
  21/07/2026: três medições erradas seguidas, todas por medir um proxy no lugar
  da coisa perguntada. (1) `curl | python` no Windows lê stdin como `cp1252` e
  mastiga todo acento — fabricou "mojibake em 100% do corpus" que não existia;
  leia JSON de ARQUIVO com `io.open(..., encoding='utf-8')`. (2) A rota de
  listagem não devolve o boletim de origem; ler esse campo vazio e concluir
  "nenhum veio do backfill" é ausência de dado, não evidência — use
  `/api/atos/{uid}`, que traz a ficha completa. (3) Cópias no JSON de extração
  **não são** linhas no banco: a chave natural do importador inclui o boletim,
  então N citações dentro do MESMO boletim colapsam em uma linha (erro de 1.126
  contra 98 reais). Regra prática: antes de afirmar quanto mudou em produção,
  pagine a API e conte, ou compare contra o dump em `dados/dumps/`.
- **A API recusa user-agent de script.** `urllib` sem header devolve **406** (o
  mod_security da HostGator); `curl` passa. Mande
  `{'User-Agent': 'curl/8.0'}` em qualquer coleta por Python, ou você vai
  interpretar bloqueio como "ato não existe".
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

- **A data da capa do boletim não é confiável, e ela envenena a data dos
  atos.** Seis boletins de março/2017 (050 a 056) usaram um modelo de 2007 que
  ninguém atualizou: capa `23/03/2007`, cabeçalho interno `23/03/2017`. Como a
  data do boletim é a âncora de `corrige_ano_futuro`, 212 atos legítimos de
  2017 foram reescritos 10 anos para trás. `metadados_bs` agora reconcilia **só
  o ano**, e só quando **duas testemunhas** concordam: o cabeçalho das páginas
  internas e o nome do arquivo. Não relaxe para "o interno ganha": o interno é
  OCR de digitalização e sozinho é pior que a capa — o acervo tem `24/80/2005`,
  `00/00/2003` e um `021-2013.pdf` cujo interno diz 2012 e puxaria o ano para
  trás. Regressão: `tools/teste_data_boletim.py` (24 casos, inclui os 8 que
  devem mudar e os 8 que não podem). Correção do que já entrou na base:
  `backend/importar/corrigir_anos_bs2017.sql`.

- **O ano do NOME do arquivo também erra — e o estrago é duplicata.** O nome é
  a identidade do boletim (`importar_v2.php`, `boletim_id()`), mas quem digita
  erra: um `21-16.pdf` que era `21-25.pdf` já foi importado e exigiu limpeza
  manual. Renomear depois **não** desfaz: como a chave natural do importador
  inclui o ano, a importação seguinte cria os atos de novo e os antigos ficam
  como duplicata. Rode `tools/conferir_nome_boletim.py <pasta>` **antes** de
  importar (sai 1 se suspeito). O sinal é o inverso do defeito da capa: capa e
  interno concordam entre si e discordam do nome.

## Pendências

- **Núcleo de inteligência institucional: os cinco módulos foram atacados; TRÊS
  têm tela no ar, e DOIS foram reprojetados depois de medidos.**
  `backend/db/inteligencia_institucional.sql` (doze tabelas) **foi aplicado em
  03/08/2026** e verificado com `backend/db/verificar_inteligencia.sql`.
  Estado por módulo, em 04/08/2026 (`api_versao 2026-08-04.3`):
  - **4.2 Políticas — NO AR.** `/api/politicas` + `#/institucional/politicas`,
    desde 03/08. 7 políticas, 93 vínculos, catálogo publicado em 04/08.
  - **4.3 Comissões — NO AR.** O Observatório (estado documental, janela,
    mandato) subiu em 03/08 sobre a aba que já existia.
  - **4.10 Mudanças — NO AR.** `/api/mudancas` + `#/mudancas`, desde 04/08. Ver
    a seção própria acima; conferido em produção devolvendo 80 itens.
  - **4.1 Radar de Obrigações — REPROJETADO.** O desenho original não se
    sustentou na medição (ver o parágrafo adiante). O que ficou no lugar é um
    **registro curado de 12 obrigações**, cada uma conferida em fonte oficial em
    04/08/2026, gerada por `tools/registro_obrigacoes_legais.py` →
    `backend/db/seed_obrigacao_legal.sql`. A obrigação vem da NORMA, não do ato
    da UFF (`ato_origem_id` NULL de propósito): a CPA não deve relatório porque
    uma portaria mandou — deve porque a Lei 10.861/2004 instituiu o SINAES.
    **Ainda não tem rota nem aba** — a tabela tem dado e nenhum consumidor.
  - **4.4 Indicador — REPROJETADO.** A nota do projeto foi simulada sobre os
    dados reais e reprovada (cinco das sete políticas empatavam). No lugar
    entrou a **série histórica de etapas**: `politica_indicador`, escrita a
    cada import por `importar/indicador_politica.php`, e exibida no dossiê da
    política. **A tabela só se enche na PRIMEIRA importação depois do deploy** —
    até lá o painel não mostra etapa nenhuma, e isso não é defeito.
  Seguem vazias e **sem consumidor**: `politica_evento`, `obrigacao_evidencia`,
  `evidencia_fato`, `comissao_evento`, `comissao_membro_evento` e
  `mudanca_relevante` — esta última porque o feed de Mudanças soma fato já
  apurado em vez de materializar linha própria.
  A verificação tem 14 blocos; os de 3 a 9 são as travas de publicação
  (evidência órfã, item público sem trecho, indicador fora da faixa, curadoria
  preservada). **Rode-a pela aba SQL do phpMyAdmin, nunca pela Importar** — ver
  a lição no skill de deploy. A regressão estática do schema roda no CI:
  `node tools/teste_schema_inteligencia.mjs`. Racional das decisões em
  `docs/ARQUITETURA-BASE-DADOS.md` §3.6 — em especial por que `comissao` é
  chaveada pelo slug, e por que **não** há FK de `obrigacao` para `prazo` (o
  importador recicla `prazo.id` a cada import).
  **Os catálogos foram semeados em 03/08/2026** e conferidos em produção:
  `comissao` 26, `politica` 7, `politica_alias` 40, `ato_politica` 93; as demais
  seguem vazias. Os seeds são `backend/db/seed_comissao.sql` (de
  `tools/registro_comissoes.py`) e `backend/db/seed_politica.sql` (de
  `tools/gerar_seed_politicas.py`) — os dois saem de gerador, e editar o `.sql`
  à mão reprova no CI.
  O bloco 7 da verificação foi de `0/26/0` para **`26/0/0`**. O zero do meio é a
  prova de que os slugs do catálogo são os mesmos que a `ato_comissao` usa: as
  três projeções do registro curado concordam. O terceiro zero diz que **nenhum
  dos 26 corpos é letra morta** — todos têm ao menos um ato no acervo.
  **Como o catálogo de políticas foi montado** (medições em
  `tools/analisar_politicas.py`, reproduzíveis): a semente são os atos com
  `ato_ods.vinculo='proposta'` — 243 linhas em 136 atos. Três achados que valem
  para qualquer módulo novo:
  (a) `integridade` solto casa o NOME DO EMISSOR — o CGIRC abre seus atos com
  "O COMITÊ DE GOVERNANÇA, INTEGRIDADE, RISCOS E CONTROLES", e levava junto o
  Plano Socioambiental, o Bem Viver e o relatório do PDI; exigir o dispositivo
  (`plano/programa/política de integridade`) tira os quatro. É a armadilha-mãe
  da METODOLOGIA-ODS outra vez.
  (b) a assistência estudantil **não se anuncia na ementa** — quem a identifica
  é o emissor, a PROAES; 24 dos 37 atos entram só por esse sinal, mesma lição
  do `comissoes_do_orgao`.
  (c) 15 atos têm ementa inutilizável (sem ementa formal, fragmento, rodapé, ou
  OCR que espaça letra a letra) e vão para curadoria, não para o catálogo.
  Assédio não veio da camada ODS (tinha 1 ato lá): veio de varredura da ementa
  no acervo inteiro — 16 atos, 1 central (Plano do CGIRC, 2025) e 10 comissões
  LOCAIS de unidade entre 2018 e 2026. As 4 sindicâncias ficam de fora por
  efeito individual. PGD não entrou: os únicos atos eram flexibilização de
  jornada de 2016/2018, território que a aba Jornada já cobre.
  Fora do seed, em `../dados/curadoria_politicas.csv`: 48 sem cluster, 10 de
  duplicata de acervo, 4 de efeito individual.
  **As sete estão `status_curadoria='publicada'` desde 04/08/2026** — o selo
  "catálogo em revisão" saiu dos cartões. O que NÃO saiu, e não deve sair, é o
  selo por vínculo: `⚠ confiança media` continua marcando o ato que entrou pelo
  ÓRGÃO EMISSOR sem a frase na ementa (os 24 da PROAES). Publicar o catálogo
  afirma que a lista de políticas foi conferida; não afirma que cada vínculo
  individual foi.
  Metodologia completa em [`docs/METODOLOGIA-POLITICAS.md`](docs/METODOLOGIA-POLITICAS.md),
  incluindo a limitação que sobrou: duas políticas não têm ato fundador
  localizado no acervo (o de `acessibilidade` era uma cartilha e foi corrigido).
  **O Radar de Obrigações (4.1) foi MEDIDO e o desenho original não se
  sustenta** — `python tools/medir_obrigacoes.py` reproduz. O `deverá` do corpus
  é texto de EDITAL e de REGIMENTO dirigido a uma PESSOA: no top 45 de sujeitos
  do modal, 556 ocorrências são pessoa (candidato, aluno, interessado), 781 são
  documento ou procedimento (inscrição, recurso, chapa) e **19 são órgão**.
  Obrigação de candidato não tem responsável institucional, não gera evidência
  posterior de cumprimento e não interessa a controle. Os padrões
  institucionais do §6 do projeto somam 253 atos (1,2%), e mesmo esses são, um
  a um, procedimento recorrente ("o colegiado se reunirá anualmente") ou o ato
  SENDO a entrega ("divulgar o resultado do programa de gestão"), não obrigação
  de entregar. Varrer o acervo produziria painel de ruído — e ruído contamina o
  dossiê, mesma lição da METODOLOGIA-ODS. O caminho que sobra é o inverso:
  procurar obrigação DENTRO das políticas e comissões já catalogadas, onde o
  universo é pequeno e o responsável é conhecido. **Pré-requisito para medir
  isso: a API expõe ementa, não corpo** (`ficha()` não devolve
  `ato_texto.texto_original`), e o extrato local não cobre os atos do catálogo
  (0 de 136 casam por uid).
  Se e quando o detector for escrito, ele **tem que chamar `extrair_prazos()`**
  para resolver data:
  aquela lógica já tem três espelhos que precisam concordar, e um quarto seria
  dois códigos discordando sobre a mesma cláusula.

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

- Curadoria fina de órgãos: identificar o CEP no corpus; ~35 nomes com sigla
  embutida entre parênteses.
- **Ementa pobre nas resoluções ad referendum ("1.").** O formato abre com
  lista numerada de considerandos ("1. Considerando o constante do processo…")
  e o extrator de ementa captura o "1." como ementa. Afeta as ~68 resoluções ad
  referendum do CEPEx (o emissor delas já foi consertado — ver a regra AD
  REFERENDUM). O conserto é no `extrai_ementa()`: pular lista de considerandos
  numerados e cair no resumo do dispositivo — precisa de medição própria antes.
- **Anos impossíveis / fantasmas de citação (limpos em produção; falta a guarda
  no extrator).** SQLs de correção:
  `corrigir_anos_impossiveis.sql` (DUPLICATA de ano typado — Resolução 02/**1014**
  = 02/2014, o boletim 134-2014 tem o typo; e o FANTASMA do anexo SIORG da
  Portaria 57.716/2017 — "Criado em: DECISÃO Nº 41/2010" virou "Decisão 41/1771"),
  `corrigir_fantasmas_citacao.sql` (5 fantasmas de citação: refs ABNT e normas
  federais citadas em boletins de 2006-2022 — IN SEDAP 205/1988, Port. SVS/MS
  29/98, NS 504/00 do NEDIN, etc.),
  `corrigir_ano_gqo.sql` (DTS GQO 003/004 com ano lido como 2000 em vez de 2007).
  **Auditoria completa dos ~100 atos com `ano < 2001` do boletim de 2001 (19/07/2026):**
  45 backlog legítimo (nada fazer), 26 com ano mal lido pelo OCR (DTS-TEC de 1998→2001,
  etc. — corrigidos em `corrigir_anos_boletim2001.sql`), e 29 deixados para revisão
  humana (7 ambíguos com múltiplos candidatos, 22 sem-match por OCR não acurado).
  Metodologia: puxadas fichas da API, baixados 19 PDFs dos boletins, extraído texto,
  casamento numero+sigla via regex e curadoria manual. O discriminador que resolveu:
  **ano-do-ato comparado com ano-do-boletim via linkBoletim**.
  **Estado (21/07/2026): os 4 SQLs rodaram em produção e estão conferidos** — os
  fantasmas respondem 404, o GQO está em 2007, e os 26 do boletim 2001 têm
  `ano=2001` com os uids novos (os antigos dão 404). Restam **76 atos com
  `ano < 2001`**: 45 são backlog legítimo (o boletim de 2001, digitalizado,
  publica atos de 1998-2000 de verdade) e o resto é o resíduo que a auditoria
  deixou para revisão humana. Verificado que nenhum deles veio do backfill de
  2021-2024 — todos já constavam do dump de 14/07.
  No EXTRATOR, `citacao_recortada()` já cobre (b) e (c) — não cria ato a partir de
  citação/anexo (regressão: 2026 perde 10 fragmentos, 2001 perde zero). **Falta
  ainda:** (a) guarda de ano plausível contra o ano do boletim para o caso PASSADO
  (o `corrige_ano_futuro()` só trata ano futuro e ano não-4-dígitos); (d) ano de 5
  dígitos (OCR "20007" vira 2000 porque `TITULO_RE` casa `\d{4}` e larga o 5º
  dígito — mexer aqui é mexer no regex mais sensível do extrator, exige medição
  própria); (e) revisar o parse de ano no boletim 2001.
- **Nomes de instituição com fragmento de boilerplate na aba Cooperação.** 19
  dos 1.467 acordos trazem no campo Instituição uma sobra de frase em vez do
  nome ("ser desenvolvido no Instituto de Ciências Humanas…", "através do Núcleo
  de Estudos…", "apoio à operacionalização…"). São ementas em que `coop_instituicao()`
  ancora no `entre` errado. O caso mais numeroso — "que **entre** si celebram a X"
  (15 ocorrências) — já foi corrigido; sobra a cauda difusa, que precisa de
  medição própria antes de mexer no âncora. Sintoma de triagem: nome de
  instituição **começando em minúscula** é quase sempre fragmento.
- **19 acordos com mojibake real** (dupla codificação: `Ã`+símbolo no lugar do
  acento), espalhados por 2004, 2016, 2018, 2020 e 2022-2026. Pré-existente, não
  veio do backfill. Nunca diagnostique isto por `curl | python` no Windows: o
  `sys.stdin.encoding` é `cp1252` e mastiga TODO acento na leitura, fabricando
  um falso positivo de 100% do corpus. Leia o JSON de arquivo com
  `io.open(..., encoding='utf-8')`.
- **Duplicata por citação — limpa no CEPEx 2021-2024, viva no resto do corpus.**
  Uma citação bem formatada de uma resolução anterior ("conforme a RESOLUÇÃO
  CEPEX/UFF Nº 394, DE 15 DE SETEMBRO DE 2021.") dentro de um documento posterior
  vira "título" e duplica o ato original com outro boletim de origem. Já
  acontecia no `TITULO_RE` original — não é regressão do fix do CEPEx.
  **Limpeza de 21/07/2026:** 98 cópias em 49 grupos, apagadas por SQL depois de
  curadoria; o CEPEx 2021-2024 foi de 2,4% para 0,0% de duplicata (4.071 atos).
  Sobraram 2 casos que exigem abrir o PDF: `res-cepex-1797-2023-4` ("Designa a
  Comissão Especial…" — pode ser artigo da própria 1797 ou resolução distinta) e
  o par `res-cepex-250-2021` / `-2`, que trazem **cursos diferentes** (Ciências e
  Ciências Contábeis) sob o mesmo número.
  **Três regras automáticas foram testadas e reprovadas — não repita:** (a) ano
  do boletim não serve, há grupo com as 5 cópias do mesmo ano; (b) forma de
  fragmento resolve só 7 dos 49 grupos; (c) verbo dispositivo deixa 36 grupos com
  dois candidatos. Pior, **em 2 grupos a cópia verdadeira não era a base**
  (`2935/2024` e `838/2022`: a citação ficou com o uid sem sufixo e o ato real com
  o `-2`), então um "mantém a primeira" apagaria o ato certo. O que funcionou foi
  ler as 63 ementas uma a uma. Método e decisões em
  `../DUPLICATAS-CEPEX-2021-2024.md` e `../PARTE2-CEPEX-CURADORIA.md`.
  **O defeito segue no extrator** para os outros órgãos e anos. A heurística que
  falta continua sendo a mesma: descartar título cujo `numero+ano` já existe
  capturado num boletim ANTERIOR — mas agora se sabe que ela precisa decidir
  **qual** cópia fica, e que a mais antiga nem sempre é a certa.
- Fase B: re-extração dos PDFs em caixa natural (habilitada pela PK estável).
- Cutover para o domínio oficial da UFF — runbook pronto em
  [`docs/MIGRACAO-UFF.md`](docs/MIGRACAO-UFF.md) (o frontend já é portável, `/api`
  relativo; o `db.php` já tem polyfill de PHP 7.4). Verificação do banco novo:
  `backend/db/verificar_migracao.sql`.
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
