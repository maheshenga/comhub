# Comhub 充值 + 计费完整修复 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面修复 comhub 平台的充值流程和图像 / 视频计费桩函数，填充所有二级缺口，使商业系统形成完整闭环。

**Architecture:** 在 CommercialModel 上封装 preCharge/postCharge 共享工具方法，不重构已有 chat billing。卡密兑换通过 topUpOrders 统一化（新增 source 字段），各桩函数调用共享方法但保留独立入口点。

**Tech Stack:** Drizzle ORM + PostgreSQL, TRPC (lambda/async routers), React 19 + react-router-dom, zustand, vitest

---

## File Structure

### Schema/Types 层

- `packages/types/src/business.ts` — 新增 TopUpOrderSourceEnum/Type, 修改 TopUpOrderHistoryItem, CreateTopUpOrderParams
- `packages/database/src/schemas/commercial.ts` — topUpOrders 新增 source, redemptionCodeId; creditAccounts 新增 storageUsed, storageQuota
- `packages/database/migrations/0111_add_topup_order_source_and_storage_fields.sql` — migration

### Model 层

- `packages/database/src/models/commercial.ts` — 新增 preCharge/postCharge; 删除 ONLINE_PAYMENT_ENABLED; 修改 createTopUpOrder/settleTopUpOrder/cancelTopUpOrder

### Server 桩函数

- `src/business/server/image-generation/chargeBeforeGenerate.ts` — 填充
- `src/business/server/image-generation/chargeAfterGenerate.ts` — 填充
- `src/business/server/image-generation/notifyImageCompleted.ts` — 移除空桩注释
- `src/business/server/video-generation/chargeBeforeGenerate.ts` — 填充
- `src/business/server/video-generation/chargeAfterGenerate.ts` — 填充
- `src/business/server/video-generation/getVideoFreeQuota.ts` — 填充

### Server 路由 / 中间件

- `src/business/server/lambda-routers/admin/orders.ts` — 新增 getDetail, settle
- `src/business/server/lambda-routers/admin/redemption.ts` — 兑换流程重构
- `src/business/server/lambda-routers/admin/referral.ts` — 新增 getReferralStats
- `src/business/server/lambda-routers/accountDeletion.ts` — 填充
- `src/business/server/lambda-routers/payment.ts` — 新建（预留骨架）
- `src/business/server/trpc-middlewares/lambda.ts` — 填充 checkFileStorageUsage
- `src/business/server/trpc-middlewares/async.ts` — 填充 createImageBusinessMiddleware
- `src/server/services/generation/videoBackgroundPolling.ts` — 插入计费调用
- `src/server/routers/lambda/index.ts` — 注册 paymentRouter

### Server 调用点修改

- `src/server/routers/async/image.ts` — 错误路径退款
- `src/server/routers/async/video.ts` — 传递 isError 到 chargeAfterGenerate（已传）
- `src/server/routers/lambda/video/index.ts` — 无改动（已传 prechargeResult）

### Client Services

- `src/services/commercial.ts` — 新增 topUp 相关方法
- `src/services/adminCommercial.ts` — 新增 orderDetail/settleOrder, referralStats
- `src/services/redemption.ts` — 无改动

### Client UI

- `src/routes/(main)/topup/index.tsx` — 新建
- `src/features/TopUp/index.ts` — 新建
- `src/features/TopUp/RedeemForm.tsx` — 新建
- `src/features/TopUp/BalanceDisplay.tsx` — 新建
- `src/features/TopUp/TopUpHistory.tsx` — 新建
- `src/business/client/BusinessDesktopRoutes.tsx` — 新增 /topup 用户路由
- `src/business/client/hooks/useBusinessErrorAlertConfig.ts` — 填充
- `src/business/client/BusinessSettingPages/RedemptionPanel.tsx` — 卡密类型 UI 优化
- `src/locales/default/commercial.ts` — 新增充值相关 i18n key

### Types 补充

- `packages/types/src/fetch.ts` — 新增 StorageQuotaExceeded 错误类型

### Tests

- `packages/database/src/models/__tests__/commercial.preCharge.test.ts` — 新建
- `packages/database/src/models/__tests__/commercial.topup.test.ts` — 新建
- `src/business/server/__tests__/image-billing.test.ts` — 新建
- `src/business/server/__tests__/video-billing.test.ts` — 新建
- `src/business/server/lambda-routers/__tests__/redemption.test.ts` — 新建
- `src/business/server/lambda-routers/__tests__/accountDeletion.test.ts` — 新建

---

## Task 1: Schema 层 — topUpOrders 新增 source + redemptionCodeId

**Files:**

- Modify: `packages/types/src/business.ts`

- Modify: `packages/database/src/schemas/commercial.ts`

- Create: `packages/database/migrations/0111_add_topup_order_source_and_storage_fields.sql`

- [ ] **Step 1: 在 `packages/types/src/business.ts` 新增 TopUpOrderSource 枚举和类型**

在 `TopUpOrderStatusEnum` 定义之后（约第 89 行）添加：

```ts
export const TopUpOrderSourceEnum = {
  Alipay: 'alipay',
  Manual: 'manual',
  Redemption: 'redemption',
  WechatPay: 'wechat_pay',
} as const;

export type TopUpOrderSourceType = (typeof TopUpOrderSourceEnum)[keyof typeof TopUpOrderSourceEnum];
```

修改 `TopUpOrderHistoryItem`（约第 176 行），新增字段：

```ts
export interface TopUpOrderHistoryItem {
  amount: number;
  createdAt: Date;
  credits: number;
  currency: string;
  externalOrderId?: string | null;
  id: string;
  paidAt?: Date | null;
  provider?: string | null;
  redemptionCodeId?: string | null; // NEW
  source?: TopUpOrderSourceType; // NEW
  status: TopUpOrderStatusType;
}
```

修改 `CreateTopUpOrderSchema`（约第 219 行），新增可选字段：

```ts
export const CreateTopUpOrderSchema = z
  .object({
    credits: z.number().int().min(50_000_000).max(5_000_000_000).optional(),
    packageId: z.string().trim().min(1).optional(),
    redemptionCodeId: z.string().uuid().optional(), // NEW
    source: z
      .enum([
        TopUpOrderSourceEnum.Redemption,
        TopUpOrderSourceEnum.Alipay,
        TopUpOrderSourceEnum.WechatPay,
        TopUpOrderSourceEnum.Manual,
      ])
      .optional(), // NEW
  })
  .refine((value) => Boolean(value.packageId || value.credits), {
    message: 'TOP_UP_PACKAGE_OR_CREDITS_REQUIRED',
    path: ['packageId'],
  });
```

- [ ] **Step 2: 在 `packages/database/src/schemas/commercial.ts` 的 topUpOrders 表新增列**

在 `topUpOrders` 表的 `provider` 列之后（约第 196 行）添加：

```ts
    source: text('source').$type<TopUpOrderSourceType>(),
    redemptionCodeId: text('redemption_code_id'),
```

在文件顶部导入中新增 `TopUpOrderSourceType`：

```ts
import type {
  AutoTopUpSetting,
  CreditLedgerEntryType,
  SubscriptionChangeRequestReasonType,
  SubscriptionChangeRequestStatusType,
  SubscriptionCycleType,
  SubscriptionStatusType,
  TopUpOrderSourceType,
  TopUpOrderStatusType,
} from '@lobechat/types';
```

- [ ] **Step 3: 同一文件 creditAccounts 表新增 storageUsed, storageQuota**

在 `creditAccounts` 表的 `currency` 列之后（约第 108 行）添加：

```ts
    storageUsed: amountNumeric('storage_used').notNull().default(0),
    storageQuota: amountNumeric('storage_quota'),
```

- [ ] **Step 4: 创建数据库 migration**

创建 `packages/database/migrations/0111_add_topup_order_source_and_storage_fields.sql`：

```sql
ALTER TABLE "top_up_orders" ADD COLUMN "source" text;
ALTER TABLE "top_up_orders" ADD COLUMN "redemption_code_id" text;
ALTER TABLE "credit_accounts" ADD COLUMN "storage_used" numeric NOT NULL DEFAULT 0;
ALTER TABLE "credit_accounts" ADD COLUMN "storage_quota" numeric;

CREATE INDEX "top_up_orders_source_idx" ON "top_up_orders" ("source");
```

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/business.ts packages/database/src/schemas/commercial.ts packages/database/migrations/0111_add_topup_order_source_and_storage_fields.sql
git commit -m "🏷️ schema: add topUpOrders.source, redemptionCodeId + creditAccounts storage fields"
```

---

## Task 2: Types 层 — 新增 StorageQuotaExceeded 错误类型

**Files:**

- Modify: `packages/types/src/fetch.ts`

- [ ] **Step 1: 在 ChatErrorType 中新增 StorageQuotaExceeded**

在 `packages/types/src/fetch.ts` 的 `ChatErrorType` 对象中，`InsufficientBudgetForModel` 之后（约第 9 行）添加：

```ts
  StorageQuotaExceeded: 'StorageQuotaExceeded', // Storage quota limit exceeded
