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
na mesma janela** — e bump em `api_versao()` no `index_v2.php`. Subir só um dos
dois quebra o painel afetado.

**Deploy só está pronto quando `bash tools/smoke_test.sh` passa** (valida
health/versão da API, rotas principais, o roteamento `/api/atos/{id}` e que o
`config.php` segue bloqueado). `GET /api/health` devolve a versão rodando.

`backend/api/config.php` mora só no servidor (está no `.gitignore` e contém as
credenciais do banco). Não versione, não imprima o conteúdo.

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
  chave). Setor saiu se QUALQUER portaria do grupo foi revogada: a revogação
  mira o ato ORIGINAL, não a manutenção mais nova.
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

## Regras do domínio que já custaram retrabalho

O catálogo completo está em [`docs/GUIA-EXTRACAO-BS.md`](docs/GUIA-EXTRACAO-BS.md)
— a **linha do tempo do corpus** (o BS é vários formatos em sequência: o marcador
de fim de ato nasce em 2002 com cinco `#`, vira seis em 2004; o SIGAEx aparece em
2018; 2020 sai em Title Case), os números de cada armadilha, os erros que já
cometemos e as sugestões à equipe que produz o Boletim. As regras abaixo são o
resumo operacional.

- **CEP ≠ CEPEx.** CEP é o Comitê de Ética em Pesquisa (3 instâncias), órgão
  totalmente diferente do CEPEx. Nunca mesclar.
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
  **Estado (20/07/2026):** os 3 primeiros SQLs já rodaram em produção (conferido:
  os fantasmas respondem 404 e o GQO está em 2007). O
  `corrigir_anos_boletim2001.sql` (26 correções) **ainda não foi executado** — a
  produção segue com 100 atos de `ano < 2001`, dos quais 45 são backlog legítimo.
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
- **Duplicata por citação (pré-existente, mais ampla que o item acima).** Uma
  citação bem formatada de uma resolução anterior ("conforme a RESOLUÇÃO
  CEPEX/UFF Nº 394, DE 15 DE SETEMBRO DE 2021.") dentro de um documento
  posterior pode virar "título" e duplicar o ato original com outro boletim
  de origem. Confirmado que já acontecia no `TITULO_RE` original (não é
  regressão do fix acima) — medido ~240-277 casos/ano só na amostra
  2021-2024. Não tratado; precisa de heurística própria (ex.: descartar
  título cujo `numero+ano` já existe capturado num boletim ANTERIOR).
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
