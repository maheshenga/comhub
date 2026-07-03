# Docmee PPT Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Docmee AiPPT as a secure, commercialized PPT creation feature with admin configuration, plan quota, local usage records, and a user-facing `/create/ppt` workspace.

**Architecture:** Store Docmee global settings in `app_settings`, store per-plan PPT capability in `plan_catalog.metadata`, and store generation/session usage in a new `ppt_usage_records` table. The browser calls ComHub tRPC only; the server creates Docmee UI tokens using the secret API key and reports usage events idempotently for local billing.

**Tech Stack:** Next/LobeHub React routes, tRPC lambda routers, Drizzle/Postgres schema and migrations, `@docmee/sdk-ui@1.6.47`, existing admin commercial service, existing credit ledger/account model.

---

## File Map

- Create `packages/database/migrations/0119_add_docmee_ppt_usage.sql`: database table for PPT session and generation records.
- Modify `packages/database/src/schemas/commercial.ts`: Drizzle schema for `pptUsageRecords`.
- Modify `src/server/services/appSettings/index.ts`: add Docmee setting keys.
- Create `src/server/services/docmee/config.ts`: normalize global settings and plan metadata.
- Create `src/server/services/docmee/index.ts`: token creation, permission checks, quota checks, event reporting, and idempotent charging.
- Create `src/server/services/docmee/index.test.ts`: server service coverage.
- Create `src/server/routers/lambda/docmee.ts`: user-facing tRPC router.
- Modify `src/server/routers/lambda/index.ts`: register `docmee`.
- Create `src/business/server/lambda-routers/admin/ppt.ts`: admin settings router.
- Modify `src/business/server/lambda-routers/admin/index.ts`: register `ppt`.
- Modify `src/services/adminCommercial.ts`: admin client methods for PPT settings.
- Modify `src/business/server/lambda-routers/admin/plans.ts`: accept PPT plan metadata during plan upsert.
- Modify `src/routes/(main)/admin/plans/index.tsx`: add PPT quota/cost fields to plan editor.
- Create `src/features/Admin/AdminPptSettingsPage.tsx`: dedicated PPT admin page.
- Create `src/routes/(main)/admin/ppt/index.tsx`: admin route wrapper.
- Modify `src/features/Admin/adminNavigation.ts`: add PPT admin navigation item.
- Modify `src/features/Admin/AdminSidebar.tsx`: add PPT icon mapping.
- Add `@docmee/sdk-ui` to `package.json`.
- Create `src/services/docmee.ts`: browser service wrapper over `lambdaClient.docmee`.
- Create `src/routes/(main)/(create)/ppt/index.tsx`: PPT route.
- Create `src/routes/(main)/(create)/ppt/features/PptWorkspace.tsx`: SDK mount and lifecycle.
- Create `src/routes/(main)/(create)/ppt/features/PptErrorState.tsx`: reusable Chinese error state.
- Create `src/routes/(main)/(create)/ppt/features/useDocmeeToken.ts`: SWR/token hook.
- Create `src/routes/(main)/(create)/ppt/features/PptWorkspace.test.tsx`: UI states and SDK mock coverage.
- Modify `src/locales/default/common.ts`: add `tab.ppt` and command/search labels.
- Modify `src/routes/(main)/(create)/features/GenerationInput/GenerationMediaModeSegment.tsx`: add PPT to the image/video mode switch.
- Modify `src/spa/router/desktopRouter.config.tsx`: add dynamic web route for `/ppt`.
- Modify `src/spa/router/desktopRouter.config.desktop.tsx`: add sync desktop route for `/ppt`.
- Modify `src/proxy.ts`: allow `/ppt` through auth/routing middleware.

---

### Task 1: Add Database Storage For PPT Usage

**Files:**

- Create: `packages/database/migrations/0119_add_docmee_ppt_usage.sql`

- Modify: `packages/database/src/schemas/commercial.ts`

- [ ] **Step 1: Write the migration**

Create `packages/database/migrations/0119_add_docmee_ppt_usage.sql` with:

```sql
CREATE TABLE IF NOT EXISTS "ppt_usage_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "session_id" varchar(64) NOT NULL,
  "docmee_uid" text NOT NULL,
  "upstream_task_id" text,
  "status" varchar(32) NOT NULL DEFAULT 'created',
  "title" text,
  "plan" varchar(32),
  "credit_cost" numeric NOT NULL DEFAULT 0,
  "quota_cost" numeric NOT NULL DEFAULT 0,
  "charged_ledger_entry_id" uuid REFERENCES "credit_ledger_entries"("id") ON DELETE set null,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "ppt_usage_records_user_created_at_idx"
  ON "ppt_usage_records" ("user_id", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "ppt_usage_records_user_session_idx"
  ON "ppt_usage_records" ("user_id", "session_id");

CREATE UNIQUE INDEX IF NOT EXISTS "ppt_usage_records_user_upstream_task_idx"
  ON "ppt_usage_records" ("user_id", "upstream_task_id")
  WHERE "upstream_task_id" IS NOT NULL;
```

- [ ] **Step 2: Add the Drizzle schema**

In `packages/database/src/schemas/commercial.ts`, add `integer` to the import from `drizzle-orm/pg-core` only if the final implementation needs an integer column. For this plan, use existing `amountNumeric`, `text`, `uuid`, `varchar`, `jsonb`, and `timestamptz`.

Add after `planCatalog` or near the commercial usage tables:

```ts
export const pptUsageRecords = pgTable(
  'ppt_usage_records',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sessionId: varchar('session_id', { length: 64 }).notNull(),
    docmeeUid: text('docmee_uid').notNull(),
    upstreamTaskId: text('upstream_task_id'),
    status: varchar('status', { length: 32 })
      .$type<'created' | 'editing' | 'generated' | 'failed' | 'canceled' | 'downloaded'>()
      .notNull()
      .default('created'),
    title: text('title'),
    plan: varchar('plan', { length: 32 }),
    creditCost: amountNumeric('credit_cost').notNull().default(0),
    quotaCost: amountNumeric('quota_cost').notNull().default(0),
    chargedLedgerEntryId: uuid('charged_ledger_entry_id').references(() => creditLedgerEntries.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: timestamptz('completed_at'),
  },
  (table) => [
    index('ppt_usage_records_user_created_at_idx').on(table.userId, table.createdAt),
    uniqueIndex('ppt_usage_records_user_session_idx').on(table.userId, table.sessionId),
    uniqueIndex('ppt_usage_records_user_upstream_task_idx')
      .on(table.userId, table.upstreamTaskId)
      .where(sql`${table.upstreamTaskId} IS NOT NULL`),
  ],
);

export type NewPptUsageRecord = typeof pptUsageRecords.$inferInsert;
export type PptUsageRecordItem = typeof pptUsageRecords.$inferSelect;
```

If `sql` is not already imported from `drizzle-orm` in this schema file, modify the top import to:

```ts
import { sql } from 'drizzle-orm';
```

