# Equivalências de termos — o mesmo fato, escrito de vários jeitos

> O Boletim de Serviço tem 25 anos e várias gerações de redator. **O mesmo fato
> muda de palavra conforme a época, o órgão e quem redigiu.** Um padrão que
> conhece só uma das formas não erra: ele fica cego, e cegueira não deixa rastro.
>
> Este documento é a lista viva dessas formas. Toda vez que uma redação nova
> aparecer, ela entra aqui **e** no teste de regressão do domínio.

Nasceu em 17/08/2026, de dois defeitos que só se descobriu porque o mantenedor
perguntou. O método que os encontrou está em
[VIES-DE-EXTRACAO.md](VIES-DE-EXTRACAO.md).

---

## Como usar

**Antes de escrever padrão novo:** procure o fato aqui. Se ele já tem seção, as
redações conhecidas estão listadas — cubra todas.

**Ao encontrar redação nova no acervo:** acrescente a linha, marque a data, e
crie o caso no teste do domínio. Linha sem caso de teste é documentação que
envelhece sozinha.

**Ao ver zero absoluto numa série:** volte aqui. Zero por vários anos, ou uma
categoria que é zero em *todos* os anos, quase sempre significa que falta uma
linha nesta tabela.

---

## Revalidação de diploma

Extrator: `tools/extrair_boletim.py` · Teste: `tools/teste_revalidacao.py`
Backfill: `backend/importar/backfill_ato_revalidacao.php`

| Decisão | Redação | Época observada | Achada em |
|---|---|---|---|
| **Deferido** | `Aprovar a revalidação do Diploma, nível …, obtido por …, junto a …` | 2010–2022 | 17/08/2026 |
| Deferido | `Deferir a solicitação de Revalidação do Diploma, nível …` | 2023– | — |
| Deferido | `Homologar a revalidação do título/diploma de …, como doutor/mestre em …` | 2005–2010 | — |
| Deferido | `pela homologação da revalidação do diploma, obtido por:` + lista | legado | — |
| Deferido | `manifestar-se pelo deferimento do pedido de revalidação…` | — | 17/08/2026 |
| Indeferido | `Indeferir a solicitação de Revalidação do Diploma, nível …` | 2023– | — |
| Indeferido | `Indeferir o pedido de revalidação do Diploma de <curso>` *(sem "nível")* | legado | 17/08/2026 |
| Indeferido | `manifestar-se pelo indeferimento do pedido de revalidação…` | 2011–2017 | — |
| Indeferido | `homologar o parecer da comissão …, indeferindo a solicitação…` | 2011–2017 | — |

### Como se lê no Boletim

Trechos reais do acervo, **com o nome da pessoa substituído** — o painel é
agregado por decisão do mantenedor, e nome não sai em lugar nenhum.

```
[2012] Aprovar a revalidação do Diploma, nível de Graduação em Letras, obtido
       por FULANO DE TAL, junto a Universidade de Paris — 4, França, como
       equivalente ao Bacharelado em Letras
```
```
[2024] Deferir a solicitação de Revalidação do Diploma, nível Graduação de
       Ingeniero Mecánico, obtido por FULANO DE TAL, junto a Universidad
       Industrial de Santander, Colômbia, nos termos estabelecidos na Resolução
```
```
[2022] Indeferir a solicitação de Revalidação do Diploma, nível Graduação em
       Engenharia Civil - Bacharelado, obtido por FULANO DE TAL, junto à Brunel
       University of London, Reino Unido, nos termos estabelecidos
```
```
[2015] Indeferir o pedido de revalidação do Diploma de Licenciado em Informática
       de Gestão, obtido por FULANO DE TAL, junto ao Instituto Politecnico de
       Coimbra, Portugal, nos termos estabelecidos na Resolução 584/2013
```
↑ **sem `nível`** — o curso vem direto depois de `Diploma de`.

```
[2010] homologar a revalidação do título de "Doutor em Filosofia", obtido por
       FULANO DE TAL, junto à London School of Economics and Political Science,
       no Reino Unido, como equivalente ao de Doutor em Economia
```
```
       decide manifestar-se pelo indeferimento do pedido de revalidação do
       diploma de FULANO DE TAL, em nível de graduação em bioquímica, realizado
       na universidade de suffolk, boston, estados unidos da américa.
```
```
       decide 1-homologar o parecer da comissão de equivalência do colegiado do
       curso de medicina, indeferindo a solicitação de revalidação de diploma de
       FULANO DE TAL, em nível de graduação em medicina, realizado na
       universidad mayor real y pontifícia de san francisco xavier de chuquisaca.
```

