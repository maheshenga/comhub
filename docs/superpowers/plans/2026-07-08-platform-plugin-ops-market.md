# Platform Plugin Ops Market Implementation Plan


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the P2-lite platform plugin operations loop: admins promote, order, explain, and measure platform plugins; users discover, filter, understand plan availability, run plugins, and review recent usage.

**Architecture:** Keep the existing P1 `platformPlugin` domain. Store operations metadata in `platform_plugins.metadata.operations` and mirror `sortWeight` to the existing `platform_plugins.sort_order` column, so this phase needs no migration. Server routers and models remain authoritative for visibility, install, and run authorization; frontend labels are presentation only.

**Tech Stack:** Next.js 16 SPA, React 19, TypeScript, TRPC lambda routers, SWR, Drizzle/PostgreSQL, Vitest, antd, `@lobehub/ui`.

## Global Constraints

- Do not import MCP entries or Skills into the platform plugin marketplace.
- Do not add desktop plugin integration, desktop update prompts, or desktop-only execution.
- Do not add runtime types beyond `api_action` and `content_generation`.
- Do not add workflows, async job queues, reviews, payment/refund/invoice logic, or deep quota rules.
- Do not change the fixed fee and multiplier billing formula; only expose clearer estimates and metrics.
- Do not create a database migration in this phase.
- User APIs must not return raw secrets, decrypted headers, full request bodies, `inputSnapshot`, or raw runtime config.
- Featured and sort weight must not override plan visibility.
- Existing MCP, Skills, legacy plugin routers, and chat ActionTag code must remain unchanged.
- Database integration tests may be marked blocked when `DATABASE_TEST_URL` is absent.

---

## File Structure

- `packages/types/src/platformPlugin.ts`: shared schemas and types for operations metadata, filters, stats, and user run history.
- `packages/types/src/platformPlugin.test.ts`: contract tests.
- `packages/database/src/models/platformPluginOperations.ts`: pure metadata/stat helpers.
- `packages/database/src/models/platformPlugin.ts`: persistence, marketplace filters, stats, run history.
- `packages/business-server/src/lambda-routers/admin/platformPlugins.ts`: admin operations mutation plus list/detail payloads.
- `packages/business-server/src/lambda-routers/admin/platformPlugins.test.ts`: admin router tests.
- `apps/server/src/routers/lambda/platformPlugin.ts`: user filters and run history endpoint.
- `apps/server/src/routers/lambda/platformPlugin.test.ts`: user router tests.
- `src/services/adminCommercial.ts`: admin client wrapper.
- `src/services/platformPlugin.ts`: user client wrapper.
- `src/services/platformPlugin.test.ts`: service wrapper tests.
- `src/features/Admin/platformPlugins/formSchema.ts`: admin operations normalization.
- `src/features/Admin/platformPlugins/formSchema.test.ts`: form schema tests.
- `src/features/Admin/platformPlugins/OperationsEditor.tsx`: focused admin operations section.
- `src/features/Admin/platformPlugins/types.ts`: admin operations and stats types.
- `src/features/Admin/platformPlugins/PluginEditorModal.tsx`: insert operations section before billing.
- `src/features/Admin/AdminPlatformPluginsPage.tsx`: admin table/detail operations and stats fields.
- `src/features/PlatformPluginMarket/helpers.ts`: filtering, sorting, plan labels, billing estimate helpers.
- `src/features/PlatformPluginMarket/helpers.test.ts`: user helper tests.
- `src/features/PlatformPluginMarket/index.tsx`: search/category/runtime filter UI and query key wiring.
- `src/features/PlatformPluginMarket/PluginCard.tsx`: featured, promo, plan state card presentation.
- `src/features/PlatformPluginMarket/PluginDetail.tsx`: operations copy, estimates, run history.
- `src/features/PlatformPluginMarket/PluginRunHistory.tsx`: current-user recent run list.
- `docs/FEATURE_REGISTRY.md`: platform plugin feature registry update.
- `docs/CHANGELOG_INTERNAL.md`: internal changelog update.

---

### Task 1: Shared Operations Contract

**Files:**
- Modify: `packages/types/src/platformPlugin.ts`
- Modify: `packages/types/src/platformPlugin.test.ts`

**Interfaces:**
- Consumes: existing `platformPluginAdminUpsertSchema`, `PlatformPluginListItem`, `PlatformPluginDetail`, `PlatformPluginRunStatus`.
- Produces: `DEFAULT_PLATFORM_PLUGIN_OPERATIONS_METADATA`, `platformPluginOperationsMetadataSchema`, `PlatformPluginOperationsMetadata`, `PlatformPluginAdminStats`, `platformPluginMarketplaceListInputSchema`, `PlatformPluginMarketplaceListInput`, `platformPluginRunHistoryInputSchema`, `PlatformPluginRunHistoryInput`, `PlatformPluginRunHistoryItem`.

- [ ] **Step 1: Write the failing contract tests**

Add tests in `packages/types/src/platformPlugin.test.ts`:

```typescript
it('defaults and trims operations metadata', () => {
  expect(platformPluginOperationsMetadataSchema.parse(undefined)).toEqual({
    featured: false,
    sortWeight: 0,
  });
  expect(
    platformPluginOperationsMetadataSchema.parse({
      featured: true,
      planBenefitSummary: ' Pro benefit ',
      promoLabel: ' Hot ',
      sortWeight: '12',
      upgradeCta: ' Upgrade ',
      useCase: '',
    }),
  ).toEqual({
    featured: true,
    planBenefitSummary: 'Pro benefit',
    promoLabel: 'Hot',
    sortWeight: 12,
    upgradeCta: 'Upgrade',
  });
});

it('accepts operations in admin upsert payloads', () => {
  const input = platformPluginAdminUpsertSchema.parse({
    billing: {},
    category: 'research',
    description: 'Generate research notes.',
    displayName: 'Research Notes',
    icon: 'FileText',
    operations: { featured: true, promoLabel: 'New', sortWeight: 20 },
    runtimeType: 'content_generation',
    slug: 'research-notes',
    status: 'published',
    tags: ['research'],
  });
  expect(input.operations).toEqual({ featured: true, promoLabel: 'New', sortWeight: 20 });
});

it('validates marketplace filters and run history pagination', () => {
  expect(platformPluginMarketplaceListInputSchema.parse({ query: ' notes ' })).toEqual({ query: 'notes' });
  expect(
    platformPluginRunHistoryInputSchema.parse({
      pluginId: '00000000-0000-4000-8000-000000000001',
    }),
  ).toEqual({ cursor: 0, limit: 20, pluginId: '00000000-0000-4000-8000-000000000001' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' packages/types/src/platformPlugin.test.ts`

Expected: FAIL with missing exports for operations/filter/history schemas.

- [ ] **Step 3: Add minimal shared contract implementation**

In `packages/types/src/platformPlugin.ts`, add the helper and schemas near the existing billing schema:

```typescript
const optionalTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    return text ? text : undefined;
  }, z.string().max(max).optional());

export const DEFAULT_PLATFORM_PLUGIN_OPERATIONS_METADATA = { featured: false, sortWeight: 0 } as const;

export const platformPluginOperationsMetadataSchema = z
  .object({
    featured: z.boolean().default(false),
    planBenefitSummary: optionalTrimmedString(300),
    promoLabel: optionalTrimmedString(80),
    sortWeight: z.coerce.number().int().min(-100_000).max(100_000).default(0),
    upgradeCta: optionalTrimmedString(160),
    useCase: optionalTrimmedString(500),
  })
  .default(DEFAULT_PLATFORM_PLUGIN_OPERATIONS_METADATA);
export type PlatformPluginOperationsMetadata = z.infer<typeof platformPluginOperationsMetadataSchema>;

export type PlatformPluginAdminStats = {
  failedRuns: number;
  fixedServiceFeeCredits: number;
  installations: number;
  runs: number;
  successRate: number;
  succeededRuns: number;
  totalChargedCredits: number;
};
```

Add `operations: platformPluginOperationsMetadataSchema` to `platformPluginAdminUpsertSchema`, and add `operations: PlatformPluginOperationsMetadata` to `PlatformPluginListItem`.

Add:

```typescript
export const platformPluginMarketplaceListInputSchema = z.object({
  category: optionalTrimmedString(80),
  query: optionalTrimmedString(120),
  runtimeType: platformPluginRuntimeTypeSchema.optional(),
}).optional().default({});
export type PlatformPluginMarketplaceListInput = z.infer<typeof platformPluginMarketplaceListInputSchema>;

export const platformPluginRunHistoryInputSchema = z.object({
  cursor: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(50).default(20),
  pluginId: z.string().uuid(),
});
export type PlatformPluginRunHistoryInput = z.infer<typeof platformPluginRunHistoryInputSchema>;

export type PlatformPluginRunHistoryItem = {
  artifactIds: string[];
  chargedCredits: number;
  createdAt: string;
  fixedServiceFeeCharged: boolean;
  pluginId: string;
  pluginName: string;
  preview?: string;
  runId: string;
  status: PlatformPluginRunStatus;
};
```

- [ ] **Step 4: Run tests and commit**

Run: `bunx vitest run --silent='passed-only' packages/types/src/platformPlugin.test.ts`

Expected: PASS.

Commit:

```powershell
git add packages/types/src/platformPlugin.ts packages/types/src/platformPlugin.test.ts
git commit -m "Add platform plugin operations contract" -m "Constraint: shared types only" -m "Tested: bunx vitest run --silent='passed-only' packages/types/src/platformPlugin.test.ts"
```


---

### Task 2: Backend Operations Persistence And Admin Stats

**Files:**
- Create: `packages/database/src/models/platformPluginOperations.ts`
- Create: `packages/database/src/models/platformPluginOperations.test.ts`
- Modify: `packages/database/src/models/platformPlugin.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/platformPlugins.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/platformPlugins.test.ts`

**Interfaces:**
- Consumes: Task 1 `PlatformPluginOperationsMetadata`, `PlatformPluginAdminStats`, and `platformPluginOperationsMetadataSchema`.
- Produces: `readPlatformPluginOperationsMetadata(metadata, sortOrder)`, `writePlatformPluginOperationsMetadata(metadata, operations)`, `summarizePlatformPluginAdminStats(input)`, `PlatformPluginModel.updateOperationsForAdmin`, `PlatformPluginModel.getAdminStats`, and `admin.platformPlugins.updateOperations`.

- [ ] **Step 1: Write failing pure helper tests**

Create `packages/database/src/models/platformPluginOperations.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import {
  readPlatformPluginOperationsMetadata,
  summarizePlatformPluginAdminStats,
  writePlatformPluginOperationsMetadata,
} from './platformPluginOperations';

describe('platformPluginOperations model helpers', () => {
  it('reads operations metadata and falls back to sortOrder', () => {
    expect(readPlatformPluginOperationsMetadata({}, 7)).toEqual({ featured: false, sortWeight: 7 });
    expect(
      readPlatformPluginOperationsMetadata(
        { operations: { featured: true, promoLabel: 'Hot', sortWeight: 12 } },
        7,
      ),
    ).toEqual({ featured: true, promoLabel: 'Hot', sortWeight: 12 });
  });

  it('writes operations metadata without dropping unrelated metadata', () => {
    expect(
      writePlatformPluginOperationsMetadata(
        { importedBy: 'seed' },
        { featured: true, planBenefitSummary: 'Pro benefit', sortWeight: 5 },
      ),
    ).toEqual({
      importedBy: 'seed',
      operations: { featured: true, planBenefitSummary: 'Pro benefit', sortWeight: 5 },
    });
  });

  it('summarizes admin stats from installation count and run snapshots', () => {
    expect(
      summarizePlatformPluginAdminStats({
        billing: { defaultMultiplier: 1.35, externalApiCostCredits: 20, fixedServiceFeeCredits: 10 },
        installationCount: 2,
        runs: [
          { billingSnapshot: { chargedCredits: 32 }, status: 'succeeded' },
          { billingSnapshot: { chargedCredits: 0 }, status: 'failed' },
          { billingSnapshot: { chargedCredits: 10 }, status: 'denied' },
        ],
      }),
    ).toEqual({
      failedRuns: 2,
      fixedServiceFeeCredits: 10,
      installations: 2,
      runs: 3,
      successRate: 33.3,
      succeededRuns: 1,
      totalChargedCredits: 42,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/platformPluginOperations.test.ts`

Expected: FAIL because `platformPluginOperations.ts` does not exist.

- [ ] **Step 3: Implement pure operations helper**

Create `packages/database/src/models/platformPluginOperations.ts`:

```typescript
import type {
  PlatformPluginAdminStats,
  PlatformPluginBillingConfig,
  PlatformPluginOperationsMetadata,
  PlatformPluginRunStatus,
} from '@lobechat/types';
import { platformPluginOperationsMetadataSchema } from '@lobechat/types';

type MetadataRecord = Record<string, unknown> | null | undefined;
type RunStatsRow = { billingSnapshot?: Record<string, unknown> | null; status: PlatformPluginRunStatus };

const toRecord = (value: MetadataRecord): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const toCredits = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
};

export const readPlatformPluginOperationsMetadata = (
  metadata: MetadataRecord,
  sortOrder = 0,
): PlatformPluginOperationsMetadata => {
  const record = toRecord(metadata);
  const rawOperations = toRecord(record.operations as MetadataRecord);
  const parsed = platformPluginOperationsMetadataSchema.parse(rawOperations);

  return {
    ...parsed,
    sortWeight: rawOperations.sortWeight === undefined ? sortOrder : parsed.sortWeight,
  };
};

export const writePlatformPluginOperationsMetadata = (
  metadata: MetadataRecord,
  operations: PlatformPluginOperationsMetadata,
): Record<string, unknown> => ({
  ...toRecord(metadata),
  operations: platformPluginOperationsMetadataSchema.parse(operations),
});

export const summarizePlatformPluginAdminStats = (input: {
  billing: PlatformPluginBillingConfig;
  installationCount: number;
  runs: RunStatsRow[];
}): PlatformPluginAdminStats => {
  const succeededRuns = input.runs.filter((run) => run.status === 'succeeded').length;
  const failedRuns = input.runs.length - succeededRuns;
  const totalChargedCredits = input.runs.reduce(
    (sum, run) => sum + toCredits(run.billingSnapshot?.chargedCredits),
    0,
  );

  return {
    failedRuns,
    fixedServiceFeeCredits: toCredits(input.billing.fixedServiceFeeCredits),
    installations: input.installationCount,
    runs: input.runs.length,
    successRate: input.runs.length === 0 ? 0 : Number(((succeededRuns / input.runs.length) * 100).toFixed(1)),
    succeededRuns,
    totalChargedCredits,
  };
};
```