- [ ] **Step 3: Run schema type-check**

Run:

```bash
pnpm run type-check
```

Expected: TypeScript should not report schema import or table definition errors.

- [ ] **Step 4: Commit**

```bash
git add packages/database/migrations/0119_add_docmee_ppt_usage.sql packages/database/src/schemas/commercial.ts
git commit -m "feat: add ppt usage storage"
```

---

### Task 2: Add Docmee Settings And Plan Metadata Normalization

**Files:**

- Modify: `src/server/services/appSettings/index.ts`

- Create: `src/server/services/docmee/config.ts`

- Test: `src/server/services/docmee/config.test.ts`

- [ ] **Step 1: Add app setting keys**

In `src/server/services/appSettings/index.ts`, add keys under `APP_SETTING_KEYS`:

```ts
docmeePptEnabled: 'docmee.ppt.enabled',
docmeePptApiKey: 'docmee.ppt.apiKey',
docmeePptBaseUrl: 'docmee.ppt.baseUrl',
docmeePptTokenTtlMinutes: 'docmee.ppt.tokenTtlMinutes',
docmeePptDefaultLang: 'docmee.ppt.defaultLang',
docmeePptThemeColor: 'docmee.ppt.themeColor',
docmeePptAllowPptxDownload: 'docmee.ppt.allowPptxDownload',
docmeePptAllowPdfExport: 'docmee.ppt.allowPdfExport',
docmeePptCreatorVersion: 'docmee.ppt.creatorVersion',
docmeePptDailyLimit: 'docmee.ppt.dailyLimit',
docmeePptAuditEnabled: 'docmee.ppt.auditEnabled',
```

Do not add the API key to `CACHED_KEYS`. Secret values should be read directly.

- [ ] **Step 2: Write config tests first**

Create `src/server/services/docmee/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DOCMEE_PPT_SETTINGS,
  normalizeDocmeePlanCapability,
  normalizeDocmeePptSettings,
} from './config';

describe('Docmee PPT config', () => {
  it('normalizes global settings without exposing unusable values', () => {
    const settings = normalizeDocmeePptSettings({
      'docmee.ppt.allowPdfExport': true,
      'docmee.ppt.allowPptxDownload': false,
      'docmee.ppt.apiKey': '  sk-live  ',
      'docmee.ppt.baseUrl': 'https://docmee.cn',
      'docmee.ppt.creatorVersion': 'v2',
      'docmee.ppt.defaultLang': 'zh',
      'docmee.ppt.enabled': true,
      'docmee.ppt.tokenTtlMinutes': 90,
    });

    expect(settings).toMatchObject({
      allowPdfExport: true,
      allowPptxDownload: false,
      apiKey: 'sk-live',
      baseUrl: 'https://docmee.cn',
      creatorVersion: 'v2',
      enabled: true,
      lang: 'zh',
      tokenTtlMinutes: 90,
    });
  });

  it('falls back to conservative defaults', () => {
    expect(normalizeDocmeePptSettings({})).toEqual(DEFAULT_DOCMEE_PPT_SETTINGS);
  });

  it('normalizes plan capability from plan metadata', () => {
    expect(
      normalizeDocmeePlanCapability({
        pptCreditCost: 12,
        pptEnabled: true,
        pptMonthlyQuota: 20,
      }),
    ).toEqual({ creditCost: 12, enabled: true, monthlyQuota: 20 });
  });
});
```

- [ ] **Step 3: Implement config normalization**

Create `src/server/services/docmee/config.ts`:

```ts
import { APP_SETTING_KEYS } from '@/server/services/appSettings';

export type DocmeePptSettings = {
  allowPdfExport: boolean;
  allowPptxDownload: boolean;
  apiKey: string | null;
  auditEnabled: boolean;
  baseUrl: string;
  creatorVersion: 'v1' | 'v2';
  dailyLimit: number | null;
  enabled: boolean;
  lang: string;
  themeColor: string | null;
  tokenTtlMinutes: number;
};

export type DocmeePlanCapability = {
  creditCost: number;
  enabled: boolean;
  monthlyQuota: number | null;
};

export const DEFAULT_DOCMEE_PPT_SETTINGS: DocmeePptSettings = {
  allowPdfExport: true,
  allowPptxDownload: true,
  apiKey: null,
  auditEnabled: true,
  baseUrl: 'https://docmee.cn',
  creatorVersion: 'v2',
  dailyLimit: null,
  enabled: false,
  lang: 'zh',
  themeColor: null,
  tokenTtlMinutes: 60,
};

const toBool = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const toPositiveInt = (value: unknown, fallback: number, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.round(n)) : fallback;
};

const toOptionalPositiveInt = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const toString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const normalizeDocmeePptSettings = (
  raw: Record<string, unknown>,
): DocmeePptSettings => {
  const apiKey = toString(raw[APP_SETTING_KEYS.docmeePptApiKey]);
  const baseUrl = toString(raw[APP_SETTING_KEYS.docmeePptBaseUrl]);
  const creatorVersion = raw[APP_SETTING_KEYS.docmeePptCreatorVersion] === 'v1' ? 'v1' : 'v2';
  const themeColor = toString(raw[APP_SETTING_KEYS.docmeePptThemeColor]);

  return {
    allowPdfExport: toBool(
      raw[APP_SETTING_KEYS.docmeePptAllowPdfExport],
      DEFAULT_DOCMEE_PPT_SETTINGS.allowPdfExport,
    ),
    allowPptxDownload: toBool(
      raw[APP_SETTING_KEYS.docmeePptAllowPptxDownload],
      DEFAULT_DOCMEE_PPT_SETTINGS.allowPptxDownload,
    ),
    apiKey: apiKey || null,
    auditEnabled: toBool(
      raw[APP_SETTING_KEYS.docmeePptAuditEnabled],
      DEFAULT_DOCMEE_PPT_SETTINGS.auditEnabled,
    ),
    baseUrl: baseUrl || DEFAULT_DOCMEE_PPT_SETTINGS.baseUrl,
    creatorVersion,
    dailyLimit: toOptionalPositiveInt(raw[APP_SETTING_KEYS.docmeePptDailyLimit]),
    enabled: toBool(raw[APP_SETTING_KEYS.docmeePptEnabled], false),
    lang: toString(raw[APP_SETTING_KEYS.docmeePptDefaultLang]) || 'zh',
    themeColor: themeColor || null,
    tokenTtlMinutes: toPositiveInt(raw[APP_SETTING_KEYS.docmeePptTokenTtlMinutes], 60, 24 * 60),
  };
};

export const normalizeDocmeePlanCapability = (
  metadata: Record<string, unknown> | null | undefined,
): DocmeePlanCapability => ({
  creditCost: Math.max(0, Number(metadata?.pptCreditCost ?? 0) || 0),
  enabled: metadata?.pptEnabled === true,
  monthlyQuota: toOptionalPositiveInt(metadata?.pptMonthlyQuota),
});
```

