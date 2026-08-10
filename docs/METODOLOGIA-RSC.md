# Metodologia — Requisitos do RSC na aba Meu SIAPE

> Como o portal decide que um ato publicado corresponde a um requisito do
> Reconhecimento de Saberes e Competências, e — mais importante — **o que ele se
> proíbe de afirmar**. Escrito em 06/08/2026 a partir da leitura da IN
> GAR/RET/UFF nº 129/2026 e de uma medição em 4.000 atos de 2025-2026 do acervo.
> **Todo número aqui é reproduzível** pelos scripts citados.

---

## 1. A norma

O RSC-PCCTAE é regulamentado na UFF pela **INSTRUÇÃO NORMATIVA GAR/RET/UFF nº
129, de 24 de julho de 2026** (BS nº 66/2026, Seção III, p. 128), que aplica a
Lei 11.091/2005 (arts. 12-B a 12-I, redação da Lei 15.367/2026) e o Decreto
13.048/2026.

O **art. 2º** — no Capítulo I, Disposições Preliminares — lista os **seis
requisitos**, cada um detalhado num Anexo com seus critérios e pontuações:

| Req. | Objeto | Anexo |
|---|---|---|
| **I** | grupos de trabalho, comissões, comitês, núcleos, representações ou similares | I |
| **II** | projetos institucionais, gestão, apoio ao ensino/pesquisa/extensão, inovação, assistência especializada | II |
| **III** | premiação em evento de reconhecimento público | III |
| **IV** | designação para responsabilidades técnico-administrativas ou especializadas | IV |
| **V** | exercício de função ou cargo de direção ou assessoramento | V |
| **VI** | produção, prospecção e difusão de conhecimento científico ou técnico | VI |

Aplica-se aos **técnico-administrativos** ativos (art. 5º), e não durante o
estágio probatório — embora atividades daquele período possam ser consideradas
depois.

## 2. Por que o selo NÃO diz "elegível"

O pedido original era um selo para as citações "elegíveis". A leitura da norma
mostrou que essa palavra o portal não pode usar, e não por cautela retórica —
por três dispositivos expressos:

- **Art. 15, §8º** e **art. 20, §3º** — *"O atendimento aos requisitos objetivos
  previstos na legislação não assegura, por si só, a concessão"*, cabendo à
  CRSC-UFF a decisão fundamentada sobre o memorial.
- **Art. 20, §2º** — não se pontua atividade que represente *"exclusivamente o
  desempenho ordinário das atribuições legais do cargo"*. Isso depende do
  **memorial descritivo**, não do ato: o Boletim publica a designação, nunca o
  que ela exigiu de quem a cumpriu.
- **Art. 15, §6º** — vedada a **dupla contagem**: a mesma atividade entra uma vez
  só, ainda que sirva a dois requisitos.

Um selo dizendo "elegível" afirmaria os três ao contrário. Pior: se a pessoa
confiasse nele e a CRSC discordasse, o erro teria sido nosso, com custo dela.

O que o selo afirma é o passo anterior, e esse é sólido: **o ato é do TIPO que o
requisito descreve**. E isso vale porque o **art. 19, parágrafo único, I** lista
entre os documentos válidos de comprovação exatamente *"portarias, resoluções ou
atos de designação ou nomeação editados pela Instituição Federal de Ensino"* —
que é o que a aba entrega, com a referência do BS. O selo é **isca de
conferência**, não veredito.

Mesma família de decisão do resto do projeto: a aba Políticas mostra etapa sem
ato como *"sem evidência localizada no Boletim"*, e o feed de Mudanças mostra o
MOTIVO nomeado em vez de um número de relevância.

## 3. O que é detectável — e o que não é

**Só 3 dos 6 requisitos**, e a exclusão dos outros três é decisão, não lacuna:
II (projetos), III (premiação) e VI (produção científica) não viram ato de
designação no Boletim. Comprovam-se por certificado, publicação ou declaração —
documentos que a aba não tem e não deve fingir ter. A interface diz isso
explicitamente: **ausência de selo nunca é ausência de direito.**

### Requisito V sai do DADO ESTRUTURADO, nunca da ementa

Esta foi a medição mais decisiva. Pela ementa, o Requisito V deu **11 de 11
falsos positivos**:

```
Altera o cargo de direção CD-4 para CD-3 do titular ...   → ato SOBRE o cargo
Distribuição de 9 Funções Gratificadas (FG-2) ...        → cria VAGA, não designa
```

O sinal bom é `ato_funcao`, que o extrator já leu do **dispositivo** com a
whitelist `_NUC_CARGO` — branca de propósito, só cargo de direção/chefia.
`dispensar` não marca: a dispensa encerra o exercício, e marcar as duas pontas do
mesmo fato convidaria justamente à dupla contagem do art. 15, §6º.

### Volume medido (4.000 atos de 2025-2026)

