# Boletim de Serviço da UFF — guia de extração

**Roteiro para quem precisa transformar 25 anos de atos em dados.**

O Boletim de Serviço da UFF é publicado desde 2001 em PDF, um arquivo por edição,
cada um com dezenas de atos dentro. Não existe versão estruturada. Quem quiser
consultar, cruzar ou analisar esse acervo precisa lê-lo com máquina — e descobrir,
no caminho, que o texto tem uma gramática própria que **mudou várias vezes ao
longo dos anos**, sem aviso e sem documentação.

Este guia é essa documentação, escrita depois do fato. Ele descreve **o corpus**:
o que muda e quando, o que engana, o que já custou retrabalho e o que funcionou.
Serve para uma pessoa que vá escrever um extrator, e serve como contexto para um
modelo de linguagem que precise interpretar esses atos — por isso os exemplos são
literais e as regras estão em forma de afirmação, não de conselho.

A última seção é dirigida à **equipe que produz o Boletim**, e é a única parte que
propõe mudar algo fora do código.

---

## O que este guia assume

O BS é um documento feito para **ser lido por gente**, e cumpre isso há mais de
duas décadas. Nada aqui é defeito do Boletim. Um humano lendo a página sabe onde a
portaria acaba, sabe que "Nomeia" e "Designa" não são sinônimos, e não confunde o
servidor avaliado com a banca que o avalia. Nada disso está escrito em lugar
nenhum: está no letramento de quem lê.

O erro recorrente de quem raspa esses arquivos é tratar a ausência de estrutura
como falha, e não como fato do material. O trabalho não é corrigir o Boletim; é
reconstruir, com evidência, a estrutura que o leitor humano infere de graça.

---

## Como os números deste guia foram medidos

Quase toda afirmação numérica vem de uma destas fontes:

- **78.994 atos** extraídos dos PDFs de 2001 a 2026, usados como corpus de
  regressão: roda-se a versão velha e a nova do extrator sobre o mesmo texto e
  compara-se o que mudou.
- **128.427 atos** na base de produção (o acervo completo indexado).
- **123.374 pares nome–SIAPE**, para as análises de pessoa.
- Amostras de 4 a 8 PDFs por ano, lidos direto com PyMuPDF. Onde a amostra é
  pequena, o número é indicativo — está sinalizado.

Duas advertências de método, ambas aprendidas errando:

**Amostre ao longo dos anos, nunca só o recente.** Um extrator desenhado em cima
de 2026 quebra em 2003 sem avisar. Praticamente todo achado deste guia só apareceu
porque a amostragem pegou atos de 2001 a 2026, ano a ano.

**Não conte volume a partir de cargas parciais.** Algumas pastas de extração por
ano são rodadas incompletas (2011 com 670 atos, 2022 com 306). Servem para
amostrar estilo, não para medir quantidade.

---

## A linha do tempo do corpus

Esta é a seção mais importante do guia. O BS não é um formato: é **vários formatos
em sequência**, e um extrator que ignore isso funciona no período em que foi
escrito e falha silenciosamente nos outros.

| período | o que muda | como se detecta |
|---|---|---|
| **2001** | **Não existe marcador de fim de ato.** O PDF é digitalização, com OCR sujo. "Matrícula UFF" convive com SIAPE. SIAPE em só 34% dos atos. | nenhum `#` no texto |
| **2002–2003** | Nasce o marcador de fim de ato, com **cinco `#`**. | `# # # # #` |
| **2004** | O marcador vira **seis `#`** e não muda mais. Pico do uso de "Matrícula UFF". | `# # # # # #` |
| **2005–2017** | Período estável. Títulos em CAIXA ALTA, marcador de seis. Cobertura de SIAPE sobe de ~42% para ~60–74%. | — |
| **2018** | Aparece o **bloco de assinatura digital do SIGAEx** no rodapé das páginas. | `Assinado com senha por…` |
| **2020** | Ano atípico: as portarias saem em **Title Case**, invisíveis a um regex que exija maiúsculas. Aparece o marcador de documento do SIGA. | `UFFPOR202067634A` + `Portaria Nº 67.634 de 16 de outubro de 2020` |
| **2021–2026** | O marcador `UFFPOR` permanece; a CAIXA ALTA volta a conviver com o Title Case. Signatário vazio em ~10% dos atos. | os dois formatos no mesmo boletim |

