# Pipeline de classificação ODS

Os quatro scripts que produziram a classificação dos atos nas 17 ODS que está
em produção. O **método** — o que conta como vínculo, por que `proposta` não é
`execucao`, a isca do nome próprio — está em
[`../../docs/METODOLOGIA-ODS.md`](../../docs/METODOLOGIA-ODS.md). Aqui fica só
a mecânica.

Eles viveram no scratchpad de uma sessão até 27/07/2026 e foram trazidos para o
repositório porque são a **proveniência auditável** de 1.368 linhas de
`ato_ods` no ar: sem eles, ninguém consegue refazer nem contestar a
classificação.

## Ordem

Cada etapa lê a saída da anterior. Rodar fora de ordem não falha com erro
claro — simplesmente lê um JSON velho.

| # | script | lê | escreve |
|---|---|---|---|
| 1 | `classificador_corpus.py` | as cargas de `dados/cargas/` | `corpus_propostas.json` |
| 2 | `rotulador_final.py` | `corpus_propostas.json` | `rotulados.json`, `descartados.json` |
| 3 | `resolver_uids.py` | `rotulados_all.json`, o dump de produção | `resolvidos.json`, `nao_resolvidos.json` |
| 4 | `emitir_final.py` | `resolvidos.json`, a curadoria | a carga em `backfill-ods/` |

1. **Recorte.** Varre os ~68,8 mil atos e separa os que têm chance de ser
   proposta de política, olhando o dispositivo e não a ementa. Saiu com 2.819
   candidatos.
2. **Rotulagem por clusters auditados.** ~40 clusters com meta nomeável. É aqui
   que moram as listas de descarte e as guardas contra ato de pessoal — a parte
   que mais custou a acertar, e a que mais compensa reler antes de mexer.
3. **Resolução de uid.** Casa cada rótulo com a linha real da produção por
   `(tipo_id, numero_norm, ano[, sigla_orig])`, lendo a tabela `ato` de dentro
   do dump zipado. **Ambíguo ou ausente vai para `nao_resolvidos` — nunca
   chuta.**
4. **Emissão.** Monta a carga `metodo='ia'` já excluindo os pares que a
   curadoria humana fixou, para a IA não sobrescrever revisão manual.

## Caminhos

Resolvidos a partir da localização do próprio arquivo — rodam de qualquer
diretório. Os JSONs intermediários **não entram no repositório** (são grandes e
regeráveis); o padrão é `backfill-ods/trabalho/`, e a variável de ambiente
`ODS_TRABALHO` sobrescreve:

```bash
ODS_TRABALHO=/tmp/ods python tools/ods/classificador_corpus.py
```

O `resolver_uids.py` espera o dump de produção em
`portal-normas-uff/fanara87_governanca.sql.zip` (fora do repo). Sem ele, a
etapa 3 não roda — e não há como substituir por consulta à API, porque a API
não expõe o `uid` interno.

## Antes de rodar de novo

A classificação em produção foi construída em várias rodadas, cada uma
disparada por um defeito medido (falso positivo de ato de pessoal, `stricto
sensu` lido como ensino, atos de reestruturação com a ODS no nome da unidade
renomeada). O histórico está em `METODOLOGIA-ODS.md`, §8-A. **Rodar do zero sem
reler aquilo reintroduz defeitos já pagos.**

A carga é upsert por `(ato_id, ods)` e as linhas `metodo='curadoria'` são
preservadas — repetir é seguro, mas conferir a contagem antes e depois não é
opcional.
