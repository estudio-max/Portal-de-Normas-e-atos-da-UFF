# Plano — reprocessar o acervo a partir dos PDFs

> **Estado: etapas 1 a 6 concluídas e em produção. Faltam a 7 (conferir contra
> o PDF) e a 8 (remover o aviso).** Documento vivo — atualize o quadro de
> etapas ao concluir cada uma. Escrito em 17/08/2026.
>
> ⚠️ **A etapa 8 está BLOQUEADA por um instrumento quebrado**, não por falta de
> trabalho: o teste de truncagem do backfill ainda mede o teto antigo de 7.000
> caracteres, então hoje não há como responder "ainda existe decisão escondida?"
> — que é a pergunta que autoriza tirar o aviso da tela. Ver as pendências do
> Codex adiante.

## Por que existe este documento

O trabalho atravessa sessões e envolve baixar e reprocessar ~20 anos de
boletins. Sem plano escrito, a sessão seguinte recomeça pela investigação — o
que já quase aconteceu com a memória do PHP nesta máquina.

## O que motivou

A aba Revalidação abriu com 95 pedidos, foi a 245 e depois a 1.021 conforme
padrões antigos foram descobertos. Ao medir a confiabilidade da fonte,
apareceu o limite real:

```
candidatos no teto : 624 de 3350
  destes, já capturados : 1
  destes, em aberto     : 623
```

`ato_texto` guarda o corpo do ato **cortado em 7.000 caracteres**. Em 623 atos
o dispositivo pode estar depois do corte, e dali **não há como distinguir "não
é revalidação" de "não deu para ver"**.

Os 1.021 no ar são um **piso verificado**, não um total comprovado. Como esses
números podem ir a órgão de controle (CGU/TCU cobram publicidade dos atos e
tempo de tramitação — Res. CNE/CES nº 1/2022), a diferença entre piso e total
não é detalhe.

**Remedido em 17/08/2026, com a chave nova e o backfill rodado em produção —
e o ponto cego NÃO diminuiu:**

```
atos candidatos lidos : 3355
pedidos gravados      : 1023   (Graduação 907 | Pós-graduação 116)
candidatos no teto    : 629 de 3355
  destes, capturados  : 1
  destes, em aberto   : 628
```

`ato_revalidacao` ficou com **1.027 linhas** (as 1.023 do backfill mais as que o
import diário grava a partir do JSON). O piso subiu de 1.021 para 1.027; os
**628** seguem cegos, e é só o reprocessamento a partir do PDF que os resolve —
o texto que falta não está no banco para ser lido de novo.

O mesmo diagnóstico relatou **309 atos que "parecem decisão e não casaram"**.
Amostra conferida (5 de 309): **nenhum é decisão de revalidação** — três são a
cláusula de regimento de pós-graduação "julgar as decisões do coordenador", um
é a norma que declara a UFF competente para revalidar e um é edital com lista
de cursos. É a família de falso positivo que o
[`CONTRIBUINDO-REPROCESSAMENTO.md`](CONTRIBUINDO-REPROCESSAMENTO.md) manda
prender como caso negativo, e ela está sendo corretamente descartada. Para
afirmar isso dos 304 restantes falta rodar com `&diagnostico=1`, que mostra 25.

A aba já exibe aviso de "série em consolidação" enquanto isto não fecha.

## ⚠️ Duas correções que precisam vir ANTES

Reprocessar é caro. Fazê-lo sem estas duas é pagar o preço e manter o ponto
cego — e depois só se corrige com outro reprocessamento.

### 1. O corte de 7.000 caracteres

Nasce em `tools/extrair_boletim.py`:

```python
corpo_busca = limpar(corpo).lower()[:7000]
```

É a causa raiz dos 623. Ao aumentar o limite, conferir o impacto em
`ato_texto` (MEDIUMTEXT aguenta 16 MB, então o limite é de custo, não de
schema) e no tamanho do `portal-data.json`, que trafega por Git e pelo
espelho público.

### 2. O texto é gravado em MINÚSCULAS

`importar_v2.php` grava o mesmo valor nas duas colunas:

```php
$texto = (string)($a['textoBusca'] ?? '');
$insTexto->execute([':id' => $atoId, ':t' => $texto, ':t2' => $texto]);
```

