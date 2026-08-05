# Metodologia — Políticas institucionais

> Como o portal decide que um ato pertence a uma política, e que papel ele
> cumpre nela. Escrito a partir da carga de 03/08/2026, medida contra o acervo
> em produção. **Todo número aqui é reproduzível** pelos scripts citados.

A aba **Políticas** responde uma pergunta que a busca não responde: *como a UFF
construiu este assunto ao longo do tempo?* Buscar "assédio" devolve uma lista
ordenada por data. O dossiê mostra a sequência — o que instituiu, o que
regulamentou, quem ficou responsável, o que foi executado.

---

## 1. O que é uma política aqui

Uma entrada **curada** do catálogo (`politica`), com nome, descrição, categoria
e um conjunto de termos que a identificam no texto. O catálogo **não é
descoberto automaticamente**: quem decide o que é política é o mantenedor.

## 1.1 A categoria vem do PDI da UFF (desde 04/08/2026)

Até 04/08/2026 a categoria era `Direitos` | `Governança` | `Estudantes` — três
rótulos **sem âncora**, escritos junto com o catálogo. O defeito não era só a
falta de origem: os três **não respondiam à mesma pergunta**. "Direitos"
classifica pela natureza do que se protege, "Estudantes" pelo destinatário,
"Governança" pela função institucional. Sob qualquer critério consistente o
conjunto se desfazia — assistência estudantil *é* um direito, e acessibilidade
atende estudantes —, e "Estudantes" era prateleira de **um item só**, criada
porque a assistência estudantil não cabia nas outras duas.

Hoje a categoria é o **subtema do PDI 2023-2027** (aprovado pelo CGIRC em
21/08/2023), que declara 5 eixos mobilizadores e, dentro deles, subtemas. É a
taxonomia da própria universidade — mesmo princípio das ODS (ancoradas em
THE/IPEA) e das obrigações (ancoradas na legislação): **quando existe
classificação oficial, não se inventa uma.**

A lista agrupa pelo **eixo** e etiqueta cada política com o **subtema**.
Agrupar por subtema devolveria o defeito antigo — prateleiras de um item.

| Política | Eixo | Subtema | Base |
|---|---|---|---|
| Assistência estudantil | Responsabilidade Social | Assistência Estudantil | nome |
| Acessibilidade e inclusão | Responsabilidade Social | Acessibilidade | nome |
| Sustentabilidade | Responsabilidade Social | Meio Ambiente e Sustentabilidade | nome |
| Ações afirmativas | Responsabilidade Social | Equidade, Diversidade e Inclusão | nome |
| Integridade, riscos e controles | Governança e Gestão | Gestão de Riscos e Integridade | nome |
| Prevenção ao assédio | Responsabilidade Social | Equidade, Diversidade e Inclusão | **conteúdo** |
| Segurança da informação | Governança e Gestão | Gestão de Riscos e Integridade | **afinidade** |

### Por que existe o campo `pdi_base`

Porque o encaixe nem sempre é literal, e a tela não pode dar a duas coisas
diferentes a mesma autoridade.

- **`nome`** — o PDI tem subtema com aquele nome. Nada a ressalvar, e por isso
  não ganha marca na interface (mesma regra do `confianca: alta`).
- **`conteudo`** — o PDI **não usa a palavra**, mas o subtema **descreve o
  tema**. É o caso do **assédio**, e ele merece registro porque nasceu de um
  erro de método: buscamos a palavra "assédio" nas 175 páginas do PDI, achamos
  **zero**, e concluímos que o tema estava ausente. Não estava. "Equidade,
  Diversidade e Inclusão" (p.58-59) prevê *"protocolo geral de atendimento e
  encaminhamento voltado para mulheres em situação de violência de gênero"*, o
  mesmo para pessoas LGBTQIAP+, protocolo para *"denúncias de racismo e
  discriminações"*, e põe a **CPEG** e a **AFIDE** como responsáveis. É o mesmo
  objeto institucional, com outro vocabulário. **Buscar o TERMO e concluir
  ausência do TEMA é a armadilha-mãe da [METODOLOGIA-ODS](METODOLOGIA-ODS.md)**,
  aplicada agora ao documento em vez de ao ato.
