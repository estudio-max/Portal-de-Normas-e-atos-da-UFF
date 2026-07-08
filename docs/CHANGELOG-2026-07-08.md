# Correções do Portal de Normas e Atos da UFF — 08/07/2026

Rodada de correções no extrator (`tools/extrair_boletim.py`), no gerador de
carga (`backend/db/gerar_sql.py`) e na API (`backend/api/index.php`),
originada de erros observados na base ao vivo (uff.fanara.com.br) e na
comparação da aba **Chefias** com a página oficial de dirigentes da UFF
(https://www.uff.br/sobre/dirigentes-da-uff/).

Todas as mudanças foram validadas com _snapshots_ antes/depois de uma amostra
de 14 boletins de 2023–2026 (1.891 nomes/eventos) e conferidas contra o texto
dos PDFs de origem. Cada bloco abaixo cita o commit correspondente.

---

## 1. Nome do cargo aparecia no lugar do nome da pessoa — `829de75`

Em Determinações de Serviço de departamento, o designado vem em _Title Case_
colado ao SIAPE (“Designar a docente Vivian Mendes Lopes, matrícula SIAPE…”),
enquanto o preâmbulo e as referências vêm em CAIXA ALTA. A heurística de
`nome_antes_siape` priorizava caixa alta (pensada para Portarias) e capturava
o texto errado.

- A janela de busca não começa mais no meio de uma palavra (o corte em
  “SUBCHEFE” fabricava “HEFE”, que escapava da _blocklist_) e cresceu de
  170 → 230 caracteres.
- A janela é cortada no último **RESOLVE**: o designado vem sempre depois dele,
  então o preâmbulo com a autoridade em caixa alta sai da disputa.
- **Bug de regex antigo:** a alternância `de|da|do|das|dos` nunca casava
  “dos”/“das” (o “do” casa antes e o motor não retrocede) — “Lenin **dos**
  Santos Pires” quebrava em dois. Trocado por `d[aeo]s?`. Recuperou dezenas de
  nomes “dos Santos”/“das Graças” truncados.
- Sequência em CAIXA ALTA não aceita mais conector minúsculo (“PROX do PPGQ”
  deixou de virar nome).
- `extrai_funcoes` rejeita durante a busca o candidato que é pedaço do nome da
  unidade (antes só zerava no fim, perdendo o nome verdadeiro).
- _Blocklist_ ampliada: referências de atos (dts/portaria…), cabeçalho de
  quebra de página (boletim/serviço/ano/seção/pág), rótulos de tabela
  eleitoral (chapa/titulares/suplentes), tipo de bolsa (AC/AA); letra solta nas
  pontas cai (“Iv P”).

Exemplos corrigidos: Vivian Mendes Lopes (GLE), Daniel Pereira Rosa (GGE),
Lúcia Oliveira da Silveira Santos (FTH), Arnaldo Costa Bueno (MICA II).

## 2. Datas superiores à data atual (erro de digitação de ano) — `04ab01d`

Erros de digitação na fonte (“…DE 03 DE DEZEMBRO DE 2026” num boletim de
2025; “Nº 047/2209”, “Nº 04/2201”) deixavam o ato datado no futuro — o que é
impossível, já que o boletim só publica ato já assinado — e poluía a projeção
de titular das chefias (um ato de 2209 nunca seria superado).

`corrige_ano_futuro()` ancora na **data do próprio boletim** (vale também nos
anos antigos do backfill, onde a data corrente não denunciaria o erro):

- `data_ato` posterior ao boletim: tenta o ano do boletim; se o ano estava
  claramente digitado errado (difere do ano do boletim), tenta também o ano
  anterior; sem candidato válido, descarta a data (vazio é melhor que futuro).
- Ano do número: edital numera legitimamente para o ano **seguinte** (“Edital
  POSLING nº 1/2024” sai em 2023), então só corrige se for maior que o ano do
  boletim + 1.

Corrigidos: DTS REN/IHS nº 30/**2024** (boletim de 27/12/2023) → 30/2023;
Resolução CUV nº 669/**2026** (boletim de 19/12/2025) → 669/2025; e as
Portarias 047/2209 e 04/2201 (boletins de 2009 e 2021).

## 3. Aba Chefias — três defeitos — `5d86f33`

1. **A aba só mostrava atos de 2026.** `gerar_sql --so-chefias` sem `--append`
   emitia `DELETE FROM ato_funcoes` global; como `chefias_TODAS.sql` é a
   concatenação dos anos, cada bloco zerava a tabela e só o último ano
   sobrevivia. Agora a limpeza é **por ano** sempre que o sufixo do lote é
   identificável.
2. **Menção descritiva virava designação.** O gatilho de função aceitava a
   preposição colada em outra palavra (o “o” de “n**o** cargo de…”), então
   “A vaga está vinculada à atuação da professora X no cargo de direção de
   Pró-Reitora da PROPPI” (numa DTS de banca) gerava uma designação falsa.
   Corrigido com fronteira de palavra antes da preposição.
3. **Corte de mandato escondia a alta administração.** O corte de 4 anos
   (pensado para chefia de setor) derrubava Pró-Reitores e Superintendentes de
   mandato longo (ex.: Superintendência de Operações e Manutenção, titular
   desde 2019). Pró-Reitor/Superintendente/Vice-Reitor ficaram isentos do
   corte; a proteção contra “fantasma” continua sendo a regra do último evento
   por pessoa.

## 4. Nomeação de dirigente perdida + setores-fantasma — `b4582cc`

Ao comparar a aba com a página oficial de dirigentes, faltavam Pró-Reitores e
sobravam setores antigos. Dois bugs de **extração** perdiam a designação (o
ato era indexado, mas sem evento de função):

- **Sufixo de gênero “(a)” colado no cargo.** “…para exercer o cargo de direção
  de **Pró-Reitor(a)** da Pró-Reitoria de Gestão de Pessoas” — o “(a)” impedia
  o casamento cargo→unidade. `FUNCAO_RE` tolera “(a)”/“(A)” opcional. Recupera
  **Aline da Silva Marques** (PROGEPE, Portaria 1.149/2021) e toda nomeação
  nesse formato.
- **Convidado externo sem SIAPE e sem vírgula.** “**Nomear** VERA… **para
  exercer** como convidado o cargo de direção de Pró-Reitor da Pró-Reitoria de
  Administração” — o atalho de nome externo exigia vírgula antes de “para
  exercer”. Vírgula agora opcional. Recupera **Vera Cajazeiras** (PROAD,
  Portaria 62.922/2019).

**Curadoria mínima na projeção** (`index.php`, só leitura — não altera dados):
remove da projeção de titular 3 designações órfãs de 2011 de unidades depois
renomeadas, isentas do corte por serem alta administração e que por isso
reapareciam como setor-fantasma (o ato histórico continua indexado e buscável):

| Setor-fantasma (2011)                              | Unidade atual (titular)                                          |
| -------------------------------------------------- | --------------------------------------------------------------- |
| “Tecnologia da Informação”                         | Superintendência de Tecnologia da Informação (Douglas, 2026)    |
| “Planejamento da Pró-Reitoria de Planejamento”     | Pró-Reitoria de Planejamento (Julio, 2022)                      |
| “Engenharia e Projetos - SUEP”                     | Superintendência de Arquitetura, Engenharia e Patrimônio (Renata, 2024) |

**Resultado:** a alta administração projetada passa a corresponder à página
oficial — 7/7 Pró-Reitores, as 7 Superintendências + Centro de Artes, e o
Vice-Reitor.

---

## Como publicar (HostGator)

As mudanças de projeção (itens 3.3 e 4-curadoria) exigem apenas subir o
`backend/api/index.php`. As de extração (itens 1, 2, 3.2 e 4-bugs) exigem
**reimportar** os dados regenerados:

1. Subir `backend/api/index.php` para `.../api/`.
2. Importar no phpMyAdmin, do mais novo disponível:
   - `out/carga_2023.sql.gz` … `carga_2026.sql.gz` (APPEND, idempotente por ano);
   - `chefias/chefias_TODAS.sql.gz`;
   - os 3 artefatos dos backfills (2004-2009, 2010-2014, 2015-2022) quando os
     workflows terminarem — trazem Vera (62.922/2019) e Aline (1.149/2021) do
     ato real.
3. Rodar `resolver_relacoes.php` uma vez.
