# Server Model Pricing Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-side model pricing snapshot helper that reports whether pricing came from admin/database metadata, static model-bank data, or is missing.

**Architecture:** Keep `getServerModelPricing` behavior compatible by delegating it to the new snapshot helper and returning only `snapshot.pricing`. The new helper exposes source metadata for later admin matrix, diagnostics, and billing audit work without changing charge calculations in this slice.

**Tech Stack:** TypeScript, Vitest, `model-bank` pricing types, existing `AiInfraRepos` model lookup.

## Global Constraints

- Work in `E:\code\comhub\ci-verify-3bbf64f`.
- Do not use subagents for this task; the user asked to execute directly.
- Do not change billing transaction math in this slice.
- Preserve `getServerModelPricing(params): Promise<Pricing | undefined>`.
- Use TDD: update tests and watch the new snapshot behavior fail before implementation.
- Keep docs in sync: update `docs/CHANGELOG_INTERNAL.md` and `docs/FEATURE_REGISTRY.md`.

---

### Task 1: Server Pricing Snapshot

**Files:**
- Modify: `packages/business-server/src/serverModelPricing.ts`
- Modify: `packages/business-server/src/serverModelPricing.test.ts`
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`

**Interfaces:**
- Consumes: existing `getServerModelCard(params)`.
- Produces: `getServerModelPricingSnapshot(params): Promise<ServerModelPricingSnapshot>`.
- Produces: `ServerModelPricingSnapshot.source` as `'database' | 'model-bank' | 'missing'`.

- [x] **Step 1: Write the failing test**

Update `packages/business-server/src/serverModelPricing.test.ts` to import `getServerModelPricingSnapshot`.

Add tests:

```ts
it('returns a database pricing snapshot when admin-managed pricing is available', async () => {
  const dbPricing = {
    approximatePricePerImage: 0.02,
    units: [],
  };
  const db = { id: 'request-db' } as any;
  mocks.getAiProviderModelList.mockResolvedValue([
    {
      id: 'gpt-image-2',
      pricing: dbPricing,
      type: 'image',
    },
  ]);

  const snapshot = await getServerModelPricingSnapshot({
    db,
    model: 'gpt-image-2',
    provider: 'newapi',
    type: 'image',
    userId: 'user-1',
  });

  expect(snapshot).toMatchObject({
    pricing: dbPricing,
    source: 'database',
  });
  expect(snapshot.modelCard?.id).toBe('gpt-image-2');
  expect(mocks.getModelPricing).not.toHaveBeenCalled();
});

it('returns a model-bank pricing snapshot when database pricing is unavailable', async () => {
  const staticPricing = {
    units: [{ name: 'imageGeneration', rate: 0.04, strategy: 'fixed', unit: 'image' }],
  };
  mocks.getAiProviderModelList.mockResolvedValue([{ id: 'gpt-image-2', type: 'image' }]);
  mocks.getModelPricing.mockResolvedValue(staticPricing);

  const snapshot = await getServerModelPricingSnapshot({
    db: {} as any,
    model: 'gpt-image-2',
    provider: 'newapi',
    type: 'image',
    userId: 'user-1',
  });

  expect(snapshot).toMatchObject({
    pricing: staticPricing,
    source: 'model-bank',
  });
  expect(snapshot.modelCard?.id).toBe('gpt-image-2');
});

it('returns a missing pricing snapshot when no pricing source is available', async () => {
  mocks.getAiProviderModelList.mockResolvedValue([{ id: 'gpt-image-2', type: 'image' }]);
  mocks.getModelPricing.mockResolvedValue(undefined);

  await expect(
    getServerModelPricingSnapshot({
      db: {} as any,
      model: 'gpt-image-2',
      provider: 'newapi',
      type: 'image',
      userId: 'user-1',
    }),
  ).resolves.toMatchObject({
    pricing: undefined,
    source: 'missing',
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/serverModelPricing.test.ts"
```

Expected: FAIL because `getServerModelPricingSnapshot` is not exported.

- [x] **Step 3: Write minimal implementation**

In `packages/business-server/src/serverModelPricing.ts`, add:

```ts
export type ServerModelPricingSource = 'database' | 'missing' | 'model-bank';

export interface ServerModelPricingSnapshot {
  modelCard?: AiProviderModelListItem;
  pricing?: Pricing;
  source: ServerModelPricingSource;
}
```

Then implement `getServerModelPricingSnapshot`:

```ts
export const getServerModelPricingSnapshot = async (params): Promise<ServerModelPricingSnapshot> => {
  const modelCard = await getServerModelCard(params);
  if (modelCard?.pricing) return { modelCard, pricing: modelCard.pricing, source: 'database' };

  const staticPricing = await getModelPricing(params.model, params.provider);
  if (staticPricing) return { modelCard, pricing: staticPricing, source: 'model-bank' };

  return { modelCard, source: 'missing' };
};
```

Update `getServerModelPricing` to delegate:

```ts
export const getServerModelPricing = async (params) =>
  (await getServerModelPricingSnapshot(params)).pricing;
```

- [x] **Step 4: Run test to verify it passes**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/serverModelPricing.test.ts"
```

Expected: PASS.

- [x] **Step 5: Update governance docs**

Append `GOV-034` to `docs/CHANGELOG_INTERNAL.md`.

Append a row to `docs/FEATURE_REGISTRY.md` under `Governance Execution Notes`:

```md
| 2026-07-07 | Server Model Pricing Snapshot | active | GOV-034 adds a server-side model pricing snapshot helper that records whether pricing comes from admin/database metadata, static model-bank data, or is missing while keeping existing billing pricing output unchanged. |
```

- [x] **Step 6: Verify changed files**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/serverModelPricing.test.ts"
cd ../..
git diff --check
bunx eslint "packages/business-server/src/serverModelPricing.ts" "packages/business-server/src/serverModelPricing.test.ts"
```

Expected: all commands exit 0.

- [x] **Step 7: Commit**

Run:

```powershell
git add -f docs/superpowers/plans/2026-07-07-p0-server-model-pricing-snapshot.md
git add packages/business-server/src/serverModelPricing.ts packages/business-server/src/serverModelPricing.test.ts docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md
git commit -m ":moneybag: add server model pricing snapshots" -m "Constraint: keep P0-04 scoped to pricing source snapshots; no billing transaction changes." -m "Tested: bunx vitest run --silent=passed-only packages/business-server/src/serverModelPricing.test.ts" -m "Tested: git diff --check" -m "Tested: bunx eslint packages/business-server/src/serverModelPricing.ts packages/business-server/src/serverModelPricing.test.ts"
```
