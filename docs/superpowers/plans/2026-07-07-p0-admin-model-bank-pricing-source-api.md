# Admin Model Bank Pricing Source API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark admin enabled model rows as `model-bank` when missing DB pricing but an exact, safe static model-bank provider/model pricing entry exists.

**Architecture:** Keep the change read-only and scoped to `getAllEnabledModels`. DB/admin metadata remains authoritative; static model-bank is a fallback only for safe provider type mappings and exact provider/model matches. Generic `newapi` and `openai-compatible` rows stay `missing` so compatible gateways are not mislabeled as official pricing.

**Tech Stack:** TypeScript, tRPC, Drizzle mock tests, Vitest.

## Global Constraints

- Do not change billing transactions, deduction math, model sync writes, or frontend grouping.
- Use TDD: add failing router tests before production code.
- Keep provider mapping conservative and easy to rollback.
- Update governance docs for GOV-037.
- Do not use subagents for this slice.

---

### Task 1: Add tests for safe static pricing source detection

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/newapiProviders.test.ts`

**Interfaces:**
- Consumes: `adminNewapiProvidersRouter.createCaller(...).getAllEnabledModels()`
- Produces: expected `pricingSource` values of `database`, `model-bank`, and `missing`

- [x] **Step 1: Mock model-bank static models**

Add a `vi.mock('model-bank', ...)` block that exports a small `LOBE_DEFAULT_MODEL_LIST` with exact provider/model pricing for `deepseek/deepseek-v4-pro` and a conflicting provider model for `openai-compatible` safety checks.

- [x] **Step 2: Write the failing test**

Extend the existing `returns pricing source metadata for enabled models` test with rows:

```ts
{
  metadata: {},
  modelId: 'deepseek-v4-pro',
  modelType: 'chat',
  providerType: 'deepseek',
}
{
  metadata: {},
  modelId: 'deepseek-v4-pro',
  modelType: 'chat',
  providerType: 'openai-compatible',
}
```

Expect `deepseek` to return `pricingSource: 'model-bank'` and `openai-compatible` to remain `pricingSource: 'missing'`.

- [x] **Step 3: Run test to verify it fails**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/newapiProviders.test.ts"
```

Expected: the new `deepseek-v4-pro` assertion fails because current code returns `missing`.

### Task 2: Implement exact model-bank fallback

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/newapiProviders.ts`
- Modify: `packages/business-server/package.json`

**Interfaces:**
- Consumes: `LOBE_DEFAULT_MODEL_LIST` from `model-bank`
- Produces: `resolveModelPricingSource(metadata, providerType, modelId)` returning `database`, `model-bank`, or `missing`

- [x] **Step 1: Add conservative provider mapping**

Create:

```ts
const MODEL_BANK_PROVIDER_BY_ADMIN_PROVIDER_TYPE: Record<string, string | undefined> = {
  claude: 'anthropic',
  deepseek: 'deepseek',
  openai: 'openai',
  siliconflow: 'siliconcloud',
};
```

Do not map `newapi`, `openai-compatible`, `opencode-go`, or `aliyun` in this slice.

- [x] **Step 2: Add exact static pricing helper**

Add a helper that finds a row where `item.providerId === mappedProvider`, `item.id === modelId`, and `item.pricing` exists.

- [x] **Step 3: Preserve DB priority**

Update `resolveModelPricingSource` to return `database` before consulting model-bank. Update the `getAllEnabledModels` map call to pass `providerType` and `modelId`.

- [x] **Step 4: Run test to verify green**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/newapiProviders.test.ts"
```

Expected: all tests in the file pass.

### Task 3: Update docs and verify

**Files:**
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/superpowers/plans/2026-07-07-p0-admin-model-bank-pricing-source-api.md`

**Interfaces:**
- Produces: GOV-037 execution note.

- [x] **Step 1: Add GOV-037 changelog entry**

Document that admin enabled model rows now surface exact static model-bank pricing source for safe provider mappings only.

- [x] **Step 2: Add feature registry execution note**

Append a row under `Governance Execution Notes` for GOV-037.

- [x] **Step 3: Verify formatting and lint**

Run:

```powershell
git diff --check
bunx eslint "packages/business-server/src/lambda-routers/admin/newapiProviders.ts" "packages/business-server/src/lambda-routers/admin/newapiProviders.test.ts"
```

- [x] **Step 4: Commit**

Commit with:

```text
:moneybag: detect admin model bank pricing sources
```
