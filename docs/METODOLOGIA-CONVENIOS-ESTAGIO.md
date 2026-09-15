# Metodologia — Convênios de Estágio

O que a aba `#/estagios` afirma, a partir de quê, e o que ela **não** afirma.
Medições de 14/09/2026, todas reproduzíveis pelos comandos citados.

---

## 1. O fato no Boletim

A UFF só encaminha estagiário a empresa com **convênio vigente**. Cada convênio
é ratificado por uma Resolução do CEPEx publicada isoladamente. A estrutura é
estável desde 2022:

```
RESOLUÇÃO CEPEx/UFF Nº 5.801, DE 08 DE ABRIL DE 2026
  Ementa: Dispõe sobre a ratificação do Convênio celebrado entre a
          Universidade Federal Fluminense - UFF e a PWC STRATEGY& DO BRASIL
          CONSULTORIA EMPRESARIAL LTDA.
  Art. 1º - Ratificar … nos termos da Lei nº 11.788, de 25 de setembro de
            2008, e da Resolução CEPEx/UFF nº 4.071 … a concessão de estágios
            curriculares profissionais …
  Art. 2º  A vigência do convênio é de 19/02/2026 a 18/02/2031.
```

Quatro campos saem daí: **empresa** (ementa), **início e fim** (Art. 2º),
**modalidade** (Art. 1º) e a **prova** (nº do ato, processo SEI, link do
boletim).

---

## 2. O recorte, e por que ele começa em 2022

O acervo tem **4.987** ratificações de convênio (2002→2026). Destas, **1.835**
trazem a vigência no corpo — e **todas são de 2022 em diante**.

Não é falha de extração: é o que a resolução escreve. Medido ano a ano contra a
produção, com a frase no corpo (`nome=`) e na ementa (`busca=`):

| ano | ratificações | com vigência no corpo |
|---|---:|---:|
| 2008 | 150 | 0 |
| 2010 | 159 | 0 |
| 2012 | 303 | 0 |
| 2015 | 272 | 0 |
| 2017 | 266 | 0 |
| 2018 | 211 | 0 |
| 2019 | 101 | 0 |
| 2020 | 83 | 0 |
| **2021** | **18** | 0 |
| 2022 | 131 | 108 |
| 2023 | 626 | 614 |
| 2024 | 577 | 562 |
| 2025 | 382 | 370 |
| 2026 (parcial) | 183 | 178 |

Reproduzir:

```bash
curl -s "https://inteligencia.fanara.com.br/api/atos?busca=%22ratificacao%20do%20convenio%22&nome=%22a%20vigencia%20do%20convenio%22&ano=2023"
```

Como o prazo típico é de 5 anos (173 de 183 na fatia local), **nada de antes de
2022 estaria vigente hoje** — o radar não perde convênio ativo por causa do
corte. O que se perde é a memória histórica, e a aba diz isso.

---

## 3. As três armadilhas medidas

### 3.1 A ementa tem DUAS redações — e a errada devolve zero para um ano inteiro

2021 escreve "ratificação **de** Convênio"; 2022 em diante, "**do** Convênio".
Buscando só a forma nova, a série lê:

```
2020: 83   2021: 0   2022: 131
```

Esse zero foi diagnosticado, aqui mesmo, como "buraco de extração de 2021" — e
chegou a virar decisão de reprocessar o ano inteiro antes de a causa aparecer.
Ela era a consulta. Com as duas formas, 2021 tem **18 convênios**, todos
íntegros, e a queda é pandemia, não defeito.

É a regra do [`VIES-DE-EXTRACAO.md`](VIES-DE-EXTRACAO.md) outra vez: **zero
absoluto num período longo é suspeita, não resultado.** O `$ft` da rota carrega
as duas frases, e é por isso.

### 3.2 O termo mora no NOME da empresa, não no dispositivo

A armadilha-mãe da [`METODOLOGIA-ODS.md`](METODOLOGIA-ODS.md), de novo. Razões
sociais reais do acervo:

- `CENTRO EDUCACIONAL DE TRABALHO E ESTAGIO REMUNERADO` (CETER)
- `ESTÁGIOS.APP TECNOLOGIA DA INFORMAÇÃO LTDA`
- `ESTAGIAR INTEGRADOR EMPRESA ESCOLA LTDA`

O corpo abre com título e ementa, e o nome se repete **dentro do Art. 1º**,
antes da redação que interessa. Uma janela presa à primeira ocorrência de
"estági" fica parada na razão social. Duas guardas resolvem, e as duas são
necessárias:

1. a janela começa no **dispositivo** (`RESOLVE` / `Art. 1º`), não no início;
2. a varredura é de **todas** as menções, com `preg_match_all` em **lookahead**
   — sem ele as janelas não se sobrepõem, e a da razão social consome os 200
   caracteres seguintes, engolindo a menção boa que cai dentro dela.

