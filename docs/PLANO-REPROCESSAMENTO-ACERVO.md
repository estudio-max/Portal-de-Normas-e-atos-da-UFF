# Plano — reprocessar o acervo a partir dos PDFs

> **Estado: não iniciado.** Documento vivo — atualize o quadro de etapas ao
> concluir cada uma. Escrito em 17/08/2026.

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

### As 4 redações de revalidação ainda descobertas

Colhidas pelo modo diagnóstico, todas reais:

| ato | forma |
|---|---|
| #6095 | "manifestar-se pelo **indeferimento do pedido**… **em nível de** graduação em bioquímica, **realizado na** universidade de suffolk" |
| #8910, #8911 | "homologar o parecer da comissão…, **indeferindo a solicitação** de revalidação de diploma de…" |
| #10848 | "homologar a revalidação **do título** de 'doctor of philosophy in computer science'… **como doutor em**" |
| #5792 | "pela **homologação da** revalidação… obtido por: decisão nº 018/08. Fulano, diploma de…" |

O padrão comum: a decisão vira **substantivo** ("indeferimento", "homologação")
ou **gerúndio** ("indeferindo"), e a origem aparece como "realizado na".

### Um defeito conhecido, ainda não corrigido

**Ato que decide vários pedidos de uma vez grava só o primeiro.** O `#5792` é
assim (formato de lista). O código dá `break` na primeira ocorrência e a chave
única é `ato_id` sozinho.

O comentário em `backend/db/ato_revalidacao.sql` afirma que isso "estouraria de
forma visível" — **está errado**: grava o primeiro e ignora o resto, em
silêncio. Corrigir exige chave `(ato_id, ordem)` e percorrer todas as
ocorrências. Numa contagem auditada, é subnotificação invisível.

## Etapas

| # | Etapa | Estado |
|---|---|---|
| 1 | Corrigir truncagem e lowercase no extrator/importador | ⬜ |
| 2 | Corrigir a chave de `ato_revalidacao` para múltiplas decisões | ⬜ |
| 3 | Acrescentar as 4 redações antigas | ⬜ |
| 4 | Baixar o acervo completo de boletins | ⬜ |
| 5 | Reprocessar e gerar a base completa | ⬜ |
| 6 | Importar no servidor | ⬜ |
| 7 | Conferir amostra aleatória contra o PDF original | ⬜ |
| 8 | Remover o aviso de "série em consolidação" | ⬜ |

A etapa 7 é a que transforma "o regex casou" em "o número está certo". Sem
ela, o resto não sustenta auditoria.

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