- [ ] **Step 4: Run helper tests**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/platformPluginOperations.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing admin router tests**

In `packages/business-server/src/lambda-routers/admin/platformPlugins.test.ts`, extend `platformPluginModelMocks`:

```typescript
const platformPluginModelMocks = vi.hoisted(() => ({
  getAdminStats: vi.fn(),
  setPlanEntitlements: vi.fn(),
  updateOperationsForAdmin: vi.fn(),
  upsertPluginForAdmin: vi.fn(),
}));
```

In `beforeEach`, add:

```typescript
platformPluginModelMocks.getAdminStats.mockResolvedValue(
  new Map([
    [pluginId, {
      failedRuns: 1,
      fixedServiceFeeCredits: 10,
      installations: 2,
      runs: 3,
      successRate: 66.7,
      succeededRuns: 2,
      totalChargedCredits: 120,
    }],
  ]),
);
platformPluginModelMocks.updateOperationsForAdmin.mockResolvedValue(undefined);
```

Add tests:

```typescript
it('returns operations metadata and stats in the admin list', async () => {
  const { caller } = createAdminCaller({ role: 'admin' });
  const result = await caller.platformPlugins.list();

  expect(result.items[0]).toMatchObject({
    operations: { featured: false, sortWeight: 0 },
    stats: { installations: 2, runs: 3, successRate: 66.7, totalChargedCredits: 120 },
  });
});

it('updates operations metadata with content write capability', async () => {
  const { caller } = createAdminCaller({ role: 'content_admin' });

  await expect(
    caller.platformPlugins.updateOperations({
      operations: { featured: true, promoLabel: 'Hot', sortWeight: 20, upgradeCta: 'Upgrade to Pro' },
      pluginId,
    }),
  ).resolves.toEqual({ ok: true });

  expect(platformPluginModelMocks.updateOperationsForAdmin).toHaveBeenCalledWith({
    operations: { featured: true, promoLabel: 'Hot', sortWeight: 20, upgradeCta: 'Upgrade to Pro' },
    pluginId,
  });
  expect(writePlatformPluginAuditLog).toHaveBeenCalledWith(
    expect.objectContaining({ eventType: 'platform_plugin.operations_updated', resourceId: pluginId }),
  );
});
```

- [ ] **Step 6: Run admin router tests to verify failure**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/platformPlugins.test.ts`

Expected: FAIL because `updateOperations` and stats payloads are missing.

- [ ] **Step 7: Update model persistence and stats**

In `packages/database/src/models/platformPlugin.ts`, import `PlatformPluginAdminStats`, `PlatformPluginMarketplaceListInput`, `PlatformPluginOperationsMetadata`, `PlatformPluginRunHistoryItem`, `platformPluginArtifacts`, `platformPluginRuns`, and helpers from `./platformPluginOperations`.

Update `toListItem` so every `PlatformPluginListItem` includes:

```typescript
operations: readPlatformPluginOperationsMetadata(plugin.metadata, plugin.sortOrder),
```

Inside `upsertPluginForAdmin`, set operations into metadata and sort order:

```typescript
const operations = input.operations;
const pluginValues = {
  billing: input.billing,
  category: input.category,
  description: input.description,
  displayName: input.displayName,
  icon: input.icon,
  metadata: writePlatformPluginOperationsMetadata(existing?.metadata, operations),
  runtimeType: input.runtimeType,
  slug: input.slug,
  sortOrder: operations.sortWeight,
  status: input.status,
  tags: input.tags,
};
```

Add model methods:

```typescript
updateOperationsForAdmin = async (params: {
  operations: PlatformPluginOperationsMetadata;
  pluginId: string;
}): Promise<void> => {
  const plugin = await this.db.query.platformPlugins.findFirst({ where: eq(platformPlugins.id, params.pluginId) });
  if (!plugin) throw new Error('PLATFORM_PLUGIN_NOT_FOUND');

  await this.db
    .update(platformPlugins)
    .set({
      metadata: writePlatformPluginOperationsMetadata(plugin.metadata, params.operations),
      sortOrder: params.operations.sortWeight,
      updatedAt: new Date(),
    })
    .where(eq(platformPlugins.id, params.pluginId));
};

getAdminStats = async (pluginIds: string[]): Promise<Map<string, PlatformPluginAdminStats>> => {
  if (pluginIds.length === 0) return new Map();

  const [plugins, installations, runs] = await Promise.all([
    this.db.query.platformPlugins.findMany({ where: inArray(platformPlugins.id, pluginIds) }),
    this.db.query.platformPluginInstallations.findMany({
      where: and(
        inArray(platformPluginInstallations.pluginId, pluginIds),
        eq(platformPluginInstallations.status, INSTALL_STATUS_ACTIVE),
        isNull(platformPluginInstallations.uninstalledAt),
      ),
    }),
    this.db.query.platformPluginRuns.findMany({ where: inArray(platformPluginRuns.pluginId, pluginIds) }),
  ]);

  return new Map(
    plugins.map((plugin) => [
      plugin.id,
      summarizePlatformPluginAdminStats({
        billing: plugin.billing,
        installationCount: installations.filter((item) => item.pluginId === plugin.id).length,
        runs: runs
          .filter((run) => run.pluginId === plugin.id)
          .map((run) => ({ billingSnapshot: run.billingSnapshot, status: run.status })),
      }),
    ]),
  );
};
```

- [ ] **Step 8: Update admin router**

In `packages/business-server/src/lambda-routers/admin/platformPlugins.ts`, import `platformPluginOperationsMetadataSchema` and `readPlatformPluginOperationsMetadata`. Add:

```typescript
const OperationsInputSchema = z.object({
  operations: platformPluginOperationsMetadataSchema,
  pluginId: z.string().uuid(),
});