### 3.3 "não obrigatórios" CONTÉM "obrigatórios"

Testar a forma positiva antes da negativa rotula ao contrário — e o rótulo
trocado diz ao aluno que o curso exige um estágio que não exige. Por isso a
locução negativa é **apagada do texto** antes de procurar a positiva, em vez de
uma cascata de `if`.

---

## 4. Modalidade: a letra do ato, sem tradução

O portal **não** reescreve "curricular profissional" como "obrigatório". A
equivalência entre as redações é competência da Divisão de Estágio; afirmá-la
aqui seria o portal falando pelo ato.

A primeira versão do classificador testava três frases fixas e deixava **14 de
181** em branco — e o branco não era silêncio: `Estágios Curriculares
OBRIGATÓRIOS`, `estágio curricular obrigatório` e `de interesse curricular,
obrigatório ou não` declaram a modalidade, só não na ordem prevista. Apurando os
dois sinais (obrigatoriedade e vínculo curricular) em separado:

| modalidade | n | % |
|---|---:|---:|
| curricular profissional | 141 | 77,9 |
| obrigatório | 27 | 14,9 |
| curricular | 5 | 2,8 |
| obrigatório e não obrigatório | 4 | 2,2 |
| não obrigatório | 1 | 0,6 |
| **não declarado** | **3** | 1,7 |

Os 3 restantes foram lidos um a um e **de fato não declaram** ("estágio aos
alunos da INSTITUIÇÃO DE ENSINO", "Estágio do Ministério Público da União",
"estágio nas Unidades/Órgão da Secretaria Municipal de Saúde de Duque de
Caxias"). A tela escreve "modalidade não declarada no ato".

**As duas modalidades ao mesmo tempo são resultado legítimo**, não empate: há
convênio que abre as duas na mesma frase, e escolher uma esconderia metade do
que foi acordado.

---

## 5. O que a aba NÃO é

**Não é o registro oficial de convênios de estágio da UFF.** Esse é o da
Divisão de Estágio, em `https://estagio.uff.br/convenios-ativos` — 4.160 linhas,
com CNPJ, cidade, ramo de atividade e número do processo. A aba linka para lá e
diz, na tela, que não encontrar uma empresa aqui **não** significa que ela não
tenha convênio.

O que o portal acrescenta é o que o registro oficial não faz. Medido em
14/09/2026, raspando as 42 páginas de `all.xml` (a mesma view, em marcação
estruturada):

- **4.160** convênios listados como "ativos";
- **2.191 (53%) já venceram** — 125 deles em 2018, 187 em 2019, 183 em 2020;
- **9** não têm data de término nenhuma, e trazem o status escrito dentro do
  nome da empresa (`[EM PROCESSO DE PRORROGAÇÃO]`, `PROCESSO DE CONVÊNIO EM
  TRAMITAÇÃO`, `PU-XXX/2022`).

Ou seja: a lista oficial é completa e o portal não; mas a lista oficial não
distingue vigente de vencido, e o portal distingue — com a data apurada do ato e
o ato como prova.

**A junção entre os dois é possível e não foi feita.** O registro traz o
processo SEI em 2.737 das 4.160 linhas, e o portal indexa todos os processos de
cada ato em `ato_processo`. Cruzar os dois apontaria, convênio a convênio, o que
o registro lista como ativo e o Boletim mostra vencido. Ficou de fora por
decisão de escopo em 14/09/2026 — depende de raspar um site de terceiro e de
manter essa raspagem viva.

---

## 6. O que pode estar errado

- **Prorrogação e rescisão não são rastreadas.** Um convênio pode ter sido
  prorrogado ou rescindido por ato posterior que o radar não relaciona. A tela
  manda conferir o ato de origem, e isso não é formalidade.
- **A data vem de OCR.** Data impossível (`31/02`) e fim anterior ao início são
  descartados — linha ausente é melhor que data que não existe, porque a data
  falsa não parece defeito.
- **O corte é `SUBSTRING(texto_original, 1, 3000)`.** Na fatia medida, a frase
  da vigência aparece no caractere 858 na melhor hipótese e 1.484 na pior; 3.000
  dá folga de o dobro. Redação que empurre o Art. 2º para além disso sairia de
  fora **em silêncio** — se a contagem cair sem motivo, suspeite daqui primeiro.

---

## 7. Regressão

```bash
php tools/teste_convenios_estagio.php     # 21 casos, roda no job `ods` do CI
```

Cada caso é texto real do acervo. Os da seção 3 são iscas que já falharam uma
vez: quem mexer nos padrões e reintroduzir o defeito vai encontrar o teste
vermelho, não o painel errado em produção.