| Requisito | marcados | % |
|---|---:|---:|
| I (ementa) | 1.169 | 29,2% |
| IV (ementa) | 61 | 1,5% |
| nenhum | 2.770 | 69,3% |
| **dois ao mesmo tempo** | **0** | 0% |

O Requisito IV teve precisão praticamente perfeita na auditoria: quase todos são
*"Designa os membros da Gestão e Fiscalização Contrato nº X"* (Anexo IV, item 3)
e *"equipe de planejamento da contratação"* (item 2).

O Requisito I foi auditado em duas amostras aleatórias de 60 e 45: precisão de
~91% estrita e ~98% contando como aceitáveis os marginais (banca de prova de
proficiência de disciplina, que ainda é colegiado formalmente designado). Os
falsos que a auditoria achou viraram guarda — errata, preâmbulo da comissão que
assina, homologação eleitoral.

### A cobertura foi de 158 para 1.169 — e o motivo é uma lição

O primeiro corte marcava **158**. Estava errado por dois defeitos somados, e
nenhum apareceria sem medir **recall** (a medição inicial só olhou precisão):

**(a) Um regex morto.** O padrão era `comiss[õo]es?`. Como o texto passa por
remoção de acento antes, "comissão" chega como `comissao`, e `comiss[õo]` nunca
casa `comissa` — **o termo central do requisito estava morto no singular**. Os
poucos que passavam entravam pelo caminho do certame, cujo padrão usa `[ãa]`.
*Lição: padrão que roda sobre texto normalizado tem que ser escrito já
normalizado.*

**(b) Uma exigência que a redação real não cumpre.** Eu exigia estrutura de
composição ("para compor", "como membros"), mas a forma dominante no Boletim é
direta: *"Designa a Comissão X"*, *"Constitui Grupo de Trabalho Y"*.

E a lista de verbos era curta demais — só designa/constitui/institui/nomeia.
Faltavam **instaura** (sindicância, PAD), **cria**, **reconduz** e **altera a
composição**, todos vínculo legítimo. `altera` entra só acompanhado de
"composição": solto, ele reintroduz o falso positivo do "Altera o cargo de
direção CD-4 para CD-3".

**Ligaduras do PDF.** O extrator decodifica algumas ligaduras como caractere
solto — `Ɵ` no lugar de "ti" (*"ConsƟtuir Comissão"*, *"Processo SeleƟvo"*), em
23 ementas de 4.000. Troca determinística antes de classificar, já que `Ɵ` não é
letra do português.