Os números por trás da linha (amostra de 4–8 PDFs/ano):

### O marcador de fim de ato

| ano | sequências de `#` | o que se usava | invisível a um regex de 6 `#` |
|---|---|---|---|
| 2001 | 0 | não existia | — |
| 2002 | 170 | **5 `#`** (123 de 170) | **91%** |
| 2003 | 254 | **5 `#`** (253 de 254) | **100%** |
| 2004 | 488 | **6 `#`** (481 de 488) | 1% |
| 2005+ | estável | 6 `#` | 0% |

O marcador é visual — batido no teclado por quem digitava. É por isso que o número
oscila, e é por isso que ele se estabiliza quando o processo de produção muda.
**Aceite `{3,}`**, não exatamente seis: exigir seis apaga 2002 e 2003 inteiros, que
é justamente o acervo onde a estrutura é mais frágil.

### Cobertura de SIAPE nos atos

| 2001 | 2003 | 2007 | 2019 | 2025 |
|---|---|---|---|---|
| 34% | 45% | 61% | 72% | 65% |

### A assinatura digital e o Title Case

Ocorrências na amostra:

| ano | `Assinado com senha por` | `UFFPOR…` | portaria em Title Case | portaria em CAIXA ALTA |
|---|---|---|---|---|
| 2015 | 0 | 0 | 0 | 74 |
| 2018 | 50 | 0 | 0 | 51 |
| 2020 | 106 | 106 | **85** | **0** |
| 2023 | 70 | 70 | 0 | 57 |

---

## A regra que governa tudo

> **Classifique pelo dispositivo do ato, não por menção.**

O ato *faz* uma coisa — o dispositivo, o que vem depois de "resolve:" — e
*menciona* outras. Quase todo falso positivo deste corpus é uma menção lida como se
fosse o dispositivo. Três exemplos reais, de eixos diferentes:

- Uma retificação que cita uma concessão anterior — *"…portaria X, **que
  concedeu** aposentadoria…"* — não é uma concessão nova. O marcador é o "que"
  antes do verbo.
- Uma dispensa que explica seu motivo — *"dispensar, **em virtude de sua
  nomeação** para diretor do Centro…"* — é uma **dispensa**. "Nomeação" é
  substantivo, numa oração explicativa.
- Uma banca de progressão cita o **avaliado** junto com os avaliadores. Estar
  citado no ato não é ter participado dele.

---

## Parte 1 — Onde o ato começa e onde ele termina

Resolva isto primeiro. Tudo o mais depende: se a fronteira do ato está errada, as
pessoas, os prazos e as relações do ato vizinho vazam para dentro dele, e nenhuma
análise posterior conserta.

### O ato engole a seção seguinte

O BS publica, além dos atos, seções **sem cabeçalho de ato**: "Resumo de Despachos
e Decisões", "Alteração de Carga Horária", "Auxílio Funeral", "Autoriza o
afastamento no exterior". Quem corta o texto no "próximo cabeçalho reconhecido" faz
o último ato antes dessas seções engolir todas elas.

**Medido: 2.414 atos, 3,1% do corpus.**

Caso-prova, a **Portaria 64.814/2019** (Comissão Interna de Conservação de
Energia): a portaria nomeia **9 servidores**; a base lhe atribuiu **22**. Os 13
extras só tiveram alteração de carga horária publicada no mesmo boletim — uma
servidora "entrou" na comissão porque mudou de 40 para 30 horas.

O mesmo já tinha acontecido por outro caminho: uma DTS ganhou um "prazo de 12
meses" que pertencia a um Extrato de Instrumento Convenial publicado logo depois —
**557 atos afetados**, 91% deles do mesmo tipo de documento.

**O que funciona:** manter uma lista de *fronteiras que não são atos* — cabeçalhos
de documentos que não viram registro próprio, mas marcam que o ato anterior
terminou ali. É aditivo e barato.

**O que não funciona:** supor que todo documento do BS comece com algo que pareça o
título de um ato.

