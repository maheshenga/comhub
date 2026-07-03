# NewAPI Instance Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-controlled NewAPI model synchronization and make NewAPI image/video models route through the correct instance type.

**Architecture:** Keep the synchronization logic server-side in a focused NewAPI catalog service. The admin tRPC router exposes connection test and sync mutations, the existing admin page calls those mutations, and runtime image/video paths pass `modelType` so multi-instance routing selects the correct NewAPI instance.

**Tech Stack:** Next.js, tRPC, Drizzle ORM, React, Ant Design, Vitest, TypeScript.

---

## File Structure

- Create `src/server/services/newapiInstance/catalog.ts`: fetch NewAPI model/pricing data, classify model type, normalize sync rows, and return structured test/sync results.
- Create `src/server/services/newapiInstance/catalog.test.ts`: unit tests for classification, default disabled sync rows, and enabled-state preservation rules.
- Modify `src/business/server/lambda-routers/admin/newapiProviders.ts`: add `testInstanceConnection` query/mutation and `syncInstanceModels` mutation.
- Modify `src/services/adminCommercial.ts`: add client service wrappers for the new admin endpoints.
- Modify `src/features/Admin/AdminNewapiProvidersPage.tsx`: add Test and Sync buttons, result messages, and model list refresh.
- Modify `src/server/globalConfig/index.ts`: attach generic image/video parameter schemas to enabled NewAPI image/video models.
- Modify `src/server/globalConfig/index.business.test.ts`: assert injected NewAPI image/video models include parameters.
- Modify `src/server/routers/async/image.ts`, `src/server/routers/lambda/video/index.ts`, `src/server/routers/async/video.ts`, and `src/server/services/generation/videoBackgroundPolling.ts`: pass NewAPI model type context to runtime initialization.
- Modify existing tests around image/video routing if present; otherwise add targeted assertions in router tests that mock `initModelRuntimeFromDB`.

---

### Task 1: Add NewAPI Catalog Service

**Files:**

- Create: `src/server/services/newapiInstance/catalog.ts`

- Create: `src/server/services/newapiInstance/catalog.test.ts`

- [ ] **Step 1: Write failing classification tests**

Add `src/server/services/newapiInstance/catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  classifyNewapiModelType,
  normalizeNewapiSyncRows,
} from './catalog';

describe('NewAPI catalog sync', () => {
  it('classifies models from supported endpoint metadata first', () => {
    expect(
      classifyNewapiModelType({
        id: 'custom-model',
        supported_endpoint_types: ['chat', 'image_generation'],
      }),
    ).toBe('image');

    expect(
      classifyNewapiModelType({
        id: 'custom-model',
        supported_endpoint_types: ['videos'],
      }),
    ).toBe('video');
  });

  it('classifies models from model id when endpoint metadata is missing', () => {
    expect(classifyNewapiModelType({ id: 'flux-pro-1.1' })).toBe('image');
    expect(classifyNewapiModelType({ id: 'sora-2' })).toBe('video');
    expect(classifyNewapiModelType({ id: 'text-embedding-3-large' })).toBe('embedding');
    expect(classifyNewapiModelType({ id: 'gpt-4o-mini' })).toBe('chat');
  });

  it('normalizes synchronized rows as disabled by default', () => {
    const rows = normalizeNewapiSyncRows({
      existingRows: [],
      models: [{ id: 'gpt-4o-mini', object: 'model' }],
      pricing: [],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        enabled: false,
        modelId: 'gpt-4o-mini',
        modelType: 'chat',
      }),
    ]);
  });

  it('preserves enabled state for existing rows', () => {
    const rows = normalizeNewapiSyncRows({
      existingRows: [
        {
          enabled: true,
          modelId: 'sora-2',
          modelType: 'video',
        },
      ],
      models: [{ id: 'sora-2', object: 'model' }],
      pricing: [],
    });

    expect(rows[0]).toEqual(expect.objectContaining({ enabled: true, modelType: 'video' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/server/services/newapiInstance/catalog.test.ts
```

Expected: FAIL because `catalog.ts` does not exist.

- [ ] **Step 3: Implement catalog service**

Create `src/server/services/newapiInstance/catalog.ts`:

