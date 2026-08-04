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

> "Fixa as diretrizes para execução do Programa Auxílio Alimentação para
> Estudantes Ingressantes"

Não há frase aqui que diga "assistência estudantil". O que diz é o emissor: a
**PROAES**, Pró-Reitoria de Assuntos Estudantis. **Medido: 24 dos 37 atos de
assistência estudantil entram só por este sinal** — sem ele, a maior política do
piloto apareceria com um terço do tamanho.

É a mesma lição que o `comissoes_do_orgao` já tinha ensinado: o ato que um corpo
assina sem se nomear na ementa só se identifica pelo emissor.

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