- **`afinidade`** — atribuição nossa; o PDI não cobre. É o caso da **segurança
  da informação**: o CGIRC emite os atos e o tema é de risco, mas o subtema
  "Gestão de Riscos e Integridade" (p.71) fala de **processo crítico, Plano de
  Integridade e TCU** (área: PROPLAN), e "Governança Digital" (p.72) fala de
  **digitalizar serviço e publicar no gov.br** (área: STI). O PDI não escreve
  "segurança da informação", "proteção de dados" nem "LGPD" em página nenhuma.
  É o melhor destino disponível — e continua sendo aproximação nossa.

### A âncora é datada

`pdi_versao` guarda a edição do plano. O PDI 2023-2027 vence em 2027 e o
próximo pode reorganizar os eixos; sem a edição registrada, a classificação
viraria afirmação sem tempo. Ao trocar de PDI, **remeça** — em especial as duas
linhas que hoje não são `nome`.

Fonte: [PDI UFF 2023-2027](https://www.uff.br/wp-content/uploads/2024/05/2023_08_21_pdi_ppi_2023_2027.pdf).
Aplicação: `backend/db/alterar_politica_pdi.sql` (uma vez) + seed regerado.

O catálogo vive em `tools/gerar_seed_politicas.py`, na constante `CATALOGO`, e
é a fonte única — o `.sql` é gerado, e o CI reprova se ele for editado à mão.

**São 7 políticas de um piloto**, não o conjunto das políticas da UFF.

## 2. De onde veio a semente

Da própria curadoria ODS. A classificação por ODS já separa `proposta` (ato
fundador de política, plano ou programa) de `execucao`, `pesquisa` e `ensino` —
ver [`METODOLOGIA-ODS.md`](METODOLOGIA-ODS.md). Os atos com `vinculo='proposta'`
são, por definição daquela metodologia, os atos fundadores do acervo.

```bash
python tools/baixar_propostas.py      # puxa /api/ods?n=1..17
python tools/analisar_politicas.py    # mede a cobertura do piloto
python tools/gerar_seed_politicas.py  # emite o seed + o CSV de curadoria
```

Medido em 03/08/2026: **243 linhas `proposta` em 136 atos distintos**, de 2001 a
2026.

## 3. Os dois sinais que ligam ato ↔ política

### 3.1 Frase estrita na ementa (confiança **alta**)

`LIKE` sobre a ementa normalizada, nunca FULLTEXT. O índice de texto tokeniza:
"segurança da informação" casaria "informação" em qualquer contexto. É a mesma
regra do casamento de comissões.

### 3.2 Órgão emissor (confiança **média**)

Quando a ementa não nomeia a política, quem a nomeia é quem assina.

> "Fixa as diretrizes para o Programa de Bolsa de Desenvolvimento Acadêmico"

Não há frase aqui que diga "assistência estudantil" nem qualquer outro termo do
catálogo. O que diz é o emissor: a **PROAES**, Pró-Reitoria de Assuntos
Estudantis. **Medido no seed de 04/08/2026: 22 dos 38 vínculos de assistência
estudantil entram só por este sinal** (16 entram por frase) — sem ele, a maior
política do piloto apareceria com pouco mais de um terço do tamanho.

> ⚠️ **O exemplo desta seção mudou em 04/08/2026, e a troca vale registro.** Ele
> era *"Programa Auxílio Alimentação para Estudantes Ingressantes"* — só que
> `auxílio alimentação` **está** na lista de termos, então aquela ementa entra
> por FRASE, com confiança alta. O exemplo contradizia o que ilustrava. Pior: o
> mesmo texto virou caso de teste em `teste_politicas_match.php`, exigindo
> confiança média de uma ementa que produz alta — **o teste nasceu vermelho e
> ficou 8 commits assim** até alguém olhar o CI. Hoje o teste cobre os dois
> lados, e o contra-exemplo está lá para impedir a volta.

É a mesma lição que o `comissoes_do_orgao` já tinha ensinado: o ato que um corpo
assina sem se nomear na ementa só se identifica pelo emissor.

### 3.3 Por que NÃO se lê o corpo do ato

A pergunta aparece sozinha: a ementa é curta, o corpo é rico — por que não ler o
corpo para achar mais? **Foi medido em 04/08/2026, e reprovado.**

Casando frase estrita no **dispositivo** do corpo (o trecho depois de
`RESOLVE:` / `Art. 1º`, já descartando o preâmbulo), sobre os 3.767 atos do
índice: **37 vínculos novos, dos quais 1 legítimo.** Precisão de ~3%.

| ementa do ato | o que o corpo casou |
|---|---|
| *"Nomeia Erika … Professor do Magistério Superior"* | `políticas afirmativas` |
| *"Designa Ana Paula da Silva, Professor"* | `ações afirmativas` |
| *"Distribuição de 1 Função Gratificada (FG-1)"* | `ações afirmativas` |
| *"Altera o percentual de Incentivo à Qualificação"* | `sustentabilidade` **e** `segurança da informação` |

O termo está no **nome da vaga**, na **UORG do anexo**, na **descrição da
função**, na **lista de áreas de capacitação** — nunca no que o ato decide. É a
armadilha-mãe da [METODOLOGIA-ODS](METODOLOGIA-ODS.md) no grau máximo, e o
paralelo é exato: foi assim que 292 atos de pessoal entraram na primeira carga
ODS.

> ⚠️ **Armadilha na própria medição.** O `textoBusca` do `portal-data.json` é
> **todo minúsculo** — é o campo do índice FULLTEXT, não o texto de exibição. A
> primeira medição procurou `RESOLVE:` em caixa alta, não casou nada, e a guarda
> de fragmento (que recusa texto abrindo em minúscula) derrubou o resto: deu um
> falso **"zero ganho"** que quase virou conclusão. Quem repetir isto, comece
> conferindo a caixa do campo.

### 3.4 Ato da Reitoria: atenção redobrada significa desconfiar mais

Ato emitido pela **Reitoria** alcança a universidade inteira, então perder um
custa mais que perder um ato de unidade. Mas a Reitoria é também **quem mais
emite ato individual de pessoal** — nomeação, designação, distribuição de função
gratificada —, e **12 dos 37 falsos positivos** da medição acima eram dela.

Daí a regra: em classificação automática, **Reitoria nunca é sinal de
inclusão**. Na triagem da curadoria ela vai para revisão humana, sempre — é onde
o olho de uma pessoa rende mais.

## 3.5 A curadoria vem triada

O CSV de curadoria não sai mais com a coluna `decisao` em branco: ele traz
`proposta` e `motivo` preenchidos, para a revisão humana se concentrar no que é
duvidoso.

| proposta | quando | 155 linhas |
|---|---|---:|
| `aceitar` | frase estrita na ementa + papel de ação + órgão não-Reitoria | 36 |
| `revisar` | Reitoria · confiança média · papel `governanca`/`referencia` · sem cluster | 92 |
| `fora` | já rejeitado por guarda medida | 27 |

**Nada é proposto como `rejeitar`.** O que as guardas rejeitam não chega ao CSV,
e rejeitar por regra o que passou seria desfazer a medição com palpite.

Duas fontes produzem a triagem e **precisam concordar**: `triagem()` em
`tools/gerar_seed_politicas.py` (recorte de `propostas.json`) e
`politica_triagem()` em `backend/importar/backfill_ato_politica.php` (acervo
real, via `?csv=1`). É o acervo real que importa curar — o recorte offline cobre
155 linhas, o acervo tem 330.

## 4. As duas guardas

### 4.1 O termo está no NOME DO EMISSOR

O CGIRC abre seus atos com a cláusula "O COMITÊ DE GOVERNANÇA, **INTEGRIDADE**,
RISCOS E CONTROLES…", e essa abertura entra na ementa capturada. Buscar
`integridade` solto trazia:

| Ato | Ementa | É integridade? |
|---|---|---|
| DECISÃO CGIRC 16/2025 | Plano de Gestão Socioambiental / Agenda Ambiental | não — é sustentabilidade |
| DECISÃO CGIRC 12/2025 | Programa Bem Viver UFF | não — é qualidade de vida |
| DECISÃO CGIRC 6/2025 | Relatório Parcial 2024 do PDI | não — é planejamento |
| DECISÃO CGIRC 15/2025 | Relatório Anual de Gestão de Riscos | **sim** |

Correção: exigir o dispositivo — `plano de integridade`, `programa de
integridade`, `política de integridade`, `gestão de riscos`. Os três falsos
positivos saem, o verdadeiro fica.

**É a armadilha-mãe da metodologia ODS reaparecendo**: o termo costuma estar no
nome de alguém — parceiro, cargo, área, órgão emissor — e não no dispositivo.

### 4.2 Ementa inutilizável

Casar frase exige uma ementa legível. **15 dos 136 atos não têm**:

| Motivo | Casos | O que é |
|---|---:|---|
| sem ementa formal | 5 | o boletim não publicou ementa |
| OCR espaçado | 5 | `C o n s t i t u i a C o m i s s ã o` |
| fragmento | 4 | recorte que abriu em minúscula ou pontuação órfã |
| rodapé | 1 | `BS - - SEÇÃO II, págs. 121 a 134` |

Vão para curadoria. Chutar rótulo neles contaminaria o dossiê.

## 5. O papel — o que o ato FAZ pela política

Esta é a distinção que sustenta a aba, e da qual o indicador de maturidade
documental vai depender.

| Papel | Reconhecido por | Exemplo |
|---|---|---|
| `fundador` | institui, cria, aprova o/a, plano de, política de | Plano de Enfrentamento ao Assédio |
| `regulamentacao` | regulamenta, regimento interno, normatiza, dispõe sobre | Regimento Interno da Comissão de Ética |
| `governanca` | designa, constitui comissão, grupo de trabalho | Designa membros da CPA |
| `execucao` | fixa as diretrizes, execução do programa | Diretrizes do Auxílio Alimentação |
| `monitoramento` | relatório, prestação de contas | Relatório Anual de Gestão de Riscos |
| `alteracao` / `revogacao` | altera, modifica, retifica / revoga | — |
| `referencia` | nada acima casou | menção sem dispositivo |

A ordem importa: a primeira regra que casa vence, da ação mais forte para a mais
fraca. `institui a cartilha|manual|guia|caderno` fica em `regulamentacao` e vem
ANTES de `fundador` — material de orientação detalha como cumprir a política,
não a institui.

**Designar comissão é `governanca`, não `execucao`.** Sem essa separação, uma
política com dez designações e nenhuma entrega apareceria como a mais ativa de
todas — que é exatamente o "gaming documental" que o indicador precisa resistir.

### Uma armadilha já paga

`plano de` estava em `monitoramento`. Consequência medida: o **Plano de
Enfrentamento ao Assédio** — o ato central da política — era classificado como
acompanhamento, e a política de assédio nascia **sem ato fundador nenhum**.
Plano é instrumento fundador; relatório é monitoramento.

## 6. O que fica de fora

| Motivo | Casos | Por quê |
|---|---:|---|
| sem cluster | 48 | nenhum termo do catálogo casou. Não recebe rótulo: precisão acima de cobertura |
| duplicata de acervo | 10 | 5 chaves naturais com dois `uid` — entrariam duas vezes na linha do tempo |
| efeito individual | 4 | sindicâncias que apuram caso concreto. Regra de privacidade |

Tudo isso vai para `dados/curadoria_politicas.csv`, com o motivo, para revisão.

Sobre a **duplicata de acervo**: é a duplicata por citação que o `CLAUDE.md`
registra como viva fora do CEPEx 2021-2024. Um caso é ilustrativo —
`Reitoria 47.106/2012` tem a ementa real numa cópia (`Propõe os termos da
Política de Segurança da Informação`) e o rodapé do boletim na outra. Como a
curadoria do CEPEx já provou que **a cópia verdadeira nem sempre é a primeira**,
nenhuma regra automática escolhe: as duas ficam fora até alguém decidir.

## 7. Como o resultado é apresentado

- **Faixa de etapas** no cartão: instituição, regulamentação, governança,
  execução, monitoramento, avaliação. Etapa sem ato aparece **apagada**, com o
  texto *"sem evidência localizada no Boletim"*.
- **Selo `catálogo em revisão`** enquanto `status_curadoria='rascunho'`.
- **Selo `⚠ confiança media`** no vínculo que entrou pelo órgão emissor, com a
  justificativa no `title`.
- **Avisos** vêm da API (`politicas_avisos()`), não do frontend.

### A regra de linguagem

**Ausência de evidência no Boletim não comprova ausência de execução.** O
acervo cobre o que foi publicado no Boletim de Serviço; muita coisa acontece
fora dele. A aba nunca diz que uma etapa "não foi cumprida" — diz que não
localizou evidência dela. A diferença entre as duas formulações é a diferença
entre informar e acusar.

## 8. Limitações conhecidas

- ~~O ato fundador de `acessibilidade` é uma cartilha.~~ **Corrigido.** A
  Instrução Normativa que institui a *Cartilha de acessibilidade atitudinal*
  casava `institui` e virava ato fundador da política. Cartilha, manual, guia e
  caderno detalham COMO cumprir; não fundam. Passaram para `regulamentacao`, e a
  regra vem antes de `fundador` na ordem — aqui a ordem das regras é a correção.
  Resultado: `acessibilidade` passou a dizer "ato instituidor não localizado no
  acervo", que é a verdade.
- **`assistencia-estudantil` e `acoes-afirmativas` não têm ato fundador
  localizado.** Não é falha da regra: o acervo registra a política em atividade
  sem registrar o ato que a instituiu.
- **Só 7 políticas.** A cobertura cresce por curadoria, não por regex mais
  frouxo.
- **Assédio não veio da camada ODS** (tinha 1 ato lá). Veio de varredura da
  ementa no acervo inteiro: 16 atos, 1 central e o resto local.

## 9. Reproduzir

```bash
python tools/baixar_propostas.py
python tools/analisar_politicas.py
python tools/gerar_seed_politicas.py
node  tools/teste_schema_inteligencia.mjs
```

O último valida o `.sql` gerado contra o catálogo do gerador: papel e confiança
dentro do ENUM, vínculo sem tripla repetida, alias apontando para política que
existe, política nascendo em rascunho, e todo `DELETE` carregando a guarda de
curadoria.

## 10. Reclassificar um ato exige DELETE, não UPDATE

`papel` faz parte da chave natural `(ato_id, politica_id, papel)`. Quando um ato
muda de papel — foi o caso da cartilha —, o upsert enxerga uma **chave nova** e
INSERE, deixando a linha antiga viva: o ato passa a aparecer duas vezes na linha
do tempo, com dois papéis, e nenhum erro é levantado.

Por isso o seed abre o bloco de vínculos com:

```sql
DELETE ap FROM `ato_politica` ap
 WHERE ap.`metodo` NOT IN ('curadoria','regra+curadoria','ia+curadoria');
```

É o mesmo desenho da `ato_ods` no importador: a passada automática apaga só o
que ela mesma escreveu, e qualquer linha revisada por humano sobrevive. O CI
reprova qualquer `DELETE` sem essa guarda — sem ela, uma reaplicação do seed
varreria a curadoria e ninguém perceberia, porque o painel continuaria cheio.