```ts
import urlJoin from 'url-join';

import type { NewapiModelType } from './index';

export interface NewapiRemoteModel {
  created?: number;
  id: string;
  object?: string;
  owned_by?: string;
  supported_endpoint_types?: string[];
  type?: string;
}

export interface NewapiRemotePricing {
  description?: string;
  model_name: string;
  supported_endpoint_types?: string[];
}

export interface ExistingNewapiModelRow {
  enabled: boolean;
  modelId: string;
  modelType: string;
}

export interface NormalizedNewapiSyncRow {
  displayName?: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  modelId: string;
  modelType: NewapiModelType;
  sortOrder: number;
}

const endpointIncludes = (values: string[], terms: string[]) =>
  values.some((value) => terms.some((term) => value.includes(term)));

const idIncludes = (id: string, terms: string[]) => terms.some((term) => id.includes(term));

export const classifyNewapiModelType = (
  model: Pick<NewapiRemoteModel, 'id' | 'supported_endpoint_types' | 'type'>,
  pricing?: Pick<NewapiRemotePricing, 'supported_endpoint_types'>,
): NewapiModelType => {
  const endpoints = [...(model.supported_endpoint_types ?? []), ...(pricing?.supported_endpoint_types ?? [])]
    .map((item) => item.toLowerCase().trim())
    .filter(Boolean);
  const explicitType = model.type?.toLowerCase().trim();
  const id = model.id.toLowerCase();

  if (explicitType === 'image' || endpointIncludes(endpoints, ['image', 'images', 'image_generation'])) return 'image';
  if (explicitType === 'video' || endpointIncludes(endpoints, ['video', 'videos', 'video_generation'])) return 'video';
  if (explicitType === 'embedding' || endpointIncludes(endpoints, ['embedding', 'embeddings'])) return 'embedding';
  if (idIncludes(id, ['image', 'dall-e', 'flux', 'stable-diffusion', 'imagen']) || /\bsd[-_]/.test(id)) return 'image';
  if (idIncludes(id, ['video', 'sora', 'wan', 'hailuo', 'seedance', 'kling', 'veo'])) return 'video';
  if (idIncludes(id, ['embedding', 'embed'])) return 'embedding';

  return 'chat';
};

export const normalizeNewapiSyncRows = ({
  existingRows,
  models,
  pricing,
}: {
  existingRows: ExistingNewapiModelRow[];
  models: NewapiRemoteModel[];
  pricing: NewapiRemotePricing[];
}): NormalizedNewapiSyncRow[] => {
  const pricingByModel = new Map(pricing.map((item) => [item.model_name, item]));
  const existingByKey = new Map(
    existingRows.map((item) => [`${item.modelId}:${item.modelType}`, item]),
  );

  return models
    .filter((model) => model.id?.trim())
    .map((model, index) => {
      const pricingItem = pricingByModel.get(model.id);
      const modelType = classifyNewapiModelType(model, pricingItem);
      const existing = existingByKey.get(`${model.id}:${modelType}`);

      return {
        displayName: pricingItem?.description,
        enabled: existing?.enabled ?? false,
        metadata: {
          created: model.created,
          object: model.object,
          ownedBy: model.owned_by,
          pricingAvailable: Boolean(pricingItem),
          supportedEndpointTypes: [
            ...(model.supported_endpoint_types ?? []),
            ...(pricingItem?.supported_endpoint_types ?? []),
          ],
          syncSource: 'newapi',
        },
        modelId: model.id,
        modelType,
        sortOrder: index,
      };
    });
};

export const fetchNewapiModels = async ({
  apiKey,
  baseUrl,
}: {
  apiKey: string;
  baseUrl: string;
}): Promise<NewapiRemoteModel[]> => {
  const response = await fetch(urlJoin(baseUrl.replace(/\/+$/, ''), '/v1/models'), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NewAPI models request failed: ${response.status} ${text}`);
  }

  const body = await response.json();
  return Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
};