const EMPTY_PLUGIN_STATS = {
  failedRuns: 0,
  fixedServiceFeeCredits: 0,
  installations: 0,
  runs: 0,
  successRate: 0,
  succeededRuns: 0,
  totalChargedCredits: 0,
};
```

In `get`, fetch `statsMap` with `new PlatformPluginModel(ctx.serverDB).getAdminStats([plugin.id])`, and return:

```typescript
operations: readPlatformPluginOperationsMetadata(plugin.metadata, plugin.sortOrder),
stats: statsMap.get(plugin.id) ?? EMPTY_PLUGIN_STATS,
```

In `list`, fetch stats for the listed ids and map each row:

```typescript
items: items.map((item) => ({
  ...item,
  operations: readPlatformPluginOperationsMetadata(item.metadata, item.sortOrder),
  stats: statsMap.get(item.id) ?? EMPTY_PLUGIN_STATS,
})),
```

Add mutation before `upsert`:

```typescript
updateOperations: contentWriteProcedure.input(OperationsInputSchema).mutation(async ({ ctx, input }) => {
  await new PlatformPluginModel(ctx.serverDB).updateOperationsForAdmin(input);
  await writeAudit(ctx, {
    eventType: 'platform_plugin.operations_updated',
    metadata: { operations: input.operations },
    resourceId: input.pluginId,
  });
  return { ok: true };
}),
```

- [ ] **Step 9: Run backend tests and commit**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/platformPluginOperations.test.ts packages/business-server/src/lambda-routers/admin/platformPlugins.test.ts`

Expected: PASS.

Commit:

```powershell
git add packages/database/src/models/platformPluginOperations.ts packages/database/src/models/platformPluginOperations.test.ts packages/database/src/models/platformPlugin.ts packages/business-server/src/lambda-routers/admin/platformPlugins.ts packages/business-server/src/lambda-routers/admin/platformPlugins.test.ts
git commit -m "Add platform plugin admin operations persistence" -m "Constraint: uses existing metadata and sort_order columns" -m "Tested: bunx vitest run --silent='passed-only' packages/database/src/models/platformPluginOperations.test.ts packages/business-server/src/lambda-routers/admin/platformPlugins.test.ts"
```


---

### Task 3: Admin Operations UI

**Files:**
- Modify: `src/features/Admin/platformPlugins/formSchema.ts`
- Modify: `src/features/Admin/platformPlugins/formSchema.test.ts`
- Create: `src/features/Admin/platformPlugins/OperationsEditor.tsx`
- Modify: `src/features/Admin/platformPlugins/types.ts`
- Modify: `src/features/Admin/platformPlugins/PluginEditorModal.tsx`
- Modify: `src/features/Admin/AdminPlatformPluginsPage.tsx`
- Modify: `src/services/adminCommercial.ts`

**Interfaces:**
- Consumes: Task 1 operations metadata type and Task 2 `admin.platformPlugins.updateOperations`.
- Produces: admin form values for `featured`, `sortWeight`, `promoLabel`, `useCase`, `planBenefitSummary`, `upgradeCta`, and admin display columns for operations/stats.

- [ ] **Step 1: Write failing form schema test**

Add to `src/features/Admin/platformPlugins/formSchema.test.ts`:

```typescript
it('normalizes operations fields into the admin upsert payload', () => {
  const values = normalizePlatformPluginFormValues({
    category: 'automation',
    description: 'Summarize customer feedback.',
    displayName: 'Feedback Summary',
    featured: true,
    icon: 'Sparkles',
    planBenefitSummary: 'Included for Business users',
    promoLabel: 'Featured',
    runtimeType: 'content_generation',
    slug: 'feedback-summary',
    sortWeight: '25',
    status: 'published',
    upgradeCta: 'Upgrade to Business',
    useCase: 'Turn messy feedback into themes.',
  });

  const input = buildPlatformPluginUpsertInput(values);

  expect(input.operations).toEqual({
    featured: true,
    planBenefitSummary: 'Included for Business users',
    promoLabel: 'Featured',
    sortWeight: 25,
    upgradeCta: 'Upgrade to Business',
    useCase: 'Turn messy feedback into themes.',
  });
});
```

- [ ] **Step 2: Run form schema test to verify failure**

Run: `bunx vitest run --silent='passed-only' src/features/Admin/platformPlugins/formSchema.test.ts`

Expected: FAIL because operations fields are not normalized.

- [ ] **Step 3: Extend form normalization**

In `src/features/Admin/platformPlugins/formSchema.ts`, add to `PlatformPluginFormInput`:

```typescript
featured?: boolean;
planBenefitSummary?: string;
promoLabel?: string;
sortWeight?: NumericInput;
upgradeCta?: string;
useCase?: string;
```

Add to `PlatformPluginFormValues`:

```typescript
featured: boolean;
sortWeight: number;
```

Add to `normalizePlatformPluginFormValues` return object:

```typescript
featured: values.featured === true,
planBenefitSummary: toText(values.planBenefitSummary),
promoLabel: toText(values.promoLabel),
sortWeight: Math.round(toNumber(values.sortWeight, 0)),
upgradeCta: toText(values.upgradeCta),
useCase: toText(values.useCase),
```

Add `operations` inside `buildPlatformPluginUpsertInput` parse object:

```typescript
operations: {
  featured: values.featured,
  planBenefitSummary: values.planBenefitSummary || undefined,
  promoLabel: values.promoLabel || undefined,
  sortWeight: values.sortWeight,
  upgradeCta: values.upgradeCta || undefined,
  useCase: values.useCase || undefined,
},
```

- [ ] **Step 4: Create operations editor component**

Create `src/features/Admin/platformPlugins/OperationsEditor.tsx`:

```tsx
'use client';

import { Flexbox } from '@lobehub/ui';
import { Form, Input, InputNumber, Switch } from 'antd';
import { memo } from 'react';

const OperationsEditor = memo(() => (
  <Flexbox gap={12}>
    <Flexbox horizontal gap={12}>
      <Form.Item label="Featured" name="featured" valuePropName="checked" style={{ width: 160 }}>
        <Switch />
      </Form.Item>
      <Form.Item label="Sort weight" name="sortWeight" style={{ flex: 1 }}>
        <InputNumber max={100_000} min={-100_000} precision={0} style={{ width: '100%' }} />
      </Form.Item>
    </Flexbox>
    <Flexbox horizontal gap={12}>
      <Form.Item label="Promotion label" name="promoLabel" style={{ flex: 1 }}>
        <Input maxLength={80} />
      </Form.Item>
      <Form.Item label="Upgrade CTA" name="upgradeCta" style={{ flex: 1 }}>
        <Input maxLength={160} />
      </Form.Item>
    </Flexbox>
    <Form.Item label="Use case" name="useCase">
      <Input.TextArea autoSize={{ maxRows: 3, minRows: 2 }} maxLength={500} />
    </Form.Item>
    <Form.Item label="Plan benefit summary" name="planBenefitSummary">
      <Input.TextArea autoSize={{ maxRows: 3, minRows: 2 }} maxLength={300} />
    </Form.Item>
  </Flexbox>
));

OperationsEditor.displayName = 'OperationsEditor';
export default OperationsEditor;
```

- [ ] **Step 5: Wire editor modal initial values**

In `src/features/Admin/platformPlugins/PluginEditorModal.tsx`, import `OperationsEditor`. In `buildInitialValues`, derive:

```typescript
const operations = plugin?.operations ?? { featured: false, sortWeight: plugin?.sortOrder ?? 0 };
```