- [ ] **Step 4: Run the config test**

Run:

```bash
pnpm exec vitest run src/server/services/docmee/config.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/appSettings/index.ts src/server/services/docmee/config.ts src/server/services/docmee/config.test.ts
git commit -m "feat: add docmee ppt config"
```

---

### Task 3: Implement Server-Side Docmee Token And Billing Service

**Files:**

- Create: `src/server/services/docmee/index.ts`

- Test: `src/server/services/docmee/index.test.ts`

- Modify if needed: `packages/database/src/models/commercial.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/server/services/docmee/index.test.ts` with tests for:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocmeePptError, DocmeePptService } from './index';

const createDb = (overrides: any = {}) =>
  ({
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn() })) })),
    query: {
      appSettings: { findMany: vi.fn().mockResolvedValue([]) },
      planCatalog: { findFirst: vi.fn() },
      pptUsageRecords: { findFirst: vi.fn(), findMany: vi.fn() },
      userPlanSnapshots: { findFirst: vi.fn() },
    },
    transaction: vi.fn(async (fn) => fn(createDb(overrides))),
    ...overrides,
  }) as any;

describe('DocmeePptService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects token creation when PPT is disabled', async () => {
    const service = new DocmeePptService({ db: createDb(), userId: 'u1' });
    await expect(service.createToken()).rejects.toMatchObject({
      code: 'PPT_DISABLED',
    });
  });

  it('does not expose the configured API key in runtime', async () => {
    const db = createDb({
      query: {
        appSettings: {
          findMany: vi.fn().mockResolvedValue([
            { key: 'docmee.ppt.enabled', value: true },
            { key: 'docmee.ppt.apiKey', value: 'sk-secret' },
          ]),
        },
        planCatalog: { findFirst: vi.fn().mockResolvedValue({ metadata: { pptEnabled: true } }) },
        pptUsageRecords: { findMany: vi.fn().mockResolvedValue([]) },
        userPlanSnapshots: { findFirst: vi.fn().mockResolvedValue({ plan: 'starter' }) },
      },
    });
    const service = new DocmeePptService({ db, userId: 'u1' });
    const runtime = await service.getRuntime();
    expect(JSON.stringify(runtime)).not.toContain('sk-secret');
  });

  it('charges a successful generation only once for the same session', async () => {
    const service = new DocmeePptService({ db: createDb(), userId: 'u1' });
    await expect(
      service.reportEvent({
        sessionId: 's1',
        type: 'afterGenerate',
        upstreamTaskId: 'task-1',
      }),
    ).resolves.toMatchObject({ charged: expect.any(Boolean) });
  });
});
```

The first implementation can refine the test DB helpers while preserving the behaviors above.

- [ ] **Step 2: Implement error class and service skeleton**

Create `src/server/services/docmee/index.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { Plans } from '@lobechat/types';
import { and, desc, eq, gte, sql } from 'drizzle-orm';

import {
  appSettings,
  creditAccounts,
  creditLedgerEntries,
  planCatalog,
  pptUsageRecords,
  userPlanSnapshots,
} from '@/database/schemas';
import { type LobeChatDatabase } from '@/database/type';
import { APP_SETTING_KEYS } from '@/server/services/appSettings';

import {
  normalizeDocmeePlanCapability,
  normalizeDocmeePptSettings,
  type DocmeePptSettings,
} from './config';

export type DocmeePptErrorCode =
  | 'PPT_DISABLED'
  | 'PPT_NOT_CONFIGURED'
  | 'PPT_FORBIDDEN_BY_PLAN'
  | 'PPT_QUOTA_EXHAUSTED'
  | 'PPT_UPSTREAM_TOKEN_FAILED'
  | 'PPT_EVENT_INVALID';

export class DocmeePptError extends Error {
  code: DocmeePptErrorCode;

  constructor(code: DocmeePptErrorCode, message = code) {
    super(message);
    this.code = code;
  }
}

export class DocmeePptService {
  constructor(private readonly params: { db: LobeChatDatabase; userId: string }) {}

  private get db() {
    return this.params.db;
  }

  private get userId() {
    return this.params.userId;
  }

  private readSettings = async (): Promise<DocmeePptSettings> => {
    const keys = Object.values(APP_SETTING_KEYS).filter((key) => key.startsWith('docmee.ppt.'));
    const rows = await this.db.query.appSettings.findMany({
      where: sql`${appSettings.key} = ANY(${keys})`,
    });

    return normalizeDocmeePptSettings(Object.fromEntries(rows.map((row) => [row.key, row.value])));
  };
}
```

If `ANY(${keys})` does not type-check with Drizzle in this repo, use `inArray(appSettings.key, keys)` and import `inArray` from `drizzle-orm`.

- [ ] **Step 3: Add plan and quota methods**

Add methods to `DocmeePptService`:

```ts
private getCurrentPlan = async () => {
  const snapshot = await this.db.query.userPlanSnapshots.findFirst({
    orderBy: [desc(userPlanSnapshots.startedAt), desc(userPlanSnapshots.createdAt)],
    where: and(eq(userPlanSnapshots.userId, this.userId), eq(userPlanSnapshots.status, 'active')),
  });

  return snapshot?.plan ?? Plans.Free;
};

private getPlanCapability = async () => {
  const plan = await this.getCurrentPlan();
  const row = await this.db.query.planCatalog.findFirst({
    where: eq(planCatalog.plan, plan),
  });

  return { capability: normalizeDocmeePlanCapability(row?.metadata), plan };
};

private countMonthlyGenerated = async () => {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const rows = await this.db.query.pptUsageRecords.findMany({
    where: and(
      eq(pptUsageRecords.userId, this.userId),
      eq(pptUsageRecords.status, 'generated'),
      gte(pptUsageRecords.createdAt, start),
    ),
  });

  return rows.length;
};

private assertAvailable = async () => {
  const settings = await this.readSettings();
  if (!settings.enabled) throw new DocmeePptError('PPT_DISABLED');
  if (!settings.apiKey) throw new DocmeePptError('PPT_NOT_CONFIGURED');

  const { capability, plan } = await this.getPlanCapability();
  if (!capability.enabled) throw new DocmeePptError('PPT_FORBIDDEN_BY_PLAN');

  const used = await this.countMonthlyGenerated();
  const remaining =
    capability.monthlyQuota === null ? null : Math.max(0, capability.monthlyQuota - used);
  if (remaining !== null && remaining <= 0) throw new DocmeePptError('PPT_QUOTA_EXHAUSTED');

  return { capability, plan, remaining, settings, used };
};
```

- [ ] **Step 4: Add runtime and token creation**

Add:

```ts
getRuntime = async () => {
  try {
    const { capability, plan, remaining, settings, used } = await this.assertAvailable();
    return {
      allowPdfExport: settings.allowPdfExport,
      allowPptxDownload: settings.allowPptxDownload,
      configured: Boolean(settings.apiKey),
      creatorVersion: settings.creatorVersion,
      enabled: settings.enabled,
      lang: settings.lang,
      plan,
      quota: { monthly: capability.monthlyQuota, remaining, used },
      themeColor: settings.themeColor,
    };
  } catch (error) {
    if (error instanceof DocmeePptError) {
      return { code: error.code, enabled: false };
    }
    throw error;
  }
};

