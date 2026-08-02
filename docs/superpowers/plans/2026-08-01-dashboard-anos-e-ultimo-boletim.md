# Dashboard: série anual e atos do último boletim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar dados reais de 2001–2026 no gráfico anual e todos os atos do Boletim de Serviço mais recente no Dashboard.

**Architecture:** A rota existente `api/stats` passa a devolver a série por ano e a lista completa do último boletim. `dataSource.getStats()` constrói a mesma forma a partir de `portal-data.json` no fallback estático. O `App` transforma essa resposta em props do Dashboard, que apresenta barras reais e uma lista identificada pelo boletim.

**Tech Stack:** React 19, TypeScript, Vite, Node assert, PHP 8/PDO/MySQL.

## Global Constraints

- A série exibe todas as barras de 2001 a 2026, com zero nos anos sem atos; não usar barras simuladas.
- A lista contém todos e somente os atos do arquivo do boletim mais recente.
- O resultado deve ser equivalente em modo API e no fallback de `portal-data.json`.
- Manter o roteamento por hash e a ação existente “Ver todos”.
- Não alterar schema, credenciais, API PHP fora de `backend/api/index_v2.php` ou o pipeline de indexação.

---

## File structure

- `backend/api/index_v2.php`: acrescenta agregação anual e os atos do último boletim à resposta cacheada de `stats`.
- `src/dataSource.ts`: declara o contrato do dashboard e produz o mesmo contrato no modo estático.
- `src/App.tsx`: mapeia a série anual e usa a lista entregue por `getStats`.
- `src/components/dashboard/Dashboard.tsx`: identifica o boletim, renderiza toda a lista e desenha uma barra por ano real.
- `tools/test_redesign_integrity.mjs`: protege o contrato de dados e impede o retorno de barras de demonstração ou corte de cinco atos.
- `docs/IMPLEMENTACAO-REDESIGN.md`: documenta origem, escopo e validação dos novos dados do dashboard.

### Task 1: Contrato e regressões do Dashboard

**Files:**
- Modify: `tools/test_redesign_integrity.mjs`
- Modify: `src/dataSource.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `Stats.porAno: Record<number, number>` e `Stats.ultimoBoletim.atos: DashboardAct[]`.
- Consumes: `UffAct.arquivo`, `UffAct.dataAssinatura`, `UffAct.status` e `UffAct.linkBoletim`.

- [ ] **Step 1: Write the failing regression assertions**

Append to `tools/test_redesign_integrity.mjs` assertions that require:

```js
assert.match(dataSource, /porAno: Record<number, number>/,
  'Stats must expose real annual totals.');
assert.match(dataSource, /atos: DashboardAct\[\]/,
  'The latest bulletin must expose all of its acts.');
assert.match(app, /porAno: s\.porAno/,
  'App must pass annual totals to the Dashboard.');
assert.doesNotMatch(app, /por_pagina: 5/,
  'Dashboard must not truncate the latest bulletin to five acts.');
```

- [ ] **Step 2: Run the regression test to verify it fails**

Run: `node tools/test_redesign_integrity.mjs`

Expected: `AssertionError` because `Stats` has no annual series and `App.tsx` requests five records.

- [ ] **Step 3: Define the shared dashboard data contract**

In `src/dataSource.ts`, add `DashboardAct` directly above `Stats` and extend `Stats`:

```ts
export interface DashboardAct {
  id: string; tipo: string; sigla: string; numero: string; ano: number;
  dataAssinatura: string; ementa: string; status: string;
  processoSei: string | null; linkBoletim: string | null;
}

