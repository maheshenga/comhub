# NewAPI Group Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NewAPI group-aware routing, plan access, pricing, and billing audit metadata without exposing group choices to end users.

**Architecture:** Treat each admin NewAPI instance as a routeable upstream channel with `groupKey`, then resolve requests by user plan, model type, model ID, group, and priority. Keep existing model IDs visible to users, but route and bill internally using `groupKey + modelId`.

**Tech Stack:** TypeScript, Next.js server routers, tRPC, Drizzle/Postgres migrations, Vitest, Ant Design admin UI.

---

## File Structure

- Modify `packages/database/src/schemas/newapiInstance.ts`: add NewAPI group fields to the instance schema and extend TypeScript metadata types.
- Create `packages/database/migrations/0114_add_newapi_group_routing.sql`: add group columns and indexes.
- Modify `src/server/services/newapiInstance/catalog.ts`: preserve upstream pricing and `enable_groups` metadata during sync.
- Modify `src/server/services/newapiInstance/index.ts`: add group-aware route resolver and return route metadata.
- Modify `src/server/modules/ModelRuntime/index.ts`: initialize NewAPI runtime using the selected route and carry route metadata into hooks.
- Modify `src/business/server/model-runtime.ts`: accept route metadata and pass it to billing.
- Modify `src/business/server/commercialBilling.ts`: accept route metadata in usage recording.
- Modify `packages/database/src/models/commercial.ts`: match pricing rules by provider, group, model and write route metadata into ledger entries.
- Modify `src/business/server/planModelRules.ts`: support `group:model`, `*:model`, `group:*`, and legacy `model`.
- Modify runtime call sites that currently omit model context: `src/server/modules/AgentRuntime/RuntimeExecutors.ts`, `src/server/routers/lambda/aiChat.ts`, `src/server/routers/lambda/chunk.ts`, `src/server/routers/async/file.ts`, `src/server/routers/async/ragEval.ts`, selected system-agent services.
- Modify `src/features/Admin/AdminNewapiProvidersPage.tsx`: add group fields to the instance form and table.
- Modify `src/features/Admin/adminModelBillingMatrix.ts` and `src/features/Admin/AdminModelBillingMatrixPage.tsx`: group rows by `groupKey + modelType + modelId`, save group-aware access and pricing rules.
- Modify `src/services/adminCommercial.ts` and `src/business/server/lambda-routers/admin/newapiProviders.ts`: expose group fields through admin APIs.

## Task 1: Pass Model Context To NewAPI Runtime

**Files:**

- Modify: `src/server/modules/AgentRuntime/RuntimeExecutors.ts`

- Modify: `src/server/routers/lambda/aiChat.ts`

- Modify: `src/server/routers/lambda/chunk.ts`

- Modify: `src/server/routers/async/file.ts`

- Modify: `src/server/routers/async/ragEval.ts`

- Test: `src/server/modules/AgentRuntime/__tests__/RuntimeExecutors.test.ts`

- Test: `src/server/routers/lambda/__tests__/aiChat.test.ts`

- [ ] **Step 1: Write failing tests for chat runtime model context**

Add an assertion in the existing runtime executor test that the chat LLM path calls:

```ts
expect(initModelRuntimeFromDB).toHaveBeenCalledWith(
  ctx.serverDB,
  ctx.userId,
  'newapi',
  { model: 'gpt-4o-mini', modelType: 'chat' },
);
```

Run:

```bash
pnpm exec vitest run src/server/modules/AgentRuntime/__tests__/RuntimeExecutors.test.ts
```

Expected: FAIL because the fourth argument is currently missing.

- [ ] **Step 2: Write failing tests for structured output model context**

In `src/server/routers/lambda/__tests__/aiChat.test.ts`, update the `outputJSON` case to expect:

```ts
expect(initModelRuntimeFromDB).toHaveBeenCalledWith({}, 'u1', 'openai', {
  model: input.model,
  modelType: 'chat',
});
```

Run:

```bash
pnpm exec vitest run src/server/routers/lambda/__tests__/aiChat.test.ts
```

Expected: FAIL because `outputJSON` currently omits model context.

- [ ] **Step 3: Implement minimal model context forwarding**