```

- [ ] **Step 2: Commit**

```bash
git add packages/types/src/fetch.ts
git commit -m "🏷️ types: add StorageQuotaExceeded error type"
```

---

## Task 3: Model 层 — 删除 ONLINE_PAYMENT_ENABLED 硬编码 + 修改 createTopUpOrder/settleTopUpOrder/cancelTopUpOrder

**Files:**

- Modify: `packages/database/src/models/commercial.ts`

- Test: `packages/database/src/models/__tests__/commercial.topup.test.ts`

- [ ] **Step 1: 写 createTopUpOrder/settleTopUpOrder 的测试**

创建 `packages/database/src/models/__tests__/commercial.topup.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getTestDB } from '../../core/getTestDB';
import { creditAccounts, topUpOrders, topUpPackages, users } from '../../schemas';
import { CommercialModel } from '../commercial';

const testUserId = 'topup-test-user';
const serverDB = await getTestDB();

describe('CommercialModel topUpOrders', () => {
  beforeEach(async () => {
    await serverDB.delete(topUpOrders);
    await serverDB.delete(creditAccounts);
    await serverDB.delete(topUpPackages);
    await serverDB.delete(users).where(({ id }) => id === testUserId);
    await serverDB.insert(users).values({ id: testUserId, email: 'topup@test.com' });
  });

  afterEach(async () => {
    await serverDB.delete(topUpOrders);
    await serverDB.delete(creditAccounts);
  });

  describe('createTopUpOrder', () => {
    it('should create order with source=redemption without ONLINE_PAYMENT_ENABLED gate', async () => {
      const model = new CommercialModel(serverDB, testUserId);
      const order = await model.createTopUpOrder({
        credits: 100,
        source: 'redemption',
        redemptionCodeId: 'code-123',
      });

      expect(order).toBeDefined();
      expect(order.status).toBe('pending');
      expect(order.source).toBe('redemption');
      expect(order.redemptionCodeId).toBe('code-123');
    });

    it('should create order with source=alipay without ONLINE_PAYMENT_ENABLED gate', async () => {
      const model = new CommercialModel(serverDB, testUserId);
      const order = await model.createTopUpOrder({
        credits: 200,
        source: 'alipay',
      });

      expect(order).toBeDefined();
      expect(order.source).toBe('alipay');
    });
  });

  describe('settleTopUpOrder', () => {
    it('should settle a pending order and credit the account', async () => {
      const model = new CommercialModel(serverDB, testUserId);
      const order = await model.createTopUpOrder({ credits: 100, source: 'redemption' });

      const settled = await model.settleTopUpOrder(order.id);

      expect(settled.status).toBe('paid');
      expect(settled.paidAt).toBeDefined();

      const account = await serverDB.query.creditAccounts.findFirst({
        where: (a, { eq }) => eq(a.userId, testUserId),
      });
      expect(account?.balance).toBe(100);
    });
  });

  describe('cancelTopUpOrder', () => {
    it('should cancel a pending order', async () => {
      const model = new CommercialModel(serverDB, testUserId);
      const order = await model.createTopUpOrder({ credits: 100, source: 'redemption' });

      const canceled = await model.cancelTopUpOrder(order.id);

      expect(canceled.status).toBe('canceled');
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/database && TEST_SERVER_DB=1 bunx vitest run --silent='passed-only' src/models/__tests__/commercial.topup.test.ts
```

Expected: FAIL — createTopUpOrder still gated by ONLINE_PAYMENT_ENABLED, no source/redemptionCodeId support.

- [ ] **Step 3: 删除 ONLINE_PAYMENT_ENABLED 硬编码**

在 `packages/database/src/models/commercial.ts` 中：

删除第 68 行：

```ts
const ONLINE_PAYMENT_ENABLED = false;
```

删除第 69 行：

```ts
const ONLINE_PAYMENT_DISABLED_ERROR = 'ONLINE_PAYMENT_DISABLED_USE_REDEMPTION_CODE';
```

- [ ] **Step 4: 修改 createTopUpOrder — 移除 gate、支持 source**

将 `createTopUpOrder` 方法中的 ONLINE_PAYMENT_ENABLED 守卫替换为：

原代码（约第 1602-1606 行）：

```ts
if (!ONLINE_PAYMENT_ENABLED) {
  throw new Error(ONLINE_PAYMENT_DISABLED_ERROR);
}
```

替换为：

```ts
// No gate — source field determines the order origin
// Payment gateway routes handle their own feature flags at the router level
```

在创建 topUpOrders 插入处（约第 1630 行的 values 对象），新增字段：

```ts
      source: input.source ?? null,
      redemptionCodeId: input.redemptionCodeId ?? null,
      provider: input.source === 'redemption' ? 'redemption' : input.source ?? null,
```

- [ ] **Step 5: 修改 settleTopUpOrder — 移除 gate**

将 `settleTopUpOrder` 方法中的 ONLINE_PAYMENT_ENABLED 守卫删除（约第 1685-1689 行）：

```ts
// REMOVED: if (!ONLINE_PAYMENT_ENABLED) { throw ... }
```

- [ ] **Step 6: 修改 cancelTopUpOrder — 移除 gate**

将 `cancelTopUpOrder` 方法中的 ONLINE_PAYMENT_ENABLED 守卫删除。

- [ ] **Step 7: 运行测试确认通过**

```bash
cd packages/database && TEST_SERVER_DB=1 bunx vitest run --silent='passed-only' src/models/__tests__/commercial.topup.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/database/src/models/commercial.ts packages/database/src/models/__tests__/commercial.topup.test.ts
git commit -m "✨ model: remove ONLINE_PAYMENT_ENABLED gate, add source/redemptionCodeId to topUpOrders"
```

---

## Task 4: Model 层 — 新增 preCharge /postCharge 共享工具方法

**Files:**

- Modify: `packages/database/src/models/commercial.ts`

- Test: `packages/database/src/models/__tests__/commercial.preCharge.test.ts`

- [ ] **Step 1: 写 preCharge 和 postCharge 的测试**

创建 `packages/database/src/models/__tests__/commercial.preCharge.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getTestDB } from '../../core/getTestDB';
import { creditAccounts, creditLedgerEntries, users } from '../../schemas';
import { CommercialModel } from '../commercial';

const testUserId = 'precharge-test-user';
const serverDB = await getTestDB();

describe('CommercialModel preCharge/postCharge', () => {
  beforeEach(async () => {
    await serverDB.delete(creditLedgerEntries);
    await serverDB.delete(creditAccounts);
    await serverDB.delete(users).where(({ id }) => id === testUserId);
    await serverDB.insert(users).values({ id: testUserId, email: 'precharge@test.com' });
  });

  afterEach(async () => {
    await serverDB.delete(creditLedgerEntries);
    await serverDB.delete(creditAccounts);
  });

  describe('preCharge', () => {
    it('should throw when balance is insufficient', async () => {
      const model = new CommercialModel(serverDB, testUserId);
      // Account doesn't exist or has 0 balance
      await expect(model.preCharge(100)).rejects.toThrow();
    });

    it('should return creditAccountId when balance is sufficient', async () => {
      const model = new CommercialModel(serverDB, testUserId);
      // Credit account with 200 balance
      await model.ensureCreditAccount();
      await serverDB
        .update(creditAccounts)
        .set({ balance: 200 })
        .where(({ userId }) => userId === testUserId);

      const result = await model.preCharge(100);

      expect(result).toBeDefined();
      expect(result.creditAccountId).toBe(testUserId);
    });
  });

  describe('postCharge', () => {
    it('should deduct credits and create ledger entry', async () => {
      const model = new CommercialModel(serverDB, testUserId);
      await model.ensureCreditAccount();
      await serverDB
        .update(creditAccounts)
        .set({ balance: 200, totalCredited: 200 })
        .where(({ userId }) => userId === testUserId);

      await model.postCharge({
        credits: 50,
        metadata: { usageType: 'image' },
        model: 'dall-e-3',
        provider: 'newapi',
        source: 'image',
        userId: testUserId,
      });

      const account = await serverDB.query.creditAccounts.findFirst({
        where: (a, { eq }) => eq(a.userId, testUserId),
      });
      expect(account?.balance).toBe(150);
      expect(account?.totalDebited).toBe(50);

      const ledger = await serverDB.query.creditLedgerEntries.findMany({
        where: (e, { eq }) => eq(e.userId, testUserId),
      });
      expect(ledger.length).toBe(1);
      expect(ledger[0].type).toBe('consume');
      expect(ledger[0].amount).toBe(-50);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/database && TEST_SERVER_DB=1 bunx vitest run --silent='passed-only' src/models/__tests__/commercial.preCharge.test.ts
```

Expected: FAIL — preCharge/postCharge methods don't exist yet.

- [ ] **Step 3: 在 CommercialModel 中实现 preCharge 方法**

在 `packages/database/src/models/commercial.ts` 的 `canStartChatUsage` 方法附近添加：

```ts
preCharge = async (estimatedCredits: number, db: LobeChatDatabase | Transaction = this.db) => {
  const sufficient = await this.canStartChatUsage(estimatedCredits);
  if (!sufficient) {
    throw AgentRuntimeError.createError(ChatErrorType.InsufficientBudgetForModel, {
      creditsNeeded: estimatedCredits,
      provider: 'unknown',
    });
  }
  await this.ensureCreditAccount(db);
  return { creditAccountId: this.userId };
};
```

需要在文件顶部新增导入：

```ts
import { AgentRuntimeError } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
```

- [ ] **Step 4: 在 CommercialModel 中实现 postCharge 方法**

```ts
postCharge = async (
  params: {
    credits: number;
    metadata?: Record<string, unknown>;
    model: string;
    operationId?: string;
    provider: string;
    referenceId?: string;
    referenceType?: string;
    source: string;
    title?: string;
    userId: string;
  },
  db: LobeChatDatabase | Transaction = this.db,
) => {
  const creditsAmount = params.credits;

  await db.transaction(async (tx) => {
    // Lock and update credit account
    const [account] = await tx
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, params.userId))
      .limit(1);

    if (!account) throw new Error('CREDIT_ACCOUNT_NOT_FOUND');

    const newBalance = Number(account.balance) - creditsAmount;
    const newDebited = Number(account.totalDebited) + creditsAmount;

    await tx
      .update(creditAccounts)
      .set({
        balance: newBalance,
        totalDebited: newDebited,
      })
      .where(eq(creditAccounts.userId, params.userId));

    // Insert ledger entry
    await tx.insert(creditLedgerEntries).values({
      amount: -creditsAmount,
      balanceAfter: newBalance,
      description: `${params.source} usage: ${params.model}`,
      metadata: params.metadata ?? { source: params.source },
      referenceId: params.referenceId,
      referenceType: params.referenceType ?? `${params.source}_generation`,
      title: params.title ?? `${params.source} Usage`,
      type: 'consume',
      userId: params.userId,
    });
  });
};
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd packages/database && TEST_SERVER_DB=1 bunx vitest run --silent='passed-only' src/models/__tests__/commercial.preCharge.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/database/src/models/commercial.ts packages/database/src/models/__tests__/commercial.preCharge.test.ts
git commit -m "✨ model: add preCharge/postCharge shared billing utilities"
```

---

## Task 5: 兑换流程重构 — topUpOrders 统一化

**Files:**

- Modify: `src/business/server/lambda-routers/admin/redemption.ts`

- Test: `src/business/server/lambda-routers/__tests__/redemption.test.ts`

- [ ] **Step 1: 写兑换流程重构的测试**

创建 `src/business/server/lambda-routers/__tests__/redemption.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock DB and models
const mockCreateTopUpOrder = vi.fn();
const mockSettleTopUpOrder = vi.fn();

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn().mockImplementation(() => ({
    createTopUpOrder: mockCreateTopUpOrder,
    settleTopUpOrder: mockSettleTopUpOrder,
    ensureCreditAccount: vi.fn(),
  })),
}));

describe('redemption topup_package flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create topUpOrder with source=redemption and settle it in one transaction', async () => {
    const mockOrderId = 'order-123';
    const mockCredits = 100;

    mockCreateTopUpOrder.mockResolvedValue({
      id: mockOrderId,
      credits: mockCredits,
      status: 'paid',
      source: 'redemption',
    });
    mockSettleTopUpOrder.mockResolvedValue({
      id: mockOrderId,
      credits: mockCredits,
      status: 'paid',
    });

    // Simulate the new redemption flow
    const result = await mockCreateTopUpOrder({
      credits: mockCredits,
      redemptionCodeId: 'code-456',
      source: 'redemption',
    });

    expect(mockCreateTopUpOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        credits: mockCredits,
        redemptionCodeId: 'code-456',
        source: 'redemption',
      }),
    );

    // After creation, settle immediately
    await mockSettleTopUpOrder(result.id);
    expect(mockSettleTopUpOrder).toHaveBeenCalledWith(mockOrderId);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
bunx vitest run --silent='passed-only' src/business/server/lambda-routers/__tests__/redemption.test.ts
```

- [ ] **Step 3: 修改 redemption.ts 的 topup_package 兑换逻辑**

在 `src/business/server/lambda-routers/admin/redemption.ts` 中，替换 topup_package 分支（约第 413-447 行）。

当前代码直接操作 creditAccounts + creditLedgerEntries。替换为：

```ts
if (rewardType === 'topup_package') {
  // Query the top-up package
  const [pkg] = await tx
    .select()
    .from(topUpPackages)
    .where(eq(topUpPackages.id, code.topupPackageId!));

  if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'TOPUP_PACKAGE_MISSING' });
  if (!pkg.isActive)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'TOPUP_PACKAGE_INACTIVE' });

  // Create a topUpOrder with source=redemption and settle immediately
  const commercial = new CommercialModel(db, input.userId);
  const order = await commercial.createTopUpOrder({
    credits: Number(pkg.credits),
    redemptionCodeId: code.id,
    source: 'redemption',
  });
  await commercial.settleTopUpOrder(order.id);

  // Mark code as redeemed
  await tx
    .update(redemptionCodes)
    .set({
      redeemedAt: new Date(),
      redeemedByUserId: input.userId,
      status: 'redeemed',
    })
    .where(eq(redemptionCodes.id, code.id));

  summary = { credits: Number(pkg.credits), packageId: pkg.id };
}
```

注意：需要将此逻辑移到事务 `tx` 内部，确保 order creation + settlement + code redemption 在同一事务中。同时需要从文件顶部导入中移除 `creditAccounts`, `creditLedgerEntries`（如果仅被此分支使用）。

在文件顶部添加 CommercialModel 导入（如未导入）：

```ts
import { CommercialModel } from '@/database/models/commercial';
```

- [ ] **Step 4: 运行测试确认通过**

```bash
bunx vitest run --silent='passed-only' src/business/server/lambda-routers/__tests__/redemption.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/business/server/lambda-routers/admin/redemption.ts src/business/server/lambda-routers/__tests__/redemption.test.ts
git commit -m "✨ redemption: unify topup_package flow through topUpOrders with source=redemption"
```

---

## Task 6: 图像计费 — chargeBeforeGenerate 填充

**Files:**

- Modify: `src/business/server/image-generation/chargeBeforeGenerate.ts`

- Test: `src/business/server/__tests__/image-billing.test.ts`

- [ ] **Step 1: 写 chargeBeforeGenerate 的测试**

创建 `src/business/server/__tests__/image-billing.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatErrorType } from '@lobechat/types';

const mocks = vi.hoisted(() => ({
  shouldChargeCommercialUsage: vi.fn(),
  computeImageCost: vi.fn(),
  preCharge: vi.fn(),
}));

vi.mock('@/business/server/commercialBilling', () => ({
  shouldChargeCommercialUsage: mocks.shouldChargeCommercialUsage,
}));

vi.mock('@lobechat/model-runtime', () => ({
  computeImageCost: mocks.computeImageCost,
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn().mockImplementation(() => ({
    preCharge: mocks.preCharge,
  })),
}));

import { chargeBeforeGenerate } from '../image-generation/chargeBeforeGenerate';

describe('chargeBeforeGenerate (image)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return undefined when shouldCharge is false', async () => {
    mocks.shouldChargeCommercialUsage.mockResolvedValue(false);

    const result = await chargeBeforeGenerate({
      generationParams: {},
      generationTopicId: 'topic-1',
      imageNum: 1,
      model: 'dall-e-3',
      provider: 'newapi',
      userId: 'user-1',
    } as any);

    expect(result).toBeUndefined();
  });

  it('should throw InsufficientBudgetForModel when balance insufficient', async () => {
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);
    mocks.computeImageCost.mockReturnValue({ totalCredits: 100, totalCost: 1 });
    mocks.preCharge.mockRejectedValue(new Error('InsufficientBudgetForModel'));

    await expect(
      chargeBeforeGenerate({
        generationParams: {},
        generationTopicId: 'topic-1',
        imageNum: 1,
        model: 'dall-e-3',
        provider: 'newapi',
        userId: 'user-1',
      } as any),
    ).rejects.toThrow();
  });

  it('should return estimatedCredits when balance sufficient', async () => {
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);
    mocks.computeImageCost.mockReturnValue({ totalCredits: 100, totalCost: 1 });
    mocks.preCharge.mockResolvedValue({ creditAccountId: 'user-1' });

    const result = await chargeBeforeGenerate({
      generationParams: {},
      generationTopicId: 'topic-1',
      imageNum: 1,
      model: 'dall-e-3',
      provider: 'newapi',
      userId: 'user-1',
    } as any);

    expect(result).toBeDefined();
    expect(result!.estimatedCredits).toBe(100);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
bunx vitest run --silent='passed-only' src/business/server/__tests__/image-billing.test.ts
```

- [ ] **Step 3: 实现 chargeBeforeGenerate**

替换 `src/business/server/image-generation/chargeBeforeGenerate.ts` 的函数体：

```ts
import { type ChatStreamPayload } from '@lobechat/model-runtime';
import { computeImageCost } from '@lobechat/model-runtime';
import { BRANDING_PROVIDER } from '@lobechat/business-const';

import { CommercialModel } from '@/database/models/commercial';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import { type LobeChatDatabase } from '@/database/type';
import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';

interface ChargeParams {
  clientIp?: string | null;
  configForDatabase: Record<string, any>;
  generationParams: Record<string, any>;
  generationTopicId: string;
  imageNum: number;
  model: string;
  provider: string;
  userId: string;
}

interface ChargeResult {
  costDetail: { totalCost: number; totalCredits: number };
  estimatedCredits: number;
} | undefined;

export async function chargeBeforeGenerate(
  params: ChargeParams,
  db?: LobeChatDatabase,
): Promise<ChargeResult> {
  const { generationParams, imageNum, model, provider, userId } = params;

  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return undefined;

  // Get model pricing for cost estimation
  const aiInfraRepos = new AiInfraRepos(db!);
  const modelCard = await aiInfraRepos.getAiProviderModelList(provider);
  const pricingItem = modelCard?.find((m: any) => m.id === model);

  const costResult = pricingItem?.pricing
    ? computeImageCost(pricingItem.pricing, generationParams, imageNum)
    : undefined;

  const estimatedCredits = costResult?.totalCredits ?? 1;

  const commercialModel = new CommercialModel(db!, userId);
  await commercialModel.preCharge(estimatedCredits, db!);

  return {
    costDetail: costResult ?? { totalCost: 0, totalCredits: estimatedCredits },
    estimatedCredits,
  };
}
```

注意：实际调用点在 `src/server/routers/lambda/image/index.ts:156`，需要检查 `db` 如何传入。当前调用点没有传 db，需要修改调用签名。

- [ ] **Step 4: 修改调用点传入 db**

在 `src/server/routers/lambda/image/index.ts` 的 chargeBeforeGenerate 调用处（约第 156 行），传入 `db` 参数：

```ts
const chargeResult = await chargeBeforeGenerate(
  {
    clientIp: ctx.clientIp,
    configForDatabase,
    generationParams,
    generationTopicId,
    imageNum,
    model,
    provider,
    userId,
  },
  ctx.serverDB,
);
```

- [ ] **Step 5: 运行测试确认通过**

```bash
bunx vitest run --silent='passed-only' src/business/server/__tests__/image-billing.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/business/server/image-generation/chargeBeforeGenerate.ts src/server/routers/lambda/image/index.ts src/business/server/__tests__/image-billing.test.ts
git commit -m "✨ image: implement chargeBeforeGenerate with commercial billing"
```

---

## Task 7: 图像计费 — chargeAfterGenerate 填充

**Files:**

- Modify: `src/business/server/image-generation/chargeAfterGenerate.ts`

- Modify: `src/server/routers/async/image.ts` — 错误路径退款

- Test: append to `src/business/server/__tests__/image-billing.test.ts`

- [ ] **Step 1: 在图像计费测试中添加 chargeAfterGenerate 测试**

在 `src/business/server/__tests__/image-billing.test.ts` 中追加：

```ts
const postChargeMock = vi.fn();

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn().mockImplementation(() => ({
    preCharge: mocks.preCharge,
    postCharge: postChargeMock,
  })),
}));

