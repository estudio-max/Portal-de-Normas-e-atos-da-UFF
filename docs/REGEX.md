# Catálogo de expressões regulares

> **Gerado por `tools/gerar_doc_regex.py` a partir do código.** Não edite
> este arquivo à mão: a explicação de cada entrada é o comentário que
> está acima do regex em `tools/extrair_boletim.py`. Para corrigir um
> texto daqui, corrija o comentário lá e rode o gerador de novo.

Todo o entendimento que o portal tem do Boletim de Serviço passa por
estes padrões. O boletim é PDF corrido, sem marcação: não existe campo
"número do ato" nem "início do documento". O que existe é texto, e
estas expressões são a régua que o transforma em registro.

Por isso mexer aqui é a operação mais arriscada do projeto. Um padrão
frouxo inventa atos que não existem; um restritivo demais apaga atos
reais, e o prejuízo só aparece meses depois, numa contagem que ninguém
conferiu. A regra da casa é **medir antes e depois, sobre uma amostra
ampla do acervo** (`dados/boletins/`), nunca só sobre o PDF que motivou
a mudança.

## Achar onde um ato começa e termina

O problema central do extrator. O boletim é um PDF corrido: nada nele marca o fim de um ato e o início do outro. Estes padrões são a única coisa separando um acervo indexado de um blocão de texto.

### `TITULO_RE`

`extrair_boletim.py:135`

Título de um ato. Ex.:
DETERMINAÇÃO DE SERVIÇO COLUNI/UFF Nº. 20, DE 12 DE JUNHO DE 2026
PORTARIA Nº 1004, DE 10 DE JUNHO DE 2026
RESOLUÇÃO CEPEX/UFF Nº 004 AR, DE 10 DE JUNHO DE 2026
PORTARIA N.º 54.919 de 11 de novembro de 2015
DETERMINAÇÃO DE SERVIÇO DDRH, Nº. 068 de 20 de julho de 2010  (vírgula antes do Nº)
DETERMINAÇÃO DE SERVIÇO — HUAP - nº 58, de 26 de setembro de 2000  (travessão)
RESOLUÇÃO CEPEx/UFF Nº 224, DE 14 DE JULHO DE 2021  (sigla com minúscula)

O grupo ÓRGÃO agora aceita minúscula (além de maiúscula/dígito/pontuação, como
sempre foi). É o que salva "CEPEx" — a grafia real que o CEPEx usou de ~2021 a
meados de 2025 antes de padronizar para "CEPEX". Achado real: com o charset
só-maiúsculas, o "x" minúsculo quebrava o TITULO_RE por completo e a resolução
inteira desaparecia (virava corpo do ato anterior) — medido em boletins reais:
~140-280 ocorrências por amostra de 40 boletins em 2022-2024 (a esmagadora
maioria das resoluções do CEPEx desses 3 anos), o que também explica um
"buraco" que a aba Cooperação expôs (2021 zerado).

CUIDADO — já houve uma versão anterior aqui com `(?:[MAIÚSC][MAIÚSCla-zà-ÿ]*|
[pontuação])*?` (alternância de grupos, tentando restringir a minúscula a
"cauda de token que começa maiúsculo"): CATASTRÓFICA. Duas formas de a mesma
sequência de maiúsculas ser particionada pelo grupo repetido = backtracking
exponencial. Travou de verdade (testado: >15s e nunca terminou) num texto
adversarial de ~750 chars sem o "Nº" no fim — que é exatamente a forma do
CORPO de qualquer ato, já que o TITULO_RE roda `.finditer()` no texto inteiro
do boletim, não só em cabeçalhos. Uma CLASSE DE CARACTERES ÚNICA (sem
alternância/aninhamento) não tem essa ambiguidade — cada posição do texto só
tem UMA forma de ser consumida — e o quantificador `{0,40}?` (limitado, não
`*`) elimina o resto do risco. Medido: 0ms contra 30.000 chars adversariais.
Isso é MENOS restritivo que a tentativa anterior (aceita minúscula solta, não
só cauda de token maiúsculo) — testado que ainda não vira falso positivo em
citação de prosa, porque a âncora real é o TIPO em maiúsculas plenas antes,
não o charset do órgão.

```python
r"(?P<tipo>%s)\s+"
    r"(?P<orgao>[A-ZÀ-Úa-zà-ÿ0-9/().\-–— ]{0,40}?)?,?\s*"
    % TIPOS_RE + _TIT_NUM_DATA
```

### `TITULO_SIGA_RE`

`extrair_boletim.py:146`

Portarias emitidas pelo SIGA em ALGUNS anos (ex.: 2020) saem em Title Case
("Portaria Nº 67.634 de 16 de outubro de 2020") — invisíveis ao TITULO_RE,
que exige TIPO em CAIXA ALTA. A âncora segura é o marcador de documento SIGA
("UFFPOR202067634A") na linha imediatamente anterior — citações no corpo do
texto nunca têm esse marcador, então não há falso positivo.

```python
r"UFF[A-Z]{3}\d{6,}[A-Z]?\s*\n\s*"
    r"(?P<tipo>Portaria|PORTARIA)(?P<orgao>)\s+" + _TIT_NUM_DATA
```

### `TITULO_CURTO_RE`

`extrair_boletim.py:176`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Marcador de fim/início de ato usado em todo o corpus: OU o separador de
hashes entre atos na mesma página, OU o cabeçalho/rodapé de página
("PÁG. 09") quando o ato começa bem no topo da página seguinte. Ancora com
segurança formatos CURTOS de título que não têm data por extenso na mesma
linha — comuns em Decisões/Resoluções de colegiados (CEP/CUV) em anos mais
antigos: "DECISÃO N.º 026/2012", "RESOLUÇÃO 18/2002" (às vezes sem "Nº"
nenhum). Como citações no corpo NUNCA vêm logo após um desses marcadores nem
são seguidas de linha em branco, não há risco de falso título.

O separador tem CINCO hashes em 2002-2003 e SEIS de 2004 em diante — medido
no corpus: 2002 tem 90 sequências de 5 contra 14 de 6; 2003, 208 de 5 e zero
de 6; 2004+, só 6. Exigir seis (como era até 16/07/2026) cegava o extrator
justamente nos anos de cinco. Aceitar 5-ou-6, medido sobre os anos INTEIROS:
2002 +189 atos (+19%), 2003 +121 (+15%), 2004 +9, e ZERO atos perdidos em
qualquer ano de 2001 a 2026. Os recuperados são Decisões reais do CEP em
numeração sequencial (642, 643, 645...), que é o formato curto que este
regex existe para ancorar.
2001 ganha ZERO aqui, e não é falha do regex: naquele ano o BS é digitalizado
e o OCR de época transformou todo "# # # # #" em lixo ("HNHUA", "hehe") — não
há hash nenhum no texto para casar. Só um re-OCR recupera aquele ano.
Não aceite QUATRO: as 21 sequências de 4 medidas em 2002 não foram
investigadas e o ganho não compensa o risco de casar coisa que não é
separador.

```python
r"%s\s*\n\s*"
    r"(?P<tipo>DECISÃO|RESOLUÇÃO)(?P<orgao>)\s+"
    r"(?:[Nn]%s\s*)?(?P<numero>[\d\.]+)\s*/\s*(?P<ano>\d{2,4})\s*\.?"
    r"(?P<dia>)(?P<mes>)"
    r"(?=[ \t]*\n[ \t]*\n)"
    % (_ATO_BOUNDARY, _ORD)
```

### `BOUNDARY_NAO_ATO_RE`