Update the runtime initialization calls:

```ts
await initModelRuntimeFromDB(ctx.serverDB, ctx.userId!, provider, {
  model,
  modelType: 'chat',
});
```

For `generateObject` chat paths use:

```ts
await initModelRuntimeFromDB(ctx.serverDB, ctx.userId, input.provider, {
  model: input.model,
  modelType: 'chat',
});
```

For embeddings use:

```ts
await initModelRuntimeFromDB(ctx.serverDB, ctx.userId, provider, {
  model,
  modelType: 'embedding',
});
```

- [ ] **Step 4: Verify tests pass**

Run:

```bash
pnpm exec vitest run src/server/modules/AgentRuntime/__tests__/RuntimeExecutors.test.ts src/server/routers/lambda/__tests__/aiChat.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/AgentRuntime/RuntimeExecutors.ts src/server/modules/AgentRuntime/__tests__/RuntimeExecutors.test.ts src/server/routers/lambda/aiChat.ts src/server/routers/lambda/__tests__/aiChat.test.ts src/server/routers/lambda/chunk.ts src/server/routers/async/file.ts src/server/routers/async/ragEval.ts
git commit -m "fix: pass model context to runtime routing"
```

## Task 2: Add NewAPI Group Fields

**Files:**

- Modify: `packages/database/src/schemas/newapiInstance.ts`

- Create: `packages/database/migrations/0114_add_newapi_group_routing.sql`

- Modify: `src/business/server/lambda-routers/admin/newapiProviders.ts`

- Modify: `src/services/adminCommercial.ts`

- Test: `src/business/server/lambda-routers/admin/newapiProviders.test.ts`

- [ ] **Step 1: Write failing admin router tests**

Add a test that creates an instance with:

```ts
{
  apiKey: 'sk-test',
  baseUrl: 'https://newapi.example.com',
  groupKey: 'pro',
  groupName: '高级分组',
  groupMultiplier: 1.25,
  name: 'NewAPI Pro',
  priority: 10,
  usageScope: ['chat', 'image'],
}
```

Assert returned/listed rows include the group fields while `apiKey` remains masked.

Run:

```bash
pnpm exec vitest run src/business/server/lambda-routers/admin/newapiProviders.test.ts
```

Expected: FAIL because the input schema rejects group fields.

- [ ] **Step 2: Add schema and migration**

Migration:

```sql
ALTER TABLE "admin_newapi_instances"
  ADD COLUMN IF NOT EXISTS "group_key" text NOT NULL DEFAULT 'default';
--> statement-breakpoint

ALTER TABLE "admin_newapi_instances"
  ADD COLUMN IF NOT EXISTS "group_name" text;
--> statement-breakpoint

ALTER TABLE "admin_newapi_instances"
  ADD COLUMN IF NOT EXISTS "group_multiplier" numeric;
--> statement-breakpoint

ALTER TABLE "admin_newapi_instances"
  ADD COLUMN IF NOT EXISTS "usage_scope" jsonb;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "admin_newapi_instances_group_enabled_priority_idx"
  ON "admin_newapi_instances" ("group_key", "enabled", "priority");
```

Schema fields:

```ts
groupKey: text('group_key').notNull().default('default'),
groupName: text('group_name'),
groupMultiplier: amountNumeric('group_multiplier'),
usageScope: jsonb('usage_scope').$type<NewapiModelType[]>(),
```

- [ ] **Step 3: Extend admin API schemas**

Accept and return `groupKey`, `groupName`, `groupMultiplier`, and `usageScope`.

- [ ] **Step 4: Verify tests pass**

Run:

```bash
pnpm exec vitest run src/business/server/lambda-routers/admin/newapiProviders.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/schemas/newapiInstance.ts packages/database/migrations/0114_add_newapi_group_routing.sql src/business/server/lambda-routers/admin/newapiProviders.ts src/business/server/lambda-routers/admin/newapiProviders.test.ts src/services/adminCommercial.ts
git commit -m "feat: add newapi group fields"
```

## Task 3: Preserve Upstream Group And Pricing Metadata

**Files:**

- Modify: `src/server/services/newapiInstance/catalog.ts`