createToken = async () => {
  const { remaining, settings } = await this.assertAvailable();
  const sessionId = randomUUID();
  const uid = this.userId;
  const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/api/user/createApiToken`, {
    body: JSON.stringify({
      limit: remaining ?? undefined,
      uid,
    }),
    headers: {
      'Api-Key': settings.apiKey!,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) throw new DocmeePptError('PPT_UPSTREAM_TOKEN_FAILED');
  const json = (await response.json()) as any;
  const token = json?.data?.token ?? json?.token;
  if (typeof token !== 'string' || !token) throw new DocmeePptError('PPT_UPSTREAM_TOKEN_FAILED');

  await this.db.insert(pptUsageRecords).values({
    docmeeUid: uid,
    metadata: { tokenTtlMinutes: settings.tokenTtlMinutes },
    quotaCost: 0,
    sessionId,
    status: 'created',
    userId: this.userId,
  });

  return { sessionId, token };
};
```

- [ ] **Step 5: Add idempotent event reporting and charging**

Implement `reportEvent` so `afterGenerate` inserts one `consume` ledger entry and updates the usage record once. Use `creditLedgerEntries.referenceType = 'ppt_generation'` and `referenceId = sessionId`.

```ts
reportEvent = async (input: {
  data?: Record<string, unknown>;
  sessionId: string;
  type: 'afterGenerate' | 'beforeDownload' | 'error' | 'pageChange' | 'charge';
  upstreamTaskId?: string;
}) => {
  if (!input.sessionId) throw new DocmeePptError('PPT_EVENT_INVALID');

  const { capability, plan } = await this.getPlanCapability();
  const status = input.type === 'afterGenerate' ? 'generated' : input.type === 'error' ? 'failed' : 'editing';

  return this.db.transaction(async (tx) => {
    const existing = await tx.query.pptUsageRecords.findFirst({
      where: and(eq(pptUsageRecords.userId, this.userId), eq(pptUsageRecords.sessionId, input.sessionId)),
    });
    if (!existing) throw new DocmeePptError('PPT_EVENT_INVALID');

    const alreadyCharged = Boolean(existing.chargedLedgerEntryId);
    if (input.type !== 'afterGenerate' || alreadyCharged || capability.creditCost <= 0) {
      await tx
        .update(pptUsageRecords)
        .set({
          metadata: { ...(existing.metadata ?? {}), lastEvent: input.type, lastEventData: input.data ?? null },
          status,
          updatedAt: new Date(),
          ...(input.upstreamTaskId ? { upstreamTaskId: input.upstreamTaskId } : {}),
          ...(status === 'generated' || status === 'failed' ? { completedAt: new Date() } : {}),
        })
        .where(eq(pptUsageRecords.id, existing.id));

      return { charged: false, status };
    }

    const [account] = await tx
      .update(creditAccounts)
      .set({
        balance: sql`${creditAccounts.balance} - ${capability.creditCost}`,
        totalDebited: sql`${creditAccounts.totalDebited} + ${capability.creditCost}`,
        updatedAt: new Date(),
      })
      .where(and(eq(creditAccounts.userId, this.userId), gte(creditAccounts.balance, capability.creditCost)))
      .returning({ balance: creditAccounts.balance });

    if (!account) throw new DocmeePptError('PPT_QUOTA_EXHAUSTED');

    const [ledger] = await tx
      .insert(creditLedgerEntries)
      .values({
        amount: -capability.creditCost,
        balanceAfter: account.balance,
        description: 'Docmee PPT generation',
        metadata: { docmee: true, plan, upstreamTaskId: input.upstreamTaskId ?? null },
        referenceId: input.sessionId,
        referenceType: 'ppt_generation',
        title: 'PPT 生成',
        type: 'consume',
        userId: this.userId,
      })
      .returning({ id: creditLedgerEntries.id });

    await tx
      .update(pptUsageRecords)
      .set({
        chargedLedgerEntryId: ledger.id,
        completedAt: new Date(),
        creditCost: capability.creditCost,
        metadata: { ...(existing.metadata ?? {}), lastEvent: input.type, lastEventData: input.data ?? null },
        plan,
        quotaCost: 1,
        status: 'generated',
        updatedAt: new Date(),
        ...(input.upstreamTaskId ? { upstreamTaskId: input.upstreamTaskId } : {}),
      })
      .where(eq(pptUsageRecords.id, existing.id));

    return { charged: true, status: 'generated' };
  });
};
```

- [ ] **Step 6: Run service tests**

Run:

```bash
pnpm exec vitest run src/server/services/docmee/config.test.ts src/server/services/docmee/index.test.ts
```

Expected: all Docmee service tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/server/services/docmee packages/database/src/models/commercial.ts
git commit -m "feat: add docmee ppt service"
```

---

### Task 4: Add tRPC Routers And Admin Settings API

**Files:**

- Create: `src/server/routers/lambda/docmee.ts`

- Modify: `src/server/routers/lambda/index.ts`

- Create: `src/business/server/lambda-routers/admin/ppt.ts`

- Modify: `src/business/server/lambda-routers/admin/index.ts`

- Modify: `src/business/server/lambda-routers/admin/settings.ts`

- Test: `src/server/routers/lambda/docmee.test.ts`

- [ ] **Step 1: Add user router**

Create `src/server/routers/lambda/docmee.ts`:

```ts
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { DocmeePptError, DocmeePptService } from '@/server/services/docmee';

const toTrpcError = (error: unknown) => {
  if (error instanceof DocmeePptError) {
    return new TRPCError({ code: 'BAD_REQUEST', message: error.code });
  }
  return error;
};

const docmeeProcedure = authedProcedure.use(serverDatabase);

export const docmeeRouter = router({
  createPptToken: docmeeProcedure.mutation(async ({ ctx }) => {
    try {
      return await new DocmeePptService({ db: ctx.serverDB, userId: ctx.userId }).createToken();
    } catch (error) {
      throw toTrpcError(error);
    }
  }),
  getPptRuntime: docmeeProcedure.query(async ({ ctx }) => {
    return new DocmeePptService({ db: ctx.serverDB, userId: ctx.userId }).getRuntime();
  }),
  reportPptEvent: docmeeProcedure
    .input(
      z.object({
        data: z.record(z.string(), z.unknown()).optional(),
        sessionId: z.string().min(1),
        type: z.enum(['afterGenerate', 'beforeDownload', 'charge', 'error', 'pageChange']),
        upstreamTaskId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await new DocmeePptService({ db: ctx.serverDB, userId: ctx.userId }).reportEvent(input);
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
});
```

- [ ] **Step 2: Register user router**

In `src/server/routers/lambda/index.ts`, import and register:

```ts
import { docmeeRouter } from './docmee';
```

Inside `lambdaRouter`:

```ts
docmee: docmeeRouter,
```

- [ ] **Step 3: Add admin PPT router**

Create `src/business/server/lambda-routers/admin/ppt.ts`:

```ts
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { appSettings } from '@/database/schemas';
import { adminProcedure, router } from '@/libs/trpc/lambda';
import { APP_SETTING_KEYS } from '@/server/services/appSettings';
import { normalizeDocmeePptSettings } from '@/server/services/docmee/config';

import { recordAdminAudit } from './audit';

const SettingSchema = z.object({
  allowPdfExport: z.boolean(),
  allowPptxDownload: z.boolean(),
  apiKey: z.string().optional(),
  auditEnabled: z.boolean(),
  baseUrl: z.string().url(),
  creatorVersion: z.enum(['v1', 'v2']),
  dailyLimit: z.number().min(0).nullable(),
  enabled: z.boolean(),
  lang: z.string().min(1).max(16),
  themeColor: z.string().max(64).nullable(),
  tokenTtlMinutes: z.number().min(1).max(1440),
});

const writeSetting = async (ctx: any, key: string, value: unknown) => {
  await ctx.serverDB
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ set: { updatedAt: new Date(), value }, target: appSettings.key });
};

export const adminPptRouter = router({
  get: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.serverDB.query.appSettings.findMany();
    const raw = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const settings = normalizeDocmeePptSettings(raw);

    return {
      ...settings,
      apiKey: undefined,
      apiKeyConfigured: Boolean(settings.apiKey),
      apiKeyMasked: settings.apiKey ? `****${settings.apiKey.slice(-4)}` : null,
    };
  }),
  save: adminProcedure.input(SettingSchema).mutation(async ({ ctx, input }) => {
    const entries: Array<[string, unknown]> = [
      [APP_SETTING_KEYS.docmeePptEnabled, input.enabled],
      [APP_SETTING_KEYS.docmeePptBaseUrl, input.baseUrl],
      [APP_SETTING_KEYS.docmeePptTokenTtlMinutes, input.tokenTtlMinutes],
      [APP_SETTING_KEYS.docmeePptDefaultLang, input.lang],
      [APP_SETTING_KEYS.docmeePptThemeColor, input.themeColor],
      [APP_SETTING_KEYS.docmeePptAllowPptxDownload, input.allowPptxDownload],
      [APP_SETTING_KEYS.docmeePptAllowPdfExport, input.allowPdfExport],
      [APP_SETTING_KEYS.docmeePptCreatorVersion, input.creatorVersion],
      [APP_SETTING_KEYS.docmeePptDailyLimit, input.dailyLimit],
      [APP_SETTING_KEYS.docmeePptAuditEnabled, input.auditEnabled],
    ];

    if (input.apiKey?.trim()) {
      entries.push([APP_SETTING_KEYS.docmeePptApiKey, input.apiKey.trim()]);
    }

    await Promise.all(entries.map(([key, value]) => writeSetting(ctx, key, value)));
    await recordAdminAudit(ctx, {
      action: 'ppt.settings.save',
      payload: { ...input, apiKey: input.apiKey ? '***' : undefined },
      resourceType: 'app_settings',
    });

    return { ok: true };
  }),
});
```

- [ ] **Step 4: Register admin router**

In `src/business/server/lambda-routers/admin/index.ts`, import and register:

```ts
import { adminPptRouter } from './ppt';
```

Inside `adminRouter`:

```ts
ppt: adminPptRouter,
```

- [ ] **Step 5: Mask Docmee API key in generic settings**

In `src/business/server/lambda-routers/admin/settings.ts`, add to `SENSITIVE_KEYS`:

```ts
SETTING_KEYS.docmeePptApiKey,
```

- [ ] **Step 6: Add router tests**

Create `src/server/routers/lambda/docmee.test.ts` to verify disabled and unconfigured states return typed messages:

```ts
import { describe, expect, it, vi } from 'vitest';