`extrair_boletim.py:223`

Cabeçalhos de documentos publicados no BS que NÃO são "atos" no vocabulário
do app (extrato de contrato/convênio, termo de homologação/adesão, ata de
registro de preços — não têm tipo_ato próprio) mas SÃO um documento novo
começando. Sem reconhecê-los, o corpo do ATO ANTERIOR "engolia" o documento
inteiro até o próximo título REAL (achado 12/07/2026: DTS PROAD 61/2025
ganhou um "prazo de 12 meses" que pertencia a um Extrato de Instrumento
Convenial sobre um terminal portuário, publicado logo depois no boletim —
557 atos afetados no corpus, 91% só de "Extrato de Instrumento Convenial").
Só serve de FRONTEIRA (corta o corpo do ato anterior aqui); não vira ato
próprio — ver uso de BOUNDARY_NAO_ATO_RE em parse_pdf().

15/07/2026: mesma classe de bug, achada por outro caminho — seções sem
cabeçalho de ato próprio ("Resumo de Despachos e Decisões", "Alteração de
Carga Horária", "Auxílio Funeral") ficavam penduradas no ato anterior. Caso-
prova: a Portaria 64.814/2019 (Comissão Interna de Conservação de Energia)
nomeia 9 servidores; o extrator lhe atribuía 22 — os 13 extras eram só
alterações de carga horária publicadas na sequência do mesmo boletim.
Medido nos 78.994 atos do corpus: 2.414 atos (3,1%) engolem uma dessas
seções. "RESUMO DE DESPACHOS E DECISÕES" sozinho cobre 2.343 (97,1%).

SÓ este marcador entrou. "AUXÍLIO FUNERAL" e "ALTERAÇÃO DE CARGA HORÁRIA"
foram cogitados e DESCARTADOS — ver docs/GUIA-EXTRACAO-BS.md:
- "Auxílio Funeral" às vezes imprime como "Assunto: Auxílio Funeral."
(Title Case, não caixa alta), então só pega com match
case-insensitive — e caiu junto lixo: "com alteração de carga
horária" aparece dentro do dispositivo de atos REAIS (DTS 16/2024,
sobre mudança de regime de trabalho), então case-insensitive teria
decapitado atos legítimos por 2 casos a mais só.
- A prova que fechou a decisão: um ato real de 2015 cita "Autorizo o
cancelamento dos efeitos do Resumo de Despachos e Decisões n°
62/2012" em Title Case, como referência — não como cabeçalho. Se o
match fosse case-insensitive, esse ato teria sido cortado ali.

Por isso o match é SEMPRE case-sensitive, igual às fronteiras acima:
"RESUMO DE DESPACHOS E DECISÕES" imprime em caixa alta pura como título de
seção (confirmado em amostra de 9 anos, 2005-2026, 248 ocorrências, 1 única
exceção — a citação Title Case acima, que o case-sensitive já rejeita
corretamente). Citação em prosa normal não sai em caixa alta.

```python
r"(?P<tipo>EXTRATO DE INSTRUMENTO CONVENIAL|EXTRATO DE CONTRATO|EXTRATO DE TERMO ADITIVO"
    r"|EXTRATO DE CONV[ÊE]NIO|TERMO DE HOMOLOGA[ÇC][ÃA]O|TERMO DE ADES[ÃA]O"
    r"|ATA DE REGISTRO DE PRE[ÇC]OS"
    r"|RESUMO DE DESPACHOS E DECIS[ÕO]ES)"
```

### `_RESOLVE_CORTE`

`extrair_boletim.py:1083`

Fronteira entre o preâmbulo do ato e o dispositivo. Ao procurar o nome de uma
pessoa ANTES de uma matrícula, a janela de busca não pode atravessar o
"RESOLVE:" para trás — do outro lado ficam a autoridade que assina e os nomes
citados nos "considerandos", que não são a pessoa do registro. Cortando ali, a
janela pôde crescer de 170 para 230 caracteres sem passar a errar.
Os `\s*` entre as letras são para o espaçamento tipográfico do boletim, que
publica "R E S O L V E" espaçado com frequência.

```python
r"(?i)\bR\s*E\s*S\s*O\s*L\s*V\s*E"
```

## Recusar o que parece ato mas não é

Uma norma antiga CITADA dentro de outro documento tem a mesma forma de um título. Sem estas guardas, a citação vira um ato fantasma com data errada, e o mesmo ato aparece várias vezes vindo de boletins diferentes.

### `_FRAGMENTO_INI_RE`

`extrair_boletim.py:480`

Ato cujo ANO fica muito atrás do ano do BOLETIM quase nunca é ato: é uma
CITAÇÃO de norma antiga que o recorte tratou como cabeçalho, ou um pedaço de
corpo ("que designou…", "considerando Processo…", "Art. 2º…", "resolve:").

Medido nos 60 boletins de 2026 (3.250 atos): gap 0 = 3.042, gap 1 = 186
(ato de dezembro publicado em janeiro — legítimo), gap 2 = 9, gap>=3 = 13.
Os 13 eram TODOS fragmento ou citação, vários repetidos (a Portaria 1.335/2021
aparecia 4x, recortada de boletins diferentes que a citavam).