**O que NÃO foi corrigido:** o OCR que espaça no meio da palavra (*"Const it ui
o Grupo Gest or"*). O detector que tentei marcou 631 ementas na amostra sendo
que quase todas eram texto normal — "de 03 de" casa o mesmo padrão. Esses atos
ficam sem selo e caem na conferência humana, que é o lado seguro do erro.

## 4. As quatro guardas, todas medidas

**(a) Bloco de assinatura.** A ementa capturada arrasta o preâmbulo de quem
ASSINA. Sem cortá-lo, *"Designação de Solicitantes de Viagens no SCDP. **A
SUBSTITUTA EVENTUAL DO PRÓ-REITOR**, no uso da delegação de competência…"*
entrava como Requisito V pelo cargo de quem assinou. **101 dos 112 falsos do
Requisito V vinham daqui.** É a armadilha-mãe da METODOLOGIA-ODS: o termo mora no
NOME de alguém, não no dispositivo.

**(b) Posse de aprovado ≠ atuação em banca.** *"Nomeia Felipe Taumaturgo
habilitado e classificado em Concurso Público"* é a posse do candidato, não
participação na comissão examinadora.

**(c) Fragmento de ementa.** *"publicada no BS de ,SEÇÃO IV, P.078, em atenção às
Resoluções CUV…"* é recorte, não ementa. Espelha `politica_ementa_inutilizavel()`.

**(d) Menção ≠ dispositivo.** Retificação que cita designação anterior (*"…que
designou…"*) não designa. Mesma regra do domínio que vale no extrator.

Regressão: `npx tsx tools/teste_rsc_requisitos.ts` (roda no CI). Cada caso é uma
isca real das medições acima — ementas copiadas do Boletim, não inventadas.

## 5. Onde o código vive, e por que no frontend

`src/components/panels/rscRequisitos.ts`, consumido por `DossieApi.tsx`.

**É cálculo em tempo de consulta, não tabela-fato**, pela mesma razão que Jornada
e Cooperação: a regra ainda está sendo descoberta, e enquanto estiver, trocar um
regex e recarregar é barato. Vira `INSERT` quando estabilizar. Como o dossiê já
devolve ementa e funções, o cálculo cabe no frontend — o que também mantém o
deploy pequeno (só `dist/`) e respeita o `no-store` da rota, que não é cacheável
por ser pessoal.

A paridade com a medição foi conferida: o classificador em TypeScript, rodado
sobre a mesma amostra de 4.000 atos, devolve **exatamente** os mesmos 158 / 61 /
3.781 / 0 do protótipo em Python. Tradução entre linguagens é onde divergência
silenciosa nasce.

## 5.1 Verbo de correção que mexe na composição

Achado em produção em 06/08/2026, num dossiê real: três linhas seguidas
*"Retificação dos membros integrantes … da Comissão Permanente de Flexibilização
de Jornada"* ficavam sem selo, porque a guarda de meta-ato barrava tudo que
abrisse com `retifica`. Mas **retificar os MEMBROS de uma comissão troca gente lá
dentro** — é vínculo tanto quanto "Altera a composição do Comitê", que já valia.

A regra passou a distinguir duas coisas que a palavra "retifica" mistura:

| forma | marca? | por quê |
|---|---|---|
| "Retificação dos **membros integrantes** da Comissão X" | **sim** | mexe em quem está no colegiado |
| "Retifica a Portaria X, **que designou** os membros" | não | fala SOBRE designação alheia (`RE_CITA`) |
| "Retifica a Portaria X para corrigir o nome do servidor" | não | correção comum |
| "Torna sem efeito a Portaria que constituiu a Comissão" | não | desfaz, não designa |

**Alcance medido: 8 atos em 6.400 (0,13%)**, sobre duas amostras — 4.000 de
2025-2026 e 2.400 de 2016/2019/2022/2024. É pequeno porque essa redação é menos
comum, e vale registrar o contraste: a correção do §4 (o regex morto no
singular) valeu 7,4× mais. Nem todo conserto tem o mesmo peso, e medir é o que
diz qual é qual.

## 5.2 O que o selo NÃO alcança: quando o dado não existe

Caso-prova, conferido em produção: a **Portaria Reitoria nº 108/2022** nomeia um
servidor "para exercer o cargo de direção de **Assessor** do Gabinete do Reitor -
Código **CD-4**" — Requisito V exemplar. Ela **não recebe selo**, e não há
conserto possível nesta camada:

```
ementa no portal : "Nomeia João Marcel Fanara Correa, Operador de Radio Telecomunicações."
ementaInferida   : true          ← a ementa foi inferida, e cortou antes do cargo
funcoes          : []            ← o extrator não registrou a função
conteudoResumido : (igual à ementa truncada)
```

O cargo e o "CD-4" **não estão em campo nenhum** da base. O selo do Requisito V
sai de `ato_funcao`, e `ato_funcao` está vazio; a ementa também não os traz.
Qualquer marcação aqui seria adivinhação.

Isso é defeito do **extrator** (`tools/extrair_boletim.py`), não do selo, e o
conserto exige reprocessar o acervo. Contraste útil para quem for investigar:
*"Nomeia Jean Pierre de Menezes Martinez, Assistente em Administração."* — mesma
forma de ementa truncada — **tem** `funcoes` com `cargo=Coordenador`. Ou seja, o
extrator lê o corpo e às vezes acerta; descobrir o que difere é o trabalho.

Medido em `public/portal-data.json` (3.802 atos): 58 ementas começam em
"Nomeia/Nomear"; **48 são posse de aprovado em concurso** (corretamente sem
função — é ingresso na carreira, não CD), 8 têm função registrada e **2
perderam**, uma delas com o corpo degradado por OCR ("coordenagdo",
"pré-reitor"). A fatia é pequena, mas cobre 3.802 de 133.453 atos: o tamanho real
no acervo inteiro ainda não foi medido.

## 6. Limitações que ficam

- **O portal não sabe a carreira da pessoa.** O RSC-PCCTAE é dos
  técnico-administrativos, e a maioria dos atos de banca é de docente. Não há
  dado de carreira em `pessoa` — só siape e nome. Quem consulta sabe a própria
  carreira, então o selo não engana; mas o painel diz "carreira
  técnico-administrativa" no cabeçalho para não induzir ninguém.
- **O selo não distingue Requisito V de Anexo IV, item 8.** O item 8 do Anexo IV
  é "responsável por setor formalmente designado, **desde que a designação não
  gere remuneração**" — e é a remuneração que separa os dois. O portal não sabe
  se a função é remunerada. Marca V, que é o caso dominante.
- **O nível do CD/FG não é conhecido.** O Anexo V pontua diferente para CD-02,
  CD-03/04, FG-01/02 e FG-03+. A ementa raramente traz o nível junto da
  designação da pessoa. Por isso o selo nomeia o requisito e nunca a pontuação.
- **Requisitos II, III e VI seguem fora**, conforme §3.

## 7. Se a IN mudar

A âncora é **datada**: os textos citados são da redação de 24/07/2026. Trocar de
IN obriga a remedir — os requisitos do art. 2º, os critérios dos Anexos e,
principalmente, os três dispositivos do §2 que sustentam a recusa em dizer
"elegível". O número da IN aparece na interface de propósito, para que a
defasagem seja visível a quem lê.