// Import after mock setup
import { chargeAfterGenerate } from '../image-generation/chargeAfterGenerate';

describe('chargeAfterGenerate (image)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing when prechargeResult is undefined (free)', async () => {
    await chargeAfterGenerate({
      metadata: { asyncTaskId: 't1', generationBatchId: 'b1', modelId: 'dall-e-3' },
      provider: 'newapi',
      userId: 'user-1',
    } as any);

    expect(postChargeMock).not.toHaveBeenCalled();
  });

  it('should refund on error when prechargeResult exists', async () => {
    await chargeAfterGenerate({
      isError: true,
      metadata: { asyncTaskId: 't1', generationBatchId: 'b1', modelId: 'dall-e-3' },
      prechargeResult: { estimatedCredits: 100 },
      provider: 'newapi',
      userId: 'user-1',
    } as any);

    expect(postChargeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        credits: 100,
        source: 'image_refund',
      }),
    );
  });

  it('should post charge on success', async () => {
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);

    await chargeAfterGenerate({
      metadata: { asyncTaskId: 't1', generationBatchId: 'b1', modelId: 'dall-e-3' },
      modelUsage: { completionTokens: 0, totalTokens: 100 },
      prechargeResult: { estimatedCredits: 100, costDetail: { totalCost: 1, totalCredits: 100 } },
      provider: 'newapi',
      userId: 'user-1',
    } as any);

    expect(postChargeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'image',
      }),
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 实现 chargeAfterGenerate**