Return:

```typescript
featured: operations.featured,
planBenefitSummary: operations.planBenefitSummary || '',
promoLabel: operations.promoLabel || '',
sortWeight: operations.sortWeight,
upgradeCta: operations.upgradeCta || '',
useCase: operations.useCase || '',
```

Insert after description and before action fields:

```tsx
<Form.Item label="Operations">
  <OperationsEditor />
</Form.Item>
```

- [ ] **Step 6: Extend admin types and service wrapper**

In `src/features/Admin/platformPlugins/types.ts`, import `PlatformPluginAdminStats` and `PlatformPluginOperationsMetadata`, then add to `AdminPlatformPluginItem`:

```typescript
operations: PlatformPluginOperationsMetadata;
stats?: PlatformPluginAdminStats;
```

In `src/services/adminCommercial.ts`, add inside `platformPlugins`:

```typescript
updateOperations: (input: { operations: unknown; pluginId: string }) =>
  lambdaClient.admin.platformPlugins.updateOperations.mutate(input as any),
```

- [ ] **Step 7: Add admin table and detail presentation**

In `src/features/Admin/AdminPlatformPluginsPage.tsx`, add helpers:

```typescript
const formatStats = (value?: number) => Number(value ?? 0).toLocaleString();
const formatSuccessRate = (value?: number) => `${Number(value ?? 0).toFixed(1)}%`;
```

Add columns after status:

```typescript
{
  dataIndex: ['operations', 'featured'],
  key: 'featured',
  render: (value: boolean) => (value ? <Tag color="gold">Featured</Tag> : '-'),
  title: 'Featured',
},
{
  dataIndex: ['operations', 'sortWeight'],
  key: 'sortWeight',
  title: 'Sort weight',
},
{
  dataIndex: 'stats',
  key: 'stats',
  render: (stats: AdminPlatformPluginItem['stats']) =>
    `${formatStats(stats?.runs)} runs / ${formatSuccessRate(stats?.successRate)}`,
  title: 'Stats',
},
```

Add overview `Descriptions.Item` entries:

```tsx
<Descriptions.Item label="Promotion label">{selectedPlugin.operations?.promoLabel || '-'}</Descriptions.Item>
<Descriptions.Item label="Sort weight">{selectedPlugin.operations?.sortWeight ?? 0}</Descriptions.Item>
<Descriptions.Item label="Use case" span={2}>{selectedPlugin.operations?.useCase || '-'}</Descriptions.Item>
<Descriptions.Item label="Plan benefit" span={2}>{selectedPlugin.operations?.planBenefitSummary || '-'}</Descriptions.Item>
<Descriptions.Item label="Upgrade CTA" span={2}>{selectedPlugin.operations?.upgradeCta || '-'}</Descriptions.Item>
```

- [ ] **Step 8: Run admin UI tests and commit**

Run: `bunx vitest run --silent='passed-only' src/features/Admin/platformPlugins/formSchema.test.ts`

Expected: PASS.

Commit:

```powershell
git add src/features/Admin/platformPlugins/formSchema.ts src/features/Admin/platformPlugins/formSchema.test.ts src/features/Admin/platformPlugins/OperationsEditor.tsx src/features/Admin/platformPlugins/types.ts src/features/Admin/platformPlugins/PluginEditorModal.tsx src/features/Admin/AdminPlatformPluginsPage.tsx src/services/adminCommercial.ts
git commit -m "Add admin operations controls for platform plugins" -m "Constraint: metadata-only operations settings" -m "Tested: bunx vitest run --silent='passed-only' src/features/Admin/platformPlugins/formSchema.test.ts"
```

---

### Task 4: User Marketplace Filtering And Availability Presentation

**Files:**
- Modify: `packages/database/src/models/platformPlugin.ts`
- Modify: `apps/server/src/routers/lambda/platformPlugin.ts`
- Modify: `apps/server/src/routers/lambda/platformPlugin.test.ts`
- Modify: `src/services/platformPlugin.ts`
- Modify: `src/services/platformPlugin.test.ts`
- Modify: `src/features/PlatformPluginMarket/helpers.ts`
- Modify: `src/features/PlatformPluginMarket/helpers.test.ts`
- Modify: `src/features/PlatformPluginMarket/index.tsx`
- Modify: `src/features/PlatformPluginMarket/PluginCard.tsx`

**Interfaces:**
- Consumes: Task 1 `platformPluginMarketplaceListInputSchema`, `PlatformPluginMarketplaceListInput`, and `operations` on `PlatformPluginListItem`.
- Produces: `filterAndSortPlatformPlugins(plugins, filters)`, `getPlatformPluginPlanStatusLabel(plugin)`, filtered user `listMarketplace`, and featured-first cards.

- [ ] **Step 1: Write failing helper tests**

In `src/features/PlatformPluginMarket/helpers.test.ts`, import `PlatformPluginListItem` and add:

```typescript
const buildPlugin = (overrides: Partial<PlatformPluginListItem>): PlatformPluginListItem => ({
  billing: { defaultMultiplier: 1, externalApiCostCredits: 0, fixedServiceFeeCredits: 0 },
  category: 'research',
  displayName: 'Research Notes',
  icon: 'FileText',
  id: '00000000-0000-4000-8000-000000000001',
  installed: false,
  operations: { featured: false, sortWeight: 0 },
  planState: { installable: true, runnable: true, visible: true },
  runtimeType: 'content_generation',
  slug: 'research-notes',
  status: 'published',
  tags: ['research'],
  ...overrides,
});

it('filters marketplace plugins and orders featured plugins first', () => {
  const standard = buildPlugin({ displayName: 'Standard Writer', id: '00000000-0000-4000-8000-000000000002', operations: { featured: false, sortWeight: 100 }, slug: 'standard-writer' });
  const featured = buildPlugin({ displayName: 'Featured Research', id: '00000000-0000-4000-8000-000000000003', operations: { featured: true, promoLabel: 'Hot', sortWeight: 1 }, slug: 'featured-research' });

  expect(filterAndSortPlatformPlugins([standard, featured], { query: 'research' })).toEqual([featured]);
  expect(filterAndSortPlatformPlugins([standard, featured], {})).toEqual([featured, standard]);
});

it('returns clear plan availability labels', () => {
  expect(getPlatformPluginPlanStatusLabel(buildPlugin({ installed: true }))).toEqual({ color: 'green', label: 'Runnable' });
  expect(
    getPlatformPluginPlanStatusLabel(
      buildPlugin({ planState: { installable: false, runnable: false, visible: true } }),
    ),
  ).toEqual({ color: 'orange', label: 'Upgrade required' });
});
```

- [ ] **Step 2: Run helper test to verify failure**

Run: `bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts`

Expected: FAIL because the new helper functions do not exist.

- [ ] **Step 3: Implement marketplace helpers**

In `src/features/PlatformPluginMarket/helpers.ts`, add:

```typescript
export const filterAndSortPlatformPlugins = (
  plugins: PlatformPluginListItem[],
  filters: PlatformPluginMarketplaceListInput,
) => {
  const query = filters.query?.toLowerCase();

  return plugins
    .filter((plugin) => {
      const matchesCategory = !filters.category || plugin.category === filters.category;
      const matchesRuntime = !filters.runtimeType || plugin.runtimeType === filters.runtimeType;
      const matchesQuery =
        !query ||
        plugin.displayName.toLowerCase().includes(query) ||
        plugin.slug.toLowerCase().includes(query) ||
        plugin.category.toLowerCase().includes(query) ||
        plugin.tags.some((tag) => tag.toLowerCase().includes(query));
      return matchesCategory && matchesRuntime && matchesQuery;
    })
    .sort((a, b) => {
      if (a.operations.featured !== b.operations.featured) return a.operations.featured ? -1 : 1;
      if (a.operations.sortWeight !== b.operations.sortWeight) return b.operations.sortWeight - a.operations.sortWeight;
      return a.displayName.localeCompare(b.displayName);
    });
};

export const getPlatformPluginPlanStatusLabel = (
  plugin: Pick<PlatformPluginListItem, 'installed' | 'planState'>,
): { color: 'default' | 'green' | 'orange'; label: string } => {
  const reason = getPlatformPluginRestrictionReason(plugin);
  if (!reason) return { color: 'green', label: 'Runnable' };
  if (reason === 'not_installed') return { color: 'default', label: 'Installable' };
  return { color: 'orange', label: 'Upgrade required' };
};
```

- [ ] **Step 4: Write failing service/router tests**

In `src/services/platformPlugin.test.ts`, update the marketplace test to call:

```typescript
await expect(service.listMarketplace({ query: 'research', runtimeType: 'content_generation' })).resolves.toEqual([{ id: 'p1' }]);
expect(client.platformPlugin.listMarketplace.query).toHaveBeenCalledWith({
  query: 'research',
  runtimeType: 'content_generation',
});
```

In `apps/server/src/routers/lambda/platformPlugin.test.ts`, add:

```typescript
it('forwards marketplace filters to the model', async () => {
  const caller = createAuthedCaller({ plan: Plans.Free, userId: 'user-a' });
  await caller.listMarketplace({ query: 'dictionary', runtimeType: 'api_action' });

  expect(platformPluginModelMocks.listMarketplacePlugins).toHaveBeenCalledWith({
    filters: { query: 'dictionary', runtimeType: 'api_action' },
    plan: Plans.Free,
    userId: 'user-a',
  });
});
```

- [ ] **Step 5: Run service/router tests to verify failure**

Run: `bunx vitest run --silent='passed-only' src/services/platformPlugin.test.ts apps/server/src/routers/lambda/platformPlugin.test.ts`

Expected: FAIL because the router and service still use no-input marketplace calls.

- [ ] **Step 6: Implement filter forwarding**

In `apps/server/src/routers/lambda/platformPlugin.ts`, import `platformPluginMarketplaceListInputSchema` and update `listMarketplace`:

```typescript
listMarketplace: platformPluginProcedure
  .input(platformPluginMarketplaceListInputSchema)
  .query(async ({ ctx, input }) => {
    return ctx.platformPluginModel.listMarketplacePlugins({ filters: input, plan: ctx.currentPlan, userId: ctx.userId });
  }),
```

In `packages/database/src/models/platformPlugin.ts`, update `listMarketplacePlugins` signature to accept `filters?: PlatformPluginMarketplaceListInput`. After mapping rows through `toListItem`, apply the same query/category/runtime predicate used by `filterAndSortPlatformPlugins`.

In `src/services/platformPlugin.ts`, update client type and method:

```typescript
listMarketplace: { query: (input?: PlatformPluginMarketplaceListInput) => Promise<PlatformPluginListItem[]> };
listMarketplace: (input?: PlatformPluginMarketplaceListInput) => client.platformPlugin.listMarketplace.query(input),
```

- [ ] **Step 7: Wire frontend filters and card presentation**

In `src/features/PlatformPluginMarket/index.tsx`, add runtime state, build `marketplaceFilters`, use it in the SWR key and service call, and use `filterAndSortPlatformPlugins(plugins, marketplaceFilters)` for display ordering. Add a runtime `Select` with values `all`, `api_action`, and `content_generation`.

In `src/features/PlatformPluginMarket/PluginCard.tsx`, compute:

```typescript
const planStatus = getPlatformPluginPlanStatusLabel(plugin);
```

Render operations tags:

```tsx
{plugin.operations.featured ? <Tag color="gold">Featured</Tag> : null}
{plugin.operations.promoLabel ? <Tag color="blue">{plugin.operations.promoLabel}</Tag> : null}
<Tag color={planStatus.color}>{planStatus.label}</Tag>
```

- [ ] **Step 8: Run marketplace tests and commit**

Run: `bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/services/platformPlugin.test.ts apps/server/src/routers/lambda/platformPlugin.test.ts`

Expected: PASS.

Commit:

```powershell
git add packages/database/src/models/platformPlugin.ts apps/server/src/routers/lambda/platformPlugin.ts apps/server/src/routers/lambda/platformPlugin.test.ts src/services/platformPlugin.ts src/services/platformPlugin.test.ts src/features/PlatformPluginMarket/helpers.ts src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/index.tsx src/features/PlatformPluginMarket/PluginCard.tsx
git commit -m "Improve platform plugin marketplace discovery" -m "Constraint: frontend labels do not replace server authorization" -m "Tested: bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/services/platformPlugin.test.ts apps/server/src/routers/lambda/platformPlugin.test.ts"
```


---

### Task 5: User Run History And Detail Experience

**Files:**
- Modify: `packages/database/src/models/platformPlugin.ts`
- Modify: `apps/server/src/routers/lambda/platformPlugin.ts`
- Modify: `apps/server/src/routers/lambda/platformPlugin.test.ts`
- Modify: `src/services/platformPlugin.ts`
- Modify: `src/services/platformPlugin.test.ts`
- Create: `src/features/PlatformPluginMarket/PluginRunHistory.tsx`
- Modify: `src/features/PlatformPluginMarket/PluginDetail.tsx`

**Interfaces:**
- Consumes: Task 1 `PlatformPluginRunHistoryItem` and `platformPluginRunHistoryInputSchema`.
- Produces: `PlatformPluginModel.listUserRunHistory({ cursor, limit, pluginId, userId })`, `lambda.platformPlugin.listRuns`, `platformPluginService.listRuns`, and user detail recent run history UI.

- [ ] **Step 1: Write failing router and service tests**

In `apps/server/src/routers/lambda/platformPlugin.test.ts`, extend `platformPluginModelMocks`:

```typescript
listUserRunHistory: vi.fn(),
```

In `beforeEach`, add:

```typescript
platformPluginModelMocks.listUserRunHistory.mockResolvedValue({
  items: [
    {
      artifactIds: ['file-1'],
      chargedCredits: 10,
      createdAt: '2026-07-08T00:00:00.000Z',
      fixedServiceFeeCharged: true,
      pluginId,
      pluginName: 'Dictionary Lookup',
      preview: 'A fruit.',
      runId: 'run-1',
      status: 'succeeded',
    },
  ],
  nextCursor: null,
});
```