- Test: `src/server/services/newapiInstance/catalog.test.ts`

- [ ] **Step 1: Write failing sync metadata test**

Add a `normalizeNewapiSyncRows` test with pricing:

```ts
{
  completion_ratio: 3,
  description: 'GPT 4o Pro',
  enable_groups: ['pro', 'vip'],
  model_name: 'gpt-4o',
  model_ratio: 15,
  quota_type: 0,
  supported_endpoint_types: ['chat_completions'],
}
```

Expect metadata:

```ts
expect(row.metadata).toMatchObject({
  completionRatio: 3,
  enableGroups: ['pro', 'vip'],
  modelRatio: 15,
  quotaType: 0,
});
```

Run:

```bash
pnpm exec vitest run src/server/services/newapiInstance/catalog.test.ts
```

Expected: FAIL because metadata currently omits these fields.

- [ ] **Step 2: Extend pricing type and metadata**

Add optional fields to `NewapiRemotePricing` and save them into metadata.

- [ ] **Step 3: Verify tests pass**

Run:

```bash
pnpm exec vitest run src/server/services/newapiInstance/catalog.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/server/services/newapiInstance/catalog.ts src/server/services/newapiInstance/catalog.test.ts
git commit -m "feat: preserve newapi group pricing metadata"
```

## Task 4: Implement Group-Aware Plan Rule Matching

**Files:**

- Modify: `src/business/server/planModelRules.ts`

- Test: `src/business/server/planModelRules.test.ts` or existing nearest test file

- [ ] **Step 1: Write failing tests for group-qualified allowlist**

Test cases:

```ts
expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'pro')).toBe(true);
expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'basic')).toBe(false);
expect(isModelAllowedByPlanRules(legacyRules, 'gpt-4o', 'chat', 'any')).toBe(true);
expect(isModelAllowedByPlanRules(groupWildcardRules, 'gpt-4o', 'chat', 'pro')).toBe(true);
expect(isModelAllowedByPlanRules(modelWildcardRules, 'gpt-4o', 'chat', 'basic')).toBe(true);
```

Run:

```bash
pnpm exec vitest run src/business/server/planModelRules.test.ts
```

Expected: FAIL because `isModelAllowedByPlanRules` has no group parameter.

- [ ] **Step 2: Implement group-aware matcher**

Update signatures:

```ts
isModelAllowedByPlanRules(rules, modelId, modelType, groupKey?)
assertPlanModelAllowed({ db, model, modelType, userId, groupKey? })
```

Match entries as:

```ts
const entryMatches = (entry: string, model: string, group?: string) => {
  const [left, right] = entry.includes(':') ? entry.split(':') : [undefined, entry];
  const groupMatches = !left || left === '*' || wildcardMatch(left, group ?? '');
  const modelMatches = wildcardMatch(right, model);
  return groupMatches && modelMatches;
};
```

- [ ] **Step 3: Verify tests pass**

Run:

```bash
pnpm exec vitest run src/business/server/planModelRules.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/business/server/planModelRules.ts src/business/server/planModelRules.test.ts
git commit -m "feat: support group-qualified plan model rules"
```

## Task 5: Resolve NewAPI Instances By Group And Plan

**Files:**

- Modify: `src/server/services/newapiInstance/index.ts`

