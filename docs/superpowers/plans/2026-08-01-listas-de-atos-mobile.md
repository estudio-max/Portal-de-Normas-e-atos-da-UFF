# Listas de atos no mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir registros como cartões abaixo de 768 px, mantendo tabelas no desktop.

**Architecture:** Cada painel renderiza a mesma coleção como tabela `hidden md:block` e cartões `md:hidden`. Um componente compartilhado trata atos genéricos; cartões locais preservam campos específicos.

**Tech Stack:** React, TypeScript, Tailwind CSS, Node assert.

## Global Constraints

- Mobile não usa rolagem horizontal em listas interativas.
- Tabelas de impressão, filtros, paginação, rotas e ações existentes permanecem inalterados.
- Não adicionar dependências.

---

### Task 1: Cartão compartilhado e consulta geral

**Files:** Create `src/components/acts/ActListCard.tsx`; modify `src/components/ActTable.tsx` and `tools/test_redesign_integrity.mjs`.

- [x] **Step 1: Write failing tests**

```js
assert.match(await read('src/components/acts/ActListCard.tsx'), /md:hidden/);
assert.match(await read('src/components/ActTable.tsx'), /<ActListCard/);
```

- [x] **Step 2: Verify RED** — run `node tools/test_redesign_integrity.mjs`; expect missing-file or assertion failure.

- [x] **Step 3: Implement** — create `ActListCard({ act, onOpen, statusClass, relationClass })` with type/number, status, data, emissor, ementa, processo, relações and “Ver ficha”. In `ActTable`, render `resp.atos` as `md:hidden` cards, wrap the table in `hidden md:block`, and stack filters with `flex-col sm:flex-row`.

- [x] **Step 4: Verify GREEN** — run `node tools/test_redesign_integrity.mjs; npm run lint`; expect exit 0.

- [x] **Step 5: Commit** — `git add src/components/acts/ActListCard.tsx src/components/ActTable.tsx tools/test_redesign_integrity.mjs` then `git commit -m "feat: adapta consulta de atos ao mobile"`.

### Task 2: Planilha e painéis de registros

**Files:** Modify `ActSpreadsheet.tsx`, `ChefiasApi.tsx`, `MandatosApi.tsx`, `PrazosApi.tsx`, `JornadaApi.tsx`, `ComissoesApi.tsx`, `CooperacaoApi.tsx`, `DossieApi.tsx`, and `tools/test_redesign_integrity.mjs` under `src/components/panels`.

- [x] **Step 1: Write failing tests**

```js
for (const file of ['ActSpreadsheet.tsx', 'ChefiasApi.tsx', 'MandatosApi.tsx', 'PrazosApi.tsx', 'JornadaApi.tsx', 'ComissoesApi.tsx', 'CooperacaoApi.tsx', 'DossieApi.tsx']) {
  assert.match(await read(`src/components/panels/${file}`), /md:hidden/);
}
```

- [x] **Step 2: Verify RED** — run `node tools/test_redesign_integrity.mjs`; expect the first panel to fail.

- [x] **Step 3: Implement** — render `md:hidden space-y-2` cards before each interactive table, then apply `hidden md:block` to the table. Use headings: ato for planilha/Dossiê/Prazos; unidade/cargo for Chefias/Mandatos; setor for Jornada; comissão for Comissões; instituição/país for Cooperação. Preserve existing links, chips and callbacks; do not modify `window.print()` templates.

- [x] **Step 4: Verify GREEN** — run `node tools/test_redesign_integrity.mjs; npm run lint; npm run build`; expect exit 0.

- [x] **Step 5: Commit** — `git add src/components/panels tools/test_redesign_integrity.mjs` then `git commit -m "feat: adapta painéis de registros ao mobile"`.

### Task 3: Documentation and final verification

**Files:** Modify `docs/IMPLEMENTACAO-REDESIGN.md`.

- [x] **Step 1: Document** — add the 768 px breakpoint, the covered panels, preserved print tables, and a 320 px manual check.
- [x] **Step 2: Verify** — run `node tools/test_redesign_integrity.mjs; npm run lint; npm run build; git diff --check`; expect exit 0.
- [x] **Step 3: Commit** — `git add docs/IMPLEMENTACAO-REDESIGN.md docs/superpowers/plans/2026-08-01-listas-de-atos-mobile.md` then `git commit -m "docs: registra listas responsivas"`.