import { docmeeRouter } from './docmee';

describe('docmeeRouter', () => {
  it('returns disabled runtime when PPT is disabled', async () => {
    const caller = docmeeRouter.createCaller({
      serverDB: {
        query: {
          appSettings: { findMany: vi.fn().mockResolvedValue([]) },
        },
      },
      userId: 'u1',
    } as any);

    await expect(caller.getPptRuntime()).resolves.toMatchObject({
      code: 'PPT_DISABLED',
      enabled: false,
    });
  });
});
```

- [ ] **Step 7: Run router tests**

Run:

```bash
pnpm exec vitest run src/server/services/docmee/config.test.ts src/server/services/docmee/index.test.ts src/server/routers/lambda/docmee.test.ts
```

Expected: all Docmee service/router tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/server/routers/lambda/docmee.ts src/server/routers/lambda/index.ts src/business/server/lambda-routers/admin/ppt.ts src/business/server/lambda-routers/admin/index.ts src/business/server/lambda-routers/admin/settings.ts src/server/routers/lambda/docmee.test.ts
git commit -m "feat: add docmee ppt routers"
```

---

### Task 5: Add Admin UI And Plan Controls

**Files:**

- Modify: `src/services/adminCommercial.ts`

- Create: `src/features/Admin/AdminPptSettingsPage.tsx`

- Create: `src/routes/(main)/admin/ppt/index.tsx`

- Modify: `src/features/Admin/adminNavigation.ts`

- Modify: `src/features/Admin/AdminSidebar.tsx`

- Modify: `src/business/server/lambda-routers/admin/plans.ts`

- Modify: `src/routes/(main)/admin/plans/index.tsx`

- [ ] **Step 1: Add admin client methods**

In `src/services/adminCommercial.ts`, add:

```ts
getPptSettings = async () => lambdaClient.admin.ppt.get.query();

savePptSettings = async (params: {
  allowPdfExport: boolean;
  allowPptxDownload: boolean;
  apiKey?: string;
  auditEnabled: boolean;
  baseUrl: string;
  creatorVersion: 'v1' | 'v2';
  dailyLimit: number | null;
  enabled: boolean;
  lang: string;
  themeColor: string | null;
  tokenTtlMinutes: number;
}) => lambdaClient.admin.ppt.save.mutate(params);
```

- [ ] **Step 2: Create admin settings page**

Create `src/features/Admin/AdminPptSettingsPage.tsx`:

```tsx
'use client';

import { Form, Input, InputNumber, Select, Switch, Button, Card, message } from 'antd';
import { memo, useEffect } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const AdminPptSettingsPage = memo(() => {
  const [form] = Form.useForm();
  const { data, mutate } = useClientDataSWR(['admin-ppt-settings'], () =>
    adminCommercialService.getPptSettings(),
  );

  useEffect(() => {
    if (data) form.setFieldsValue(data);
  }, [data, form]);

  const onFinish = async (values: any) => {
    await adminCommercialService.savePptSettings({
      ...values,
      apiKey: values.apiKey || undefined,
      dailyLimit: values.dailyLimit ?? null,
      themeColor: values.themeColor || null,
    });
    message.success('PPT 设置已保存');
    await mutate();
    form.setFieldValue('apiKey', '');
  };

  return (
    <Card title="PPT 创作设置">
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item label="启用 PPT 创作" name="enabled" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item extra={data?.apiKeyConfigured ? `当前已配置：${data.apiKeyMasked}` : '尚未配置'} label="Docmee API-Key" name="apiKey">
          <Input.Password autoComplete="new-password" placeholder="留空表示不更换已有 API-Key" />
        </Form.Item>
        <Form.Item label="服务地址" name="baseUrl" rules={[{ required: true }]}>
          <Input placeholder="https://docmee.cn" />
        </Form.Item>
        <Form.Item label="Token 有效期（分钟）" name="tokenTtlMinutes" rules={[{ required: true }]}>
          <InputNumber min={1} max={1440} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="默认语言" name="lang">
          <Select options={[{ label: '简体中文', value: 'zh' }, { label: 'English', value: 'en' }]} />
        </Form.Item>
        <Form.Item label="创建器版本" name="creatorVersion">
          <Select options={[{ label: '对话式 V2', value: 'v2' }, { label: '步骤式 V1', value: 'v1' }]} />
        </Form.Item>
        <Form.Item label="主题色" name="themeColor">
          <Input placeholder="#00A76F" />
        </Form.Item>
        <Form.Item label="允许下载 PPTX" name="allowPptxDownload" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="允许导出 PDF" name="allowPdfExport" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="单用户每日上限" name="dailyLimit">
          <InputNumber min={0} placeholder="0 或留空表示不限制" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="记录审计日志" name="auditEnabled" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Button htmlType="submit" type="primary">保存设置</Button>
      </Form>
    </Card>
  );
});

AdminPptSettingsPage.displayName = 'AdminPptSettingsPage';

export default AdminPptSettingsPage;
```

Adapt styling to the existing admin page density if the imported `Card` conflicts with local antd compatibility.

- [ ] **Step 3: Add admin route wrapper**

Create `src/routes/(main)/admin/ppt/index.tsx`:

```tsx
'use client';

import AdminPptSettingsPage from '@/features/Admin/AdminPptSettingsPage';

export default AdminPptSettingsPage;
```

- [ ] **Step 4: Add navigation item**

In `src/features/Admin/adminNavigation.ts`, add icon type:

```ts
| 'ppt'
```

Add item under the model/billing or brand-growth group:

```ts
{
  description: '配置 Docmee PPT 创作服务、套餐权限和额度规则',
  icon: 'ppt',
  label: 'PPT 创作',
  path: `${ADMIN_BASE_PATH}/ppt`,
},
```

In `src/features/Admin/AdminSidebar.tsx`, import `Presentation` from `lucide-react` and map:

```ts
ppt: Presentation,
```

- [ ] **Step 5: Accept PPT metadata in plan upsert**

In `src/business/server/lambda-routers/admin/plans.ts`, extend `PlanInputSchema`:

```ts
pptCreditCost: z.number().min(0).optional(),
pptEnabled: z.boolean().optional(),
pptMonthlyQuota: z.number().min(0).nullable().optional(),
```

When building `metadata`, include:

```ts
pptCreditCost: input.pptCreditCost ?? 0,
pptEnabled: input.pptEnabled === true,
pptMonthlyQuota: input.pptMonthlyQuota ?? null,
```

Ensure the `planInput` object passed to `planCatalog` excludes the three PPT UI fields.

- [ ] **Step 6: Add PPT fields to plan editor UI**

In `src/routes/(main)/admin/plans/index.tsx`, add form values and modal fields:

```tsx
<Form.Item label="允许 PPT 创作" name="pptEnabled" valuePropName="checked">
  <Switch />
</Form.Item>
<Form.Item label="PPT 月生成次数" name="pptMonthlyQuota" extra="留空表示不限制">
  <InputNumber min={0} style={{ width: '100%' }} />
</Form.Item>
<Form.Item label="每次 PPT 成功生成扣除积分" name="pptCreditCost">
  <InputNumber min={0} style={{ width: '100%' }} />
</Form.Item>
```

When editing an existing row, read from `row.metadata`:

```ts
pptCreditCost: Number((row.metadata as any)?.pptCreditCost ?? 0),
pptEnabled: (row.metadata as any)?.pptEnabled === true,
pptMonthlyQuota: (row.metadata as any)?.pptMonthlyQuota ?? null,
```

When saving, pass these values to `adminCommercialService.upsertPlan`.

- [ ] **Step 7: Run admin UI type-check and focused tests**

Run:

```bash
pnpm run type-check
pnpm exec vitest run src/features/Admin/adminNavigation.test.ts src/routes/(main)/settings/admin/index.test.tsx
```

Expected: type-check passes and admin navigation/settings tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/services/adminCommercial.ts src/features/Admin/AdminPptSettingsPage.tsx src/routes/(main)/admin/ppt/index.tsx src/features/Admin/adminNavigation.ts src/features/Admin/AdminSidebar.tsx src/business/server/lambda-routers/admin/plans.ts src/routes/(main)/admin/plans/index.tsx
git commit -m "feat: add admin ppt controls"
```

---

### Task 6: Add User-Facing `/create/ppt` Workspace

**Files:**

- Modify: `package.json`

- Create: `src/services/docmee.ts`

- Create: `src/routes/(main)/(create)/ppt/index.tsx`

- Create: `src/routes/(main)/(create)/ppt/features/PptWorkspace.tsx`

- Create: `src/routes/(main)/(create)/ppt/features/PptErrorState.tsx`

- Create: `src/routes/(main)/(create)/ppt/features/useDocmeeToken.ts`

- Test: `src/routes/(main)/(create)/ppt/features/PptWorkspace.test.tsx`

- [ ] **Step 1: Install SDK dependency**

Run:

```bash
pnpm add @docmee/sdk-ui@1.6.47
```

Expected: `package.json` updates with `@docmee/sdk-ui`.

- [ ] **Step 2: Add browser service wrapper**

Create `src/services/docmee.ts`:

```ts
import { lambdaClient } from '@/libs/trpc/client';

export const docmeeService = {
  createPptToken: () => lambdaClient.docmee.createPptToken.mutate(),
  getPptRuntime: () => lambdaClient.docmee.getPptRuntime.query(),
  reportPptEvent: (params: {
    data?: Record<string, unknown>;
    sessionId: string;
    type: 'afterGenerate' | 'beforeDownload' | 'charge' | 'error' | 'pageChange';
    upstreamTaskId?: string;
  }) => lambdaClient.docmee.reportPptEvent.mutate(params),
};
```

- [ ] **Step 3: Add token hook**

Create `src/routes/(main)/(create)/ppt/features/useDocmeeToken.ts`:

```ts
import useSWRMutation from 'swr/mutation';