### O marcador `# # # # # #` não fecha tudo, e não é sobra

O marcador separa itens depois da assinatura, e é tentador usá-lo como fronteira.
Duas ressalvas, ambas medidas:

**Ele não fecha os atos assinados digitalmente.** Esses terminam no carimbo do
SIGAEx, não no `#`.

**Ele pode já estar sendo usado para outra coisa.** No nosso extrator, ele era a
âncora que permitia reconhecer títulos curtos sem data — *"DECISÃO N.º 026/2012"*,
*"RESOLUÇÃO 18/2002"*, comuns nos colegiados antigos, que não trazem data por
extenso na mesma linha. Transformá-lo *também* em fronteira, ingenuamente, fez **7
atos sumirem e 10 perderem todas as pessoas** (uma DTS caiu de 26 pessoas para
zero). Um ato desaparece quando a fronteira cai logo depois do título: o corpo fica
vazio e ele é descartado.

### O bloco do SIGAEx é rodapé de página, não fim de documento

Atos assinados digitalmente (de 2018 em diante) terminam assim:

```
Classif. documental 011.1
Assinado com senha por ANTONIO CLAUDIO LUCAS DA NOBREGA.
Documento Nº: 20918-1060 - consulta à autenticidade em https://app.uff.br/sigaex/...
```

Parece um fim de ato perfeito. **Não é.** É um carimbo estampado **por página**. Na
Portaria 68.651/2023 ele aparece logo depois de *"Art. 3º. Servidores designados
para a Comissão:"*, e a lista dos 10 servidores continua na página seguinte. Cortar
ali decapita o ato: aquele foi de 10 pessoas para zero.

O `Documento Nº` do carimbo parecia salvar a ideia — páginas do mesmo documento
compartilhariam o número — mas ele **não sai em todas as páginas**: a página que
contém a Portaria 64.814 não tem `Documento Nº` nenhum.

### A identidade do boletim é o ARQUIVO, não o número impresso

O arquivo `57-26.pdf` traz, impresso na página, "BS nº 113". Chavear pelo número
publicado duplica atos. A identidade estável é o arquivo.

### O mesmo ato sai em mais de um boletim

Republicação é comum: a mesma portaria aparece em edições diferentes e vira dois
registros. Quem monta uma visão por pessoa precisa colapsar isso, ou o servidor
cita o mesmo ato duas vezes no processo dele.

### Cuidado: a ementa pode atravessar a fronteira

Defeito nosso, registrado porque é fácil de repetir. A ementa era lida a partir do
fim do título por um número fixo de caracteres, **direto do texto completo do
boletim** — não do trecho do ato. Consertar a fronteira não conserta a ementa: são
dois defeitos que se somam.

---

## Parte 2 — Pessoas

### O SIAPE tem duas grafias, e elas viram duas pessoas

O corpus traz o mesmo servidor como `0307221` **e** `307221`. Só existem SIAPEs de
6 e 7 dígitos (20.677 de sete, 5.823 de seis) — a diferença é o zero à esquerda.

**Medido: 1.462 servidores partidos em duas identidades.** Se a coluna do SIAPE for
única na sua base, são duas linhas, cada uma com seus atos, e quem consultar por
matrícula recebe **metade** do histórico sem nenhum sinal de que faltou.

Normalize tirando os zeros à esquerda. E uma armadilha específica do MySQL: **não
use `LPAD`**. `LPAD('12345678', 7, '0')` devolve `'1234567'` — a função *trunca*
quando a string é maior que o alvo, e fundiria matrículas diferentes.
`TRIM(LEADING '0' FROM …)` é seguro em qualquer comprimento.

Normalize a **consulta**, não os dados. Consolidar as linhas duplicadas é
curadoria, não regex.

### Um SIAPE pode carregar duas pessoas — e a base pode não saber

No corpus, o SIAPE `3369546` aparece com **Bárbara Luciana Sena Costa** e **Simone
da Costa Lemos**. O `0303043` carrega três nomes: Hermano Cavalcanti, Eliana
Siciliano e Maria Andreia Sarmento. É erro de extração — o parser grudou o SIAPE
errado no nome ao percorrer uma lista.