Repare que as duas últimas chegam ao extrator **em caixa baixa e sem acento** —
o padrão precisa ser escrito já normalizado.

⚠️ **`Aprovar` era a que faltava, e custou a credibilidade do painel.** Sem ela,
511 deferimentos entre 2010 e 2022 eram invisíveis e o portal publicava **0% de
deferimento** em anos inteiros — com 2019 e 2020 ausentes da série.

⚠️ **`homologar` é ambíguo e depende do objeto.** `homologar A REVALIDAÇÃO` é
deferimento; `homologar O PARECER …, indeferindo` é indeferimento. Quem decide é
o que vem depois do verbo, nunca o verbo sozinho. As duas formas estão lado a
lado nos exemplos acima.

⚠️ **18/08/2026 — "146 pedidos de pós-graduação é impossível", disse o
mantenedor, e tinha razão.** Três lacunas, achadas com atos reais que ele foi
colando de buscas no próprio Boletim, empurravam pós-graduação para dentro (ou
para fora) da conta errada:

```
[2010] Homologar a revalidação do Título de "Doutor em Filosofia", obtido por
       FULANO DE TAL, junto à State University of New York at Stony Brook, nos
       Estados Unidos da América, como equivalente ao de Doutor em Comunicação
```
↑ `Título` (não `Diploma`) sem nível declarado caía no fallback de
Graduação e perdia o país — 69 atos, medidos ato a ato contra a versão
anterior do extrator.

```
[2013] Aprovar o reconhecimento do Título de Doutorado em Matemática, obtido
       por FULANA DE TAL, junto a Universidad de Granada, Espanha, como
       equivalente ao de Doutor em Matemática
```
↑ **substantivo `reconhecimento`** (não só `revalidação`) — gramaticalmente
correto, "reconhecimento" é masculino ("**o** reconhecimento"), mas o padrão só
prendia o artigo feminino de "a revalidação". Sem essa alternativa, o ato
inteiro dava zero match, não só perdia um campo.

```
[2013] Aprovar o reconhecimento do Título de Mestre em Linguistica Germânica,
       obtido por FULANA DE TAL, junto a Eberhard Karls Universität Tübingen,
       como equivalente ao TÍTULO DE Mestre em Estudos de Linguagem
```
↑ a palavra `Título` repetida entre "ao" e "de" (variante real do mesmo
boletim, decisões 275 e 276/2013) também dava zero match — sem ela, o texto
seguia até o fim da frase e a instituição virava a cláusula inteira, ainda
classificada (errado) como Graduação.

Corrigido nos dois lados (`tools/extrair_boletim.py` e
`backend/importar/backfill_ato_revalidacao.php`, mantidos espelhados). No
acervo local reprocessado, Pós-graduação subiu de 146 para 297 (Graduação caiu
de 1.503 para 1.432 — exatamente os 69 atos do primeiro achado, que nunca
foram graduação). Em produção, `backfill_ato_revalidacao.php` (que recupera o
histórico fora do cache de ~1 ano do extrator diário) fechou em Graduação
1.461 / Pós-graduação 555.

⚠️ **Corrigido em 18/08/2026:** país entre parênteses colado à instituição —
`"Universidad de Buenos Aires (Argentina)"` gravava `pais=NULL` em vez de
separar `instituicao="Universidad de Buenos Aires"`, `pais="Argentina"`.
Achado por consulta direta em `ato_revalidacao` (`WHERE via='Pós-graduação'`),
não só spot-check: `Universidad de la Empresa (Uruguai)`, `Universidad
Complutense de Madrid (Espanha)` e `Universidad de Buenos Aires (Argentina)`
tinham `pais=NULL`. Um quarto caso partia o parêntese AO MEIO quando cidade e
país vêm juntos — `Kth - Kungliga Tekniska Högskolan (Estocolmo, Suécia)`
virava `instituicao="…Högskolan (Estocolmo"` (parêntese aberto sobrando) e
`pais="Suécia)"` (parêntese fechando sobrando), porque o split por vírgula que
separa instituição de país não sabia que estava dentro de um parêntese.
Corrigido nos dois lados: `_reval_extrai_pais_parenteses()` em
`tools/extrair_boletim.py` e `revalidacao_extrai_pais_parenteses()` em
`backend/importar/revalidacao_campos.php` (usada tanto no backfill quanto no
casamento da lista legada em `revalidacao_lista_legada.php`) — a extração
roda ANTES do split por vírgula normal, para o parêntese nunca ser partido.