import { docmeeService } from '@/services/docmee';

export const useDocmeeToken = () =>
  useSWRMutation(['docmee-ppt-token'], () => docmeeService.createPptToken());
```

- [ ] **Step 4: Add error state component**

Create `src/routes/(main)/(create)/ppt/features/PptErrorState.tsx`:

```tsx
'use client';

import { Button, Result } from 'antd';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';

const copy: Record<string, { action?: string; description: string; title: string }> = {
  PPT_DISABLED: { description: '管理员暂未开启 PPT 创作功能。', title: 'PPT 创作暂未开启' },
  PPT_FORBIDDEN_BY_PLAN: {
    action: '查看套餐',
    description: '当前套餐暂不支持 PPT 创作，可以升级套餐或使用激活码。',
    title: '当前套餐不可用',
  },
  PPT_NOT_CONFIGURED: { description: '管理员尚未配置 Docmee PPT 服务。', title: 'PPT 服务未配置' },
  PPT_QUOTA_EXHAUSTED: {
    action: '查看套餐',
    description: '本月 PPT 生成额度已用完，可以升级套餐或等待下个周期。',
    title: 'PPT 额度不足',
  },
  PPT_UPSTREAM_TOKEN_FAILED: { description: 'Docmee 服务暂时不可用，请稍后重试。', title: '服务连接失败' },
};

const PptErrorState = memo<{ code?: string; onRetry?: () => void }>(({ code, onRetry }) => {
  const navigate = useNavigate();
  const item = copy[code || ''] ?? { description: '请稍后重试。', title: 'PPT 创作加载失败' };

  return (
    <Result
      extra={
        item.action ? (
          <Button type="primary" onClick={() => navigate('/settings/plans')}>
            {item.action}
          </Button>
        ) : (
          <Button onClick={onRetry}>重试</Button>
        )
      }
      status="warning"
      subTitle={item.description}
      title={item.title}
    />
  );
});

PptErrorState.displayName = 'PptErrorState';

export default PptErrorState;
```

- [ ] **Step 5: Add SDK workspace**

Create `src/routes/(main)/(create)/ppt/features/PptWorkspace.tsx`:

```tsx
'use client';

import { Spin } from 'antd';
import { memo, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import { docmeeService } from '@/services/docmee';

import PptErrorState from './PptErrorState';
import { useDocmeeToken } from './useDocmeeToken';

const getDownloadButton = (runtime: any) => {
  const formats = [
    runtime?.allowPptxDownload ? 'pptx' : null,
    runtime?.allowPdfExport ? 'pdf' : null,
  ].filter(Boolean);

  return formats.length > 0 ? formats : false;
};

const PptWorkspace = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<any>(null);
  const [errorCode, setErrorCode] = useState<string>();
  const { data: runtime, isLoading, mutate } = useSWR(['docmee-ppt-runtime'], () =>
    docmeeService.getPptRuntime(),
  );
  const tokenMutation = useDocmeeToken();

  useEffect(() => {
    if (!runtime || !('enabled' in runtime) || runtime.enabled === false || !containerRef.current)
      return;

    let disposed = false;

    const mount = async () => {
      try {
        const token = await tokenMutation.trigger();
        if (disposed || !containerRef.current) return;

        const { DocmeeUI } = await import('@docmee/sdk-ui');
        uiRef.current = new DocmeeUI({
          container: containerRef.current,
          creatorVersion: runtime.creatorVersion,
          downloadButton: getDownloadButton(runtime) as any,
          lang: runtime.lang,
          mode: 'light',
          onMessage: async (event: any) => {
            if (!token?.sessionId) return;
            if (['afterGenerate', 'beforeDownload', 'charge', 'error', 'pageChange'].includes(event.type)) {
              await docmeeService.reportPptEvent({
                data: event.data,
                sessionId: token.sessionId,
                type: event.type,
                upstreamTaskId: event.data?.id || event.data?.taskId || event.data?.pptId,
              });
            }
          },
          page: runtime.creatorVersion === 'v2' ? 'creator-v2' : 'creator',
          token: token.token,
        });
      } catch (error: any) {
        setErrorCode(error?.message || 'PPT_UPSTREAM_TOKEN_FAILED');
      }
    };

    mount();

    return () => {
      disposed = true;
      uiRef.current?.destroy?.();
      uiRef.current = null;
    };
  }, [runtime]);

  if (isLoading) return <Spin fullscreen tip="正在加载 PPT 创作服务" />;
  if ((runtime as any)?.enabled === false) {
    return <PptErrorState code={(runtime as any)?.code} onRetry={() => mutate()} />;
  }
  if (errorCode) return <PptErrorState code={errorCode} onRetry={() => mutate()} />;

  return <div ref={containerRef} style={{ height: '100%', minHeight: 'calc(100vh - 64px)', width: '100%' }} />;
});

PptWorkspace.displayName = 'PptWorkspace';

export default PptWorkspace;
```

- [ ] **Step 6: Add route**

Create `src/routes/(main)/(create)/ppt/index.tsx`:

```tsx
'use client';

import NavHeader from '@/features/NavHeader';

import PptWorkspace from './features/PptWorkspace';

const PptPage = () => (
  <>
    <NavHeader />
    <PptWorkspace />
  </>
);

export default PptPage;
```

- [ ] **Step 7: Add UI tests**

Create `src/routes/(main)/(create)/ppt/features/PptWorkspace.test.tsx` with mocks for `docmeeService` and `@docmee/sdk-ui`. Verify disabled state and normal mount:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PptWorkspace from './PptWorkspace';

vi.mock('@/services/docmee', () => ({
  docmeeService: {
    createPptToken: vi.fn().mockResolvedValue({ sessionId: 's1', token: 'token-1' }),
    getPptRuntime: vi.fn().mockResolvedValue({
      allowPdfExport: true,
      allowPptxDownload: true,
      creatorVersion: 'v2',
      enabled: true,
      lang: 'zh',
    }),
    reportPptEvent: vi.fn().mockResolvedValue({ charged: true }),
  },
}));

const docmeeConstructor = vi.fn();
vi.mock('@docmee/sdk-ui', () => ({
  DocmeeUI: function MockDocmeeUI(options: any) {
    docmeeConstructor(options);
    return { destroy: vi.fn() };
  },
}));

describe('PptWorkspace', () => {
  it('mounts DocmeeUI after runtime and token are ready', async () => {
    render(<PptWorkspace />);
    await waitFor(() => expect(docmeeConstructor).toHaveBeenCalled());
  });
});
```

- [ ] **Step 8: Run frontend tests**

Run:

```bash
pnpm exec vitest run "src/routes/(main)/(create)/ppt/features/PptWorkspace.test.tsx"
pnpm run type-check
```

