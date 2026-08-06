# O problema da matrícula SIAPE

> Por que "Meu SIAPE" precisa de mais cuidado do que parece, e o que o portal
> faz — e não faz — a respeito. Escrito em 05-06/08/2026, a partir de um caso
> real levantado pela própria usuária (a matrícula de Denise Aparecida de
> Miranda Rosas). **Todo número aqui é reproduzível** contra
> `public/portal-data.json` ou a API em produção.

A aba **Meu SIAPE** é, por desenho, a mais usada do portal: é onde o servidor
busca os próprios atos para instruir um pedido de RSC. É também a que sofre
mais com um fato incômodo — a matrícula, no corpus, **não é uma chave
confiável**. Este documento reúne os quatro defeitos distintos que essa
inconfiabilidade produz, como cada um foi medido e o que foi feito.

---

## 1. O dígito verificador parte a pessoa em duas

A matrícula SIAPE tem 7 dígitos: 6 de base + 1 dígito verificador (DV). A
servidora que originou este capítulo se identifica como `139693-2`, mas o
Boletim a registra ora pela base (`139693`), ora pelo número completo
(`1396932`). Como `pessoa.siape` é `UNIQUE`, cada grafia é uma **linha
diferente** — e, antes do conserto, uma **pessoa diferente** para o portal:

| consulta | funções | atos |
|---|---:|---:|
| `1396932` (número completo — o **correto**) | 0 | 1 |
| `139693` (só a base) | 6 | 25 |

Quem digitava a matrícula certa recebia o resultado pior, e perdia justamente
as funções — a evidência que o RSC pontua.

**A união é pelo NOME, nunca pela matrícula**, e isso foi medido antes de
decidir: a matrícula é sequencial, então quem se cadastrou na mesma época
divide o prefixo de 6 dígitos. **109 bases de 6 dígitos têm mais de uma
extensão de 7 no acervo, e nas 109 são pessoas diferentes** — a base `170833`
sozinha corresponde a Patrick, Letícia e Fábio. Unir por matrícula traria ato
de estranho para dentro do dossiê.

O nome funciona como árbitro porque, como a própria usuária observou, **toda
matrícula aparece junto de um nome**: medido em 7.821 pares matrícula+nome
contra 4 sem nome (0,05%). Sem nome em comum entre as duas grafias, elas não
se unem.

**Correção (API `2026-08-05.1`):** `dossie()` monta as variantes possíveis da
matrícula digitada (7 dígitos → tenta a base; 6 dígitos → tenta as 10
extensões) e só une a variante cujo nome bate — acento e caixa ignorados — com
o nome já encontrado na consulta original. Refeito o teste com `1396932`: 25
atos e 6 funções, os mesmos que antes só apareciam digitando `139693`.

## 2. A busca misturava pessoas por substring, em silêncio

Antes da mesma correção, a rota de listagem comparava a matrícula com
`LIKE '%dígitos%'` — substring, não igualdade. Medido: dos 70 pares do acervo
em que uma matrícula **contém** outra como pedaço, **18 eram pessoas
diferentes**, e o vazamento corria nos dois sentidos:

```
digitar 265891 trazia também 1265891   Zuleika recebia atos de Ricardo
digitar 307724 trazia também 2307724   Lúcia recebia atos de Patrícia
```

Numa aba usada para instruir processo, ver o ato de outra pessoa é o pior
defeito possível — pior que não ver o próprio.

**Correção:** a comparação virou exata sobre a chave normalizada
(`TRIM(LEADING '0' FROM ...)` — nunca `LPAD`, que **trunca** no MySQL 5.7:
`LPAD('12345678', 7, '0')` devolve `'1234567'`, cortando o número em vez de
preservá-lo). As duas correções (§1 e §2) subiram juntas de propósito: a
segunda sozinha devolveria menos alcance do que a matrícula tinha antes — só
que agora por acidente, não por precisão.

## 3. O nome digitado nunca era confrontado com o dono da matrícula

**Achado pela usuária em 06/08/2026, depois das correções acima estarem no
ar.** A aba tem um segundo campo, opcional: o nome, usado para alcançar atos
que não registram SIAPE nenhum (ver §4). O defeito — silencioso, sem erro —
era que **os dois campos nunca se olhavam**. Digitar a matrícula de uma pessoa
e o nome de outra não recusava nada: a matrícula decidia os blocos 1 e 2, o
nome decidia o 3º, e a tela — depois do conserto do PDF em 05/08/2026, também
o PDF — apresentava os dois sob um cabeçalho só.

Medido em produção: SIAPE `1396932` (Denise) + o nome de outra servidora
trouxe **11 atos que não são dela**, um deles a instauração de um Processo
Administrativo Disciplinar. Um documento de instrução de RSC atribuindo a
alguém um PAD alheio é o mesmo tipo de erro que motivou a comparação exata do
§2 — só que dessa vez o vazamento vinha do próprio formulário, não do banco.