export interface Stats {
  // existing counters
  porAno: Record<number, number>;
  ultimoBoletim?: {
    arquivo: string; numero: string; ano: number; link: string | null;
    atos: DashboardAct[];
  } | null;
}
```

- [ ] **Step 4: Pass the annual series and bulletin acts through `App`**

Change `mapStats` to assign `porAno: s.porAno`. Replace the independent
`listAtos({ por_pagina: 5, ... })` branch with a conversion from
`s.ultimoBoletim?.atos ?? []` into the existing `UffAct` fields, using empty
arrays/strings for unavailable detail-only properties. Keep the static branch
only as a defensive fallback when `ultimoBoletim` is unavailable.

- [ ] **Step 5: Run the regression test to verify the contract passes**

Run: `node tools/test_redesign_integrity.mjs`

Expected: the new assertions pass after Tasks 2 and 3 complete; existing
assertions remain green.

- [ ] **Step 6: Commit**

```powershell
git add tools/test_redesign_integrity.mjs src/dataSource.ts src/App.tsx
git commit -m "test: cobre dados reais do dashboard"
```

### Task 2: Produzir série e último boletim na API e no fallback estático

**Files:**
- Modify: `backend/api/index_v2.php:432-465`
- Modify: `src/dataSource.ts:208-235`

**Interfaces:**
- Consumes: `ato.ano`, `ato.boletim_id`, `boletim.arquivo`, `boletim.numero`, `boletim.ano`.
- Produces: a resposta `GET /api/stats` estendida e equivalente a `getStats()` no fallback.

- [ ] **Step 1: Extend the PHP `stats()` payload**

After querying `$ult`, query the annual totals and the acts attached to
`$ult['arquivo']`. Join `ato`, `tipo_ato`, `orgao`, and `boletim`; order by
`a.data_ato DESC, a.id ASC`; map every row to the `DashboardAct` JSON keys.
Build the series and attach it only inside `ultimoBoletim`:

```php
$porAno = [];
foreach ($pdo->query("SELECT ano, COUNT(*) AS total FROM ato
                       WHERE ano BETWEEN 2001 AND 2026 GROUP BY ano ORDER BY ano") as $r) {
    $porAno[(int)$r['ano']] = (int)$r['total'];
}
// $atosUltimos uses WHERE b.arquivo = :arquivo and has no LIMIT.
```

Return `'porAno' => $porAno` and `'atos' => $atosUltimos` in the
`ultimoBoletim` object. Preserve `null` for `ultimoBoletim` when no bulletin
exists and return an empty array in that case.

- [ ] **Step 2: Implement identical static aggregation**

In `getStats()`, while iterating `CACHE`, increment
`porAno[a.ano]` when `a.ano` is between 2001 and 2026. After calculating
`ultArq`, filter `CACHE` by `a.arquivo === ultArq`, sort by
`dataAssinatura` descending then `id` ascending, and map every entry to
`DashboardAct`. Do not slice the list.

- [ ] **Step 3: Verify fixture-independent source regressions**

Run: `node tools/test_redesign_integrity.mjs`

Expected: `Redesign structure is safe for TypeScript compilation.`

- [ ] **Step 4: Commit**

```powershell
git add backend/api/index_v2.php src/dataSource.ts tools/test_redesign_integrity.mjs
git commit -m "feat: expõe série anual e último boletim"
```

### Task 3: Renderizar a série completa e a lista do boletim

**Files:**
- Modify: `src/components/dashboard/Dashboard.tsx`
- Modify: `tools/test_redesign_integrity.mjs`

**Interfaces:**
- Consumes: `UffStatistics.porAno`, `recentActs: UffAct[]`, e metadados do último boletim fornecidos pelo `App`.
- Produces: dashboard com barras 2001–2026 e lista completa, acessível, do último boletim.

- [ ] **Step 1: Write failing UI-source assertions**

Add assertions requiring a nonempty explicit state and barring fake fallback
bars and the five-item truncation:

```js
assert.doesNotMatch(dashboard, /\[35, 48, 42, 58/, 'Annual chart must not use placeholder bars.');
assert.doesNotMatch(dashboard, /recentActs\.slice\(0, 5\)/, 'The latest bulletin list must not be truncated.');
assert.match(dashboard, /aria-label=\{`\$\{ano\}: \$\{count\} atos`\}/,
  'Each annual bar must expose its value.');
```

- [ ] **Step 2: Run the UI regression test to verify it fails**

Run: `node tools/test_redesign_integrity.mjs`

Expected: `AssertionError` identifying the placeholder bars or `.slice(0, 5)`.

- [ ] **Step 3: Render all real bars and all bulletin acts**

In `Dashboard.tsx`, derive `annualEntries` from `stats?.porAno`, sorted by
year, and `maxAnnualCount` once. Render each bar with `title` and
`aria-label`, and use an empty-state message when no entries exist. Render axis
labels for the first, every fifth, and last year. Remove the illustrative
fallback array.

Replace `recentActs.slice(0, 5)` with `recentActs.map`. Change the card title
to receive and display `Boletim de Serviço nº <numero>/<ano> · <n> atos`; when
metadata is absent, retain `Últimos atos publicados` and show the existing
empty-state message.

- [ ] **Step 4: Run the UI regression test to verify it passes**

Run: `node tools/test_redesign_integrity.mjs`

Expected: `Redesign structure is safe for TypeScript compilation.`

- [ ] **Step 5: Commit**

```powershell
git add src/components/dashboard/Dashboard.tsx tools/test_redesign_integrity.mjs
git commit -m "feat: mostra série anual e atos do último boletim"
```

### Task 4: Verificar e documentar a entrega

**Files:**
- Modify: `docs/IMPLEMENTACAO-REDESIGN.md`

**Interfaces:**
- Consumes: comportamento final das Tasks 1–3.
- Produces: instruções de validação e explicação do contrato de dados do dashboard.

- [ ] **Step 1: Document the behavior**

Add a section "Dashboard: série anual e último boletim" explaining that the
chart aggregates 2001–2026 from `ano`, the list groups by the latest bulletin
file, and both are returned by `/api/stats` or derived from the static cache.
State that every act in the latest bulletin is rendered and that API response
cache invalidation continues to happen through the existing importer flow.

- [ ] **Step 2: Run full verification**

Run:

```powershell
node tools/test_redesign_integrity.mjs
npm run lint
npm run build
git diff --check
git status --short
```

Expected: structural test, TypeScript check and production build succeed; no
whitespace errors and only the documented files are staged for commit.

- [ ] **Step 3: Commit documentation**

```powershell
git add docs/IMPLEMENTACAO-REDESIGN.md
git commit -m "docs: registra dados do dashboard"
```
