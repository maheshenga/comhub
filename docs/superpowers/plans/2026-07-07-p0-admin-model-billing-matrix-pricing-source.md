# Admin Model Billing Matrix Pricing Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show where each admin model billing matrix row gets its pricing metadata from so administrators can separate manual overrides, database/admin pricing, model-bank pricing, and missing pricing.

**Architecture:** Keep this as a presentation and diagnostic slice in `src/features/Admin/adminModelBillingMatrix.ts` plus the matrix page. Add explicit source fields to matrix source models and derived rows, then update health counts and tags. Do not change billing transactions, pricing math, or provider sync.

**Tech Stack:** TypeScript, React 19, Next.js SPA, antd, Vitest.

## Global Constraints

- Use TDD: add failing tests before production changes.
- Keep changes small and reversible.
- Do not alter real deduction or ledger transaction code.
- Do not introduce new service calls.
- Continue documenting governance changes in `docs/FEATURE_REGISTRY.md` and `docs/CHANGELOG_INTERNAL.md`.

---

### Task 1: Add Matrix Pricing Source Semantics

**Files:**
- Modify: `src/features/Admin/adminModelBillingMatrix.test.ts`
- Modify: `src/features/Admin/adminModelBillingMatrix.ts`

**Interfaces:**
- Consumes: `MatrixSourceModel.hasModelPricing`, optional new `MatrixSourceModel.pricingSource`
- Produces: `MatrixRow.pricingSources`, `MatrixRow.effectivePricingSource`

- [x] **Step 1: Write failing tests**

Add tests that build rows from source models using `pricingSource: 'database'`, `pricingSource: 'model-bank'`, and `pricingSource: 'missing'`. Assert grouped rows preserve distinct `pricingSources`, and rows with a pricing override expose `effectivePricingSource: 'manual-override'`.

- [x] **Step 2: Run test to verify failure**

Run:

```powershell
bunx vitest run --silent='passed-only' "src/features/Admin/adminModelBillingMatrix.test.ts"
```

Expected: fail because `pricingSource`, `pricingSources`, and `effectivePricingSource` do not exist.

- [x] **Step 3: Implement minimal source derivation**

Add:

```ts
export type MatrixPricingSource = 'database' | 'manual-override' | 'missing' | 'model-bank';
```

Add optional `pricingSource?: Exclude<MatrixPricingSource, 'manual-override'>` to `MatrixSourceModel`. Add provider metadata `pricingSources` and `effectivePricingSource: MatrixPricingSource` to `MatrixRow`.

Derive missing source as:

```ts
model.pricingSource ?? (model.hasModelPricing ? 'database' : 'missing')
```

Use `manual-override` only when `pricingMultiplier` or `creditsPerDollar` is finite.

- [x] **Step 4: Run test to verify pass**

Run:

```powershell
bunx vitest run --silent='passed-only' "src/features/Admin/adminModelBillingMatrix.test.ts"
```

Expected: pass.

### Task 2: Reflect Pricing Sources In Health Diagnostics

**Files:**
- Modify: `src/features/Admin/adminModelBillingMatrix.test.ts`
- Modify: `src/features/Admin/adminModelBillingMatrix.ts`

**Interfaces:**
- Consumes: `MatrixRow.effectivePricingSource`
- Produces: source-specific summary counts and focus behavior

- [x] **Step 1: Write failing tests**

Extend health tests to assert:

```ts
databasePricingModelCount
modelBankPricingModelCount
missingPricingModelCount
pricingOverrideCount
providerPricingModelCount
```

Also assert `pricing-fallbacks` focuses rows whose effective source is `database` or `model-bank`, not manual override or missing pricing.

- [x] **Step 2: Run test to verify failure**

Run:

```powershell
bunx vitest run --silent='passed-only' "src/features/Admin/adminModelBillingMatrix.test.ts"
```

Expected: fail because the new summary fields and focus behavior are not implemented.

- [x] **Step 3: Implement minimal health updates**

Count rows by `effectivePricingSource`. Preserve existing `providerPricingModelCount` as all non-missing metadata rows, independent of whether a manual override is the effective source:

```ts
const providerPricingRows = rows.filter((row) =>
  row.pricingSources.some((source) => source !== 'missing'),
);
```

Keep `pricing-fallbacks` as info severity and make missing pricing warning only for `effectivePricingSource === 'missing'`.

- [x] **Step 4: Run test to verify pass**

Run:

```powershell
bunx vitest run --silent='passed-only' "src/features/Admin/adminModelBillingMatrix.test.ts"
```

Expected: pass.

### Task 3: Show Pricing Source In Admin Matrix UI

**Files:**
- Modify: `src/features/Admin/AdminModelBillingMatrixPage.tsx`
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`

**Interfaces:**
- Consumes: `EnabledModelItem.pricingSource`, `MatrixRow.effectivePricingSource`
- Produces: visible source tag in the model column and source-specific health summary tags

- [x] **Step 1: Map API source field**

Add optional `pricingSource?: 'database' | 'missing' | 'model-bank' | null` to `EnabledModelItem` and pass it into `MatrixSourceModel`.

- [x] **Step 2: Add source tag helper**

Create a local mapping:

```ts
const PRICING_SOURCE_STATUS = {
  database: { color: 'green', label: 'DB pricing' },
  'manual-override': { color: 'gold', label: 'Manual pricing' },
  missing: { color: 'red', label: 'Missing pricing' },
  'model-bank': { color: 'blue', label: 'Model Bank' },
} as const;
```

Render the tag next to model metadata.

- [x] **Step 3: Update docs**

Add `GOV-035` to `docs/CHANGELOG_INTERNAL.md` and append a governance execution note to `docs/FEATURE_REGISTRY.md`.

- [x] **Step 4: Verify**

Run:

```powershell
bunx vitest run --silent='passed-only' "src/features/Admin/adminModelBillingMatrix.test.ts"
git diff --check
bunx eslint "src/features/Admin/adminModelBillingMatrix.ts" "src/features/Admin/adminModelBillingMatrix.test.ts" "src/features/Admin/AdminModelBillingMatrixPage.tsx"
```

Expected: all commands pass.

### Rollback

Revert this commit. It only changes matrix diagnostics, UI tags, and docs. No database migration or billing transaction code is touched.