O detalhe cruel: se o seu importador chaveia pessoa por SIAPE e a coluna é única,
**os nomes divergentes colapsam numa linha só**, com o primeiro nome que entrou, e
os atos das duas pessoas ficam pendurados nela. Se a tabela de ligação guarda só
`ato_id` + `pessoa_id`, o nome grafado em cada ato **se perdeu**: não há como
detectar nem desfazer por SQL depois.

**Se isso vai afetar a vida de alguém, guarde o nome como ele aparece em cada
ato.**

### A busca por matrícula é incompleta por construção

Um terço a dois terços dos atos não trazem SIAPE nenhum (ver a linha do tempo).
Pior: se o seu extrator só cria a entidade "pessoa" quando encontra um SIAPE — o
nosso faz isso — então quem não tem matrícula no ato **não existe** na tabela de
pessoas. Existe só no corpo do texto, e o único caminho até ele é busca em texto
completo.

Ausência de resultado não prova ausência de ato. Diga isso a quem consulta.

### Nem todo mundo tem SIAPE: existe "Matrícula UFF"

Os atos antigos usam *"matrícula UFF nº 023886-6"*, que é **outro identificador** —
convive com o SIAPE, não o substitui. E discentes aparecem assim até hoje: *"IGOR
DE ASSUMPÇÃO MELLO, Matricula UFF 114038018, discente"*.

### Os nomes variam de quatro jeitos distintos

- **Acento:** "João Marcel Fanara Correa" e "Joao Marcel Fanara Correa".
- **OCR:** "claudia henriques gentil", "claudia henrique gentil", "claudia heriques
  gentil" — a mesma pessoa, três vezes.
- **Sigla do órgão colada no nome:** "proplan vera lucia lavrado cupello
  cajazeiras", "progepe vera lucia…", "proppi vera lucia…".
- **Nome truncado ou lixo:** "vera lucia", "regina peres", e "engenharias iii"
  capturado como se fosse gente.

Consequência prática: comparar nomes **sem normalizar acento e caixa** faz um
alarme de "matrícula com dois nomes" disparar para quase todo mundo. Um aviso que
sempre pisca não é lido — e aí não serve para o caso real.

### Estar citado no ato não é ter participado dele

A tabela de menções lista **todo mundo que o ato cita**. Numa banca de progressão,
isso inclui **o servidor avaliado**. Numa listagem por pessoa aparece também
*"Interrompe o período de férias do servidor X"* — que cita a matrícula e não é
participação nenhuma.

Se o seu produto precisa afirmar participação, ele precisa ler o **dispositivo** —
e isso é um extrator novo, não uma consulta.

---

## Parte 3 — Cargos e funções

### Nomear/exonerar ≠ designar/dispensar

No serviço público federal:

- **Nomeação / exoneração** → **cargo de direção (CD)**
- **Designação / dispensa** → **função gratificada e chefias**

Um modelo que só conheça `designar`/`dispensar` **não enxerga a família CD
inteira**. E um extrator que conheça `exonerar` (a saída) mas não `nomear` (a
entrada) fica assimétrico de um jeito perigoso: numa portaria que exonera um e
nomeia outro no mesmo texto — padrão comum — a busca pelo "último verbo antes do
cargo" acha só o "Exonerar", e **o nomeado entra como dispensado**. Erro invertido
e silencioso.

O par, literal:

```
PORTARIA Nº 106 — Exonerar JOÃO MARCEL FANARA CORREA, Matrícula SIAPE nº 1076836,
                  do cargo de direção de Assessor do Gabinete do Reitor - Código CD-4.

PORTARIA Nº 108 — Nomear JOÃO MARCEL FANARA CORREA, Operador de Radio
                  Telecomunicações, código 701.456, Matrícula SIAPE nº 1076836,
                  para exercer o cargo de direção de Assessor do Gabinete do
                  Reitor - Código CD-4.
```

Repare que "Operador de Radio Telecomunicações" é o **cargo efetivo** (o emprego da
pessoa) e "Assessor" é o **cargo de direção**. Os dois estão na mesma frase, e só
um deles é o que o ato faz.

### A lista de cargos precisa ser branca, e curta