⚠️ **Corrigido em 18/08/2026 — grafia de instituição.** A aba listava
`École de Hautes Études en Sciences Sociales` (sem o segundo "s") ao lado da
grafia correta, como se fossem duas instituições. São a **EHESS**, e o nome
oficial leva `des`. Medido no acervo: 34 ocorrências com o "s", 8 sem.

A correção é **tabela curada**, uma entrada por erro confirmado — nunca fusão
por similaridade. O motivo está no cabeçalho de `revalidacao_campos.php`: no
corte de 90% de similaridade, `universidad de aquino` (Bolívia, 82 pedidos)
casa com `universidad del quindío` (Colômbia, 1), que são instituições
diferentes. Fundir por parecença num dado que vai a órgão de controle inventa
história. Na dúvida, não entra: instituição repetida no painel é ruído
visível; instituição fundida por engano é registro falso — e os testes dos
dois lados travam exatamente isso, com um nome parecido que **não** está na
tabela e tem de passar intacto.

Mesmo espírito de `_REVAL_PAIS_CANON` para `Aústria` → `Áustria`.

## Aposentadoria

Extrator: `tools/extrair_boletim.py` · Teste: `tools/teste_aposentadoria.py`

| Fato | Redação | Achada em |
|---|---|---|
| Aposentadoria (tipo no texto) | `Conceder aposentadoria voluntária/compulsória a …` | — |
| Aposentadoria (tipo no verbo) | `Aposentar por invalidez FULANO, matrícula SIAPE nº …` | 17/08/2026 |
| Aposentadoria (tipo no verbo) | `Aposentar compulsoriamente …` | 17/08/2026 |
| Aposentadoria (tipo implícito) | `Declarar aposentado o servidor …` | — |
| Vacância art. 33 VIII | `declarar vago` / `declarar a vacância` + `posse em outro cargo inacumulável` | — |

### Como se lê no Boletim

```
[2004] Conceder aposentadoria voluntária a FULANO DE TAL, matrícula SIAPE
       nº 0000000-3, ocupante do cargo de Motorista, código 416028
```
```
[2004] Aposentar por invalidez FULANO DE TAL, matrícula SIAPE nº 0000000-1,
       ocupante do cargo de Auxiliar de Laboratório, código 419013
```
```
[2005] Declarar aposentado, compulsoriamente a partir de 19/01/05, FULANO DE
       TAL, matrícula SIAPE nº 0000000-9, ocupante da categoria funcional de
       professor de 3º grau, classe Titular
```
```
[2002] Declarar vago, nos termos do inciso VIII, do artigo 33 da Lei nº 8.112/90
```

E a cláusula que **não** é ato de aposentadoria, apesar do verbo:

```
[2019] Art. 40 - O docente desta Universidade, uma vez credenciado para lecionar
       nos Cursos de Pós-Graduação, ao se aposentar poderá, ouvido o Colegiado
       do Curso, orientar dissertações, sem ônus para a Universidade.
```

⚠️ **`Aposentar por invalidez` não tinha padrão nenhum**, e o painel publicava
`invalidez = 0` em **todos** os anos da série. São 6 a 20 atos por ano.

⚠️ **O qualificador depois do verbo é obrigatório.** `aposentar` solto casa a
cláusula de regimento *"ao se aposentar poderá orientar dissertações"*, que não
é ato de aposentadoria.

⚠️ **Sem tipo escrito, o inciso do art. 40 § 1º classifica:** I invalidez,
II compulsória, III voluntária. É a única fonte do tipo nesses atos.

**Não é aposentadoria:** `reversão de aposentadoria` (o servidor volta), e
retificação que apenas *cita* uma concessão anterior.

## Funções e cargos

Extrator: `tools/extrair_boletim.py` · Teste: `tools/teste_funcoes_cd.py`

| Ação | Redação | Observação |
|---|---|---|
| designar | `Designar`, `Nomear` | *Nomear* é o par dos cargos de direção (CD); entra como `designar` |
| dispensar | `Dispensar`, `Exonerar` | *Exonerar* é o par dos CD |
| — | `nomeação`, `designação` (substantivo) | **Não** é ação: explica o motivo de outra coisa |

## Comissões e colegiados

Registro: `tools/registro_comissoes.py` · Match: `backend/importar/comissoes_match.php`