- Test: `src/server/services/newapiInstance/index.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Create tests for:

- A free plan allows `basic:gpt-4o-mini` and denies `pro:gpt-4o-mini`.
- A premium plan allows `pro:gpt-4o`.
- Resolver returns same-group fallback candidates only.
- Resolver respects `usageScope`.

Run:

```bash
pnpm exec vitest run src/server/services/newapiInstance/index.test.ts
```

Expected: FAIL because resolver does not accept `userId` or group-aware filtering.

- [ ] **Step 2: Implement route metadata**

Extend `ResolvedNewapiInstance`:

```ts
{
  apiKey: string;
  baseUrl: string;
  groupKey: string;
  groupName?: string | null;
  groupMultiplier?: number | null;
  instanceId: string;
  instanceName: string;
  priority: number;
  source: 'instance';
}
```

Add resolver params:

```ts
{
  modelId?: string | null;
  modelType?: NewapiModelType;
  userId?: string;
  preferredGroupKey?: string;
}
```

Filter by plan rules when `userId` is present.

- [ ] **Step 3: Update default resolver**

Existing default behavior should return the first enabled instance using `groupKey = 'default'` when no model is available.

- [ ] **Step 4: Verify tests pass**

Run:

```bash
pnpm exec vitest run src/server/services/newapiInstance/index.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/newapiInstance/index.ts src/server/services/newapiInstance/index.test.ts
git commit -m "feat: resolve newapi routes by group and plan"
```

## Task 6: Add Group-Aware Pricing And Billing Metadata

**Files:**

- Modify: `packages/database/src/models/commercial.ts`

- Modify: `src/business/server/commercialBilling.ts`

- Modify: `src/business/server/model-runtime.ts`

- Modify: `src/server/modules/ModelRuntime/index.ts`

- Test: `packages/database/src/models/__tests__/commercial.test.ts`

- Test: `src/business/server/commercialBilling.test.ts`

- Test: `src/business/server/model-runtime.test.ts`

- [ ] **Step 1: Write failing pricing rule tests**

Add tests proving:

```ts
[
  { provider: 'newapi', group: 'pro', model: 'gpt-4o', multiplier: 2 },
  { provider: 'newapi', model: 'gpt-4o', multiplier: 1.2 },
]
```

selects multiplier `2` when `groupKey = 'pro'` and `1.2` when group is absent.

Run:

```bash
pnpm exec vitest run packages/database/src/models/__tests__/commercial.test.ts
```

Expected: FAIL because pricing has no group match.

- [ ] **Step 2: Write failing billing metadata tests**

Assert `recordCommercialChatUsage` passes route metadata to `consumeCreditsForAiUsage`, and ledger metadata includes:

```ts
{
  groupKey: 'pro',
  groupName: '高级分组',
  instanceId: 'instance-pro',
  instanceName: 'NewAPI Pro',
}
```

- [ ] **Step 3: Implement route metadata propagation**

Define:

```ts
export interface NewapiRouteMetadata {
  groupKey?: string;
  groupName?: string | null;
  instanceId?: string;
  instanceName?: string;
}
```

Pass it from `initModelRuntimeFromDB` into `getBusinessModelRuntimeHooks`, then into `recordCommercialAiUsage`.

- [ ] **Step 4: Fix NewAPI failover billing**

Current fallback runtime skips hooks to avoid double-charge. Preserve that behavior for pre-checks, but ensure the successful fallback's final usage can be charged once with fallback route metadata.

The minimal MVP approach:

- Keep `beforeChat` on the primary runtime only.

- On fallback success, attach `skipCommercialBilling: true` to fallback runtime calls.

- Let wrapper call `recordCommercialChatUsage` once after fallback final data is available if the runtime API exposes final usage.

- If final usage is not available from the wrapper, keep same behavior as today and record route metadata only for primary success. Add a test documenting the limitation.

- [ ] **Step 5: Verify tests pass**

Run:

```bash
pnpm exec vitest run src/business/server/model-runtime.test.ts src/business/server/commercialBilling.test.ts packages/database/src/models/__tests__/commercial.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/business/server/model-runtime.ts src/business/server/model-runtime.test.ts src/business/server/commercialBilling.ts src/business/server/commercialBilling.test.ts packages/database/src/models/commercial.ts packages/database/src/models/__tests__/commercial.test.ts src/server/modules/ModelRuntime/index.ts
git commit -m "feat: bill newapi usage with group metadata"
```

## Task 7: Update Admin NewAPI Instance UI

**Files:**

- Modify: `src/features/Admin/AdminNewapiProvidersPage.tsx`

- Modify: `src/services/adminCommercial.ts`

- Test: `src/features/Admin/AdminNewapiProvidersPage.test.tsx` if present, otherwise add focused helper tests around form payload construction.

- [ ] **Step 1: Write failing UI serialization test**

Test the instance form payload includes:

```ts
{
  groupKey: 'pro',
  groupName: '高级分组',
  groupMultiplier: 1.25,
  usageScope: ['chat', 'image'],
}
```

Expected: FAIL because the form does not expose these fields.

- [ ] **Step 2: Add fields to create/edit modal**

Add Ant Design fields:

- `Input` for group key.

- `Input` for group name.

- `InputNumber` for group multiplier.

- `Select mode="multiple"` for usage scope.

- [ ] **Step 3: Add table columns**

Show group key/name and usage scope in the instance table.

- [ ] **Step 4: Verify focused tests pass**

Run the relevant UI test command.

- [ ] **Step 5: Commit**

```bash
git add src/features/Admin/AdminNewapiProvidersPage.tsx src/services/adminCommercial.ts
git commit -m "feat: manage newapi groups in admin"
```

## Task 8: Update Model And Billing Matrix

**Files:**

- Modify: `src/features/Admin/adminModelBillingMatrix.ts`

- Modify: `src/features/Admin/AdminModelBillingMatrixPage.tsx`

- Modify: `src/features/Admin/adminModelBillingMatrix.test.ts`

- [ ] **Step 1: Write failing matrix grouping test**

Input two source models:

```ts
[
  { groupKey: 'basic', modelId: 'gpt-4o-mini', modelType: 'chat' },
  { groupKey: 'pro', modelId: 'gpt-4o-mini', modelType: 'chat' },
]
```

Expect two rows with different keys:

```ts
newapi:basic:chat:gpt-4o-mini
newapi:pro:chat:gpt-4o-mini
```

Expected: FAIL because current grouping ignores group.

- [ ] **Step 2: Write failing rule serialization test**

When only `pro / gpt-4o-mini` is enabled for a plan, expect:

```ts
{
  chat: {
    mode: 'allowlist',
    allowlist: ['pro:gpt-4o-mini'],
  },
}
```

- [ ] **Step 3: Implement group-aware matrix rows**

Add `groupKey` and `groupName` to `MatrixSourceModel` and `MatrixRow`. Group by:

```ts
const key = `newapi:${groupKey}:${model.modelType}:${model.modelId}`;
```

- [ ] **Step 4: Implement group-aware pricing rule serialization**

Output:

```ts
{
  provider: row.provider,
  group: row.groupKey,
  model: row.modelId,
  multiplier: row.pricingMultiplier,
  creditsPerDollar: row.creditsPerDollar,
}
```

- [ ] **Step 5: Verify tests pass**

Run:

```bash
pnpm exec vitest run src/features/Admin/adminModelBillingMatrix.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/Admin/adminModelBillingMatrix.ts src/features/Admin/adminModelBillingMatrix.test.ts src/features/Admin/AdminModelBillingMatrixPage.tsx
git commit -m "feat: make model billing matrix group-aware"
```

## Task 9: Full Verification And Build

**Files:**

- No new files unless test fixes require updates.

- [ ] **Step 1: Run targeted test suite**

```bash
pnpm exec vitest run src/server/services/newapiInstance/catalog.test.ts src/server/services/newapiInstance/index.test.ts src/business/server/planModelRules.test.ts src/business/server/model-runtime.test.ts src/business/server/commercialBilling.test.ts src/features/Admin/adminModelBillingMatrix.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run type check**

```bash
pnpm exec tsgo --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run lint**

```bash
pnpm exec eslint --max-warnings=0
```

Expected: PASS or report existing warnings separately if repository baseline prevents zero warnings.

- [ ] **Step 4: Build locally only**

Use the documented local Docker packaging flow. Do not build on the server.

- [ ] **Step 5: Commit final verification fixes**

If verification required small fixes:

```bash
git add <changed-files>
git commit -m "test: cover newapi group routing"
```

## Execution Notes

- Recommended execution workspace: isolated worktree because the current checkout has many unrelated historical changes.
- Do not deploy until all targeted tests and local build pass.
- Do not build on the server.
- Keep backward compatibility for existing instances, existing plan rules, and existing pricing rules.

## Self-Review

- Spec coverage: all design sections map to tasks 1-9.
- Placeholder scan: no deferred implementation placeholders are used as requirements.
- Type consistency: the plan uses `groupKey`, `groupName`, `groupMultiplier`, `usageScope`, and `NewapiRouteMetadata` consistently.
- Scope: this is one cohesive subsystem, but implementation should be committed in small steps.