Se o gatilho aceitar `cargo de X` sem exigir o "de direção", **todo nome na lista
também passa a casar cargo efetivo**. Medido, entre os atos com o padrão inequívoco
"cargo de direção/em comissão de X": **669 capturados** contra **91 perdidos**.

O que entra e o que não entra, decidido caso a caso pela medição:

| candidato | CD explícito | "cargo de X" solto | veredito |
|---|---|---|---|
| Assessor(a) | 49 | 20 (assessorias reais) | **entra** |
| Secretário-Geral | 5 | 0 | **entra** (só hifenizado) |
| Prefeito | 4 | 0 | **entra** (Prefeito Universitário) |
| Corregedor(a) | 2 | 0 | **entra** |
| Secretário (solto) | 8 | **60** | **fica fora** |
| Procurador (solto) | 3 | 1 | **fica fora** |

Os 60 casos de "secretário" solto são deste tipo: *"para o cargo de secretário
**executivo**, por não apresentar documentação que comprove os requisitos"* —
**eliminação em concurso público**. Adicionar a palavra criaria 60 designações que
nunca existiram. Pela mesma razão ficam fora `professor`, `assistente`, `técnico`,
`médico`, `enfermeiro`: é o emprego da pessoa, não posição de direção.

**Meça antes de acrescentar um cargo.** Conte quantas vezes ele aparece depois de
"cargo de direção de" e quantas depois de "cargo de" solto.

### O papel dentro do colegiado está em prosa, e é anafórico

*"Designar os professores A, B e C para comporem, **sob a presidência do
primeiro**, a banca…"* — o papel de presidente depende da **ordem dos nomes**.
Também aparece como "(presidente)", "membro titular", "membro suplente",
"secretária", em qualquer combinação.

### Quase toda "comissão" do BS é efêmera

Isto surpreende quem chega esperando encontrar colegiados. A esmagadora maioria das
comissões do Boletim é **temporária**: banca de monografia, banca de progressão,
comissão de inventário, comissão eleitoral local, comissão de aceite de obra,
comissão de revisão de regulamento. Nascem num ato, cumprem uma tarefa, somem. Em
2026, 270 atos constitutivos de 3.053.

Os colegiados **permanentes** — com competências, com composição que muda por atos
sucessivos — são **dezenas**, contra **milhares** de efêmeras. São dois objetos
diferentes e não cabem na mesma lista: juntos, os poucos que importam somem debaixo
das bancas.

### O fim de um mandato não gera ato