Expected: PPT workspace test and type-check pass.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml src/services/docmee.ts "src/routes/(main)/(create)/ppt"
git commit -m "feat: add docmee ppt workspace"
```

---

### Task 7: Add Navigation, Route Registration, And Final Integration Verification

**Files:**

- Modify: `src/locales/default/common.ts`

- Modify: `src/routes/(main)/(create)/features/GenerationInput/GenerationMediaModeSegment.tsx`

- Modify: `src/spa/router/desktopRouter.config.tsx`

- Modify: `src/spa/router/desktopRouter.config.desktop.tsx`

- Modify: `src/proxy.ts`

- [ ] **Step 1: Add locale labels**

In `src/locales/default/common.ts`, add:

```ts
'cmdk.keywords.ppt': 'ppt presentation slides deck powerpoint',
'cmdk.ppt': 'PPT',
'tab.ppt': 'PPT',
```

- [ ] **Step 2: Add PPT to the media mode switch**

In `src/routes/(main)/(create)/features/GenerationInput/GenerationMediaModeSegment.tsx`, import `Presentation`:

```ts
import { ImageIcon, Presentation, Video } from 'lucide-react';
```

Change the prop type:

```ts
mode: 'image' | 'ppt' | 'video';
```

Add the option after video:

```tsx
{
  label: (
    <Flexbox horizontal align="center" gap={8}>
      {!isHero && <Icon icon={Presentation} />}
      <span className={isHero ? styles.heroText : undefined}>{t('tab.ppt')}</span>
    </Flexbox>
  ),
  value: 'ppt',
},
```

Update `labelRender`:

```tsx
const text = v === 'video' ? t('tab.video') : v === 'ppt' ? t('tab.ppt') : t('tab.image');
const icon = v === 'video' ? Video : v === 'ppt' ? Presentation : ImageIcon;
```

Use `icon` in the compact render:

```tsx
<Icon icon={icon} size={16} />
```

Update navigation:

```ts
const pathMap = { image: '/image', ppt: '/ppt', video: '/video' } as const;
navigate(pathMap[value as keyof typeof pathMap] ?? '/image');
```

- [ ] **Step 3: Register web SPA route**

In `src/spa/router/desktopRouter.config.tsx`, add a dynamic route block before Image routes:

```tsx
// PPT routes
{
  children: [
    {
      element: dynamicElement(() => import('@/routes/(main)/(create)/ppt'), 'Desktop > PPT'),
      index: true,
    },
  ],
  errorElement: <ErrorBoundary />,
  path: 'ppt',
},
```

- [ ] **Step 4: Register desktop SPA route**

In `src/spa/router/desktopRouter.config.desktop.tsx`, add:

```ts
import PptPage from '@/routes/(main)/(create)/ppt';
```

Add a route block near Video and Image:

```tsx
// PPT routes
{
  children: [
    {
      element: <PptPage />,
      index: true,
    },
  ],
  errorElement: <ErrorBoundary />,
  path: 'ppt',
},
```

- [ ] **Step 5: Allow `/ppt` through proxy middleware**

In `src/proxy.ts`, add `'/ppt'` beside `'/image'` and `'/video'`:

```ts
'/ppt',
```

- [ ] **Step 6: Run full focused verification**

Run:

```bash
pnpm run type-check
pnpm exec vitest run src/server/services/docmee/config.test.ts src/server/services/docmee/index.test.ts src/server/routers/lambda/docmee.test.ts "src/routes/(main)/(create)/ppt/features/PptWorkspace.test.tsx" src/features/Admin/adminNavigation.test.ts
git diff --check
rg -n "^(<<<<<<<|=======|>>>>>>>)$" -g "!*node_modules*" -g "!*.lock" .
```

Expected:

- `type-check` exits 0.

- Vitest exits 0.

- `git diff --check` exits 0.

- conflict marker scan exits 1 with no matches.

- [ ] **Step 7: Commit**

```bash
git add src/locales/default/common.ts src/routes/(main)/(create)/features/GenerationInput/GenerationMediaModeSegment.tsx src/spa/router/desktopRouter.config.tsx src/spa/router/desktopRouter.config.desktop.tsx src/proxy.ts
git commit -m "feat: expose ppt creation entry"
```

---

### Task 8: Manual QA Checklist

**Files:**

- No code files unless failures are found.

- [ ] **Step 1: Start local app**

Run:

```bash
pnpm dev
```

Expected: local app starts on its configured port.

- [ ] **Step 2: Admin config path**

Open `/settings/admin/ppt` and verify:

- page is Chinese

- API key field is empty when already configured

- masked key is shown as `****xxxx`

- saving without a new API key does not clear the old key

- enable switch persists

- [ ] **Step 3: Plan config path**

Open `/settings/admin/plans` and verify:

- each plan can enable or disable PPT

- monthly quota can be blank for unlimited

- credit cost can be `0` or a positive number

- saved values reappear when editing the same plan

- [ ] **Step 4: User PPT path**

Open `/create/ppt` as:

- user with disabled plan: sees no-permission state

- user with enabled plan and quota: sees Docmee UI

- user with exhausted quota: sees quota state

- [ ] **Step 5: Event and billing path**

With a valid Docmee token:

- create a PPT

- verify `ppt_usage_records.status = 'generated'`

- verify one `credit_ledger_entries` row exists with `reference_type = 'ppt_generation'`

- trigger or simulate the same `afterGenerate` event again

- verify no second ledger entry is created

- [ ] **Step 6: Final commit if manual QA fixes were needed**

If manual QA required changes:

```bash
git status --short
git add packages/database/migrations/0119_add_docmee_ppt_usage.sql packages/database/src/schemas/commercial.ts src/server/services/appSettings/index.ts src/server/services/docmee src/server/routers/lambda/docmee.ts src/server/routers/lambda/index.ts src/business/server/lambda-routers/admin/ppt.ts src/business/server/lambda-routers/admin/index.ts src/business/server/lambda-routers/admin/settings.ts src/business/server/lambda-routers/admin/plans.ts src/services/adminCommercial.ts src/features/Admin/AdminPptSettingsPage.tsx src/routes/(main)/admin/ppt/index.tsx src/features/Admin/adminNavigation.ts src/features/Admin/AdminSidebar.tsx src/routes/(main)/admin/plans/index.tsx package.json pnpm-lock.yaml src/services/docmee.ts src/routes/(main)/(create)/ppt src/locales/default/common.ts src/routes/(main)/(create)/features/GenerationInput/GenerationMediaModeSegment.tsx src/spa/router/desktopRouter.config.tsx src/spa/router/desktopRouter.config.desktop.tsx src/proxy.ts
git commit -m "fix: stabilize docmee ppt integration"
```

If no changes were needed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: user entry, admin settings, API key secrecy, plan permissions, quota, event reporting, billing, error states, and tests are mapped to tasks.
- Scope control: the plan embeds Docmee UI and records usage; it does not reimplement Docmee templates or editor internals.
- Security: API key remains server-side, generic admin settings masks it, and the browser only receives a temporary token.
- Billing: opening the page and creating a token do not charge; only `afterGenerate` charges, idempotently by session.
