# Backfill 2021-2024 — recuperação das resoluções CEPEx

> **EXECUTADO em 21/07/2026.** Os quatro anos rodaram sem erro. `novos` por ano:
> 2021 = 651, 2022 = 818, 2023 = 1.509, 2024 = 1.256 — **4.234 atos recuperados**
> (a medição local previa 4.238; diferença de 0,09%). Banco: 128.968 → 133.202
> atos. CEPEx por ano, antes → depois: 2021 10 → 631, 2022 4 → 813,
> 2023 1 → 1.488, 2024 5 → 1.235. Smoke test passou nas 9 verificações.
> O documento fica como registro do método — não precisa ser rodado de novo.

Fecha na produção o que o commit `42c504d` corrigiu só no extrator: até então,
`TITULO_RE` só reconhecia órgão em CAIXA ALTA — "CEPEx" (x minúsculo, a grafia
real usada pela UFF de ~2021 a meados de 2025) quebrava o título inteiro, e a
resolução inteira era absorvida pelo corpo do ato anterior. Medido: 651 a 1.515
atos recuperados por ano em 2021-2024, a maioria resoluções do CEPEx (acordos de
cooperação, credenciamento em pós-graduação, regulamentos — não é só a aba
Cooperação). 2001 e 2026 servem de controle: zero perdas nos dois.

O extrator já está corrigido e no ar (`tools/extrair_boletim.py`). Este runbook
é só a etapa que falta: levar o resultado da reextração para o **MySQL de
produção**, sem SSH, pelo caminho que o próprio projeto já previu para isso.

## Por que não os workflows `Backfill do Legado` / `Backfill em Bloco`

`.github/workflows/backfill.yml` e `backfill-bloco.yml` chamam
`backend/db/gerar_sql.py`, que grava no **schema v1** (`atos`, `ato_corpo`,
`ato_siapes`...) — morto, segundo a própria tabela de armadilhas do
`CLAUDE.md`. A API viva lê do schema v2 (`ato`, `ato_texto`, `ato_pessoa`...).
Rodar esses workflows não ajudaria e pode confundir. **Não usar.**

## O caminho certo: `importar_v2.php`

Esse importador já foi desenhado exatamente para isto — o comentário do
próprio arquivo diz: *"sem SSH, o navegador é o único jeito de rodar isto"*.
Ele é **idempotente por chave natural** (`boletim_id, tipo_id, sigla_orig,
numero_norm, ano`): se o ato já existe, faz `UPDATE` nele (sem duplicar); se
não existe — exatamente o caso dos atos "sumidos" pelo bug do CEPEx —, faz
`INSERT`. Rodar isto sobre anos que já têm dados em produção é seguro por
construção.

## Pré-requisito no servidor (confira antes do primeiro arquivo)

`importar_v2.php` faz `require_once` de dois arquivos da mesma pasta:
`extrair_prazos.php` e `extrair_prazos_pad_sinve.php`. Se só o `importar_v2.php`
foi publicado sem esses dois, o import falha com um fatal error (mesma
assinatura já vista neste projeto: HTTP 500 / corpo vazio). Confirme pelo
Gerenciador de Arquivos que a pasta `importar/` no servidor tem os três:
- `importar_v2.php`
- `extrair_prazos.php`
- `extrair_prazos_pad_sinve.php`

## Os 4 arquivos

Gerados localmente com o extrator já corrigido, no formato que `importar_v2.php`
espera (o mesmo shape do `portal-data.json` diário). Confirmado: a Resolução
CEPEx/UFF 224/2021 (Universidade Portucalense — o caso que expôs o bug) está
presente e corretamente atribuída ao órgão CEPEx.

Em [`../portal-normas-uff/backfill-2021-2024/`](../portal-normas-uff/backfill-2021-2024/):

| Arquivo | Atos | Ativo | Alterado | Revogado |
|---|---|---|---|---|
| `portal-data-2021.json` | 5.969 | 5.842 | 89 | 38 |
| `portal-data-2022.json` | 6.442 | 6.283 | 120 | 39 |
| `portal-data-2023.json` | 8.281 | 8.052 | 178 | 51 |
| `portal-data-2024.json` | 6.844 | 6.726 | 92 | 26 |

(2024 tem menos boletins que os outros anos — 159 contra ~240 — mas a
sequência é completa, do nº 1 ao 159, o último de 27/12/2024: a UFF publicou
menos boletins naquele ano, não é lacuna do corpus.)

## Passo a passo — um ano por vez

Fazer **um ano de cada vez**, conferir o resultado, só então seguir para o
próximo. Ordem sugerida: 2021 → 2022 → 2023 → 2024.

1. **Subir o arquivo** pelo Gerenciador de Arquivos da HostGator, para dentro
   da pasta `importar/` no servidor (a mesma do `importar_v2.php`) — ex.:
   `portal-data-2021.json`.
2. **Visitar a URL** (troque `SEU_TOKEN` pelo `import_token` do `config.php`):
   ```
   https://inteligencia.fanara.com.br/importar/importar_v2.php?token=SEU_TOKEN&arquivo=portal-data-2021.json
   ```
3. **Ler o retorno.** A página fica em branco até terminar (pode levar um
   tempo — são milhares de atos) e depois imprime texto simples terminando em:
   ```
   OK. novos=NNNN | atualizados-c-mudanca=NNNN | Banco agora com NNNNNN atos.
   ```
   `novos` é essencialmente o tamanho do buraco fechado naquele ano — para
   2021, o número bruto de atos recuperados foi 651 no teste local (o `novos`
   real pode diferir um pouco, já que o teste local mediu o total do ano, não
   só os que faltavam).
4. **Apagar o arquivo** da pasta `importar/` do servidor depois de confirmado
   (é dado de trabalho, não precisa ficar público) e repetir para o próximo ano.

## Se um arquivo for grande demais para o servidor aceitar de uma vez

Não é o caso esperado, mas se o upload ou a execução falhar por limite do
hosting: divida o JSON por semestre antes de subir (é uma lista JSON simples,
dá para cortar em duas metades com qualquer script) e rode cada metade como um
arquivo `?arquivo=` separado — o importador não se importa com o tamanho do
lote, cada ato é upsertado independente dos outros.

## Verificação depois de cada ano

Mesmo teste que expôs o problema:

```bash
curl -sL "https://inteligencia.fanara.com.br/api/atos?ano=2021&orgao=CEPEx&por_pagina=1"
```

Antes do backfill: `"total": 10`. Depois de importar 2021, esse número deve
subir para a casa das centenas (o CEPEx é um conselho ativo — 2022 sozinho
teve mais de cem menções de "coopera" na amostra bruta dos PDFs).

Repita para `ano=2022`, `2023`, `2024`. Ao final, o buraco que a aba
Cooperação expôs (2021 com zero acordos) deve estar preenchido — conferir em
`/api/cooperacao`.

## Depois do backfill completo

- `resolver_cross_ano_v2` já roda sozinho ao fim de cada import (linha final
  de `importar_v2.php`) — não precisa disparar o resolver à parte.
- Rodar `bash tools/smoke_test.sh` para confirmar que nada mais quebrou.
- Atualizar a pendência do `CLAUDE.md` (linha do CEPEx 2021-2024) marcando
  como feito, com a data e os números finais de `novos` de cada ano.