export const fetchNewapiPricing = async ({
  apiKey,
  baseUrl,
}: {
  apiKey: string;
  baseUrl: string;
}): Promise<NewapiRemotePricing[]> => {
  const rootBaseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v\d+[a-z]*\/?$/, '');
  const response = await fetch(urlJoin(rootBaseUrl, '/api/pricing'), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) return [];

  const body = await response.json();
  return body?.success && Array.isArray(body.data) ? body.data : [];
};
```

- [ ] **Step 4: Run catalog tests**

Run:

```bash
pnpm vitest run src/server/services/newapiInstance/catalog.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/newapiInstance/catalog.ts src/server/services/newapiInstance/catalog.test.ts
git commit -m "feat: add newapi catalog sync helpers"
```

---

### Task 2: Add Admin Test and Sync Endpoints

**Files:**

- Modify: `src/business/server/lambda-routers/admin/newapiProviders.ts`

- [ ] **Step 1: Write router tests or extend existing admin router coverage**

If no focused test exists for this router, create `src/business/server/lambda-routers/admin/newapiProviders.test.ts` with mocked `ctx.serverDB` and fetch. Cover:

```ts
it('syncInstanceModels imports fetched models as disabled by default', async () => {
  // Mock one enabled instance, /v1/models returning [{ id: 'sora-2' }],
  // and an empty existing model list.
  // Expect insert values to contain enabled: false and modelType: 'video'.
});
```

Run:

```bash
pnpm vitest run src/business/server/lambda-routers/admin/newapiProviders.test.ts
```

Expected: FAIL before endpoint implementation.

- [ ] **Step 2: Add endpoint imports**

In `src/business/server/lambda-routers/admin/newapiProviders.ts`, add:

```ts
import {
  fetchNewapiModels,
  fetchNewapiPricing,
  normalizeNewapiSyncRows,
} from '@/server/services/newapiInstance/catalog';
```

- [ ] **Step 3: Add `testInstanceConnection` query**

Inside `adminNewapiProvidersRouter`, add:

```ts
testInstanceConnection: adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const instance = await ctx.serverDB.query.adminNewapiInstances.findFirst({
      where: eq(adminNewapiInstances.id, input.id),
    });
    if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });

    try {
      const models = await fetchNewapiModels({
        apiKey: instance.apiKey,
        baseUrl: instance.baseUrl,
      });
      const pricing = await fetchNewapiPricing({
        apiKey: instance.apiKey,
        baseUrl: instance.baseUrl,
      });

      return {
        modelsCount: models.length,
        ok: true,
        pricingCount: pricing.length,
        warnings: pricing.length === 0 ? ['Pricing endpoint unavailable or empty'] : [],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        modelsCount: 0,
        ok: false,
        pricingCount: 0,
        warnings: [],
      };
    }
  }),
```

- [ ] **Step 4: Add `syncInstanceModels` mutation**

Inside `adminNewapiProvidersRouter`, add:

```ts
syncInstanceModels: adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const instance = await ctx.serverDB.query.adminNewapiInstances.findFirst({
      where: eq(adminNewapiInstances.id, input.id),
    });
    if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });

    const [models, pricing, existingRows] = await Promise.all([
      fetchNewapiModels({ apiKey: instance.apiKey, baseUrl: instance.baseUrl }),
      fetchNewapiPricing({ apiKey: instance.apiKey, baseUrl: instance.baseUrl }),
      ctx.serverDB
        .select({
          enabled: adminNewapiInstanceModels.enabled,
          modelId: adminNewapiInstanceModels.modelId,
          modelType: adminNewapiInstanceModels.modelType,
        })
        .from(adminNewapiInstanceModels)
        .where(eq(adminNewapiInstanceModels.instanceId, input.id)),
    ]);

    const rows = normalizeNewapiSyncRows({ existingRows, models, pricing }).map((row) => ({
      ...row,
      instanceId: input.id,
    }));

    if (rows.length > 0) {
      await ctx.serverDB
        .insert(adminNewapiInstanceModels)
        .values(rows)
        .onConflictDoUpdate({
          set: {
            displayName: sql`excluded.display_name`,
            metadata: sql`excluded.metadata`,
            sortOrder: sql`excluded.sort_order`,
            updatedAt: new Date(),
          },
          target: [
            adminNewapiInstanceModels.instanceId,
            adminNewapiInstanceModels.modelId,
            adminNewapiInstanceModels.modelType,
          ],
        });
    }

    await recordAdminAudit(ctx, {
      action: 'newapiInstanceModels.sync',
      payload: { count: rows.length },
      resourceId: input.id,
      resourceType: 'admin_newapi_instance_models',
    });
    invalidateNewapiInstancesCache();

    return {
      importedCount: rows.length,
      modelsCount: models.length,
      ok: true,
      pricingCount: pricing.length,
      warnings: pricing.length === 0 ? ['Pricing endpoint unavailable or empty'] : [],
    };
  }),
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm vitest run src/server/services/newapiInstance/catalog.test.ts src/business/server/lambda-routers/admin/newapiProviders.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/business/server/lambda-routers/admin/newapiProviders.ts src/business/server/lambda-routers/admin/newapiProviders.test.ts
git commit -m "feat: sync newapi instance models"
```

---

### Task 3: Wire Admin Client and UI

**Files:**

- Modify: `src/services/adminCommercial.ts`

- Modify: `src/features/Admin/AdminNewapiProvidersPage.tsx`

- [ ] **Step 1: Add service wrappers**

In `src/services/adminCommercial.ts`, add near NewAPI methods:

```ts
testNewapiInstanceConnection = async (id: string) =>
  lambdaClient.admin.newapiProviders.testInstanceConnection.query({ id });