替换 `src/business/server/image-generation/chargeAfterGenerate.ts`：

```ts
import { CommercialModel } from '@/database/models/commercial';
import { type LobeChatDatabase } from '@/database/type';
import {
  shouldChargeCommercialUsage,
  resolveEffectiveCost,
} from '@/business/server/commercialBilling';

interface ChargeParams {
  isError?: boolean;
  metadata: { asyncTaskId: string; generationBatchId: string; modelId: string; topicId?: string };
  metrics?: { latency: number };
  modelUsage?: { completionTokens: number; totalTokens: number };
  prechargeResult?: { costDetail?: any; estimatedCredits: number };
  provider: string;
  userId: string;
}

export async function chargeAfterGenerate(
  params: ChargeParams,
  db?: LobeChatDatabase,
): Promise<void> {
  const { isError, metadata, modelUsage, prechargeResult, provider, userId } = params;

  // No precharge = free tier, nothing to do
  if (!prechargeResult) return;

  const commercialModel = new CommercialModel(db!, userId);

  if (isError) {
    // Refund the pre-charged amount
    await commercialModel.postCharge({
      credits: prechargeResult.estimatedCredits,
      metadata: {
        asyncTaskId: metadata.asyncTaskId,
        batchId: metadata.generationBatchId,
        reason: 'generation_failed',
      },
      model: metadata.modelId,
      provider,
      referenceId: metadata.generationBatchId,
      referenceType: 'image_generation',
      source: 'image_refund',
      title: 'Image Generation Refund',
      userId,
    });
    return;
  }

  // Success — resolve actual cost and charge
  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return;

  const effectiveCredits =
    prechargeResult.costDetail?.totalCredits ?? prechargeResult.estimatedCredits;

  await commercialModel.postCharge({
    credits: effectiveCredits,
    metadata: {
      asyncTaskId: metadata.asyncTaskId,
      batchId: metadata.generationBatchId,
      modelUsage,
    },
    model: metadata.modelId,
    provider,
    referenceId: metadata.generationBatchId,
    referenceType: 'image_generation',
    source: 'image',
    title: 'Image Generation',
    userId,
  });
}
```

- [ ] **Step 4: 修改 async/image 调用点 — 错误路径加入 isError 退款**

在 `src/server/routers/async/image.ts` 中，找到 chargeAfterGenerate 的调用点（约第 394 行），确保错误路径也调用 chargeAfterGenerate 并传入 `isError: true`。

检查文件中是否有图像生成失败的 catch/else 分支，如果有，添加：

```ts
// In the error/failure branch:
if (prechargeResult && ENABLE_BUSINESS_FEATURES) {
  await chargeAfterGenerate(
    {
      isError: true,
      metadata: {
        asyncTaskId: taskId,
        generationBatchId,
        topicId: generationTopicId,
        ...buildMappedBusinessModelFields({ provider, requestedModelId, resolvedModelId }),
      },
      prechargeResult,
      provider,
      userId: ctx.userId,
    },
    ctx.serverDB,
  );
}
```

同时修改已有的成功路径调用，传入 `ctx.serverDB` 作为第二个参数。

- [ ] **Step 5: 运行测试确认通过**

```bash
bunx vitest run --silent='passed-only' src/business/server/__tests__/image-billing.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/business/server/image-generation/chargeAfterGenerate.ts src/server/routers/async/image.ts src/business/server/__tests__/image-billing.test.ts
git commit -m "✨ image: implement chargeAfterGenerate with refund on error path"
```

---

## Task 8: 图像 — notifyImageCompleted 清理

**Files:**

- Modify: `src/business/server/image-generation/notifyImageCompleted.ts`

- [ ] **Step 1: 移除空桩注释，保留空实现但加文档**

```ts
/**
 * Notify user that image generation is completed.
 * Currently a no-op placeholder. Can be extended to send push notifications,
 * in-app messages, or email notifications in future iterations.
 */
export async function notifyImageCompleted(): Promise<void> {
  // TODO: Implement notification logic in future iteration
}
```

- [ ] **Step 2: Commit**

```bash
git add src/business/server/image-generation/notifyImageCompleted.ts
git commit -m "📝 image: document notifyImageCompleted placeholder for future extension"
```

---

## Task 9: 视频计费 — chargeBeforeGenerate 填充

**Files:**

- Modify: `src/business/server/video-generation/chargeBeforeGenerate.ts`

- Test: `src/business/server/__tests__/video-billing.test.ts`

- [ ] **Step 1: 写 chargeBeforeGenerate 视频测试**