Ou seja, **`texto_original` não é o texto original**. É por isso que metade do
`backfill_ato_revalidacao.php` é código restaurando nome próprio
(`caixa_nome()`).

Corrigir para `texto_original` = original e `texto_busca` = versão dobrada
melhora busca, extração de instituição e qualquer análise futura sobre o
corpo. **Atenção:** `mascarar_cpfs()` precisa continuar aplicado aos dois.

## O que um reprocesso completo recupera

O extrator de hoje é muito melhor que o que fez a carga histórica.

| Frente | Ganho esperado |
|---|---|
| **Cargos e funções** | os padrões de Secretário, Assistente e o levantamento sistemático recuperaram **935 funções só no ano recente**. É a maior colheita da lista |
| **Selos de RSC** | os padrões foram corrigidos duas vezes (regex morto no singular, bloco de assinatura); o histórico tem a versão antiga |
| **Comissões, ODS, políticas** | classificadores que amadureceram depois da carga inicial |
| **Revalidação** | os 623 cegos + as 4 redações de 2000–2008 (ver abaixo) |

### As 4 redações de revalidação incorporadas

Colhidas pelo modo diagnóstico, todas reais e já cobertas pelos parsers e
testes de regressão:

| ato | forma |
|---|---|
| #6095 | "manifestar-se pelo **indeferimento do pedido**… **em nível de** graduação em bioquímica, **realizado na** universidade de suffolk" |
| #8910, #8911 | "homologar o parecer da comissão…, **indeferindo a solicitação** de revalidação de diploma de…" |
| #10848 | "homologar a revalidação **do título** de 'doctor of philosophy in computer science'… **como doutor em**" |
| #5792 | "pela **homologação da** revalidação… obtido por: decisão nº 018/08. Fulano, diploma de…" |

O padrão comum: a decisão vira **substantivo** ("indeferimento", "homologação")
ou **gerúndio** ("indeferindo"), e a origem aparece como "realizado na".

### Correção de múltiplos pedidos concluída

O `#5792` decide dois pedidos no mesmo ato (formato de lista). A etapa 2 passou
a extrair todas as ocorrências em ordem documental, manter `revalidacao` como
alias da primeira, sincronizar importador e backfill de forma atômica e usar a
chave `(ato_id, ordem)`. Assim, a contagem auditada preserva cada pedido sem
duplicar o ato.

## Etapas

> **Divisão de trabalho:** este plano é executado a quatro mãos com o Codex.
> Fronteiras, formato do caso de teste e ordem de merge em
> [`CONTRIBUINDO-REPROCESSAMENTO.md`](CONTRIBUINDO-REPROCESSAMENTO.md).

### ✅ Pendência da etapa 1 resolvida — duplicação removida do JSON

O extrator continua emitindo `corpo_texto` (caixa preservada) **e**
`corpo_busca` (dobrada) para uso interno, mas `gerar_dados_portal.py` publica
somente `textoOriginal`. O importador deriva `texto_busca` com
`mb_strtolower(..., 'UTF-8')`; o frontend e o mock derivam na leitura e mantêm
fallback para a safra antiga do JSON.

Testes compartilhados em Python, PHP e JavaScript conferem a caixa Unicode, a
máscara de CPF e a compatibilidade das duas safras. Na publicação automática
de 17/08/2026: **3.971 atos com `textoOriginal` e zero com `textoBusca`**.

A etapa 5 pode usar esse contrato sem republicar a cópia minúscula do corpo.

| # | Etapa | Estado |
|---|---|---|
| 1 | Corrigir truncagem e lowercase no extrator/importador | ✅ |
| 2 | Corrigir a chave de `ato_revalidacao` para múltiplas decisões | ✅ |
| 3 | Acrescentar as redações antigas de decisão única (`#5792` segue na etapa 2) | ✅ **no extrator**; o backfill segue sem elas (ver abaixo) |
| 4 | Baixar o acervo completo de boletins | ✅ 5.205 de 5.213 (8 não existem na fonte) |
| 5 | Reprocessar e gerar a base completa | ✅ 136.248 atos, 19 min, 474 MB em 5 blocos |
| 6 | Importar no servidor | ✅ 17/08/2026 — banco em 134.512 atos |
| 7 | Conferir amostra aleatória contra o PDF original | ⬜ |
| 8 | Remover o aviso de "série em consolidação" | ⬜ |