syncNewapiInstanceModels = async (id: string) =>
  lambdaClient.admin.newapiProviders.syncInstanceModels.mutate({ id });
```

- [ ] **Step 2: Add UI handlers**

In `AdminNewapiProvidersPage`, add state:

```ts
const [testingId, setTestingId] = useState<string | null>(null);
const [syncingId, setSyncingId] = useState<string | null>(null);
```

Add handlers:

```ts
const handleTestConnection = async (row: InstanceRow) => {
  setTestingId(row.id);
  try {
    const result = await adminCommercialService.testNewapiInstanceConnection(row.id);
    if (result.ok) {
      message.success(
        `连接成功：模型 ${result.modelsCount} 个，价格 ${result.pricingCount} 条`,
      );
    } else {
      message.error(`连接失败：${result.error}`);
    }
  } finally {
    setTestingId(null);
  }
};

const handleSyncModels = async (row: InstanceRow) => {
  setSyncingId(row.id);
  try {
    const result = await adminCommercialService.syncNewapiInstanceModels(row.id);
    message.success(`同步完成：导入 ${result.importedCount} 个模型，默认未启用`);
    await mutate(modelsKey(row.id, 'chat'));
    await mutate(modelsKey(row.id, 'image'));
    await mutate(modelsKey(row.id, 'video'));
  } finally {
    setSyncingId(null);
  }
};
```

- [ ] **Step 3: Add buttons to instance actions**

In the action column, before the `模型` button:

```tsx
<Button
  loading={testingId === row.id}
  size="small"
  onClick={() => handleTestConnection(row)}
>
  {t('admin.newapi.action.test', '测试')}
</Button>
<Popconfirm
  okText={t('admin.newapi.action.sync', '同步')}
  title={t('admin.newapi.sync.confirm', '同步到本地模型库？新模型默认不会启用。')}
  onConfirm={() => handleSyncModels(row)}
>
  <Button loading={syncingId === row.id} size="small">
    {t('admin.newapi.action.sync', '同步')}
  </Button>