Exige TAMBÉM a forma de fragmento (começa em minúscula, vazio, ou abre com
que/considerando/resolve/a saber/Art.). Só o gap não basta: o boletim de 2001,
digitalizado, publica backlog REAL de 1998-2000 com ementa própria — esse
precisa continuar entrando. Sem a segunda condição, a guarda comeria 100 atos
legítimos daquele ano.
SEM re.IGNORECASE de propósito: a classe de MINÚSCULAS é metade do sinal
("do Ministério…", "que designou…" começam minúsculo porque foram recortados
do meio de uma frase). Com re.I, `[a-zà-ö…]` casaria maiúscula também e a
condição viraria letra morta — a guarda degeneraria em "só o gap" e passaria a
derrubar ato legítimo de ementa normal (medido: derrubava "DESIGNAR os
docentes…" e "As bolsas são distribuídas…", que começam em maiúscula).

A classe de PONTUAÇÃO órfã veio depois, do backfill de 2021-2024: 3 fantasmas
escaparam por abrirem com ")", "●" e "§" — recorte no meio de uma lista ou de
um parágrafo, forma de fragmento tão clara quanto a minúscula, mas que a
classe original não via. Medido nos 27.536 atos de 2021-2024: derruba 13, todos
fragmento inequívoco. Regressão em 2001 (o controle, onde caractere-lixo de OCR
no início de ementa seria esperado): +0, nada a mais cai.

```python
r"^\s*$"                                             # ementa vazia
    r"|^\s*[a-zà-öø-ÿ]"                                  # começa em minúscula
    r"|^\s*[
```

### `_QUE_ANTES_RE`

`extrair_boletim.py:1523`

Retificação que CITA uma concessão anterior: "...a portaria nº X de DD/MM/AAAA,
publicada no DOU..., QUE concedeu aposentadoria a fulano..." — "que" logo antes
do verbo é oração relativa (descreve a portaria REFERENCIADA), não o dispositivo
deste ato (cujo verbo real é "alterar/retificar", visto no início do "resolve:").
Achado real: sem isso, retificações de fundamentação legal/proporcionalidade
eram contadas como concessões novas — 34% dos casos no legado 2001-2014,
11% em 2015-2022 (a compulsória "quase 0" nunca foi por causa disso, mas a
poluição existia e inflava as contagens).

```python
r"\bque\s*$", re.I
```

## Ler o cabeçalho do boletim

Identificam a edição: número, ano, data e a seção/página em que o ato saiu. A identidade real do boletim é o nome do ARQUIVO — o número impresso diverge — mas estes campos entram como enriquecimento.

### `HEADER_BS_RE`

`extrair_boletim.py:322`

Linha de cabeçalho repetida em cada página do ato

```python
r"UNIVERSIDADE FEDERAL FLUMINENSE.{0,5}BOLETIM DE SERVIÇO", re.I
```

### `ANO_NUM_RE`

`extrair_boletim.py:324`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Linha de cabeçalho repetida em cada página do ato

```python
r"ANO\s+([IVXLCDM]+)\s*.{0,4}\s*N%s\s*(\d+)" % _ORD, re.I
```

### `DATA_BS_RE`

`extrair_boletim.py:325`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Linha de cabeçalho repetida em cada página do ato

```python
r"\b(\d{2}/\d{2}/\d{4})\b"
```

### `SECAO_RE`

`extrair_boletim.py:326`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Linha de cabeçalho repetida em cada página do ato

```python
r"SEÇÃO\s+([IVX]+)\s+(?:PÁG|P)\.?\s*0?(\d+)", re.I
```

## Identificadores: processo, documento, matrícula

Números que ligam o ato a outros sistemas da UFF (SEI) e a pessoas (SIAPE). São o que permite responder "quais atos citam a minha matrícula".

### `PROC_RE`

`extrair_boletim.py:231`

Processo SEI: 23069.166342/2026-40  (aceita espaços no lugar de . / -)

```python
r"23069[.\s]\d{6}[/\s]\d{4}[-\s]\d{2}"
```

### `SEI_DOC_RE`

`extrair_boletim.py:233`

Código verificador SEI: "SEI nº 3441183"  ou  "(3442574)"

```python
r"SEI\s*n%s\s*(\d{6,8})" % _ORD
```

### `SEI_DOC_PAREN_RE`

`extrair_boletim.py:234`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Código verificador SEI: "SEI nº 3441183"  ou  "(3442574)"

```python
r"\((\d{6,8})\)"
```

### `SIAPE_RE`

`extrair_boletim.py:239`

Matrícula SIAPE: "SIAPE 1642620", "Siape nº 1642620", "Matrícula SIAPE nº 2364493".
Consome também a abreviação de "Matrícula" colada/pontuada ("Mat. SIAPE 123",
"MATSIAPE 123") — senão o "MAT" era absorvido como sobrenome ("...SANTOS MAT").

```python
r"(?:\b(?:matr[íi]cula|mat)\.?\s*)?(?:SIAPE|Siape)[:\s]*n?%s\s*(\d{6,7})" % _ORD, re.I
```

## Nomes de pessoas

Capturar nome próprio em texto livre é heurística, não certeza. Os dois padrões convivem porque o boletim mudou de estilo: houve época de CAIXA ALTA e época de Title Case.

### `NOME_RE`

`extrair_boletim.py:315`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Conector: inclui "d'Aquino"/"d'Ávila" inteiros (senão o "d'" corta o sobrenome).
"d[aeo]s?" e não "de|da|do|das|dos": na alternância, "do" casa antes e
esconde "dos" (o motor não volta atrás), partindo "Lenin dos Santos Pires"
em "Lenin do" + "Santos Pires".

```python
r"%s(?:\s+(?:%s|%s)){1,6}" % (_PALAVRA_NOME, _CONN, _PALAVRA_NOME)
```

### `NOME_CAPS_RE`

`extrair_boletim.py:319`

Run de CAIXA ALTA não aceita conector minúsculo: nome oficial em caps usa
"DOS/DE" também em caps (casam como palavra), e o minúsculo no meio denuncia
sigla/rótulo ("Comissão CG/PROX do PPGQ"), que virava nome.

```python
r"%s(?:\s+%s){1,6}" % (_PALAVRA_CAPS, _PALAVRA_CAPS)
```

### `_NAO_NOME`

`extrair_boletim.py:1235`

Palavras que denunciam que o "nome" é na verdade um coletivo/genérico.

```python
r"\b(comiss|membro|docente|servidor|professor|grupo|equipe|"
                       r"seguinte|abaixo|relacionad)", re.I
```

### `_NOMEIA_EXT`

`extrair_boletim.py:1233`

A vírgula depois do nome é opcional: portarias de convidado externo tanto
escrevem "Nomear FULANO, para exercer" quanto "Nomear FULANO para exercer"
(ex.: Vera Cajazeiras, Pró-Reitora de Administração convidada). O "para
exercer" logo após o nome já é âncora forte o bastante.

```python
r"\b[Nn]omear\s+(?P<nome>" + _NOME_PROP + r")\s*,?\s*para\s+exercer\b"
```

## Ementa: a frase que resume o ato

A ementa é por onde se pesquisa. Quando o ato não traz uma formal, o extrator sintetiza uma a partir do dispositivo — e aí precisa cortar preâmbulo, boilerplate e enumeração para sobrar a frase que interessa.

### `PREAMBULO_RE`

`extrair_boletim.py:821`

"Ementa" que na verdade é o PREÂMBULO do ato: a autoridade + "no uso de suas
atribuições" logo no início (sem frase de ementa antes). Acontece quando o
corte por autoridade não pega a variação de grafia — melhor detectar e tratar
como sem-ementa (inferindo do dispositivo) do que exibir o preâmbulo na ficha.

```python
r"(?i)^[^.;]{0,80}\bno uso d(?:e suas?\b|e atribui\w*|as?\s+(?:atribui|compet)\w*)"
```

### `BOILERPLATE_EMENTA_RE`

`extrair_boletim.py:827`

"Ementa" que é só a cláusula de vigência/fecho do ato ("Esta DTS entrará em
vigor na data de sua assinatura. DOCUMENTO ASSINADO..."): ato sem ementa cujo
corpo começou a ser lido no lugar errado — trata como sem-ementa e infere.

```python
r"(?i)^\s*est[ae]\s+(?:dts|determina\w*(?:\s+de\s+servi[çc]o)?|portaria|"
    r"resolu[çc][ãa]o|instru[çc][ãa]o(?:\s+normativa)?|norma|ordem|decis[ãa]o)\b"
    r"[^.;]{0,40}\bentrar?[áa]?\s+em\s+vigor"
```

### `_ENUM_EMENTA_RE`

`extrair_boletim.py:912`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

--------------------------------------------------------------------------- #
Ementa INFERIDA: para atos sem ementa formal, resume o próprio dispositivo
(o texto após "resolve:") em 3ª pessoa. NÃO inventa nada — usa as palavras do
ato. O resultado é marcado como inferido (ementa_inferida=True) para o portal
exibir como "resumo automático", nunca confundido com a ementa oficial.
--------------------------------------------------------------------------- #
Verbo do dispositivo (infinitivo) -> forma na 3ª pessoa do singular.

```python
r"(?i)^\s*(?:art\.?\s*\d+[ºo°.\-]*\s*[-–]?\s*|[ivx]{1,4}\s*[-–.)]\s*|"
    r"\d+\s*[-–.
```

### `_STOP_EMENTA_RE`

`extrair_boletim.py:917`

Corte do objeto: ";" ou "." de fim de frase (NÃO o "." interno de nº de
processo "23069.002753"), próximo item (II-, IV-), ou início de cláusula acessória.

```python
r"(?i)(?:;|\.(?=\s|$)|\bII+\s*[-–]|\bIV\s*[-–]|,?\s*\bmatr[íi]cula\b|,?\s*\bsiape\b|"
    r",?\s*\bc[óo]digo\b|\ba partir\b|\bcom valid|\bpelo per[íi]odo\b|\bno per[íi]odo\b|"
    r"\btendo em vista\b|\bem virtude\b|\bnos termos\b|\bem substitui|"
    r"\bpublique-se\b|\bregistre-se\b|\bfica\b)"
```

### `_CLAUSULA_INI_RE`

`extrair_boletim.py:924`

Cláusula acessória inicial a descartar para chegar ao objeto real. Ex.:
"dispensar, A PEDIDO, A PARTIR DE 04/08/2025, Fulano..." -> "Fulano...".

```python
r"(?i)^\s*,?\s*(?:"
    r"consoante\b[^,]*|conforme\b[^,]*|nos termos\b[^,]*|tendo em vista\b[^,]*|"
    r"de acordo com\b[^,]*|com base n[oa]\b[^,]*|a pedido|"
    r"a partir d[eo]\b[^,]*|a contar d[eo]\b[^,]*|com efeitos?\b[^,]*|"
    r"pelo per[íi]odo\b[^,]*|no per[íi]odo\b[^,]*|retroativ[oa]\b[^,]*|"
    r"em car[áa]ter\b[^,]*|por \d+[^,]*"
    r")\s*,\s*"
```

### `ACAO_EMENTA_RE`

`extrair_boletim.py:345`

Verbo no início da ementa -> natureza do ato (para classificação rápida)

```python
r"^\s*(Altera|Revoga|Substitui|Retifica|Republica|Designa|Designar|Dispõe|"
    r"Prorroga|Torna|Aprova|Cria|Institui|Estabelece|Nomeia|Exonera|Dispensa|"
    r"Concede|Autoriza|Delega|Constitui|Homologa|Cancela|Suspende|Anula)", re.I
```

## Relações entre atos (revoga, altera, cita)

O que o portal acrescenta ao acervo: um ato não anuncia a própria revogação, ela é publicada anos depois em outro ato. Estes padrões acham a referência; quem resolve o alvo é o resolver_relacoes_v2.php.

### `REF_RE`

`extrair_boletim.py:365`

Aceita as DUAS grafias do número do ato citado:
• com marcador "nº":  "DTS GES/INF/UFF nº 16, de 22/08/2025"  (ano opcional /AAAA)
• forma COMPACTA sem "nº":  "DTS GHT 07/2023"  (sigla + NN/AAAA) — muito usada
em revogações ("Revoga a DTS GHT 07/2023"). Exige "/AAAA" p/ NÃO capturar
número solto (artigo, processo, "Lei 8.112/90"); o tipo já vem da whitelist
REF_TIPOS e a relação só é registrada se houver verbo (revoga/altera/...).
Órgão: cada token COMEÇA com letra — senão, na forma compacta "GHT 07/2023" o
órgão (que aceita dígitos p/ siglas tipo "GES/INF/UFF") engoliria o "0" do
número ("GHT 0" + "7/2023"). Exigir letra inicial deixa o número intacto.

```python
r"(?P<tipo>(?i:%s))\s+"
    r"(?P<orgao>[A-ZÀ-Ú][A-ZÀ-Ú0-9/().]{0,24}(?:\s[A-ZÀ-Ú][A-ZÀ-Ú0-9/().]{0,14}){0,3})?\s*"
    r"(?:"
    r"[nN]%s\s*(?P<numero>\d[\d\.]*(?:\s*[A-Z]{1,4})?)(?:\s*/\s*(?P<ano>\d{4}))?"
    r"|"
    r"(?P<numero2>\d{1,4})\s*/\s*(?P<ano2>\d{4})"
    r")" % (REF_TIPOS, _ORD)
```

### `BS_REF_RE`

`extrair_boletim.py:375`

Referência a outro Boletim: "publicada no BS nº 102, de 01/09/2025"

```python
r"BS\s*n%s\s*(\d+)\s*,?\s*de\s*(\d{2}/\d{2}/\d{4})" % _ORD, re.I
```

## Chefias: quem foi designado para quê

Designação e dispensa de função. A armadilha documentada aqui é classificar pelo DISPOSITIVO e não por menção: "dispensar em virtude de sua nomeação" é uma dispensa, não uma nomeação.

### `FUNCAO_RE`

`extrair_boletim.py:1190`

A vírgula só encerra a unidade quando NÃO for parte do próprio nome: em
"Pró-Reitor de Pesquisa, Pós-Graduação e Inovação" a vírgula é interna
(seguida de Palavra Capitalizada) e truncava a unidade em só "Pesquisa" —
fragmentando a chave e quebrando o pareamento designação↔exoneração.
Vírgula seguida de minúscula ("Divisão X, da Superintendência...") continua
encerrando (o que vem depois é o órgão-pai, não parte do nome).
O traço opcional antes dos marcadores cobre "... e Inovação - Código CD-2".
O sufixo de gênero "(a)"/"(A)" colado no cargo ("Pró-Reitor(a) da...",
"Coordenador(a) do...", comum em portarias de nomeação) impedia o casamento
do conector logo depois do cargo — a designação inteira era perdida.

```python
_TRIG_FUNC + _CARGO_G + r"(?:\s*\([aA]\))?\s+" + _CONECT_CU + r"\s+"
    r"(?P<unidade>[A-ZÀ-Úa-zà-ú(][^;:.]{2,90}?)"
    r"(?=\s*(?:[-–—]\s*)?(?:,(?!\s*(?-i:[A-ZÀ-Ú][a-zà-ú]))|;|\.|:|\bc[óo]digo\b|\bc[óo]d\b|\bs[íi]mbolo\b|\bFG[- ]?\d|\bCD[- ]?\d|"
    r"\bFCC\b|\bFUC\b|\bn[.ºo°]|\ba partir\b|\bpelo per|\bno per[íi]odo\b|\bcom valid|"
    r"\bem substitui|\bda Universidade\b|/UFF|\bem virtude\b|\bdurante\b|$))", re.I)

_TIPO_SO_UNID = {"curso", "departamento", "programa", "instituto", "faculdade", "escola",
                 "divisao", "secao", "setor", "nucleo", "coordenacao", "coordenadoria",
                 "diretoria", "gerencia", "reitoria", "unidade", "polo", "colegiado"}
# "nomear/nomeia" é o par de ENTRADA dos cargos de direção (CD), como
# "designar" é o das funções — e faltava aqui, embora "exoner" (a SAÍDA do CD)
# já estivesse. A assimetria não era inofensiva: numa portaria que exonera um e
# nomeia outro no mesmo texto (padrão comum), a janela achava só o "Exonerar"
# anterior e o NOMEADO entrava como dispensado — erro invertido e silencioso.
#
# O (?!c) é o que separa VERBO de MENÇÃO, e não é detalhe: só o VERBO conta,
# porque é ele o dispositivo. O substantivo "nomeação" aparece em oração
# explicativa dando o MOTIVO de uma dispensa — "dispensar, em virtude de sua
# nomeação para diretor do Centro..." — e como _acao_func fica com o ÚLTIMO
# verbo da janela, casar o substantivo invertia 34 dispensas reais em
# designações (medido). Mesma regra que já vale para aposentadoria: classifique
# pelo dispositivo, não por menção. _fold() tira o acento, então "nomeação"
# chega aqui como "nomeacao" — daí excluir o "c" seguinte, que deixa passar
# nomear/nomeado/nomeada. "nomei" cobre a ementa ("Nomeia").
_VERBO_FUNC = re.compile(r"design|nomea(?!c)|nomei|dispens|exoner|destitu")
_SUBST_FUNC = re.compile(r"(?i)substitut|eventual|pro\s*tempore|respond|interin|exerc[íi]cio eventual")
_ANAFORA_UNID = re.compile(r"\b(referid|mesm|respectiv|citad|aludid|supracitad|present|seguinte|propri)")

# Nomeação de pessoa EXTERNA (convidado/sem vínculo => SEM SIAPE): p.ex. o Reitor
# "Nomear Marina Vieira Gontijo, para exercer como Convidado, o Cargo de
# Superintendente da ...". Como não há matrícula, o nome é o único identificador.
# Só captura com verbo de nomeação + Nome Próprio (capitalizado) + "para exercer"
# logo antes do gatilho do cargo — a exigência de SIAPE é o que segura o ruído
# nos demais casos, então este atalho tem que ser bem restrito.
# Nome próprio em Title Case OU CAIXA ALTA (portarias de nomeação usam os dois):
# token começa com maiúscula e o resto pode ser maiúsculo ("MARINA") ou
# minúsculo ("Marina"); conectores de/da/dos entre os tokens em qualquer caixa.
_NOME_PROP = r"[A-ZÀ-Ú][A-ZÀ-Úa-zà-ú]+(?:\s+(?:d[aeo]s?\s+|D[AEO]S?\s+)?[A-ZÀ-Ú][A-ZÀ-Úa-zà-ú]+){1,4}"
# A vírgula depois do nome é opcional: portarias de convidado externo tanto
# escrevem "Nomear FULANO, para exercer" quanto "Nomear FULANO para exercer"
# (ex.: Vera Cajazeiras, Pró-Reitora de Administração convidada). O "para
# exercer" logo após o nome já é âncora forte o bastante.
_NOMEIA_EXT = re.compile(r"\b[Nn]omear\s+(?P<nome>" + _NOME_PROP + r")\s*,?\s*para\s+exercer\b")
# Palavras que denunciam que o "nome" é na verdade um coletivo/genérico.
_NAO_NOME = re.compile(r"\b(comiss|membro|docente|servidor|professor|grupo|equipe|"
                       r"seguinte|abaixo|relacionad)", re.I)


def _nome_externo_antes(trecho, pos_gatilho):
    """Nome do convidado nomeado, quando o ato não traz SIAPE. Exige que a
    nomeação ('Nomear FULANO, para exercer') termine logo antes do gatilho do
    cargo (até ~50 chars de 'como Convidado,' no meio). Senão retorna ''."""
    jan_ini = max(0, pos_gatilho - 150)
    jan = trecho[jan_ini:pos_gatilho]
    ult = None
    for x in _NOMEIA_EXT.finditer(jan):
        ult = x
    if not ult:
        return ""
    if pos_gatilho - (jan_ini + ult.end()) > 50:   # nome longe do cargo: não é a mesma frase
        return ""
    if _NAO_NOME.search(ult.group("nome")):         # coletivo/genérico, não é pessoa
        return ""
    return _limpa_nome(ult.group("nome"))


# Mandato da designação: PRAZO e DATA DE INÍCIO ----------------------------- #
# A designação de chefia é AUTOLIMITADA — ela traz a própria validade ("com
# mandato de 04 (quatro) anos"). Por isso o Boletim quase nunca publica a
# "revogação" ao fim do mandato: ela seria redundante. A dispensa, quando
# aparece, é o ato de encerrar ANTES da hora (medido no corpus: 83% das
# dispensas saem >90 dias antes do fim do prazo). Consequência prática: o fim
# do mandato só existe como DADO se for calculado daqui — não há ato para ele.
#
# Ancorar em "mandato" é obrigatório, não conveniência: o corpus tem "pelo
# prazo de 03 (três) anos" em LICENÇA para tratar de interesses particulares,
# que não é mandato nenhum. Casar "N (extenso) anos" solto importaria isso como
# se fosse prazo de chefia. Mesmo princípio de intent-anchoring da aba Prazos.
_MANDATO_RE = re.compile(r"mandato\s+de\s+(?P<n>\d{1,2})\s*\(", re.I)
# A unidade vem DEPOIS do extenso entre parênteses ("04 (quatro) anos"), então
# tem que pular o fecha-parênteses antes de ler "anos"/"meses".
_MANDATO_UNID_RE = re.compile(r"^[^)]{0,20}\)\s*(?P<unid>m[eê]s(?:es)?|anos?)", re.I
```

### `_VERBO_FUNC`

`extrair_boletim.py:1215`

"nomear/nomeia" é o par de ENTRADA dos cargos de direção (CD), como
"designar" é o das funções — e faltava aqui, embora "exoner" (a SAÍDA do CD)
já estivesse. A assimetria não era inofensiva: numa portaria que exonera um e
nomeia outro no mesmo texto (padrão comum), a janela achava só o "Exonerar"
anterior e o NOMEADO entrava como dispensado — erro invertido e silencioso.

O (?!c) é o que separa VERBO de MENÇÃO, e não é detalhe: só o VERBO conta,
porque é ele o dispositivo. O substantivo "nomeação" aparece em oração
explicativa dando o MOTIVO de uma dispensa — "dispensar, em virtude de sua
nomeação para diretor do Centro..." — e como _acao_func fica com o ÚLTIMO
verbo da janela, casar o substantivo invertia 34 dispensas reais em
designações (medido). Mesma regra que já vale para aposentadoria: classifique
pelo dispositivo, não por menção. _fold() tira o acento, então "nomeação"
chega aqui como "nomeacao" — daí excluir o "c" seguinte, que deixa passar
nomear/nomeado/nomeada. "nomei" cobre a ementa ("Nomeia").

```python
r"design|nomea(?!c)|nomei|dispens|exoner|destitu"
```

### `_SUBST_FUNC`

`extrair_boletim.py:1216`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

"nomear/nomeia" é o par de ENTRADA dos cargos de direção (CD), como
"designar" é o das funções — e faltava aqui, embora "exoner" (a SAÍDA do CD)
já estivesse. A assimetria não era inofensiva: numa portaria que exonera um e
nomeia outro no mesmo texto (padrão comum), a janela achava só o "Exonerar"
anterior e o NOMEADO entrava como dispensado — erro invertido e silencioso.

O (?!c) é o que separa VERBO de MENÇÃO, e não é detalhe: só o VERBO conta,
porque é ele o dispositivo. O substantivo "nomeação" aparece em oração
explicativa dando o MOTIVO de uma dispensa — "dispensar, em virtude de sua
nomeação para diretor do Centro..." — e como _acao_func fica com o ÚLTIMO
verbo da janela, casar o substantivo invertia 34 dispensas reais em
designações (medido). Mesma regra que já vale para aposentadoria: classifique
pelo dispositivo, não por menção. _fold() tira o acento, então "nomeação"
chega aqui como "nomeacao" — daí excluir o "c" seguinte, que deixa passar
nomear/nomeado/nomeada. "nomei" cobre a ementa ("Nomeia").

```python
r"(?i)substitut|eventual|pro\s*tempore|respond|interin|exerc[íi]cio eventual"
```

### `_ANAFORA_UNID`

`extrair_boletim.py:1217`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

"nomear/nomeia" é o par de ENTRADA dos cargos de direção (CD), como
"designar" é o das funções — e faltava aqui, embora "exoner" (a SAÍDA do CD)
já estivesse. A assimetria não era inofensiva: numa portaria que exonera um e
nomeia outro no mesmo texto (padrão comum), a janela achava só o "Exonerar"
anterior e o NOMEADO entrava como dispensado — erro invertido e silencioso.

O (?!c) é o que separa VERBO de MENÇÃO, e não é detalhe: só o VERBO conta,
porque é ele o dispositivo. O substantivo "nomeação" aparece em oração
explicativa dando o MOTIVO de uma dispensa — "dispensar, em virtude de sua
nomeação para diretor do Centro..." — e como _acao_func fica com o ÚLTIMO
verbo da janela, casar o substantivo invertia 34 dispensas reais em
designações (medido). Mesma regra que já vale para aposentadoria: classifique
pelo dispositivo, não por menção. _fold() tira o acento, então "nomeação"
chega aqui como "nomeacao" — daí excluir o "c" seguinte, que deixa passar
nomear/nomeado/nomeada. "nomei" cobre a ementa ("Nomeia").

```python
r"\b(referid|mesm|respectiv|citad|aludid|supracitad|present|seguinte|propri)"
```

## Mandatos e prazos

Quanto dura uma designação e quando ela começou a contar. O fim de um mandato normalmente não gera ato, então o máximo honesto é "o prazo venceu e não há ato posterior".

### `_MANDATO_RE`

`extrair_boletim.py:1269`

Mandato da designação: PRAZO e DATA DE INÍCIO ----------------------------- #
A designação de chefia é AUTOLIMITADA — ela traz a própria validade ("com
mandato de 04 (quatro) anos"). Por isso o Boletim quase nunca publica a
"revogação" ao fim do mandato: ela seria redundante. A dispensa, quando
aparece, é o ato de encerrar ANTES da hora (medido no corpus: 83% das
dispensas saem >90 dias antes do fim do prazo). Consequência prática: o fim
do mandato só existe como DADO se for calculado daqui — não há ato para ele.

Ancorar em "mandato" é obrigatório, não conveniência: o corpus tem "pelo
prazo de 03 (três) anos" em LICENÇA para tratar de interesses particulares,
que não é mandato nenhum. Casar "N (extenso) anos" solto importaria isso como
se fosse prazo de chefia. Mesmo princípio de intent-anchoring da aba Prazos.

```python
r"mandato\s+de\s+(?P<n>\d{1,2})\s*\(", re.I)
# A unidade vem DEPOIS do extenso entre parênteses ("04 (quatro) anos"), então
# tem que pular o fecha-parênteses antes de ler "anos"/"meses".
_MANDATO_UNID_RE = re.compile(r"^[^)]{0,20}\
```

### `_MANDATO_UNID_RE`

`extrair_boletim.py:1272`

A unidade vem DEPOIS do extenso entre parênteses ("04 (quatro) anos"), então
tem que pular o fecha-parênteses antes de ler "anos"/"meses".

```python
r"^[^
```

### `_INICIADO_RE`

`extrair_boletim.py:1279`

Mandato-tampão: quem COMPLETA o mandato do antecessor. O relógio começou com
o ANTECESSOR, não com este ato — "complementando assim, o mandato de 04
(quatro) anos, iniciado em 29 de abril de 2003". Somar o prazo à data deste
ato daria ao substituto um mandato novo em folha, quando ele pode ter só
meses pela frente. São ~7% das designações com prazo, e justamente os
substitutos: a população mais propensa a esticar sem que ninguém veja.

```python
r"(?:iniciado|com\s+in[íi]cio)\s+em\s+(?P<d>\d{1,2})\s+de\s+(?P<m>\w+)\s+de\s+(?P<a>\d{4})", re.I
```

### `_APARTIR_RE`

`extrair_boletim.py:1284`

Início declarado: "Designar, a partir de 30/03/2026, FULANO, ... com mandato
de 04 (quatro) anos, a função de ...". Sem isso o início vira a data do ato,
que é só a data em que o BS publicou — não a data em que o mandato corre.

```python
r"a\s+partir\s+de\s+(?P<d>\d{1,2})[./](?P<m>\d{1,2})[./](?P<a>\d{2,4})", re.I
```

## Aposentadoria

Tipo e base legal. O grosso da dificuldade é distinguir a CONCESSÃO de uma retificação que apenas menciona uma concessão anterior.

### `_APOSENT_RETRO_RE`

`extrair_boletim.py:1502`

Aposentadorias: classifica pelo DISPOSITIVO de concessão, nunca por menção
solta — desde 2023 é comum a Portaria de nomeação/vacância dizer "a vacância
corresponde à aposentadoria voluntária de fulano, publicada pela Portaria
nº X" (retrospecto da vaga, não uma concessão nova); contar isso dobra o
número e não tem nada a ver com o ato em questão.
O RÓTULO mudou de forma ao longo dos anos: "Concede aposentadoria
compulsória" (fraseado recente) e "Declara aposentado(a), compulsoriamente"
(legado 2014-2015, verbo "declarar" + advérbio, não "compulsória" como
adjetivo) são o MESMO ato — sem os dois padrões a compulsória do legado
ficava quase invisível (achado real: 2016-2019 caíam a ~0/ano só por causa
do fraseado antigo, enquanto voluntária continuava na casa de centenas).
Quando não há rótulo nenhum, cai pra BASE LEGAL: art. 40 da Constituição,
§1º, inciso I=invalidez / II=compulsória / III=voluntária (Regime Próprio
de Previdência) — cobre concessões que só citam o dispositivo legal.
Sem nenhum dos dois sinais: 'Indefinida' (não desaparece — fica visível
como não-classificada, mesmo espírito dos "ambíguos" em resolver_relacoes).

```python
r"c[oó]digo\s+de\s+vaga|origem\s+da\s+vaga|decorrente\s+da\s+(?:posse|aposentadoria)|"
    r"oriund[ao]\s+de\s+vac[aâ]ncia|vac[aâ]ncia\s+corresponde|corresponde\s+[aà]\s+aposentadoria",
    re.I,
```

### `_APOSENT_DISPOSITIVO_RE`

`extrair_boletim.py:1507`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Aposentadorias: classifica pelo DISPOSITIVO de concessão, nunca por menção
solta — desde 2023 é comum a Portaria de nomeação/vacância dizer "a vacância
corresponde à aposentadoria voluntária de fulano, publicada pela Portaria
nº X" (retrospecto da vaga, não uma concessão nova); contar isso dobra o
número e não tem nada a ver com o ato em questão.
O RÓTULO mudou de forma ao longo dos anos: "Concede aposentadoria
compulsória" (fraseado recente) e "Declara aposentado(a), compulsoriamente"
(legado 2014-2015, verbo "declarar" + advérbio, não "compulsória" como
adjetivo) são o MESMO ato — sem os dois padrões a compulsória do legado
ficava quase invisível (achado real: 2016-2019 caíam a ~0/ano só por causa
do fraseado antigo, enquanto voluntária continuava na casa de centenas).
Quando não há rótulo nenhum, cai pra BASE LEGAL: art. 40 da Constituição,
§1º, inciso I=invalidez / II=compulsória / III=voluntária (Regime Próprio
de Previdência) — cobre concessões que só citam o dispositivo legal.
Sem nenhum dos dois sinais: 'Indefinida' (não desaparece — fica visível
como não-classificada, mesmo espírito dos "ambíguos" em resolver_relacoes).

```python
r"conced\w*\s+(?:a\s+)?aposentadoria|declara\w*\s+aposentad[oa](?:\s*\([aA]\))?\b", re.I,
```

### `_APOSENT_COMPULSORIA_RE`

`extrair_boletim.py:1510`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Aposentadorias: classifica pelo DISPOSITIVO de concessão, nunca por menção
solta — desde 2023 é comum a Portaria de nomeação/vacância dizer "a vacância
corresponde à aposentadoria voluntária de fulano, publicada pela Portaria
nº X" (retrospecto da vaga, não uma concessão nova); contar isso dobra o
número e não tem nada a ver com o ato em questão.
O RÓTULO mudou de forma ao longo dos anos: "Concede aposentadoria
compulsória" (fraseado recente) e "Declara aposentado(a), compulsoriamente"
(legado 2014-2015, verbo "declarar" + advérbio, não "compulsória" como
adjetivo) são o MESMO ato — sem os dois padrões a compulsória do legado
ficava quase invisível (achado real: 2016-2019 caíam a ~0/ano só por causa
do fraseado antigo, enquanto voluntária continuava na casa de centenas).
Quando não há rótulo nenhum, cai pra BASE LEGAL: art. 40 da Constituição,
§1º, inciso I=invalidez / II=compulsória / III=voluntária (Regime Próprio
de Previdência) — cobre concessões que só citam o dispositivo legal.
Sem nenhum dos dois sinais: 'Indefinida' (não desaparece — fica visível
como não-classificada, mesmo espírito dos "ambíguos" em resolver_relacoes).

```python
r"aposentadoria\s+compuls[oó]ria|compulsoriamente", re.I
```

### `_APOSENT_VOLUNTARIA_RE`

`extrair_boletim.py:1511`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Aposentadorias: classifica pelo DISPOSITIVO de concessão, nunca por menção
solta — desde 2023 é comum a Portaria de nomeação/vacância dizer "a vacância
corresponde à aposentadoria voluntária de fulano, publicada pela Portaria
nº X" (retrospecto da vaga, não uma concessão nova); contar isso dobra o
número e não tem nada a ver com o ato em questão.
O RÓTULO mudou de forma ao longo dos anos: "Concede aposentadoria
compulsória" (fraseado recente) e "Declara aposentado(a), compulsoriamente"
(legado 2014-2015, verbo "declarar" + advérbio, não "compulsória" como
adjetivo) são o MESMO ato — sem os dois padrões a compulsória do legado
ficava quase invisível (achado real: 2016-2019 caíam a ~0/ano só por causa
do fraseado antigo, enquanto voluntária continuava na casa de centenas).
Quando não há rótulo nenhum, cai pra BASE LEGAL: art. 40 da Constituição,
§1º, inciso I=invalidez / II=compulsória / III=voluntária (Regime Próprio
de Previdência) — cobre concessões que só citam o dispositivo legal.
Sem nenhum dos dois sinais: 'Indefinida' (não desaparece — fica visível
como não-classificada, mesmo espírito dos "ambíguos" em resolver_relacoes).

```python
r"aposentadoria\s+volunt[aá]ria", re.I
```

### `_APOSENT_INVALIDEZ_RE`

`extrair_boletim.py:1512`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Aposentadorias: classifica pelo DISPOSITIVO de concessão, nunca por menção
solta — desde 2023 é comum a Portaria de nomeação/vacância dizer "a vacância
corresponde à aposentadoria voluntária de fulano, publicada pela Portaria
nº X" (retrospecto da vaga, não uma concessão nova); contar isso dobra o
número e não tem nada a ver com o ato em questão.
O RÓTULO mudou de forma ao longo dos anos: "Concede aposentadoria
compulsória" (fraseado recente) e "Declara aposentado(a), compulsoriamente"
(legado 2014-2015, verbo "declarar" + advérbio, não "compulsória" como
adjetivo) são o MESMO ato — sem os dois padrões a compulsória do legado
ficava quase invisível (achado real: 2016-2019 caíam a ~0/ano só por causa
do fraseado antigo, enquanto voluntária continuava na casa de centenas).
Quando não há rótulo nenhum, cai pra BASE LEGAL: art. 40 da Constituição,
§1º, inciso I=invalidez / II=compulsória / III=voluntária (Regime Próprio
de Previdência) — cobre concessões que só citam o dispositivo legal.
Sem nenhum dos dois sinais: 'Indefinida' (não desaparece — fica visível
como não-classificada, mesmo espírito dos "ambíguos" em resolver_relacoes).

```python
r"aposentadoria\s+por\s+(?:invalidez|incapacidade)", re.I
```

### `_ART40_RE`

`extrair_boletim.py:1513`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Aposentadorias: classifica pelo DISPOSITIVO de concessão, nunca por menção
solta — desde 2023 é comum a Portaria de nomeação/vacância dizer "a vacância
corresponde à aposentadoria voluntária de fulano, publicada pela Portaria
nº X" (retrospecto da vaga, não uma concessão nova); contar isso dobra o
número e não tem nada a ver com o ato em questão.
O RÓTULO mudou de forma ao longo dos anos: "Concede aposentadoria
compulsória" (fraseado recente) e "Declara aposentado(a), compulsoriamente"
(legado 2014-2015, verbo "declarar" + advérbio, não "compulsória" como
adjetivo) são o MESMO ato — sem os dois padrões a compulsória do legado
ficava quase invisível (achado real: 2016-2019 caíam a ~0/ano só por causa
do fraseado antigo, enquanto voluntária continuava na casa de centenas).
Quando não há rótulo nenhum, cai pra BASE LEGAL: art. 40 da Constituição,
§1º, inciso I=invalidez / II=compulsória / III=voluntária (Regime Próprio
de Previdência) — cobre concessões que só citam o dispositivo legal.
Sem nenhum dos dois sinais: 'Indefinida' (não desaparece — fica visível
como não-classificada, mesmo espírito dos "ambíguos" em resolver_relacoes).

```python
r"art(?:igo)?\.?\s*40\b", re.I
```

### `_INCISO_ART40_RE`

`extrair_boletim.py:1514`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Aposentadorias: classifica pelo DISPOSITIVO de concessão, nunca por menção
solta — desde 2023 é comum a Portaria de nomeação/vacância dizer "a vacância
corresponde à aposentadoria voluntária de fulano, publicada pela Portaria
nº X" (retrospecto da vaga, não uma concessão nova); contar isso dobra o
número e não tem nada a ver com o ato em questão.
O RÓTULO mudou de forma ao longo dos anos: "Concede aposentadoria
compulsória" (fraseado recente) e "Declara aposentado(a), compulsoriamente"
(legado 2014-2015, verbo "declarar" + advérbio, não "compulsória" como
adjetivo) são o MESMO ato — sem os dois padrões a compulsória do legado
ficava quase invisível (achado real: 2016-2019 caíam a ~0/ano só por causa
do fraseado antigo, enquanto voluntária continuava na casa de centenas).
Quando não há rótulo nenhum, cai pra BASE LEGAL: art. 40 da Constituição,
§1º, inciso I=invalidez / II=compulsória / III=voluntária (Regime Próprio
de Previdência) — cobre concessões que só citam o dispositivo legal.
Sem nenhum dos dois sinais: 'Indefinida' (não desaparece — fica visível
como não-classificada, mesmo espírito dos "ambíguos" em resolver_relacoes).

```python
r"inciso\s+(i{1,3})\b|§\s*1[ºo]?[^.;]{0,15}?\b(i{1,3})\b", re.I
```

## Deslocamento de servidor (remoção, redistribuição)

Para onde a pessoa foi e por quê. Separa movimentação interna da UFF de saída para instituição externa.

### `_RED_QQ`

`extrair_boletim.py:1559`

Deslocamento de servidor (Lei 8.112/90): REMOÇÃO = dentro da própria UFF
(art. 36); REDISTRIBUIÇÃO = cargo entra/sai da UFF p/ outro órgão (art. 37).

```python
r"redistribu", re.I
```

### `_RED_EXCL`

`extrair_boletim.py:1560`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Deslocamento de servidor (Lei 8.112/90): REMOÇÃO = dentro da própria UFF
(art. 36); REDISTRIBUIÇÃO = cargo entra/sai da UFF p/ outro órgão (art. 37).

```python
r"redistribuiç[ãa]o\s+de\s+cargos\s+de\s+direç"        # CD/FG genérico do MEC
    r"|funç[õo]es\s+gratificadas\s+do\s+minist"
    r"|vagas?\s+.{0,30}?redistribu"                         # vaga de edital/bolsa
    r"|redistribu\w+\s+os?\s+dados"                         # IN sobre dados
    r"|redistribu\w+\s+para\s+recredenciamento"
    r"|redistribu\w+\s+.{0,40}?espaç"                       # espaço físico/interno, não servidor
    r"|entende-se\s+por\s+redistribu"                       # definição normativa (IN), não evento
    r"|remo[çc][ãa]o\s*/\s*redistribui"                     # cláusula de atribuição de cargo (rotina do setor)
    r"|redistribu\w+\s+pela\s+portaria\s+mec"               # proveniência da VAGA, não do servidor deste ato
    r"|redistribu\w+\s+por\s+meio\s+da\s+portaria"
    r"|c[óo]digo\s+de\s+vaga.{0,30}?redistribu"
    r"|redistribu\w+\s+(?:através\s+de\s+)?portaria\s+mec\s+n", re.I
```

### `_INST_EXTERNA`

`extrair_boletim.py:1579`

Instituição de origem/destino EXTERNA (não-UFF). "Ministério da Educação" fica
de fora de propósito: é o rodapé padrão de TODO ato (a UFF também é MEC), não
indica origem/destino externo — incluí-lo sem essa exceção derrubou casos reais
(medido: 9 atos de 2022-2024 viraram falso-negativo quando testado sem o
`(?!educaç)`, porque o rodapé "Ministério da Educação Universidade Federal
Fluminense" cai dentro da janela de busca do destino).

```python
r"universidade\s+federal\s+(?!fluminense)\w[\wçãáéíóúâêô]*"
    r"|universidade\s+estadual\s+\w+"
    r"|universidade\s+federal\s+rural\s+\w+"
    r"|fundaç[ãa]o\s+universidade\s+(?:de|do|federal)"
    r"|instituto\s+federal\s+\w+"
    r"|centro\s+federal\s+de\s+educaç[ãa]o"
    r"|cefet\b"
    r"|minist[ée]rio\s+d[aeo]\s+(?!educaç)\w+"
    r"|departamento\s+nacional\s+de\s+\w+"
    r"|instituto\s+do\s+patrim[ôo]nio\s+hist[óo]rico", re.I
```

### `_UFF_MARK`

`extrair_boletim.py:1590`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Instituição de origem/destino EXTERNA (não-UFF). "Ministério da Educação" fica
de fora de propósito: é o rodapé padrão de TODO ato (a UFF também é MEC), não
indica origem/destino externo — incluí-lo sem essa exceção derrubou casos reais
(medido: 9 atos de 2022-2024 viraram falso-negativo quando testado sem o
`(?!educaç)`, porque o rodapé "Ministério da Educação Universidade Federal
Fluminense" cai dentro da janela de busca do destino).

```python
r"desta\s+universidade|universidade\s+federal\s+fluminense", re.I
```

### `_REMOVER`

`extrair_boletim.py:1637`

Remoção: "remover" ancorado num servidor/matrícula na MESMA frase (sem ponto).
Cobre "remover o(a) servidor(a)", "remover, em caráter provisório, a servidora",
"remover os servidores abaixo". A âncora descarta "remover" de outros contextos.

```python
r"\bremover\b[^.]{0,60}?\b(?:servidor|servidora|professor|docente|"
    r"matr[íi]cula\s+siape|siape\s+n)", re.I
```

### `_M_SAUDE`

`extrair_boletim.py:1640`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Remoção: "remover" ancorado num servidor/matrícula na MESMA frase (sem ponto).
Cobre "remover o(a) servidor(a)", "remover, em caráter provisório, a servidora",
"remover os servidores abaixo". A âncora descarta "remover" de outros contextos.

```python
r"motivos?\s+de\s+sa[úu]de", re.I
```

### `_M_CONJ`

`extrair_boletim.py:1641`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Remoção: "remover" ancorado num servidor/matrícula na MESMA frase (sem ponto).
Cobre "remover o(a) servidor(a)", "remover, em caráter provisório, a servidora",
"remover os servidores abaixo". A âncora descarta "remover" de outros contextos.

```python
r"acompanhar\s+c[ôo]njuge|acompanhar\s+companheir", re.I
```

### `_M_PERMUTA`

`extrair_boletim.py:1642`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Remoção: "remover" ancorado num servidor/matrícula na MESMA frase (sem ponto).
Cobre "remover o(a) servidor(a)", "remover, em caráter provisório, a servidora",
"remover os servidores abaixo". A âncora descarta "remover" de outros contextos.

```python
r"permuta", re.I
```

### `_M_OFICIO`

`extrair_boletim.py:1643`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Remoção: "remover" ancorado num servidor/matrícula na MESMA frase (sem ponto).
Cobre "remover o(a) servidor(a)", "remover, em caráter provisório, a servidora",
"remover os servidores abaixo". A âncora descarta "remover" de outros contextos.

```python
r"de\s+of[íi]cio|interesse\s+d[ao]\s+administraç", re.I
```

### `_M_PEDIDO`

`extrair_boletim.py:1644`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Remoção: "remover" ancorado num servidor/matrícula na MESMA frase (sem ponto).
Cobre "remover o(a) servidor(a)", "remover, em caráter provisório, a servidora",
"remover os servidores abaixo". A âncora descarta "remover" de outros contextos.

```python
r"a\s+pedido", re.I
```

### `_DEST_SIGLA`

`extrair_boletim.py:1647`

Unidade de DESTINO ("para a UNIDADE - SIGLA[, uorg N]"): prefere a SIGLA (chave
estável), última ocorrência (a origem vem antes); sem sigla, nome curto.

```python
r"para\s+[oa]s?\s+[^.;:]{3,90}?\s[-–]\s*([a-zà-ú]+(?:/[a-zà-ú]+){0,2})\s*"
    r"(?:[,-–]\s*uorg|\.|:|$)", re.I
```

### `_DEST_NOME`

`extrair_boletim.py:1650`

*O comentário abaixo encabeça o bloco e vale também para os padrões vizinhos.*

Unidade de DESTINO ("para a UNIDADE - SIGLA[, uorg N]"): prefere a SIGLA (chave
estável), última ocorrência (a origem vem antes); sem sigla, nome curto.

```python
r"para\s+[oa]s?\s+((?:departamento|instituto|faculdade|escola|coordena\w+|"
    r"divis[ãa]o|superintend\w+|pró-?reitoria|reitoria|hospital|n[úu]cleo|"
    r"setor|se[çc][ãa]o|ger[êe]ncia|diretoria|secretaria|centro)"
    r"[^.;:]{2,55}?)(?:,\s*por\b|,?\s*uorg|\.|$)", re.I
```

## Limpeza de texto

Lixo de OCR e de extração de PDF que atrapalha tudo o que vem depois.

### `CTRL_RE`

`extrair_boletim.py:383`

Caracteres de controle ilegais (rejeitados por XLSX e indesejados no resto)

```python
r"[\x00-\x08\x0b\x0c\x0e-\x1f]"
```