| Ação | Redação |
|---|---|
| constituir | `Constituir`, `Criar`, `Instituir`, `Designar a Comissão` |
| instaurar | `Instaurar` (sindicância, PAD) |
| recompor | `Reconduzir`, `Altera a composição`, `Retificação dos membros integrantes` |

### Como se lê no Boletim

```
[2010] Designar FULANO DE TAL, Economista, código 701026, Matrícula SIAPE
       nº 0000000, como Substituto Eventual do Chefe da Auditoria Técnica -
       Código CD-4
```
```
[2009] Nomear FULANO DE TAL, convidado para exercer o cargo de direção de Chefe
       do Serviço de Orientação Educacional do Colégio Agrícola Nilo Peçanha
```
```
[2001] Constituir Comissão com a incumbência de proceder ao levantamento dos
       Bens Móveis e intangíveis e do Estoque em Almoxarifado da Pró-Reitoria de
       Pesquisa e Pós-Graduação desta Universidade
```
```
[2001] Instaurar Processo Disciplinar e designar Comissão de Processo Disciplinar
       composta pela Professora Adjunta FULANA DE TAL, matrícula 0000000
```
```
[2001] Alterar a composição da Comissão instituída pela DTS nº 25 de 06 de
       setembro de 2001, substituindo o Professor FULANO DE TAL pelo Professor
       BELTRANO DE TAL
```

Note o `c` no lugar do `e` no primeiro — *"Bens Móveis c intangíveis"* é OCR de
digitalização, e é assim que o texto de 2001 chega ao extrator.

⚠️ **`Altera` só entra acompanhado de "composição".** Solto, traz *"Altera o
cargo de direção CD-4 para CD-3"*, que é ato sobre o cargo.

⚠️ **`Retifica a Portaria X, QUE DESIGNOU os membros`** fala *sobre* designação
alheia e não recompõe nada — a regra do "classifique pelo dispositivo".

## Jornada de trabalho

Cálculo em tempo de consulta: `/api/jornada` (`flex_classe()`)

| Fato | Redação |
|---|---|
| aprovação | `Aprova o plano de flexibilização da jornada de trabalho…` |
| revogação | `Revogar a Portaria X - Jornada Flexibilizada de…` |

### Como se lê no Boletim

```
[2019] Aprova o plano de flexibilização da jornada de trabalho dos servidores
       técnicos administrativos da Biblioteca da Faculdade de Nova Friburgo e dá
       outras providências
```
```
       Revogar a Portaria nº 00.000 de 00/00/0000 - Jornada Flexibilizada do
       Setor X desta Universidade
```

⚠️ O OCR quebra as palavras: `d o p l ano`, `jornada de t r a b a l h o`, e a
preposição alterna entre `da jornada` e `de jornada`. Uma frase só perde casos.

---

## Armadilhas que valem para todos os domínios

**O verbo negativo contém o positivo.** `indeferir` contém `deferir`;
`indeferimento` contém `deferimento`. Padrão para o positivo precisa de
`(?<!in)` ou de âncora — senão ele casa o miolo do negativo e inverte a decisão.

**Substantivo não é ação.** `nomeação`, `designação`, `aposentadoria`,
`revalidação` aparecem em atos que apenas *citam* o fato. O que decide é o
dispositivo, e o marcador é o `que` antes do verbo:
*"a portaria X, **que** concedeu aposentadoria"*.

**Caixa e acento chegam normalizados.** Padrão que roda sobre texto já
normalizado escreve-se normalizado: `comiss[õo]` nunca casa `comissao`, e esse
erro exato já deixou o termo central de um requisito morto no singular.

**Proximidade não é relação.** Contar verbo numa janela em volta do assunto
contamina: em 2015, a maioria dos `indeferir` perto de `revalidação` é
*"Indeferir o pedido de ADICIONAL DE INSALUBRIDADE"*. Exija a frase.

---

## Como levantar as redações de um domínio novo

```python
# 1. Junte TODO verbo decisório perto do assunto, sem filtrar pela hipótese.
VERBOS = r'(defer\w*|indefer\w*|aprov\w+|homolog\w+|conced\w+|autoriz\w+|'
         r'declar\w+|instaur\w+|constitu\w+|revog\w+|retific\w+|torna\w*)'

# 2. Conte por ANO. Verbo que aparece num período e some noutro é troca de
#    redação, e é exatamente o que produz o degrau falso na série.

# 3. Compare com o que o extrator devolve, ato a ato. A diferença é a lista
#    do que falta — e é ela que responde "o padrão não pega" ou "o ato não
#    existe".
```

O campo a ler é `corpo_texto`, nunca a ementa.