A etapa 7 é a que transforma "o regex casou" em "o número está certo". Sem
ela, o resto não sustenta auditoria.

### Etapas 5 e 6 — o que a carga completa rendeu (17/08/2026)

Cinco blocos importados em sequência. **O banco foi de 133.686 para 134.512
atos (+826)** — e NÃO duplicou, que era o risco medido antes de começar
(previsão para o bloco 1: 133.782; realizado: 133.759).

**Revalidação, que é o que motivou tudo:**

| momento | pedidos |
|---|---|
| antes do reprocessamento | 1.027 |
| logo após a importação | **299** ⚠️ |
| após rodar o backfill | **1.079** |

⚠️ **A queda para 299 não foi perda: foi o import fazendo o que ele faz.**
O `importar_v2.php` reescreve `ato_revalidacao` a partir do JSON, e o JSON só
carrega o que o EXTRATOR enxerga (299 no acervo inteiro). Os 1.027 vinham do
**backfill**, que lê o texto do banco com outro conjunto de padrões e acha
1.069. Os dois são **complementares, não redundantes**.

**Regra que fica: toda importação em massa é seguida do backfill de
revalidação.** Não é passo opcional — sem ele o painel cai para o que o
extrator sozinho vê. A união é segura porque o backfill só apaga o ato que ele
próprio casou (`if (!$achados) … continue;` antes do `sincronizar`), então os
10 pedidos que só o extrator conhece sobrevivem: 1.069 + 10 = **1.079**.

### 🔧 Duas pendências no `backfill_ato_revalidacao.php` (frente do Codex)

Levantadas na conferência de 17/08/2026. **Não toquei no arquivo** — ele é da
frente de padrões de extração.

**1. O teste de truncagem virou alarme falso.** A consulta é
`CHAR_LENGTH(t.texto_original) >= 6990`, fixa no teto ANTIGO. Com o teto novo
de 40.000, todo texto longo passa a contar como "no teto": o relatório acusa
**1.247 em aberto**, contra 628 antes do reprocessamento, exatamente quando o
problema deixou de existir. A prova de que é o medidor, e não o dado: os
candidatos cresceram 20% (3.355 → 4.027) e os "no teto" **dobraram** (629 →
1.249) — se o corte ainda fosse em 7.000 os dois teriam crescido junto. O
limiar precisa acompanhar o teto do extrator (hoje 39.990), senão a etapa 8
não tem como ser decidida: é este número que diz se ainda há decisão escondida.

**2. As 4 redações antigas estão só no extrator.** Testadas com o texto REAL
do acervo, vindo do diagnóstico rodado em produção:

| trecho | extrator | backfill |
|---|---|---|
| `#6095` "indeferimento do pedido … em nível de … realizado na" | ✅ | ❌ |
| `#8910` / `#8911` "indeferindo a solicitação de" | ✅ | ❌ |
| `#10848` "homologar a revalidação do Título … como Doutor em" | ✅ | ❌ |
| `#1651` regimento ("julgar as decisões do Coordenador") — NEGATIVO | rejeita ✅ | rejeita ✅ |

`RE_GRAD` exige a forma "revalidação do diploma …, obtido por …, junto a …",
e essas redações usam "do pedido de" e "realizado na". Por isso elas seguem na
lista de "parecem decisão e NÃO casaram" mesmo com a etapa 3 concluída — ela
foi feita no `extrai_revalidacoes()`, não aqui.

### Etapa 4 — o acervo já estava quase todo aqui (17/08/2026)

A etapa foi escrita como "baixar ~20 anos de boletins". Medido, era outra
coisa: `dados/boletins/` já tinha 2001–2026 e faltavam **24** PDFs. Ferramenta
nova para medir isso — `tools/conferir_acervo.py`, que lê a página de cada ano
e cruza com o disco, **sem baixar nada**.

| | |
|---|---|
| publicados pela UFF (2001–2026) | **5.213** |
| presentes no acervo local | **5.205** |
| baixados nesta rodada | 12 (o resto de 2026) |
| irrecuperáveis na fonte | **8** |