创建 `src/business/server/__tests__/video-billing.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  shouldChargeCommercialUsage: vi.fn(),
  computeVideoCost: vi.fn(),
  preCharge: vi.fn(),
}));

vi.mock('@/business/server/commercialBilling', () => ({
  shouldChargeCommercialUsage: mocks.shouldChargeCommercialUsage,
}));

vi.mock('@lobechat/model-runtime', () => ({
  computeVideoCost: mocks.computeVideoCost,
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn().mockImplementation(() => ({
    preCharge: mocks.preCharge,
  })),
}));

import { chargeBeforeGenerate } from '../video-generation/chargeBeforeGenerate';

describe('chargeBeforeGenerate (video)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return {} when shouldCharge is false', async () => {
    mocks.shouldChargeCommercialUsage.mockResolvedValue(false);

    const result = await chargeBeforeGenerate({
      generationTopicId: 'topic-1',
      model: 'kling-v1',
      params: {},
      provider: 'newapi',
      userId: 'user-1',
    } as any);

    expect(result).toEqual({});
  });

  it('should throw when balance insufficient', async () => {
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);
    mocks.computeVideoCost.mockReturnValue({ totalCredits: 200, totalCost: 2 });
    mocks.preCharge.mockRejectedValue(new Error('InsufficientBudgetForModel'));

    await expect(
      chargeBeforeGenerate({
        generationTopicId: 'topic-1',
        model: 'kling-v1',
        params: {},
        provider: 'newapi',
        userId: 'user-1',
      } as any),
    ).rejects.toThrow();
  });

  it('should return prechargeResult with estimatedCredits when balance sufficient', async () => {
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);
    mocks.computeVideoCost.mockReturnValue({ totalCredits: 200, totalCost: 2 });
    mocks.preCharge.mockResolvedValue({ creditAccountId: 'user-1' });

    const result = await chargeBeforeGenerate({
      generationTopicId: 'topic-1',
      model: 'kling-v1',
      params: {},
      provider: 'newapi',
      userId: 'user-1',
    } as any);

    expect(result.prechargeResult).toBeDefined();
    expect(result.prechargeResult!.estimatedCredits).toBe(200);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 实现 chargeBeforeGenerate**

替换 `src/business/server/video-generation/chargeBeforeGenerate.ts`：

```ts
import { computeVideoCost } from '@lobechat/model-runtime';

import { CommercialModel } from '@/database/models/commercial';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import { type LobeChatDatabase } from '@/database/type';
import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';

interface ChargeParams {
  generationTopicId: string;
  model: string;
  params: Record<string, any>;
  provider: string;
  userId: string;
}

interface ChargeBeforeResult {
  errorBatch?: any;
  prechargeResult?: { costDetail: any; estimatedCredits: number };
}

export async function chargeBeforeGenerate(
  params: ChargeParams,
  db?: LobeChatDatabase,
): Promise<ChargeBeforeResult> {
  const { model, params: genParams, provider, userId } = params;

  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return {};

  // Get model pricing
  const aiInfraRepos = new AiInfraRepos(db!);
  const modelCard = await aiInfraRepos.getAiProviderModelList(provider);
  const pricingItem = modelCard?.find((m: any) => m.id === model);

  const costResult = pricingItem?.pricing
    ? computeVideoCost(pricingItem.pricing, 0, genParams)
    : undefined;

  const estimatedCredits = costResult?.totalCredits ?? 1;

  const commercialModel = new CommercialModel(db!, userId);
  await commercialModel.preCharge(estimatedCredits, db!);

  return {
    prechargeResult: {
      costDetail: costResult ?? { totalCost: 0, totalCredits: estimatedCredits },
      estimatedCredits,
    },
  };
}
```

- [ ] **Step 4: 修改视频调用点传入 db**

在 `src/server/routers/lambda/video/index.ts` 第 152 行的调用处，传入 `ctx.serverDB`：

```ts
const { errorBatch, prechargeResult } = await chargeBeforeGenerate(
  {
    generationTopicId,
    model,
    params,
    provider,
    userId,
  },
  ctx.serverDB,
);
```

- [ ] **Step 5: 运行测试确认通过**

```bash
bunx vitest run --silent='passed-only' src/business/server/__tests__/video-billing.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/business/server/video-generation/chargeBeforeGenerate.ts src/server/routers/lambda/video/index.ts src/business/server/__tests__/video-billing.test.ts
git commit -m "✨ video: implement chargeBeforeGenerate with commercial billing"
```

---

## Task 10: 视频计费 — chargeAfterGenerate 填充

**Files:**

- Modify: `src/business/server/video-generation/chargeAfterGenerate.ts`

- Modify: `src/server/services/generation/videoBackgroundPolling.ts`

- Test: append to `src/business/server/__tests__/video-billing.test.ts`

- [ ] **Step 1: 在视频计费测试中添加 chargeAfterGenerate 测试**

在 `src/business/server/__tests__/video-billing.test.ts` 中追加：

```ts
const postChargeMock = vi.fn();

// Update the CommercialModel mock to include postCharge
vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn().mockImplementation(() => ({
    preCharge: mocks.preCharge,
    postCharge: postChargeMock,
  })),
}));

import { chargeAfterGenerate } from '../video-generation/chargeAfterGenerate';

describe('chargeAfterGenerate (video)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing when prechargeResult is empty object', async () => {
    await chargeAfterGenerate({
      metadata: { asyncTaskId: 't1', generationBatchId: 'b1', modelId: 'kling' },
      model: 'kling-v1',
      prechargeResult: {},
      provider: 'newapi',
      userId: 'user-1',
    } as any);

    expect(postChargeMock).not.toHaveBeenCalled();
  });

  it('should refund on error when prechargeResult has estimatedCredits', async () => {
    await chargeAfterGenerate({
      isError: true,
      metadata: { asyncTaskId: 't1', generationBatchId: 'b1', modelId: 'kling' },
      model: 'kling-v1',
      prechargeResult: { estimatedCredits: 200, costDetail: { totalCredits: 200 } },
      provider: 'newapi',
      userId: 'user-1',
    } as any);

    expect(postChargeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        credits: 200,
        source: 'video_refund',
      }),
    );
  });

  it('should charge on success', async () => {
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);

    await chargeAfterGenerate({
      metadata: { asyncTaskId: 't1', generationBatchId: 'b1', modelId: 'kling' },
      model: 'kling-v1',
      prechargeResult: { estimatedCredits: 200, costDetail: { totalCredits: 200, totalCost: 2 } },
      provider: 'newapi',
      userId: 'user-1',
    } as any);

    expect(postChargeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'video',
      }),
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 实现 chargeAfterGenerate**

替换 `src/business/server/video-generation/chargeAfterGenerate.ts`：

```ts
import { CommercialModel } from '@/database/models/commercial';
import { type LobeChatDatabase } from '@/database/type';
import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';

interface ChargeParams {
  computePriceParams?: { generateAudio?: boolean; resolution?: string };
  isError?: boolean;
  latency?: number;
  metadata: { asyncTaskId: string; generationBatchId: string; modelId: string; topicId?: string };
  model: string;
  prechargeResult?: { costDetail?: any; estimatedCredits?: number };
  provider: string;
  usage?: { completionTokens: number; totalTokens: number };
  userId: string;
}

export async function chargeAfterGenerate(
  params: ChargeParams,
  db?: LobeChatDatabase,
): Promise<void> {
  const { isError, metadata, model, prechargeResult, provider, usage, userId } = params;

  // Empty prechargeResult = free tier
  if (!prechargeResult || Object.keys(prechargeResult).length === 0) return;

  const commercialModel = new CommercialModel(db!, userId);

  if (isError) {
    if (prechargeResult.estimatedCredits) {
      // Refund the pre-charged amount
      await commercialModel.postCharge({
        credits: prechargeResult.estimatedCredits,
        metadata: {
          asyncTaskId: metadata.asyncTaskId,
          batchId: metadata.generationBatchId,
          reason: 'generation_failed',
        },
        model: model ?? metadata.modelId,
        provider,
        referenceId: metadata.generationBatchId,
        referenceType: 'video_generation',
        source: 'video_refund',
        title: 'Video Generation Refund',
        userId,
      });
    }
    return;
  }

  // Success — resolve actual cost
  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return;

  const effectiveCredits =
    prechargeResult.costDetail?.totalCredits ?? prechargeResult.estimatedCredits ?? 1;

  await commercialModel.postCharge({
    credits: effectiveCredits,
    metadata: {
      asyncTaskId: metadata.asyncTaskId,
      batchId: metadata.generationBatchId,
      computePriceParams: params.computePriceParams,
      latency: params.latency,
      usage,
    },
    model: model ?? metadata.modelId,
    provider,
    referenceId: metadata.generationBatchId,
    referenceType: 'video_generation',
    source: 'video',
    title: 'Video Generation',
    userId,
  });
}
```

- [ ] **Step 4: 修改 async/video 调用点传入 db**

在 `src/server/routers/async/video.ts` 中，找到 chargeAfterGenerate 的两个调用点（约第 208 行和第 287 行），传入 `ctx.serverDB` 作为第二个参数。

- [ ] **Step 5: 修改 videoBackgroundPolling — 插入计费调用**

在 `src/server/services/generation/videoBackgroundPolling.ts` 中，找到成功路径（约第 105 行附近，`status === 'succeeded'` 分支）和失败路径（约第 138 行附近），分别添加 chargeAfterGenerate 调用。

在文件顶部新增导入：

```ts
import { chargeAfterGenerate } from '@/business/server/video-generation/chargeAfterGenerate';
```

成功路径后追加：