</Popconfirm>
```

- [ ] **Step 4: Run targeted type check**

Run:

```bash
pnpm type-check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/adminCommercial.ts src/features/Admin/AdminNewapiProvidersPage.tsx
git commit -m "feat: add newapi sync controls"
```

---

### Task 4: Add Generic Image and Video Parameters for Synced NewAPI Models

**Files:**

- Modify: `src/server/globalConfig/index.ts`

- Modify: `src/server/globalConfig/index.business.test.ts`

- [ ] **Step 1: Write failing global config test**

Extend `src/server/globalConfig/index.business.test.ts`:

```ts
it('adds generic parameters for admin-managed NewAPI image and video models', async () => {
  vi.mocked(getAllEnabledModels).mockResolvedValue([
    { displayName: 'Flux', id: 'flux-pro', type: 'image' },
    { displayName: 'Sora', id: 'sora-2', type: 'video' },
  ]);

  const result = await getServerGlobalConfig({ db: {} as any });
  const models = result.aiProvider.newapi!.serverModelLists!;

  expect(models.find((m) => m.id === 'flux-pro')?.parameters).toEqual(
    expect.objectContaining({ prompt: { default: '' } }),
  );
  expect(models.find((m) => m.id === 'sora-2')?.parameters).toEqual(
    expect.objectContaining({ duration: expect.objectContaining({ default: 5 }) }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/server/globalConfig/index.business.test.ts
```

Expected: FAIL because `parameters` are missing for injected NewAPI image/video models.

- [ ] **Step 3: Add generic parameter schemas**

In `src/server/globalConfig/index.ts`, import:

```ts
import { gptImage1Schema } from 'model-bank/lobehub';
import { seedance15ProParams } from 'model-bank/lobehub';
```

Add helper:

```ts
const getGenericNewapiParameters = (type: string) => {
  if (type === 'image') return gptImage1Schema;
  if (type === 'video') return seedance15ProParams;
  return undefined;
};
```

Change `serverModelLists` mapping:

```ts
const serverModelLists: AiFullModelCard[] = instanceModels.map((m) => ({
  displayName: m.displayName || m.id,
  enabled: true,
  id: m.id,
  type: m.type,
  ...(getGenericNewapiParameters(m.type) ? { parameters: getGenericNewapiParameters(m.type) } : {}),
}));
```

- [ ] **Step 4: Run global config tests**

Run:

```bash
pnpm vitest run src/server/globalConfig/index.business.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/globalConfig/index.ts src/server/globalConfig/index.business.test.ts
git commit -m "fix: add parameters for synced newapi media models"
```

---

### Task 5: Route NewAPI Image and Video by Model Type

**Files:**

- Modify: `src/server/routers/async/image.ts`

- Modify: `src/server/routers/lambda/video/index.ts`

- Modify: `src/server/routers/async/video.ts`

- Modify: `src/server/services/generation/videoBackgroundPolling.ts`

- [ ] **Step 1: Write or update tests for runtime init calls**

Update existing image/video router tests that mock `initModelRuntimeFromDB`:

```ts
expect(initModelRuntimeFromDB).toHaveBeenCalledWith(
  expect.anything(),
  expect.any(String),
  'newapi',
  expect.objectContaining({ model: expect.any(String), modelType: 'image' }),
);
```

For video:

```ts
expect(initModelRuntimeFromDB).toHaveBeenCalledWith(
  expect.anything(),
  expect.any(String),
  'newapi',
  expect.objectContaining({ model: expect.any(String), modelType: 'video' }),
);
```

Run the chosen tests and verify they fail before code changes.

- [ ] **Step 2: Pass image model type**

In `src/server/routers/async/image.ts`, change:

```ts
const modelRuntime = await initModelRuntimeFromDB(ctx.serverDB, ctx.userId, provider);
```

to:

```ts
const modelRuntime = await initModelRuntimeFromDB(ctx.serverDB, ctx.userId, provider, {
  model: resolvedModelId,
  modelType: 'image',
});
```

- [ ] **Step 3: Pass video model type on submission**

In `src/server/routers/lambda/video/index.ts`, change:

```ts
const modelRuntime = await initModelRuntimeFromDB(serverDB, userId, provider);
```

to:

```ts
const modelRuntime = await initModelRuntimeFromDB(serverDB, userId, provider, {
  model: resolvedModelId,
  modelType: 'video',
});
```

- [ ] **Step 4: Pass video model type during polling when model is available**

In `src/server/routers/async/video.ts`, change:

```ts
const modelRuntime = await initModelRuntimeFromDB(ctx.serverDB, ctx.userId, provider);
```

to:

```ts
const modelRuntime = await initModelRuntimeFromDB(ctx.serverDB, ctx.userId, provider, {
  model: resolvedModelId,
  modelType: 'video',
});
```

In `src/server/services/generation/videoBackgroundPolling.ts`, use the generation record's model if available:

```ts
const modelRuntime = await initModelRuntimeFromDB(db, userId, provider, {
  model,
  modelType: 'video',
});
```

- [ ] **Step 5: Run targeted tests**

Run:

```bash
pnpm vitest run src/server/routers/lambda/__tests__/video.test.ts src/server/routers/lambda/__tests__/aiProvider.test.ts src/server/services/generation/videoBackgroundPolling.test.ts
```

Expected: PASS after updating assertions and implementation.

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/async/image.ts src/server/routers/lambda/video/index.ts src/server/routers/async/video.ts src/server/services/generation/videoBackgroundPolling.ts
git commit -m "fix: route newapi media models by type"
```

---

### Task 6: Full Verification and Deployment Prep

**Files:**

- Modify if needed: `scripts/deploy/comhub-deploy-standalone.sh`

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm vitest run src/server/services/newapiInstance/catalog.test.ts src/server/globalConfig/index.business.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full type check**

Run:

```bash
pnpm type-check
```

Expected: PASS.

- [ ] **Step 3: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 4: Commit remaining changes**

```bash
git status --short
git add .
git commit -m "feat: improve newapi instance sync"
```

Expected: commit only if `git status --short` shows uncommitted changes.

- [ ] **Step 5: Build locally and deploy by upload**

Use the existing local build workflow:

```bash
wsl bash scripts/deploy/comhub-build-package-wsl.sh
```

Upload the generated tarball and `scripts/deploy/comhub-deploy-standalone.sh`, then run the deploy script on the server. The server must not run build commands.