Add:

```typescript
it('lists only current user run history with sanitized fields', async () => {
  const caller = createAuthedCaller({ plan: Plans.Free, userId: 'user-a' });
  const result = await caller.listRuns({ pluginId });

  expect(platformPluginModelMocks.listUserRunHistory).toHaveBeenCalledWith({
    cursor: 0,
    limit: 20,
    pluginId,
    userId: 'user-a',
  });
  expect(JSON.stringify(result)).not.toContain('inputSnapshot');
  expect(JSON.stringify(result)).not.toContain('runtimeConfig');
  expect(result.items[0]).toMatchObject({ runId: 'run-1', status: 'succeeded' });
});
```

In `src/services/platformPlugin.test.ts`, add:

```typescript
it('forwards run history queries to lambda.platformPlugin.listRuns', async () => {
  const client = {
    platformPlugin: {
      listRuns: { query: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) },
    },
  };
  const service = createPlatformPluginService(client as never);
  const pluginId = '00000000-0000-4000-8000-000000000001';

  await expect(service.listRuns({ pluginId })).resolves.toEqual({ items: [], nextCursor: null });
  expect(client.platformPlugin.listRuns.query).toHaveBeenCalledWith({ pluginId });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bunx vitest run --silent='passed-only' apps/server/src/routers/lambda/platformPlugin.test.ts src/services/platformPlugin.test.ts`

Expected: FAIL because `listRuns` does not exist in user router or service.

- [ ] **Step 3: Implement model run history mapping**

In `packages/database/src/models/platformPlugin.ts`, import `platformPluginArtifacts`, `platformPluginRuns`, and `PlatformPluginRunHistoryItem`. Add helpers:

```typescript
const getRunChargedCredits = (snapshot: Record<string, unknown> | null | undefined) => {
  const value = Number(snapshot?.chargedCredits ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const getFixedServiceFeeCharged = (snapshot: Record<string, unknown> | null | undefined) =>
  snapshot?.fixedServiceFeeCharged === true;

const getRunPreview = (snapshot: Record<string, unknown> | null | undefined) => {
  const preview = snapshot?.preview;
  return typeof preview === 'string' && preview.trim() ? preview.trim().slice(0, 240) : undefined;
};
```

Add method:

```typescript
listUserRunHistory = async (params: {
  cursor: number;
  limit: number;
  pluginId: string;
  userId: string;
}): Promise<{ items: PlatformPluginRunHistoryItem[]; nextCursor: null | number }> => {
  const plugin = await this.db.query.platformPlugins.findFirst({ where: eq(platformPlugins.id, params.pluginId) });
  if (!plugin) return { items: [], nextCursor: null };

  const runs = await this.db.query.platformPluginRuns.findMany({
    limit: params.limit,
    offset: params.cursor,
    orderBy: [desc(platformPluginRuns.createdAt)],
    where: and(eq(platformPluginRuns.pluginId, params.pluginId), eq(platformPluginRuns.userId, params.userId)),
  });
  if (runs.length === 0) return { items: [], nextCursor: null };

  const artifacts = await this.db.query.platformPluginArtifacts.findMany({
    where: inArray(platformPluginArtifacts.runId, runs.map((run) => run.id)),
  });
  const artifactIdsByRunId = new Map<string, string[]>();
  for (const artifact of artifacts) {
    const ids = artifactIdsByRunId.get(artifact.runId) ?? [];
    ids.push(artifact.id);
    artifactIdsByRunId.set(artifact.runId, ids);
  }

  return {
    items: runs.map((run) => ({
      artifactIds: artifactIdsByRunId.get(run.id) ?? [],
      chargedCredits: getRunChargedCredits(run.billingSnapshot),
      createdAt: run.createdAt.toISOString(),
      fixedServiceFeeCharged: getFixedServiceFeeCharged(run.billingSnapshot),
      pluginId: plugin.id,
      pluginName: plugin.displayName,
      preview: getRunPreview(run.outputSnapshot),
      runId: run.id,
      status: run.status,
    })),
    nextCursor: runs.length === params.limit ? params.cursor + params.limit : null,
  };
};
```

- [ ] **Step 4: Implement router and service endpoint**

In `apps/server/src/routers/lambda/platformPlugin.ts`, import `platformPluginRunHistoryInputSchema` and add before `run`:

```typescript
listRuns: platformPluginProcedure.input(platformPluginRunHistoryInputSchema).query(async ({ ctx, input }) => {
  await requirePluginDetail({
    model: ctx.platformPluginModel,
    plan: ctx.currentPlan,
    pluginIdOrSlug: input.pluginId,
    userId: ctx.userId,
  });

  return ctx.platformPluginModel.listUserRunHistory({
    cursor: input.cursor,
    limit: input.limit,
    pluginId: input.pluginId,
    userId: ctx.userId,
  });
}),
```

In `src/services/platformPlugin.ts`, import `PlatformPluginRunHistoryInput` and `PlatformPluginRunHistoryItem`, add client type:

```typescript
listRuns: {
  query: (input: PlatformPluginRunHistoryInput) => Promise<{
    items: PlatformPluginRunHistoryItem[];
    nextCursor: null | number;
  }>;
};
```

Add service method:

```typescript
listRuns: (input: PlatformPluginRunHistoryInput) => client.platformPlugin.listRuns.query(input),
```

- [ ] **Step 5: Create run history UI component**

Create `src/features/PlatformPluginMarket/PluginRunHistory.tsx`:

```tsx
'use client';

import type { PlatformPluginRunHistoryItem } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Empty, Tag, Typography } from 'antd';
import { memo } from 'react';

import { formatPlatformPluginCredits } from './helpers';

const { Text } = Typography;

const statusColor: Record<PlatformPluginRunHistoryItem['status'], string> = {
  denied: 'orange',
  failed: 'red',
  queued: 'default',
  running: 'blue',
  succeeded: 'green',
};

type PluginRunHistoryProps = { items: PlatformPluginRunHistoryItem[] };

const PluginRunHistory = memo<PluginRunHistoryProps>(({ items }) => {
  if (items.length === 0) return <Empty description="No recent runs" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  return (
    <Flexbox gap={8}>
      {items.map((item) => (
        <Flexbox key={item.runId} gap={6} padding={12} style={{ border: '1px solid var(--lobe-color-border-secondary)', borderRadius: 8 }}>
          <Flexbox horizontal align="center" justify="space-between" gap={8}>
            <Flexbox horizontal gap={6} wrap="wrap">
              <Tag color={statusColor[item.status]}>{item.status}</Tag>
              <Tag>{formatPlatformPluginCredits(item.chargedCredits)} credits</Tag>
              {item.fixedServiceFeeCharged ? <Tag color="blue">service fee</Tag> : null}
              {item.artifactIds.length > 0 ? <Tag color="purple">{item.artifactIds.length} artifacts</Tag> : null}
            </Flexbox>
            <Text type="secondary">{new Date(item.createdAt).toLocaleString()}</Text>
          </Flexbox>
          {item.preview ? <Text ellipsis>{item.preview}</Text> : null}
        </Flexbox>
      ))}
    </Flexbox>
  );
});

PluginRunHistory.displayName = 'PluginRunHistory';
export default PluginRunHistory;
```