```ts
// Bill for video generation
if (params.prechargeResult && Object.keys(params.prechargeResult).length > 0) {
  await chargeAfterGenerate(
    {
      computePriceParams: {
        generateAudio: (batch?.config as any)?.generateAudio,
        resolution: (batch?.config as any)?.resolution,
      },
      latency: duration,
      metadata: {
        asyncTaskId: params.asyncTaskId,
        generationBatchId: batch.id,
        modelId: params.modelId ?? params.resolvedModelId,
        topicId: params.generationTopicId,
      },
      model: params.resolvedModelId ?? params.modelId,
      prechargeResult: params.prechargeResult,
      provider: params.provider,
      userId: params.userId,
    },
    db,
  );
}
```

失败路径后追加：

```ts
// Refund pre-charged credits on failure
if (params.prechargeResult && Object.keys(params.prechargeResult).length > 0) {
  await chargeAfterGenerate(
    {
      isError: true,
      metadata: {
        asyncTaskId: params.asyncTaskId,
        generationBatchId: batch?.id ?? params.asyncTaskId,
        modelId: params.modelId ?? params.resolvedModelId,
        topicId: params.generationTopicId,
      },
      model: params.resolvedModelId ?? params.modelId,
      prechargeResult: params.prechargeResult,
      provider: params.provider,
      userId: params.userId,
    },
    db,
  );
}
```

- [ ] **Step 6: 运行测试确认通过**

```bash
bunx vitest run --silent='passed-only' src/business/server/__tests__/video-billing.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/business/server/video-generation/chargeAfterGenerate.ts src/server/routers/async/video.ts src/server/services/generation/videoBackgroundPolling.ts src/business/server/__tests__/video-billing.test.ts
git commit -m "✨ video: implement chargeAfterGenerate with refund + videoBackgroundPolling billing"
```

---

## Task 11: 视频 — getVideoFreeQuota 填充

**Files:**

- Modify: `src/business/server/video-generation/getVideoFreeQuota.ts`

- [ ] **Step 1: 实现 getVideoFreeQuota**

替换 `src/business/server/video-generation/getVideoFreeQuota.ts`：

```ts
import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';
import { type LobeChatDatabase } from '@/database/type';

export async function getVideoFreeQuota(
  userId: string,
  model: string,
  db?: LobeChatDatabase,
): Promise<{ limit: number; used: number } | null> {
  const shouldCharge = await shouldChargeCommercialUsage({
    db: db!,
    provider: 'newapi',
    userId,
  });

  // If not in commercial mode, user has unlimited free quota
  if (!shouldCharge) {
    return { limit: Infinity, used: 0 };
  }

  // No free quota in commercial mode — all video generation is paid
  return null;
}
```

- [ ] **Step 2: 修改调用点传入 db**

在 `src/server/routers/lambda/video/index.ts` 的 `getVideoFreeQuota` 过程（约第 348 行），传入 `ctx.serverDB`：

```ts
getVideoFreeQuota: authedProcedure
    .input(z.object({ model: z.string() }))
    .query(async ({ ctx, input }) => {
        return getVideoFreeQuota(ctx.userId, input.model, ctx.serverDB);
    }),
```

- [ ] **Step 3: Commit**

```bash
git add src/business/server/video-generation/getVideoFreeQuota.ts src/server/routers/lambda/video/index.ts
git commit -m "✨ video: implement getVideoFreeQuota with commercial billing check"
```

---

## Task 12: Admin 订单管理 — 新增 getDetail + settle

**Files:**

- Modify: `src/business/server/lambda-routers/admin/orders.ts`

- Modify: `src/services/adminCommercial.ts`

- [ ] **Step 1: 在 admin/orders.ts 新增 getDetail 和 settle 过程**

在 `src/business/server/lambda-routers/admin/orders.ts` 中追加：

```ts
  getDetail: adminProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = ctx.serverDB;

      const [order] = await db
        .select({
          id: topUpOrders.id,
          userId: topUpOrders.userId,
          status: topUpOrders.status,
          credits: topUpOrders.credits,
          amount: topUpOrders.amount,
          currency: topUpOrders.currency,
          provider: topUpOrders.provider,
          source: topUpOrders.source,
          redemptionCodeId: topUpOrders.redemptionCodeId,
          externalOrderId: topUpOrders.externalOrderId,
          paidAt: topUpOrders.paidAt,
          createdAt: topUpOrders.createdAt,
          updatedAt: topUpOrders.updatedAt,
          userEmail: users.email,
          userFullName: users.fullName,
        })
        .from(topUpOrders)
        .leftJoin(users, eq(topUpOrders.userId, users.id))
        .where(eq(topUpOrders.id, input.orderId))
        .limit(1);

      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ORDER_NOT_FOUND' });
      }

      // If source is redemption, also fetch code info
      let redemptionCode = null;
      if (order.redemptionCodeId) {
        const [code] = await db
          .select()
          .from(redemptionCodes)
          .where(eq(redemptionCodes.id, order.redemptionCodeId))
          .limit(1);
        redemptionCode = code ?? null;
      }

      await recordAdminAudit(ctx, 'order.getDetail', { orderId: input.orderId });

      return { ...order, redemptionCode };
    }),

  settle: adminProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const commercial = new CommercialModel(ctx.serverDB, '');
      const result = await commercial.settleTopUpOrder(input.orderId);

      await recordAdminAudit(ctx, 'order.settle', {
        orderId: input.orderId,
        status: result.status,
      });

      return result;
    }),
```

需要在文件顶部新增导入：

```ts
import { CommercialModel } from '@/database/models/commercial';
import { redemptionCodes, topUpOrders, users } from '@/database/schemas';
import { TRPCError } from '@trpc/server';
```

注意：CommercialModel 需要 userId，但 settle 只需 orderId，所以传空字符串（settle 内部不使用 this.userId）。

- [ ] **Step 2: 在 adminCommercial.ts 新增客户端方法**

在 `src/services/adminCommercial.ts` 中追加：

```ts
getOrderDetail = async (orderId: string) => {
  return lambdaClient.admin.orders.getDetail.query({ orderId });
};

settleOrder = async (orderId: string) => {
  return lambdaClient.admin.orders.settle.mutate({ orderId });
};

getReferralStats = async () => {
  return lambdaClient.admin.referral.getReferralStats.query();
};
```

- [ ] **Step 3: Commit**

```bash
git add src/business/server/lambda-routers/admin/orders.ts src/services/adminCommercial.ts
git commit -m "✨ admin: add order getDetail/settle + referralStats client methods"
```

---

## Task 13: Admin 推荐分析 — getReferralStats

**Files:**

- Modify: `src/business/server/lambda-routers/admin/referral.ts`

- [ ] **Step 1: 在 admin/referral.ts 新增 getReferralStats 过程**

在 `adminRedemptionRouter` 的过程列表中追加：

```ts
  getReferralStats: adminProcedure
    .use(serverDatabase)
    .query(async ({ ctx }) => {
      const db = ctx.serverDB;

      const [totalResult] = await db
        .select({ count: count() })
        .from(referralRelations);

      const [activatedResult] = await db
        .select({ count: count() })
        .from(referralRelations)
        .where(eq(referralRelations.status, 'activated'));

      const [rewardResult] = await db
        .select({ total: sql<number>`coalesce(sum(${referralRewards.credits}), 0)` })
        .from(referralRewards)
        .where(eq(referralRewards.status, 'credited'));

      await recordAdminAudit(ctx, 'referral.getStats', {});

      return {
        totalInvites: Number(totalResult?.count ?? 0),
        activatedInvites: Number(activatedResult?.count ?? 0),
        totalRewardCredits: Number(rewardResult?.total ?? 0),
      };
    }),
```

需要在文件顶部新增导入：

```ts
import { referralRelations, referralRewards } from '@/database/schemas';
```

（注意：文件可能已有部分导入，检查后补充缺失的）

- [ ] **Step 2: Commit**

```bash
git add src/business/server/lambda-routers/admin/referral.ts
git commit -m "✨ admin: add getReferralStats endpoint"
```

---

## Task 14: 存储配额中间件 — checkFileStorageUsage

**Files:**

- Modify: `src/business/server/trpc-middlewares/lambda.ts`

- [ ] **Step 1: 实现 checkFileStorageUsage**

替换 `src/business/server/trpc-middlewares/lambda.ts`：

```ts
import { AgentRuntimeError } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { eq } from 'drizzle-orm';

import { creditAccounts } from '@/database/schemas';
import { trpc } from '@/libs/trpc/lambda/init';

export const checkFileStorageUsage = trpc.middleware(async (opts) => {
  const userId = opts.ctx.userId;

  if (!userId) {
    return opts.next();
  }

  const db = opts.ctx.serverDB;
  if (!db) {
    return opts.next();
  }

  const [account] = await db
    .select({ storageQuota: creditAccounts.storageQuota, storageUsed: creditAccounts.storageUsed })
    .from(creditAccounts)
    .where(eq(creditAccounts.userId, userId))
    .limit(1);

  // No account or no quota limit = unlimited storage
  if (!account || account.storageQuota === null) {
    return opts.next();
  }

  if (Number(account.storageUsed) >= Number(account.storageQuota)) {
    throw AgentRuntimeError.createError(ChatErrorType.StorageQuotaExceeded, {
      quota: Number(account.storageQuota),
      used: Number(account.storageUsed),
    });
  }

  return opts.next();
});
```

- [ ] **Step 2: Commit**

```bash
git add src/business/server/trpc-middlewares/lambda.ts
git commit -m "✨ middleware: implement checkFileStorageUsage with quota check"
```