**Correção (frontend, `DossieApi.tsx`):** o nome digitado é comparado aos
nomes que a matrícula resolveu, por **tokens** — não por igualdade de string,
porque "Denise Rosas" e "Denise Aparecida de Miranda Rosas" são a mesma
pessoa, "Conceição" e "Conceicao" também, e nome de casada acrescenta
sobrenome em vez de trocar. Confere se todo token de um nome está contido no
outro (em qualquer direção); acentos são removidos via Unicode NFD +
`\p{M}`, nunca por uma classe de caracteres escrita à mão — a primeira
tentativa usou o caractere combinante literal no código-fonte e não
sobreviveu a um reencode do arquivo. Partículas (`de/da/do/dos/das/e`) e
tokens de 1–2 letras (iniciais abreviadas) são ignorados.

Quando diverge, a tela isola o bloco do nome digitado sob um aviso vermelho —
distinto do âmbar de "matrícula com mais de um nome" (§ do componente): aquele
avisa que a **base** pode estar suja, este avisa que a **consulta** está
juntando duas pessoas, e tem conserto imediato por quem digitou. O PDF carrega
o mesmo aviso, porque quem lê o papel não viu a tela.

**Na dúvida, não acusa.** Campo de nome vazio, matrícula fora da base, ou
qualquer sobreposição de tokens compatível com abreviação — tudo isso passa
sem aviso. O custo de um alarme falso aqui é a pessoa desconfiar do dossiê
inteiro; o custo de deixar passar um caso ambíguo é menor, porque a ressalva
geral do bloco 3 (§4) já avisa que a busca por nome pode trazer homônimo.
Regressão: 18 casos cobrindo os dois lados, incluindo o caso em que quem está
sujo é o **registro** (nome capturado errado por OCR), não o campo digitado.

## 4. Só 30–70% dos atos registram SIAPE

O extrator só cria `pessoa`/`ato_pessoa` quando encontra uma matrícula no
texto — 34% dos atos em 2001, ~65% em 2025. Quem não tem matrícula registrada
não está em `pessoa`: existe só no corpo do ato, alcançável apenas pelo
FULLTEXT de `ato_texto`. É por isso que a aba tem um segundo campo (nome), e
por que o bloco 3 é buscado separadamente do bloco 2 — confiança diferente
merece rótulo diferente.

Essa mesma busca por nome tem uma ressalva própria, medida em produção em
05/08/2026: num dossiê real, da maioria dos ~100 atos achados pelo nome, a
pessoa não *participava* do ato — ela o **assinava**, como Pró-Reitora. O
campo `signatario` vem vazio nesses atos (não há como filtrar
automaticamente), então o aviso nomeia o caso comum, não só o raro
("assinar não é participar").

## O que continua sem solução

- **Um SIAPE pode carregar duas pessoas**, e o v2 não tem como saber. O
  importador chaveia pessoa por `"s:$siape"`; se duas pessoas do corpus foram
  publicadas com a mesma matrícula (erro de digitação no Boletim), a segunda
  colapsa na primeira e o nome divergente se perde — `ato_pessoa` só guarda
  `ato_id`+`pessoa_id`, não o nome grafado em cada ato. Caso real:
  `'3369546'` = Bárbara Sena **e** Simone Lemos. Não é detectável nem
  desfazível por SQL; exige curadoria manual, ato por ato.
- **A busca por nome pode trazer homônimo.** Duas pessoas com o mesmo nome, ou
  nomes que colidem sob a tolerância do §3, não são distinguíveis pelo texto
  do ato sozinho.
- Nenhuma das duas acima tem solução de engenharia: são limitações do que o
  Boletim publica, não bugs do portal. O tratamento é avisar com precisão, não
  prometer exaustividade.

## Regra prática para quem mexer nesta área de novo

Qualquer código que resolva ou compare matrícula precisa lembrar, ao mesmo
tempo, que: (1) o zero à esquerda separa pessoa (§1 do arquivo `CLAUDE.md`);
(2) a base de 6 dígitos não é a pessoa, é um prefixo compartilhado (§1 aqui);
(3) substring não é igualdade (§2); (4) o nome, quando presente, tem que ser
**confrontado**, não só usado como atalho de busca (§3). Os quatro pontos já
foram, cada um, medidos e corrigidos separadamente — e cada um passou
despercebido até alguém tropeçar nele. `TRIM(LEADING '0' FROM ...)` no SQL,
comparação por tokens no frontend; nunca `LPAD`, nunca `LIKE '%...%'` para
matrícula, nunca campo de nome que não é lido pelo código.