**Os 8 não são falha nossa nem download pendente: a UFF os LISTA e o servidor
não os entrega.** Conferido um a um — o host legado (`www.noticias.uff.br`,
para onde apontam TODOS os links de 2002 e 2014, inclusive os que temos)
responde 200 nos demais e **404 nestes**:

```
079-2002.pdf   133-2004.pdf
040-2014.pdf  041-2014.pdf  091-2014.pdf
092-2014.pdf  093-2014.pdf  094-2014.pdf
```

Isso é limitação de FONTE e precisa aparecer como tal em qualquer número que
vá a órgão de controle — do mesmo jeito que a aba Políticas diz "sem evidência
localizada no Boletim" em vez de afirmar omissão. Vale repetir a conferência
antes da etapa 7: link quebrado na UFF pode voltar.

⚠️ **Uma medição errada já nasceu aqui, e a lição vale para a etapa 7:** a
primeira versão do `conferir_acervo.py` procurava o PDF só na pasta do ano e
acusou 4 faltas em 2011 — a página de 2011 lista `001-2010.pdf` a
`004-2010.pdf`, que moram em `2010/`. Contar por pasta é contar errado; a
busca é no acervo inteiro.

### O que das etapas 1 a 3 já está NO AR (17/08/2026)

Concluída no repositório ≠ em produção. O que foi aplicado no servidor:

- **Banco:** `migrar_ato_revalidacao_multiplas.sql` rodado e conferido —
  `ordem` `SMALLINT UNSIGNED NOT NULL DEFAULT 1` e `uq_ato_revalidacao`
  `(ato_id, ordem)`, sem duplicata.
- **Importador e auxiliares:** `revalidacao_lista.php`,
  `revalidacao_lista_legada.php`, `revalidacao_sincronizacao.php`,
  `importar_v2.php` e `backfill_ato_revalidacao.php`.
- **Importação conferida pelo efeito:** 124 atos atualizados, 133.686 no banco,
  cache invalidado.
- **Frontend:** falta subir (o aviso de "série em consolidação" ainda não está
  no ar). Pacote pronto em `../enviar-hostgator-revalidacao-multiplas-2026-08-17/`.
- **API:** não mudou; segue em `2026-08-16.2`.

⚠️ **Duas armadilhas pagas neste deploy, as duas silenciosas:**

1. **A migração estourou `#1109 'ato_revalidacao' desconhecida em
   'information_schema'`** na conferência final — não era tabela ausente, era
   o banco corrente trocado por uma leitura anterior do `information_schema`.
   O arquivo agora captura `DATABASE()` no topo e qualifica as tabelas com ele.
2. **A primeira importação depois do deploy reverteu inteira**, com
   `ods_do_ato(): Argument #3 ($corpo) must be of type string, null given`:
   `$texto` tinha ficado pendurada quando o bloco do corpo foi renomeado, e
   `php -l` não vê variável indefinida. Guarda nova em
   `backend/importar/teste_variaveis_importador.php`, no CI.

## Ferramentas que já existem

- `tools/baixar_boletins.py --pasta boletins`
- `tools/extrair_boletim.py --pasta boletins --saida out`
- `tools/gerar_dados_portal.py --entrada out/atos.json --saida public/portal-data.json`
- `backend/importar/importar_v2.php?token=…&arquivo=…`
- `backend/importar/backfill_ato_revalidacao.php?token=…&diagnostico=1`

Não é território novo: a pasta de trabalho já tem `import-2002-2003`,
`backfill-2021-2024` e dois `reprocessamento-*` de operações anteriores. A
diferença é a escala.

## Cuidados operacionais

- **A trava anti-regressão do `indexar.yml` existe por bom motivo:** se a base
  nova vier MENOR que a publicada, ela não publica. Num reprocesso parcial
  isso vai disparar — é proteção, não defeito.
- **Espelho e importador leem do repositório de dados** (público, separado).
  Ver `CLAUDE.md`.
- **O import é idempotente** (upsert por chave natural), então repetir não
  duplica.
- **Rodar o `.sql` de `ato_revalidacao` antes**, se a chave mudar na etapa 2.
