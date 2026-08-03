# Metodologia — Atos da UFF × ODS

> **Rascunho para revisão** (jul/2026). Define o critério para classificar os atos
> normativos da UFF nas 17 ODS de forma **auditável e defensável diante de órgão de
> controle**. Não é posição institucional da UFF. É a metodologia por trás da aba
> **`#ods`** do portal e da tabela `ato_ods`; a carga vive em `../../backfill-ods/`.

## 1. Enquadramento: dossiê de evidência, não 17 baldes

O objetivo **não** é rotular todo o acervo. É montar, para cada ODS, a **trilha de
evidência** dos atos normativos que a comprovam — o mesmo formato que rankings
internacionais e o controle pedem. Consequências de desenho:

- A maioria dos atos **não entra** (nomeação, aposentadoria, concurso, doação, diária).
  Medido no protótipo: só ~8% do fluxo normativo cego é proposta ODS real.
- A distribuição **é desigual e isso é honesto**: governança (16), inclusão (10),
  trabalho/saúde do servidor (8/3), educação (4) e sustentabilidade (12/13) concentram;
  ODS 6, 7, 11, 15 quase não aparecem, e 2/13/14 entram sobretudo por **pesquisa**.
  Forçar equilíbrio seria fabricar evidência — e é o primeiro alvo do controle.

## 2. Âncoras oficiais (para não ser arbitrário)

Nenhum critério aqui é inventado. Cada ODS é ancorado em duas referências que o
controle (TCU/CGU) e os rankings reconhecem:

### 2.1 THE Impact Rankings — metodologia vigente
[Methodology 2025](https://www.timeshighereducation.com/world-university-rankings/impact-rankings-2025-methodology)
· [PDF](https://the-ranking.s3.eu-west-1.amazonaws.com/IMPACT/IMPACT2025/THE.ImpactRankings.METHODOLOGY.2025.pdf)

O THE pontua cada universidade em cada ODS por **três tipos de métrica**:

1. **Bibliométrica** — produção de pesquisa por ODS.
2. **Contínua** — números normalizados pelo tamanho (ex.: nº de formandos em área de saúde).
3. **Policy & initiative** — a universidade **submete evidência documentada** de
   políticas, programas e medidas; ganha crédito pela evidência **e crédito extra por
   ela ser pública**; *"a evidência não precisa ser exaustiva — busca-se exemplos que
   demonstrem boa prática"*.

**É o tipo 3 que os atos da UFF alimentam diretamente.** As métricas de política têm
código e rótulo próprios; exemplos confirmados na metodologia (usados aqui como âncora
de "o que conta"):

| Código THE | Métrica de política | ODS |
|---|---|---|
| 10.6.4 | *Have an anti-discrimination policy* | 10 |
| 10.6.11 | *Have an anti-harassment policy* | 10/5/16 |
| 3.3.5 / 3.3.7 | *Mental health support (students / staff)* | 3 |
| 15.2.5 | *Sustainable management of land for agriculture* | 15 |
| 2.x | *Access to food / food banks para estudantes e staff* | 2 |
| 16.x | *Published governance / anti-corruption policies; academic freedom* | 16 |
| 17.x | *Cross-sector & international collaboration; publication of SDG reports* | 17 |

> Ao industrializar, **fixe os códigos exatos da versão do THE vigente** naquele ciclo
> (a metodologia muda de ano a ano) — este documento cita a de 2025.

### 2.2 IPEA / ODS-Brasil — metas nacionais adequadas
[Metas nacionais dos ODS: proposta de adequação](https://repositorio.ipea.gov.br/entities/book/80bd7091-c7cb-4a7d-9ec4-15cc271f4494)
· [Cadernos ODS](https://www.ipea.gov.br/ods/publicacoes.html)

O IPEA adequou as 169 metas globais à realidade brasileira, por encargo da Comissão
Nacional dos ODS. É a régua **nacional** — a que um órgão de controle federal usa. Cada
ODS abaixo aponta a meta nacional pertinente a uma universidade federal (ex.: 4.3/4.5
acesso e permanência; 5.1/5.2 discriminação e violência de gênero; 16.5/16.6 corrupção e
instituições eficazes; 8.8 segurança no trabalho).

**Regra de ouro:** um ato só entra num ODS se casar com **uma meta nomeável** (THE
e/ou IPEA). "Tem a ver com o tema" não basta — a justificativa tem que citar a meta.

## 3. Taxonomia do vínculo (o pulo do gato)

Cada ligação ato↔ODS recebe um **tipo de vínculo**. É a distinção que nenhum casamento
por palavra-chave faz, e a que separa evidência real de ruído:

| Vínculo | O que é | Vale para o THE como… | Exemplo |
|---|---|---|---|
| **proposta** | ato **fundador** de política/programa/plano/estrutura | policy & initiative (o alvo) | Decisão CGIRC que *institui* o Programa Bem Viver |
| **execução** | **staffing/operação** de política já existente | contexto, não evidência nova | *designa membros* da Comissão de Ações Afirmativas |
| **pesquisa** | ato que **cria/viabiliza** pesquisa ODS-relevante | métrica bibliométrica/pesquisa | *aprova o projeto* "Mudanças Climáticas e Trabalho Decente" |
| **ensino** | **oferta acadêmica** sobre tema-ODS (curso/disciplina/currículo) | métricas de *educational programmes on X* | *cria o Curso* de Engenharia de Recursos Hídricos |
| **nenhuma** | sem meta nomeável | — | *declara vago* o cargo de Técnico em Segurança do Trabalho |

Por que importa: no protótipo com corpo, de 210 atos, **43 eram proposta, 12 pesquisa e
103 execução** — quase metade das ligações é staffing. Um painel que contasse tudo como
"evidência" inflaria a ODS 10 em 3× e enganaria o controle. A categoria **pesquisa** é
o único jeito de as ODS "vazias" (13, 14) ganharem evidência honesta. E **ensino** foi
imposto pela varredura do corpus completo: curso *sobre* recursos hídricos não é política
hídrica da instituição — era a maior fonte de falsa "proposta" nas ODS raras (6, 7, 13),
mas é evidência legítima na métrica educacional do THE, então ganha vínculo próprio em
vez de ser descartado.

### O caso decisivo: instrumento individual não é proposta

A aplicação que mais mexeu nos números: **um convênio não é uma política**. Ratificar o
acordo com a Universidade X é a UFF *executar* a política de cooperação que já tem — não
propor uma nova. Na primeira carga, os 671 instrumentos individuais entraram como
`proposta`, e a **ODS 17 sozinha respondia por 68% de todas as propostas do dossiê**
(388 de 568). Nenhum avaliador leria isso como evidência séria.

Separando **política** (o ato que institui o regime — ex.: *"Regulamenta o regime de
cotutela"*, Res. 133/2013; *"Cria o Comitê da Assessoria para Assuntos Internacionais"*,
NS 592/2007) de **instrumento** (cada acordo firmado), o total de propostas caiu de
**568 para 205** e o perfil virou o de uma federal brasileira de verdade:

| ODS | propostas | ODS | propostas |
|---|---|---|---|
| 10 Desigualdades | 49 | 3 Saúde | 10 |
| 4 Educação | 35 | 2 Fome | 9 |
| 16 Instituições | 34 | 13 Clima | 4 |
| 8 Trabalho | 19 | **17 Parcerias** | **3** |
| 5 Gênero | 15 | 15 Vida terrestre / 9 Inovação | 3 / 2 |
| 1 Pobreza / 12 Consumo | 11 | 6, 7, 11, 14 | 0 |

A ODS 17 não perdeu evidência — ganhou precisão: **770 execuções** ("a UFF firmou 770
instrumentos de cooperação") é um número forte e verdadeiro, no rótulo certo.

**Guarda de implementação:** o cluster de política de cooperação só vale se o sinal
estiver na **ementa**, não no corpo — o clausulado de qualquer convênio diz
"regulamenta a cooperação", e isso promovia instrumentos individuais de volta a
proposta (2 falsos-positivos medidos).

## 4. O pipeline de classificação

```
133k atos
  │  (A) RECORTE — corta ~96% (medido no corpus completo)
  ▼
tipos normativos (Resolução, Decisão, IN, Norma de Serviço,
Portaria normativa) ∩ verbo dispositivo no corpo
(institui | dispõe | estabelece | regulamenta | aprova a política/o
 programa/o plano | cria)  →  2.819 candidatos
 (varredura de 22/07/2026 sobre 68.843 atos normativos únicos:
  901 proposta · 31 pesquisa · 326 ensino · 1.561 execução)
  │  (B) LER O DISPOSITIVO — não a ementa
  ▼
para cada candidato: ler o CORPO (texto_original), do marcador
"RESOLVE:/DECIDE:" até o fim do Art. 1º-2º
  │  + GUARDA DE COERÊNCIA corpo↔ementa (ver §5)
  ▼
  (C) IA classifica: ODS[] + vínculo + confiança + justificativa
      (a justificativa cita a meta THE/IPEA e o trecho)
  │  (D) CURADORIA humana no borderline e no ODS 4
  ▼
  (E) grava em tabela-fato `ato_ods`  →  API lê o índice  →  aba #ods
```

### Por que ler o corpo, e não a ementa
A ementa engana — medido no lote de 210, o corpo **mudou o veredito em 25 atos (~12%)**:
- **Rejeitou 19/19 iscas de palavra-chave** que a ementa/área aceitaria: *"declara vago
  o cargo de Engenheiro de **Segurança do Trabalho**"* (cargo, não ODS 8); *"torna sem
  efeito nomeação em **vagas reservadas a negros/PcD**"* (nomeação anulada, não ODS 10);
  *"nomeia Superintendente de Comunicação **Social**"* (isca "nome social");
  *"ratifica convênio de estágio com Instituto Biasse **Socioambiental**"* (o nome do
  parceiro, não política ambiental).
- **Corrigiu ementas truncadas/erradas do OCR:** ementa "Plano de Desenvolvimento do
  Instituto Biomédico" cujo corpo é regulamento de estágio de biblioteconomia (→ ODS 4).

### Esquema mínimo da tabela-fato
Segue o padrão de `ato_comissao` (índice pré-computado, lido pela API):
```sql
CREATE TABLE `ato_ods` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ato_id`       BIGINT UNSIGNED NOT NULL,
  `ods`          TINYINT UNSIGNED NOT NULL,      -- 1..17
  `vinculo`      ENUM('proposta','execucao','pesquisa','ensino') NOT NULL,
  `confianca`    ENUM('alta','media','baixa') NOT NULL,
  `meta`         VARCHAR(16) NULL,               -- meta THE/IPEA ancorada (ex.: '10.6.11')
  `justificativa` VARCHAR(400) NULL,             -- 1 frase + trecho
  `metodo`       ENUM('ia','curadoria','ia+curadoria') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ato_ods` (`ato_id`,`ods`),
  KEY `ix_ods` (`ods`,`vinculo`),
  CONSTRAINT `fk_atoods_ato` FOREIGN KEY (`ato_id`) REFERENCES `ato`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
Um ato pode ter **várias** linhas (a IN PROAES 38 casa ODS 10, 5 e 4). É Percona 5.7:
extração de padrões do TEXT em PHP (loop + `preg_match_all`), nunca `REGEXP_SUBSTR`.

## 5. Armadilhas medidas (guardas obrigatórias)

1. **Isca de palavra-chave.** Termo-ODS no nome do parceiro, na área do concurso ou no
   cargo da pessoa ≠ política. Guarda: classificar pelo **dispositivo**, não pela menção
   (mesma doutrina do extrator). 19/19 rejeitadas no lote.
2. **Ementa ≠ corpo (desalinhamento de extração).** Parte dos atos traz corpo de um ato
   vizinho. Guarda de **coerência**: exigir que ≥1 palavra-conteúdo da ementa apareça no
   corpo; senão, marcar `corpo_suspeito` e cair para curadoria. (No casamento offline,
   isto também pega o bug de casar por número sem sigla — número de Resolução reinicia
   por colegiado; **sigla é obrigatória**, exceto Portaria/NS, cuja numeração é única.)
3. **ODS 4 infla.** Educação é a razão de ser da UFF; quase todo ato "toca" ODS 4.
   Guarda: ODS 4 só conta política de **acesso, permanência, qualidade ou inclusão**
   (metas 4.3/4.5) — **não** cada regulamento de TCC, criação de disciplina ou
   progressão docente. Sem essa guarda, ODS 4 vira 17 mil resoluções sem sinal.
4. **Proposta vs execução.** "Designa membros de" / "altera composição de" = execução.
   "Institui / cria / aprova a política" = proposta. O verbo decide.
5. **FULLTEXT tokeniza.** "nome social" casa "Nomeia … Social"; "segurança da informação"
   casa "engenharia da informação". Casamento determinístico é por **frase/dispositivo**,
   nunca por índice de texto livre (ver `CLAUDE.md`).

## 6. Critério por ODS (âncora → o que conta na UFF → o que NÃO conta)

| ODS | Âncora (THE / IPEA) | Conta como proposta da UFF | NÃO conta (guarda) | Exemplo real no acervo |
|---|---|---|---|---|
| **1** Pobreza | 1.4 acesso a serviços; assistência | Auxílio-moradia, auxílio emergencial, bolsa por vulnerabilidade | Bolsa de mérito acadêmico | IN PROAES 35 (Apoio à Moradia) |
| **2** Fome | 2.1 acesso a alimento | Restaurante Universitário, auxílio-alimentação, seg. alimentar | Curso de nutrição | Portaria 68.900 (RU campus Macaé) |
| **3** Saúde | 3.3.5/3.3.7 saúde mental; saúde do servidor | Política de qualidade de vida, saúde do trabalhador, apoio psicológico | Concurso da área de saúde; HUAP assistencial de rotina | Decisão CGIRC 9 (Qualidade de Vida) |
| **4** Educação | 4.3/4.5 acesso e permanência | **Só** acesso/permanência/qualidade/inclusão | Regulamento de TCC, criação de disciplina, progressão | IN PROAES 22 (Permanência) |
| **5** Gênero | 10.6.11 assédio; 5.1/5.2 discriminação/violência | Enfrentamento ao assédio, creche, gestantes, nome social, equidade | Ato de pessoal de mulher | IN PROAES 24 (gestantes/creche) |
| **6** Água | 6.3 saneamento (operações do campus) | Gestão de água/efluentes do campus | — (raro; sobretudo pesquisa) | — |
| **7** Energia | 7.2/7.3 energia limpa e eficiência | Eficiência energética, solar no campus | Convênio com empresa "Energia Solar" (isca) | — |
| **8** Trabalho | 8.8 direitos e segurança no trabalho | CIPA, saúde/segurança do servidor, PGD, capacitação | "Cargo de Segurança do Trabalho" (isca) | IN GAR 127 (CISSP) |
| **9** Inovação | 9.5 pesquisa e infraestrutura | NIT, inovação, ciência aberta, infra de pesquisa | — | DTS SDC 9 (Núcleo Ciência Aberta) |
| **10** Desigualdades | 10.6.4 antidiscriminação; cotas | Ações afirmativas, cotas, acessibilidade, permanência, SEPAD/AFIDE/CPPIQ | *Designar* membros (isso é execução); nomeação anulada de vaga reservada | Res. CUV 635 (cria SEPAD) |
| **11** Cidades | 11.4 patrimônio; acesso público | Patrimônio, mobilidade, espaços abertos à comunidade | — | Res. CEPEx 2.678 (Núcleo Meio Ambiente e comunidade) |
| **12** Consumo | 12.5 resíduos; compras sustentáveis | PLS, A3P, coleta seletiva, gestão de resíduos, CPS | Convênio com parceiro "socioambiental" (isca) | Res. CUV 528 (PLS 2025-2028) |
| **13** Clima | 13.3 educação climática | Educação/ação climática; **muito via pesquisa** | — | Res. CEPEx 5.213 (pesquisa clima+trabalho) |
| **14** Vida na água | 14.x | Quase só **pesquisa** (biologia marinha, reciclagem naval) | — | IN VEP 1 (reciclagem de navios) |
| **15** Vida terrestre | 15.2.5 manejo sustentável | Bem-estar animal (CEUA), manejo; sobretudo pesquisa | — | — |
| **16** Instituições | 16.5/16.6 corrupção e instituições eficazes; liberdade acadêmica | Governança (CGIRC), integridade, riscos, LGPD, ética, segurança da informação | Sindicância/PAD individual | Res. CUV 372 (PSI); Portaria 68.259 (institui CGIRC) |
| **17** Parcerias | 17.x colaboração intersetorial e internacional; relatório ODS | Acordos de cooperação internacional, convênios institucionais, o próprio relatório ODS | Convênio de estágio (é operação de ensino) | Res. CEPEx 6.016-6.019 (coop. internacional) |

## 7. Warm start — o que já está curado

Não se começa do zero. Estruturas já curadas no portal são infraestrutura-ODS pronta,
e seus atos **fundadores** entram direto:

- Comissões permanentes (`comissoes_registro()`): **CPS** → 12/13, **AFIDE** → 10/5,
  **CPPIQ** → 10, **CGIRC** → 16, **CIPA** → 8, **CEUA** → 15.
- Nova estrutura vista no lote: **SEPAD** (Superintendência de Equidade, Políticas
  Afirmativas e Diversidade, Res. CUV 635/2025) → 10/5.
- Aba **Cooperação** → 17 (já pronta; os acordos internacionais são evidência 17).

## 5-A. A isca do NOME PRÓPRIO (a armadilha que mais custou)

Todas as guardas do §5.1 são instâncias de **um único defeito**: o termo-ODS
aparece no **nome de alguma entidade** citada pelo ato, não no que o ato faz.
Catalogadas até agora, todas medidas neste corpus:

| onde o termo mora | exemplo real | quantos |
|---|---|---|
| nome do **parceiro** | convênio de estágio com "Instituto Biasse **Socioambiental**" | dezenas |
| **área** do concurso | "Comissão Examinadora … **Psiquiatria e Saúde Mental**" | ~32 na amostra |
| **cargo** da pessoa | "declara vago o cargo de Engenheiro de **Segurança do Trabalho**" | dezenas |
| nome do **órgão emissor** | "**Escola de Governança** em Gestão Pública" assina a progressão | **193** |
| nome da **unidade remanejada** | "excluir CD-3 da **Divisão de Saúde Ocupacional**" | **22** |
| **cargo/lotação de quem recebe** | "Designa Fulana, **Nutricionista**", "diretor da Divisão de Moradia Estudantil e **Restaurante Universitário**" | **~300** |
| **palavra comum** homônima | "**inclusão** de disciplina", "Bio**ética**" | 2 + cauda |

O caso do **cargo de quem recebe o ato** foi o mais numeroso e o último a cair —
achado por leitura do painel no ar, não pelos testes: a ODS 2 (Fome zero) exibia
60 de 75 atos do tipo *"Designa Fulana, Nutricionista"* e *"Dispensa Beltrano"*.
Nenhum faz política alimentar; o que casava era a profissão da pessoa ou o nome da
unidade em que ela seria lotada.

**A guarda é o OBJETO DO VERBO**, não o verbo: `designar`/`dispensar`/`nomear`
seguidos de **pessoa** são ato de pessoal e saem; seguidos de **colegiado**
("designa membros para compor a Comissão de Ética") são execução legítima de
política e ficam. Duas sutilezas que custaram medição:

- O dispositivo quase nunca começa no verbo — vem `resolve: 1- designar…`,
  `resolve: art. 1º - dispensar…`. Sem descascar o marcador de item, o verbo não
  casa e o ato passa batido (71 designações sobreviveram assim na primeira
  tentativa).
- Ato de designação de **colegiado** fica, mas o tema tem de vir da **ementa** —
  que é onde o colegiado se nomeia. O corpo desses atos é lista de membros e
  programação de evento: foi por ali que "Designa representantes do Comitê
  Científico da Agenda Acadêmica" virou evidência de creche (2012) e de
  assistência estudantil (2014).

O caso do emissor é o mais instrutivo: a EGGP assina centenas de atos de
capacitação, e a palavra "governança" no nome dela fez 193 atos de **folha de
pagamento** parecerem política de governança (ODS 16). Nenhum deles cita
governança no dispositivo.

**Regra operacional:** antes de aceitar um vínculo, pergunte *"o termo está no
DISPOSITIVO ou no nome de alguém?"*. Se for nome — de parceiro, de órgão, de
cargo, de unidade, de curso — não é vínculo. É a mesma doutrina do extrator
("classifique pelo dispositivo, não por menção"), aplicada à classificação.

## 8-A. Curadoria dos ambíguos — o que ela ensinou

A resolução automática de uid deixou **32 casos ambíguos** (o dump tem 2+ linhas
com mesmo tipo+número+ano e a ementa não desempatou). Foram curados um a um:
22 aproveitados, 10 descartados. Método e resultados em
`../../backfill-ods/LEIA-ME.md`; a carga curada é `ato_ods_curadoria.json`
(`metodo='curadoria'`, que a IA nunca sobrescreve).

Três lições que valem para qualquer trabalho futuro neste corpus:

1. **"Manter a primeira cópia" apagaria o ato certo.** Em **6 dos 22**, o ato
   real é a cópia **`-2`**, não a base — confirmando a medição já registrada no
   `CLAUDE.md`. Caso-prova: a **Decisão 40/2012 (nome social)**; varrendo o corpo
   de todo o acervo, só a cópia do **BS 177/2012** contém o dispositivo que
   regulamenta o nome social de travestis e transexuais — a base (BS 41/2012)
   não contém. Um "fica a primeira" teria gravado o ato errado numa das
   evidências mais fortes de ODS 5/10 do acervo.
2. **O boletim de origem é um discriminador melhor que a ementa.** A carga
   (`atos.json`) registra de qual PDF cada ato foi extraído, e o dump guarda
   `boletim.arquivo`: cruzar os dois resolve por evidência. Só falha quando a
   própria carga tem as duas cópias — que é justamente a origem do `-2`.
3. **Nem todo ato "da UFF" no acervo é da UFF.** A Resolução 879/2008 é do
   **CFMV** (Conselho Federal de Medicina Veterinária), citada em boletins de
   2012/2013 — mesmo tipo de fantasma de norma externa já catalogado. Ela seria
   a evidência mais forte de ODS 15 do dossiê, e é falsa. Antes de celebrar um
   achado de ODS rara, confira se o emissor é a UFF.

Os outros descartes: quatro **atos de pessoal** (nomeação de nutricionista,
designação de médico, licença) que o rótulo automático leu como política de
alimentação/saúde — a mesma isca de cargo do §5.1, agora entrando por ementa
vazia; e dois casos indecidíveis (6 atos distintos numerados 3/2021).

## 8-B. A cauda de resíduo — e o que ela revelou sobre a carga

"Resíduo" = candidato que passou pelo recorte mas nenhum cluster reconheceu.
Eram 759. Tratados: **351 descartados** por regra nova (ato de pessoal, folha,
estrutura), **33 recuperados** com clusters novos, **375 deixados como cauda
longa** (casos únicos; 489 dos 759 sem ementa nenhuma, atos de 2001-2010).

O ganho maior não foram os 33 — foi o **diagnóstico**. Ao entender por que 193
atos de progressão tinham virado candidatos a ODS 16, achamos a isca do órgão
emissor (§5-A) e, com ela, **auditamos a carga que já ia para produção**: 29
atos contaminados (2,1%), 54 linhas. Corrigidos na fonte antes do deploy.

**Lição de processo:** a cauda de resíduo não é lixo a ser ignorado — é o
detector de defeito sistemático da carga principal. Um falso-positivo que
aparece 193 vezes no resíduo aparece algumas vezes dentro dos clusters também.
Vale tratá-la sempre que a classificação for revista.

**E o inverso também mora lá: evidência real perdida.** A cauda esconde
falso-NEGATIVO, não só falso-positivo. Caso medido: a **Portaria 68.317/2022,
que constitui a CPEG** (Comissão Permanente para Equidade de Gênero), estava na
cauda como "caso único". O recorte acertou — marcou `proposta`, ODS 5 e 10 —,
mas nenhum cluster cobria a grafia *"Comissão Permanente **para** Equidade de
Gênero"*: os padrões tinham AFIDE, SEPAD, CPPIQ e "ações afirmativas,
diversidade e equidade". Uma preposição diferente e a evidência sumia.

Generalizando: **cluster é lista de nomes próprios, e nome próprio da UFF varia**
(preposição, sigla, ordem das palavras, nome histórico). Quando o recorte marca
`proposta` com ODS plausível e nenhum cluster reconhece, a hipótese default deve
ser *"falta padrão"*, não *"não é evidência"*. Por isso a cauda vai para o
`backfill-ods/` com o vínculo e as ODS que o recorte propôs — é ali que se
procura o que ficou de fora. Este caso foi achado pelo mantenedor lendo o
painel, não pelos testes.

## 7-A. A classificação roda no import (desde 03/08/2026)

Até aqui este documento descreve como a carga foi CONSTRUÍDA. O que mudou: as
etapas (A) recorte e (C) rotulagem por clusters — que são **determinísticas,
regex sobre o dispositivo** — foram portadas para
[`backend/importar/ods_match.php`](../backend/importar/ods_match.php) e passaram
a rodar a cada importação, como já acontecia com `ato_comissao` e `prazo`.

Antes disso a `ato_ods` só era preenchida pelo backfill offline: boletim novo
entrava **sem vínculo ODS nenhum**, e a aba ficava parada até alguém rodar uma
carga à mão. Depender 100% de passo manual num painel que a diretoria consulta
não se sustenta.

**O que NÃO foi automatizado, de propósito:**

- A **curadoria humana** continua sendo a autoridade final. O import apaga só o
  que é automático (`DELETE FROM ato_ods WHERE ato_id=:id AND metodo <>
  'curadoria'`) e grava com `INSERT IGNORE`, então a UNIQUE `(ato_id, ods)` faz
  a linha revisada à mão vencer a automática. Revisar um ato é definitivo.
- O **resíduo**. Ato que passa pelo recorte mas não casa cluster **não recebe
  rótulo** — não se chuta. É a assimetria que sustenta o painel: falso-negativo
  se conserta com um padrão novo (foi assim que a CPEG entrou, §8-B);
  falso-positivo contamina o dossiê e só se descobre lendo o painel no ar.

**A barreira contra falso-positivo é um teste, não uma intenção.**
[`backend/importar/teste_ods_match.php`](../backend/importar/teste_ods_match.php)
fixa 22 casos, e cada um é uma isca que **já esteve em produção**: o cargo de
quem recebe o ato (nutricionista → ODS 2), a governança no nome do emissor
(EGGP, 193 atos), o parceiro "Socioambiental", a vaga reservada em nomeação
anulada, a creche citada na programação da Agenda Acadêmica, o "inclusão de
disciplina" do jargão curricular. Junto vão os verdadeiros-positivos que já
sumiram uma vez — a CPEG à frente. Roda no CI a cada push que toque `backend/`.

Mexer nos regex sem rodar esse teste é reintroduzir defeito já pago.

**Uma divergência deliberada do rotulador Python:** o tipo
**"Resolução ad referendum"** entra no recorte. Ele nasceu depois da
classificação original (é a série própria do CEPEx — ver `CLAUDE.md`), então o
`NORM` do Python não o conhece e os ~68 atos dessa série nunca seriam
classificados. Ad referendum muda o rito de aprovação, não a natureza normativa.

### Reclassificar o acervo antigo

Os atos importados antes de 03/08/2026 carregam a carga original, montada em
várias rodadas. Para dar uma passada uniforme com o classificador atual:
[`backend/importar/backfill_ato_ods_auto.php`](../backend/importar/backfill_ato_ods_auto.php).

Ele lê o corpo do próprio banco (não depende de JSON) e usa o **mesmo**
`ods_match.php` do import, então backfill e import produzem linhas idênticas.
Roda **em lotes com cursor** — são ~69 mil atos normativos com texto completo, o
que não cabe numa requisição de shared hosting; o script imprime a URL do
próximo lote e repetir um lote é inofensivo.

`&limpar=1` na primeira chamada apaga as linhas automáticas antes de começar
(troca a carga antiga inteira pela nova). Em qualquer modo, **a curadoria é
preservada**: o `DELETE` sempre exclui `metodo='curadoria'` e o `INSERT IGNORE`
cede quando a curadoria já cravou aquele par `(ato, ods)`.

Ao terminar, confira o que o próprio script manda conferir — em especial que a
contagem de `metodo='curadoria'` não caiu. Se caiu, pare e investigue.

## 8. Governança da classificação

- **Confiança** (alta/média/baixa) em cada linha; o painel filtra por ela e o controle
  vê o grau de certeza.
- **Justificativa obrigatória** citando a meta e o trecho do dispositivo — sem
  justificativa, não grava. É o que torna cada rótulo auditável.
- **Curadoria humana** no borderline, no ODS 4 e em todo `corpo_suspeito`.
- **Transparência de método** na própria aba (como a aba Privacidade explica o RSC):
  dizer que é classificação assistida por IA, ancorada em THE+IPEA, revisada.

## 9. Estado do protótipo (22/07/2026)

Três passadas rodadas, cada uma respondendo uma pergunta:

| Passada | Fonte | N | O que provou |
|---|---|---|---|
| Largura | ementas via API | 267 | taxa-base ~8%; proposta ≠ execução; 11/11 iscas rejeitadas |
| Profundidade | corpo (dispositivo) das cargas | 210 | o corpo muda 12% dos vereditos; 19/19 iscas rejeitadas; achou SEPAD, coop. internacional |
| Corpus completo | corpo de TODO o normativo (`reprocessamento-2026-07-15/`) | 68.843 | recorte real 96%→2.819 candidatos; achou ODS 2 (Aux. Alimentação, RU), ODS 15 (CEUA 879/2008), ODS 1 (auxílios Covid); impôs o vínculo `ensino` |

Classificador de recorte: `tools/ods/classificador_corpus.py` — ele e os outros
três do pipeline estão em `tools/ods/`, com a ordem de execução em
[`../tools/ods/LEIA-ME.md`](../tools/ods/LEIA-ME.md). A auditoria manual das ODS raras mostrou que o
determinístico **gera candidatos** (recall) mas erra rótulo no borderline — o rótulo
final é da camada IA + curadoria, como desenhado.

**Camada fina rodada em 22/07/2026 — backfill pronto.** Os 2.819 candidatos passaram
pela rotulagem por clusters auditados (`tools/ods/rotulador_final.py`): 40 clusters com meta
THE/IPEA e justificativa; descartes duros com motivo (concurso, folha, moção, doação,
cargo CD/FG, aditivo de estágio); vínculo `ensino` decidido pelo NOME do curso na
ementa (nunca por disciplina citada no corpo); adesões de jornada separadas da norma
geral; CEUA protegida da colisão com "Comissão de Ética". Resultado:

- **1.392 atos rotulados** (inclui 33 recuperados da cauda) → uid resolvido contra
  o dump do dia (97,6%; desempate de duplicata `-2` por prefixo de ementa) →
  **1.368 linhas (uid × ods)** sobre **1.216 atos**, em `../../backfill-ods/`
  (`ato_ods_backfill.json`, 1.336 de IA + `ato_ods_curadoria.json`, 32 curadas).
  191 proposta · 966 execução · 172 ensino · 7 pesquisa (ver §3).
- **34 ambíguos** (32 curados — ver §8-A) + **descartados com motivo**, incluindo
  a cauda tratada (§8-B) — trilha completa em `backfill-ods/`.
- Infra: `backend/db/ato_ods.sql` (+ tabela no `schema_v2.sql`) e
  `backend/importar/backfill_ato_ods.php` (upsert por uid; linha `metodo='curadoria'`
  nunca é sobrescrita). Runbook: `../../backfill-ods/LEIA-ME.md`.

Falta para a aba: rota `/api/ods` (cacheada, padrão dos painéis diário-estáticos) +
frontend `#ods` + curadoria dos 32+759.

Dossiê visual: https://claude.ai/code/artifact/59b5cb32-f337-412d-821e-5c21bc78c38a

---
*Fontes: THE Impact Rankings 2025 (methodology); IPEA — Metas nacionais dos ODS
(proposta de adequação) e Cadernos ODS. Números do protótipo: 267 atos por ementa +
210 por corpo + varredura do corpus normativo completo (68.843), acervo
`inteligencia.fanara.com.br` e cargas locais, jul/2026.*