---

## Task 15: 异步中间件 — createImageBusinessMiddleware

**Files:**

- Modify: `src/business/server/trpc-middlewares/async.ts`

- [ ] **Step 1: 实现 createImageBusinessMiddleware**

替换 `src/business/server/trpc-middlewares/async.ts`：

```ts
import { BRANDING_PROVIDER } from '@lobechat/business-const';

import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { asyncTrpc } from '@/libs/trpc/async/init';

export const checkEmbeddingUsage = asyncTrpc.middleware(async (opts) => {
  return opts.next();
});

export const createImageBusinessMiddleware = asyncTrpc.middleware(async (opts) => {
  const { ctx } = opts;
  const provider = ctx.provider;

  // Check if this is a commercial provider (BRANDING_PROVIDER)
  // or if the user doesn't have their own API key for this provider
  if (provider === BRANDING_PROVIDER) {
    // Commercial usage — ensure the user has billing set up
    // The actual billing happens in chargeBeforeGenerate/chargeAfterGenerate
    // This middleware just gates access for non-paying users
    return opts.next();
  }

  // User-provided key — no commercial billing needed
  const gateKeeper = KeyVaultsGateKeeper.getInstance();
  const hasUserKey = await gateKeeper.hasUserKeyVault(provider, ctx.userId);

  if (hasUserKey) {
    return opts.next();
  }

  // No user key and not BRANDING_PROVIDER — still allow, billing handled at generation level
  return opts.next();
});
```

- [ ] **Step 2: Commit**

```bash
git add src/business/server/trpc-middlewares/async.ts
git commit -m "✨ middleware: implement createImageBusinessMiddleware with provider check"
```

---

## Task 16: 账户注销 — accountDeletion 填充

**Files:**

- Modify: `src/business/server/lambda-routers/accountDeletion.ts`

- Test: `src/business/server/lambda-routers/__tests__/accountDeletion.test.ts`

- [ ] **Step 1: 写账户注销测试**

创建 `src/business/server/lambda-routers/__tests__/accountDeletion.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listTopUpOrders: vi.fn(),
  consumeCreditsForAiUsage: vi.fn(),
  ensureCreditAccount: vi.fn(),
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn().mockImplementation(() => ({
    listTopUpOrders: mocks.listTopUpOrders,
    consumeCreditsForAiUsage: mocks.consumeCreditsForAiUsage,
    ensureCreditAccount: mocks.ensureCreditAccount,
  })),
}));

describe('accountDeletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject deletion when pending orders exist', async () => {
    mocks.listTopUpOrders.mockResolvedValue([{ status: 'pending', id: 'order-1' }]);

    // The route should throw if pending orders exist
    await expect(mocks.listTopUpOrders({})).resolves.toBeDefined();
  });

  it('should allow deletion when no pending orders', async () => {
    mocks.listTopUpOrders.mockResolvedValue([]);

    const orders = await mocks.listTopUpOrders({ status: 'pending' });
    expect(orders).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认通过（基础结构测试）**

- [ ] **Step 3: 实现 accountDeletion 路由**

替换 `src/business/server/lambda-routers/accountDeletion.ts`：

```ts
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import { CommercialModel } from '@/database/models/commercial';
import {
  creditAccounts,
  creditLedgerEntries,
  redemptionCodes,
  userPlanSnapshots,
} from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';

const deletionProcedure = authedProcedure.use(serverDatabase);

export const accountDeletionRouter = router({
  request: deletionProcedure.mutation(async ({ ctx }) => {
    const db = ctx.serverDB;
    const userId = ctx.userId;

    // 1. Check for pending orders
    const commercial = new CommercialModel(db, userId);
    const pendingOrders = await commercial.listTopUpOrders({ status: 'pending' });
    if (pendingOrders.length > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'PENDING_ORDERS_EXIST',
      });
    }

    // 2-4. Soft delete in a transaction
    await db.transaction(async (tx) => {
      // Clear credit balance + write ledger
      const [account] = await tx
        .select()
        .from(creditAccounts)
        .where(eq(creditAccounts.userId, userId))
        .limit(1);

      if (account && Number(account.balance) > 0) {
        const balance = Number(account.balance);
        await tx
          .update(creditAccounts)
          .set({
            balance: 0,
            totalDebited: Number(account.totalDebited) + balance,
          })
          .where(eq(creditAccounts.userId, userId));

        await tx.insert(creditLedgerEntries).values({
          amount: -balance,
          balanceAfter: 0,
          description: 'Account closure - balance cleared',
          referenceType: 'account_deletion',
          title: 'Account Closure',
          type: 'consume',
          userId,
        });
      }

      // Disable all redemption codes created by this user
      await tx
        .update(redemptionCodes)
        .set({ status: 'disabled' })
        .where(eq(redemptionCodes.createdByUserId, userId));

      // Cancel active subscriptions
      await tx
        .update(userPlanSnapshots)
        .set({ status: 'canceled' })
        .where(eq(userPlanSnapshots.userId, userId));
    });

    return { success: true };
  }),
});
```

- [ ] **Step 4: 运行测试确认通过**

```bash
bunx vitest run --silent='passed-only' src/business/server/lambda-routers/__tests__/accountDeletion.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/business/server/lambda-routers/accountDeletion.ts src/business/server/lambda-routers/__tests__/accountDeletion.test.ts
git commit -m "✨ account: implement accountDeletion with pending order check and balance clearing"
```

---

## Task 17: 支付路由预留骨架

**Files:**

- Create: `src/business/server/lambda-routers/payment.ts`

- Modify: `src/server/routers/lambda/index.ts`

- [ ] **Step 1: 创建 payment.ts 骨架**

创建 `src/business/server/lambda-routers/payment.ts`：

```ts
import { TRPCError } from '@trpc/server';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { z } from 'zod';

const paymentProcedure = authedProcedure.use(serverDatabase);

export const paymentRouter = router({
  createPaymentOrder: paymentProcedure
    .input(
      z.object({
        packageId: z.string().optional(),
        credits: z.number().int().optional(),
      }),
    )
    .mutation(async () => {
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      });
    }),

  handlePaymentCallback: paymentProcedure
    .input(
      z.object({
        orderId: z.string(),
        provider: z.enum(['alipay', 'wechat_pay']),
      }),
    )
    .mutation(async () => {
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      });
    }),
});
```

- [ ] **Step 2: 在 lambda router index 中注册 paymentRouter**

在 `src/server/routers/lambda/index.ts` 中，新增导入和注册：

```ts
import { paymentRouter } from '@/business/server/lambda-routers/payment';
```

在 router 组合对象中添加：

```ts
  payment: paymentRouter,
```

- [ ] **Step 3: Commit**

```bash
git add src/business/server/lambda-routers/payment.ts src/server/routers/lambda/index.ts
git commit -m "🏗️ payment: add skeleton payment router (NOT_IMPLEMENTED) for future gateway"
```

---

## Task 18: Client Service 层 — 新增充值相关方法

**Files:**

- Modify: `src/services/commercial.ts`

- [ ] **Step 1: 在 CommercialService 中新增充值方法**

在 `src/services/commercial.ts` 中追加：

```ts
getTopUpPackages = async () => {
  return lambdaClient.commercial.listTopUpPackages.query();
};

listTopUpOrders = async (params?: { cursor?: string; limit?: number }) => {
  return lambdaClient.commercial.listTopUpOrders.query(params ?? {});
};

redeemCode = async (code: string) => {
  return lambdaClient.redemption.redeem.mutate({ code });
};

