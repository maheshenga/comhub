# Admin Enabled Model Pricing Source API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin enabled-model API return a `pricingSource` field so the billing matrix UI can display the source metadata added in GOV-035.

**Architecture:** Add a pure metadata resolver in `packages/business-server/src/lambda-routers/admin/newapiProviders.ts` and include its result in `getAllEnabledModels`. Keep the resolver conservative: current DB metadata maps to `database`; missing pricing maps to `missing`. Do not infer `model-bank` from model names in this slice.

**Tech Stack:** TypeScript, tRPC, Drizzle query builder, Vitest.

## Global Constraints

- Use TDD: add a failing router test before production changes.
- No database migration.
- No billing transaction changes.
- No provider sync behavior changes.
- Document as GOV-036.

---

### Task 1: Add Pricing Source To Enabled Model API

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/newapiProviders.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/newapiProviders.ts`
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`

**Interfaces:**
- Consumes: existing model metadata from `admin_newapi_instance_models.metadata`
- Produces: `pricingSource: 'database' | 'missing'` on `getAllEnabledModels` items

- [x] **Step 1: Write failing test**

Add a test for `caller.getAllEnabledModels()` with two selected rows:

```ts
metadata: { modelRatio: 1, pricingAvailable: true }
metadata: {}
```

Assert returned items include:

```ts
pricingSource: 'database'
pricingSource: 'missing'
```

- [x] **Step 2: Run test to verify failure**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/newapiProviders.test.ts"
```

Expected: fail because `pricingSource` is not returned.

- [x] **Step 3: Implement resolver**

Add:

```ts
const resolveModelPricingSource = (
  metadata: Record<string, unknown> | null | undefined,
) => (resolveModelPricingCompleteness(metadata) ? 'database' : 'missing') as const;
```

Use it in `getAllEnabledModels` output.

- [x] **Step 4: Update docs**

Add GOV-036 entries to changelog and feature registry.

- [x] **Step 5: Verify**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/newapiProviders.test.ts"
cd ../..
git diff --check
bunx eslint "packages/business-server/src/lambda-routers/admin/newapiProviders.ts" "packages/business-server/src/lambda-routers/admin/newapiProviders.test.ts"
```

Expected: all commands pass.

### Rollback

Revert this commit. It only adds a read-only response field and docs.