- [ ] **Step 6: Wire detail page run history and operations copy**

In `src/features/PlatformPluginMarket/PluginDetail.tsx`, import `PluginRunHistory`. Inside `PluginDetailView`, add:

```typescript
const runsKey = ['platform-plugin-runs', plugin.id];
const { data: runHistory } = useClientDataSWR(runsKey, () => platformPluginService.listRuns({ pluginId: plugin.id }));
```

Include `mutate(runsKey)` in `refresh`. Render operations copy near description:

```tsx
{plugin.operations.useCase ? <Alert showIcon message={plugin.operations.useCase} type="info" /> : null}
{restrictionReason && plugin.operations.upgradeCta ? <Alert showIcon message={plugin.operations.upgradeCta} type="warning" /> : null}
{plugin.operations.planBenefitSummary ? <Text type="secondary">{plugin.operations.planBenefitSummary}</Text> : null}
```

Render after `PluginRunPanel`:

```tsx
<Flexbox gap={8}>
  <Text strong>Recent runs</Text>
  <PluginRunHistory items={runHistory?.items ?? []} />
</Flexbox>
```

- [ ] **Step 7: Run tests and commit**

Run: `bunx vitest run --silent='passed-only' apps/server/src/routers/lambda/platformPlugin.test.ts src/services/platformPlugin.test.ts`

Expected: PASS.

Commit:

```powershell
git add packages/database/src/models/platformPlugin.ts apps/server/src/routers/lambda/platformPlugin.ts apps/server/src/routers/lambda/platformPlugin.test.ts src/services/platformPlugin.ts src/services/platformPlugin.test.ts src/features/PlatformPluginMarket/PluginRunHistory.tsx src/features/PlatformPluginMarket/PluginDetail.tsx
git commit -m "Add user platform plugin run history" -m "Constraint: run history exposes sanitized current-user records only" -m "Tested: bunx vitest run --silent='passed-only' apps/server/src/routers/lambda/platformPlugin.test.ts src/services/platformPlugin.test.ts"
```

---

### Task 6: Documentation, Review, And Verification

**Files:**
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: updated governance docs and final verification evidence.

- [ ] **Step 1: Update feature registry**

In `docs/FEATURE_REGISTRY.md`, update the Platform Plugin Marketplace entry with these exact points:

```markdown
- Status: experimental
- Description: Independent platform function plugin marketplace. P2-lite adds operations metadata, admin stats, user filtering, plan availability presentation, and user run history.
- Frontend entries: `/plugins`, `/plugins/:pluginId`, `settings/admin/platform-plugins`
- Core components: `src/features/PlatformPluginMarket/*`, `src/features/Admin/platformPlugins/*`
- Backend API: `admin.platformPlugins.*`, `lambda.platformPlugin.*`
- Database dependencies: `platform_plugins`, `platform_plugin_versions`, `platform_plugin_actions`, `platform_plugin_plan_entitlements`, `platform_plugin_installations`, `platform_plugin_agent_bindings`, `platform_plugin_runs`, `platform_plugin_artifacts`, `platform_plugin_secrets`, `platform_plugin_audit_logs`
- Config dependencies: plugin billing config, plan entitlement config, plugin secret config
- Env dependencies: `PLATFORM_PLUGIN_SECRET_KEY`
- External services: plugin API Action targets and AI providers configured by content generation plugins
- Maintenance risk: high
- Refactor recommendation: split the admin page and run history query further after this phase
- Test recommendation: add real DB integration and browser interaction tests later
- Note: P2-lite does not import MCP / Skills, does not add desktop plugin ability, and does not add new runtime types.
```

- [ ] **Step 2: Update internal changelog**

In `docs/CHANGELOG_INTERNAL.md`, add:

```markdown
### Platform Plugin Marketplace P2-lite

- Added admin operations metadata for featured state, sort weight, promotion label, use case, plan benefit summary, and upgrade CTA.
- Added admin plugin stats for installations, runs, success rate, charged credits, and fixed service fee estimate.
- Added user marketplace filtering by search, category, and runtime type with featured-first ordering.
- Added user plugin detail availability copy, billing summary, and current-user run history.
- Preserved MCP / Skills isolation and did not add new plugin runtime types.
```

- [ ] **Step 3: Run focused verification**

Run:

```powershell
bunx vitest run --silent='passed-only' packages/types/src/platformPlugin.test.ts packages/database/src/models/platformPluginOperations.test.ts packages/business-server/src/lambda-routers/admin/platformPlugins.test.ts apps/server/src/routers/lambda/platformPlugin.test.ts src/features/Admin/platformPlugins/formSchema.test.ts src/features/PlatformPluginMarket/helpers.test.ts src/services/platformPlugin.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run type-check**

Run: `bun run type-check`

Expected: PASS.

- [ ] **Step 5: Run optional database integration check**

Run:

```powershell
if ($env:DATABASE_TEST_URL) { bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/platformPlugin.marketplace.test.ts } else { Write-Output 'DATABASE_TEST_URL not set; database integration test blocked by environment' }
```

Expected: PASS when `DATABASE_TEST_URL` exists; otherwise record the blocked message.

- [ ] **Step 6: Verify isolation boundaries**

Run:

```powershell
git diff -- packages/database/src/models/plugin.ts apps/server/src/routers/lambda/plugin.ts apps/server/src/routers/tools/mcp.ts "src/routes/(main)/settings/skill" src/features/ChatInput/InputEditor/ActionTag
```

Expected: no diff output.

- [ ] **Step 7: Run diff check and commit docs**

Run: `git diff --check`

Expected: no whitespace errors.

Commit:

```powershell
git add docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git commit -m "Document platform plugin ops market rollout" -m "Constraint: governance docs only" -m "Tested: focused platform plugin vitest suite" -m "Tested: bun run type-check"
```

---

## Final Review Checklist

- [ ] `PlatformPluginListItem` and `PlatformPluginDetail` always include `operations`.
- [ ] Existing plugins with empty metadata parse to `{ featured: false, sortWeight: sortOrder }`.
- [ ] Admin stats are derived from existing installation and run tables.
- [ ] Admin stats and public payloads never expose decrypted secrets or raw runtime config.
- [ ] Marketplace filters do not weaken server-side visibility checks.
- [ ] User run history is scoped by `userId` and `pluginId`.
- [ ] User run history omits raw `inputSnapshot`, request bodies, runtime config, decrypted headers, and secret values.
- [ ] MCP routes, Skills pages, legacy plugin routers, and chat ActionTag code have no diff.
- [ ] Route sync test is not required because this plan does not change route registration.
- [ ] Focused tests and `bun run type-check` are run before declaring the implementation complete.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-08-platform-plugin-ops-market.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