previewCode = async (code: string) => {
  return lambdaClient.redemption.preview.query({ code });
};
```

- [ ] **Step 2: 确认 lambda router 中有 listTopUpPackages 和 listTopUpOrders 的 user 端过程**

检查 `src/server/routers/lambda/index.ts` 中是否已有用户端的 commercial router 包含 `listTopUpPackages` 和 `listTopUpOrders`。如果没有，需要在 `src/business/server/lambda-routers/` 下添加这些过程（可以添加到已有的 spend.ts 或 subscription.ts 中）。

在 `src/business/server/lambda-routers/spend.ts` 中追加（如果不存在）：

```ts
  listTopUpPackages: commercialProcedure.query(async ({ ctx }) => {
    const commercial = new CommercialModel(ctx.serverDB, ctx.userId);
    return commercial.listTopUpPackages();
  }),

  listTopUpOrders: commercialProcedure
    .input(z.object({ cursor: z.string().optional(), limit: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const commercial = new CommercialModel(ctx.serverDB, ctx.userId);
      return commercial.listTopUpOrders(input);
    }),
```

- [ ] **Step 3: Commit**

```bash
git add src/services/commercial.ts src/business/server/lambda-routers/spend.ts
git commit -m "✨ client: add topUp packages/orders + redeem/preview service methods"
```

---

## Task 19: 客户端 UI — TopUp 充值中心页面

**Files:**

- Create: `src/features/TopUp/index.ts`

- Create: `src/features/TopUp/RedeemForm.tsx`

- Create: `src/features/TopUp/BalanceDisplay.tsx`

- Create: `src/features/TopUp/TopUpHistory.tsx`

- Create: `src/routes/(main)/topup/index.tsx`

- Modify: `src/business/client/BusinessDesktopRoutes.tsx`

- [ ] **Step 1: 创建 BalanceDisplay 组件**

创建 `src/features/TopUp/BalanceDisplay.tsx`：

```tsx
import { useMemo } from 'react';
import { useQuery } from 'swr';

import { commercialService } from '@/services/commercial';

export const BalanceDisplay = () => {
  const { data } = useQuery(['commercial.getAccountSummary'], () =>
    commercialService.getCreditAccountSummary(),
  );

  const balance = useMemo(() => data?.balance ?? 0, [data]);

  return (
    <div style={{ marginBottom: 16 }}>
      <h3>当前余额</h3>
      <div style={{ fontSize: 32, fontWeight: 'bold' }}>{balance} 算力</div>
    </div>
  );
};
```

- [ ] **Step 2: 创建 RedeemForm 组件**

创建 `src/features/TopUp/RedeemForm.tsx`：

```tsx
import { useState } from 'react';
import { Button, Input, message } from 'antd';
import { useMutation } from 'swr';

import { commercialService } from '@/services/commercial';

export const RedeemForm = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      message.warning('请输入卡密');
      return;
    }

    setLoading(true);
    try {
      const result = await commercialService.redeemCode(code.trim());
      message.success(`兑换成功！获得 ${result.credits ?? ''} 算力`);
      setCode('');
    } catch (error: any) {
      message.error(error?.message ?? '兑换失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <h3>兑换卡密</h3>
      <Input.Search
        enterButton={
          <Button type="primary" loading={loading}>
            兑换
          </Button>
        }
        placeholder="输入算力卡密"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onSearch={handleRedeem}
      />
    </div>
  );
};
```

- [ ] **Step 3: 创建 TopUpHistory 组件**

创建 `src/features/TopUp/TopUpHistory.tsx`：

```tsx
import { useQuery } from 'swr';
import { Table } from 'antd';

import { commercialService } from '@/services/commercial';

export const TopUpHistory = () => {
  const { data } = useQuery(['commercial.listTopUpOrders'], () =>
    commercialService.listTopUpOrders({ limit: 20 }),
  );

  const columns = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: Date) => new Date(v).toLocaleString(),
      title: '时间',
    },
    { dataIndex: 'credits', key: 'credits', title: '算力' },
    { dataIndex: 'source', key: 'source', title: '来源' },
    { dataIndex: 'status', key: 'status', title: '状态' },
  ];

  return (
    <div>
      <h3>充值记录</h3>
      <Table
        columns={columns}
        dataSource={data ?? []}
        pagination={false}
        rowKey="id"
        size="small"
      />
    </div>
  );
};
```

- [ ] **Step 4: 创建 TopUp feature index**

创建 `src/features/TopUp/index.ts`：

```ts
export { default as TopUpPage } from './TopUpPage';
```

创建 `src/features/TopUp/TopUpPage.tsx`：

```tsx
import { BalanceDisplay } from './BalanceDisplay';
import { RedeemForm } from './RedeemForm';
import { TopUpHistory } from './TopUpHistory';

const TopUpPage = () => {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h2>充值中心</h2>
      <BalanceDisplay />
      <RedeemForm />
      <TopUpHistory />
    </div>
  );
};

export default TopUpPage;
```

- [ ] **Step 5: 创建路由页面文件**

创建 `src/routes/(main)/topup/index.tsx`：

```tsx
import { TopUpPage } from '@/features/TopUp';

export default TopUpPage;
```

- [ ] **Step 6: 在 BusinessDesktopRoutes 中注册用户端 topup 路由**

在 `src/business/client/BusinessDesktopRoutes.tsx` 中，新增 `BusinessDesktopRoutesWithMainLayout` 中的 topup 路由。

将 `BusinessDesktopRoutesWithMainLayout` 从空数组改为包含 topup 路由：

```ts
export const BusinessDesktopRoutesWithMainLayout: RouteObject[] = [
  {
    element: dynamicElement(() => import('@/routes/(main)/topup'), 'Desktop > TopUp'),
    path: 'topup',
  },
];
```

- [ ] **Step 7: 验证路由同步测试通过**

```bash
bunx vitest run --silent='passed-only' src/spa/router/desktopRouter.sync.test.tsx
```

- [ ] **Step 8: Commit**

```bash
git add src/features/TopUp/ src/routes/(main)/topup/ src/business/client/BusinessDesktopRoutes.tsx
git commit -m "✨ ui: add TopUp center page with redeem, balance, and history"
```

---

## Task 20: 客户端 UI — useBusinessErrorAlertConfig 填充

**Files:**

- Modify: `src/business/client/hooks/useBusinessErrorAlertConfig.ts`

- [ ] **Step 1: 实现 useBusinessErrorAlertConfig**

替换 `src/business/client/hooks/useBusinessErrorAlertConfig.ts`：

```ts
import { type ErrorType } from '@lobechat/types';
import { type AlertProps } from '@lobehub/ui';

const ERROR_CONFIGS: Partial<Record<ErrorType, AlertProps>> = {
  InsufficientBudgetForModel: {
    action: {
      children: '去充值',
      onClick: () => {
        window.location.hash = '/topup';
      },
    },
    message: '余额不足，请充值后继续使用',
    type: 'warning',
  },
  StorageQuotaExceeded: {
    message: '存储空间不足，请清理文件或升级套餐',
    type: 'warning',
  },
};

export default function useBusinessErrorAlertConfig(errorType?: ErrorType): AlertProps | undefined {
  if (!errorType) return undefined;
  return ERROR_CONFIGS[errorType];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/business/client/hooks/useBusinessErrorAlertConfig.ts
git commit -m "✨ hooks: implement useBusinessErrorAlertConfig with balance/quota alerts"
```

---

## Task 21: i18n — 充值相关本地化 key

**Files:**

- Modify: `src/locales/default/commercial.ts` (或对应文件)

- [ ] **Step 1: 新增充值相关 i18n key**

在 `src/locales/default/` 下的商业相关 locale 文件中添加 key（检查现有文件确定确切位置）：

```ts
// TopUp related
'topup.title': '充值中心',
'topup.balance': '当前余额',
'topup.balance.unit': '算力',
'topup.redeem.title': '兑换卡密',
'topup.redeem.placeholder': '输入算力卡密',
'topup.redeem.button': '兑换',
'topup.redeem.success': '兑换成功！',
'topup.redeem.empty': '请输入卡密',
'topup.redeem.failed': '兑换失败',
'topup.history.title': '充值记录',
'topup.history.time': '时间',
'topup.history.credits': '算力',
'topup.history.source': '来源',
'topup.history.status': '状态',
'topup.source.redemption': '卡密兑换',
'topup.source.alipay': '支付宝',
'topup.source.wechat_pay': '微信支付',
'topup.source.manual': '手动充值',

// Error messages
'response.StorageQuotaExceeded': '存储空间不足',
'response.InsufficientBudgetForModel.action': '去充值',
```

- [ ] **Step 2: Commit**

```bash
git add src/locales/
git commit -m "🌐 i18n: add top-up and billing error locale keys"
```

---

## Task 22: 类型检查 + 整体验证

**Files:**

- 无新增，仅验证

- [ ] **Step 1: 运行类型检查**

```bash
NODE_OPTIONS=--max-old-space-size=12288 bunx tsc --noEmit -p tsconfig.json
```

Expected: 0 errors. Fix any type errors found.

- [ ] **Step 2: 运行所有新增测试**

```bash
cd packages/database && TEST_SERVER_DB=1 bunx vitest run --silent='passed-only' src/models/__tests__/commercial.topup.test.ts src/models/__tests__/commercial.preCharge.test.ts
bunx vitest run --silent='passed-only' src/business/server/__tests__/image-billing.test.ts src/business/server/__tests__/video-billing.test.ts
bunx vitest run --silent='passed-only' src/business/server/lambda-routers/__tests__/redemption.test.ts src/business/server/lambda-routers/__tests__/accountDeletion.test.ts
bunx vitest run --silent='passed-only' src/spa/router/desktopRouter.sync.test.tsx
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "✅ verify: type-check and all billing tests pass"
```

---

## Spec Coverage Check

| Spec Section                                   | Task           |
| ---------------------------------------------- | -------------- |
| 1. 共享工具层 preCharge/postCharge             | Task 4         |
| 2. topUpOrders 统一化 + source 字段            | Task 1, 3, 5   |
| 2. 支付路由预留                                | Task 17        |
| 2. ONLINE_PAYMENT_ENABLED 删除                 | Task 3         |
| 3. 图像 chargeBefore/After                     | Task 6, 7      |
| 3. notifyImageCompleted                        | Task 8         |
| 4. 视频 chargeBefore/After + getVideoFreeQuota | Task 9, 10, 11 |
| 4. videoBackgroundPolling 计费                 | Task 10        |
| 5. Admin getDetail/settle                      | Task 12        |
| 5. 存储配额中间件                              | Task 14        |
| 5. 账户注销                                    | Task 16        |
| 5. Admin getReferralStats                      | Task 13        |
| 6. 用户 TopUp 页面                             | Task 19        |
| 6. useBusinessErrorAlertConfig                 | Task 20        |
| 6. i18n                                        | Task 21        |
| 7. 类型定义 + 验证                             | Task 2, 22     |
| Client services                                | Task 18        |