Vale para qualquer análise de vigência neste corpus. A designação de chefia é
**autolimitada**: ela traz a própria validade (*"com mandato de 04 (quatro)
anos"*). Cumprir o mandato inteiro **não produz ato nenhum** — seria redundante. A
dispensa só aparece quando alguém sai **antes** da hora (medido: 83% das dispensas
saem mais de 90 dias antes do fim do prazo).

Consequência: **o fim do mandato não existe no Boletim.** Só existe se for
calculado. E o corolário incômodo: uma comissão que entregou o trabalho e se
dissolveu em silêncio é, na base, **idêntica** a uma comissão esquecida. Não dá
para distinguir. O máximo honesto é dizer "o prazo venceu e não há ato posterior
desde X".

---

## Parte 4 — Órgãos

- **~1.162 grafias de sigla** no corpus. É deriva histórica de 25 anos, não erro de
  digitação: a Reitoria aparece como GAR, GAR-RET, GARRETUFF, RET, GABR.
  Consolidar é **curadoria** (uma tabela de apelidos), não regex.
- **CEP ≠ CEPEx.** O CEP é o Comitê de Ética em Pesquisa; o CEPEx é o Conselho de
  Ensino, Pesquisa e Extensão. Órgãos completamente diferentes, siglas parecidas.
  Nunca mescle por semelhança.
- A sigla vem colada com lixo, e às vezes o nome do órgão traz a própria sigla
  embutida entre parênteses.

---

## Parte 5 — Texto, OCR e caixa

- **Os PDFs antigos são digitalizações sujas.** Exemplos literais do corpus:
  *"regimento gera!"*, *"monitonia"*, *"claboração"*, *"rociia"*, *"de edezembro"*.
  Busca literal falha; casamento aproximado é obrigatório para 2001–2004.
- **A caixa do título muda com o ano** (ver a linha do tempo). Em 2020 as portarias
  saem em Title Case — *"Portaria Nº 67.634 de 16 de outubro de 2020"* — invisíveis
  a um regex que exija maiúsculas. A âncora segura é o marcador de documento do
  SIGA na linha anterior (`UFFPOR202067634A`), que citações no corpo nunca têm.
- **Cuidado com a collation do banco.** No MySQL com `utf8mb4_unicode_ci`,
  `DECISOES` == `DECISÕES`; em contexto numérico, `'001'` == `'01'` == `'1'`. O
  dedup do Python não concorda com o do banco. Decida onde a comparação acontece.
- **O signatário é capturado errado com frequência.** Vazio em ~10% dos atos
  recentes (772 de 6.785 em 2023; 608 de 8.119 em 2025) e errado em mais ~2% —
  encontramos `signatario = "RESOLVE:"` e `signatario = "ELEITORAL LOCAL PARA A
  ORGANIZAÇÃO DO PROCESSO DE ESCOLHA DE"`. Se o seu produto depende de "quem
  assinou", trate isso como pré-requisito, não como detalhe.

---

## Parte 6 — Os erros que nós cometemos

Cada item abaixo parecia óbvio, foi implementado, e estava errado. Nenhum apareceu
por revisão de código; todos apareceram medindo.

**Comparar nomes sem tirar o acento.** Um aviso de "esta matrícula tem mais de um
nome" disparava para praticamente todo mundo, porque "João Marcel" e "Joao Marcel"
contavam como dois.

**Casar o substantivo junto com o verbo.** Ao ensinar o extrator a reconhecer
"nomear", casamos também "nomeação" — e *"dispensar, em virtude de sua nomeação
para diretor"* passou a ser lido como designação. **34 dispensas reais foram
invertidas.** A regra do dispositivo estava escrita na nossa própria documentação;
violamos assim mesmo.

**Usar o marcador `# # #` como fronteira.** Parecia a solução óbvia do problema
central. Ele já era peça estrutural: **7 atos sumiram, 10 perderam todas as
pessoas.**

**Confiar no bloco de assinatura digital como fim de ato.** É rodapé de página.
Decapitou um ato de várias páginas: 10 membros viraram zero.

**Comparar um build local com outro build local achando que era produção.** Numa
publicação do site, concluímos que o CSS "não tinha mudado" comparando dois builds
feitos com minutos de diferença — e o arquivo no servidor tinha outro nome. O site
subiu sem estilo. Hash de conteúdo não diz nada sobre o que está do outro lado.

**Deixar uma autenticação falhar aberta.** Uma tela protegida por senha consultava
uma rota nova; a API antiga não conhecia a rota, caía no `default` do roteador e
respondia **200** com uma lista qualquer. Como o código só checava o status, a
senha errada **abria a porta**. Autenticação tem que verificar o formato da
resposta, não só o código HTTP.

O padrão comum: **a hipótese era razoável e o corpus discordou.** A única defesa que
funcionou foi rodar a versão velha e a nova sobre dezenas de milhares de atos e
olhar tudo o que mudou — inclusive o que parecia melhoria.

---

## Parte 7 — O que funcionou

- **Rodar velho × novo sobre o corpus inteiro, sempre.** Pegou os 34 invertidos, os
  7 sumidos e os 10 truncados. Sem isso, os três teriam ido para produção parecendo
  melhorias.
- **Fixar cada bug num teste, com o texto real do ato que o revelou.** Os casos
  negativos valem mais que os positivos: cada um existe porque aconteceu.
- **Uma lista de "fronteiras que não são atos".** Mecanismo simples e aditivo que
  resolveu 557 atos de uma vez.
- **Chave estável e legível para o ato**, separada da chave interna do banco.
- **Chave normalizada da unidade**, que casa a mesma unidade escrita de formas
  diferentes entre boletins — sem ela, uma unidade que mudou de grafia vira duas
  posições, e a antiga fica como titular fantasma.
- **Guardar a proveniência ao lado do dado.** Saber se uma data foi *declarada no
  ato* ou *deduzida* é o que separa um painel de um chute com cara de fato.
- **Medir antes de acrescentar.** A tabela de cargos decidiu sozinha quais palavras
  entram — nenhuma opinião foi necessária.

---

## Parte 8 — Sugestão à equipe que produz o Boletim

Nada aqui é crítica ao trabalho de vocês. O BS cumpre a função dele: publicar atos
de forma legível e oficial, e faz isso há décadas. As sugestões abaixo são sobre um
uso que não estava no contrato original — o de ser lido por máquina — e estão em
ordem de impacto.

**1. Publicar os atos também em formato estruturado.** Um JSON, XML ou CSV ao lado
do PDF, com um registro por ato: tipo, número, ano, data, órgão, ementa, processo
SEI, signatário e a lista de pessoas com matrícula e papel. É de longe a mudança de
maior efeito — ela dispensa **todo** o resto deste documento. Se o sistema que gera
o boletim já tem esses campos em banco (e tem, para conseguir imprimir a página),
publicá-los é exportação, não trabalho novo.

**2. Um delimitador de fim de ato, explícito e estável.** O `# # # # # #` já faz
esse papel, e faz bem — só não faz sempre: nasceu em 2002 com cinco `#`, virou seis
em 2004, e **não fecha os atos assinados digitalmente**, que terminam no carimbo do
SIGAEx. Se todo ato terminasse com o mesmo delimitador, incluindo os do SIGAEx, o
problema mais caro deste guia (3,1% dos atos contaminados) deixava de existir.

**3. Dar cabeçalho às seções que não têm.** "Resumo de Despachos e Decisões",
"Alteração de Carga Horária" e "Auxílio Funeral" começam sem nada que as anuncie
como bloco novo. É por isso que são absorvidas pelo ato anterior.

**4. Registrar sempre a matrícula, ao lado do nome.** Um terço a dois terços dos
atos citam pessoas sem matrícula, e nome não identifica ninguém com segurança — há
homônimos, há OCR, e há a mesma pessoa escrita de cinco formas. Quando a pessoa não
for servidor, dizer qual identificador é aquele ("Matrícula UFF", "discente") já
resolve.

**5. Manter o número impresso igual ao do arquivo.** O arquivo `57-26.pdf` traz
"BS nº 113" impresso. Quem indexa pelo número publicado duplica atos.

**6. Exportar PDF de texto, nunca digitalização.** Os boletins de 2001–2004 são
imagem passada por OCR, e o resultado tem "regimento gera!" e "monitonia". Cada
erro desses é um ato que a busca não acha.

**7. Padronizar o vocabulário do dispositivo.** "Nomear/exonerar" para cargo de
direção e "designar/dispensar" para função já é a prática — mantê-la explícita, e
evitar que o mesmo ato misture as duas famílias sem separar os artigos, elimina uma
classe inteira de erro de interpretação.

**8. Nomear o papel de cada membro, em vez de deixá-lo implícito.** "Sob a
presidência do primeiro" obriga qualquer leitor automático a resolver a ordem dos
nomes. "Fulano (presidente)" custa o mesmo e não tem ambiguidade.

Se apenas o item 1 for possível, os outros sete deixam de importar.

---

## Roteiro para quem vai começar agora

1. Amostre o corpus **por ano**, de ponta a ponta, antes de escrever a primeira
   regra. O BS é vários formatos em sequência, não um.
2. Resolva a **fronteira do ato** primeiro. Todo o resto contamina a partir dela.
3. Trate **menção** e **dispositivo** como coisas diferentes, sempre.
4. Normalize o SIAPE tirando zeros à esquerda; guarde o nome **por ato**.
5. Assuma que a busca por matrícula é **incompleta**, e diga isso a quem consulta.
6. Meça antes de acrescentar; rode velho × novo depois. A intuição erra, e o corpus
   responde.

---

*Escrito a partir da experiência de indexar o Boletim de Serviço da UFF no Portal
de Normas e Atos. Os números vêm do corpus de 2001 a 2026 e valem para ele; a
metodologia vale para qualquer um.*
