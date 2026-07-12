# Module App Commerce And Credit Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add consistent application products, purchases, subscriptions, plan entitlements, AI generation, real credit reservations and settlement, and auditable developer revenue.

**Architecture:** Extend the existing commercial domain rather than creating a second balance. Add reservation and workspace account adapters around `CommercialModel`, centralize application entitlement decisions, route module AI calls through `initModelRuntimeFromDB` and `recordCommercialAiUsage`, and snapshot all prices, multipliers, orders, and settlements.

**Tech Stack:** TypeScript, Zod, Drizzle/PostgreSQL, existing CommercialModel and ModelRuntime, TRPC, React/SWR, Vitest.

## Global Constraints

- Execute after migration `0137`; this plan owns migration `0138`.
- Existing chat, image, video, PPT, top-up, referral, and subscription billing behavior must remain compatible.
- Never let an application provide a provider API key, base URL, raw model price, ledger amount, or settlement result.
- AI base cost comes from the current model/provider pricing path; module multipliers apply afterward.
- Use immutable ledger entries and unique idempotency identities.
- Purchases and resource usage are separate ledgers.
- Orders may remain pending until an existing or future payment adapter settles them; do not claim online payment is available when it is not.
- Team application charges use a workspace account only when funded and authorized; otherwise use the explicitly selected purchaser account.
- Refunds, manual settlement, balance adjustment, and payout require audit records.
- Billing concurrency and entitlement logic require tests before implementation.

---

## File Structure

- `packages/types/src/moduleAppCommerce.ts`: product, price, order, license, entitlement, and settlement contracts.
- `packages/database/migrations/0138_add_module_app_commerce.sql`: reservations, workspace credits, products, orders, licenses, subscriptions, and revenue ledger.
- `packages/database/src/models/moduleAppCommerce.ts`: catalog, order, license, refund, and revenue transitions.
- `packages/database/src/models/moduleAppCredit.ts`: user/workspace reservation and settlement adapter.
- `packages/business-server/src/module-apps/entitlement.ts`: one entitlement authority for UI, API, job, and webhook calls.
- `apps/server/src/services/moduleAppAi/`: existing AI Router adapter and usage capture.
- `packages/business-server/src/lambda-routers/admin/moduleApps.ts`: catalog, multiplier, refund, and settlement administration.
- `src/features/ModuleAppMarket/`: purchase and license UI.
- `src/features/Admin/moduleApps/`: commercial controls and settlement views.

### Task 1: Commerce And Billing Contracts

**Files:**
- Create: `packages/types/src/moduleAppCommerce.ts`
- Create: `packages/types/src/moduleAppCommerce.test.ts`
- Modify: `packages/types/src/moduleApp.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `src/features/Admin/moduleApps/formSchema.ts`
- Modify: `src/features/Admin/moduleApps/formSchema.test.ts`

**Interfaces:**
- Produces: product, price, license, order, billing payer, multiplier, and entitlement schemas.
- Preserves: current `ModuleAppBillingConfig` defaults and plan entitlement fields.

- [ ] **Step 1: Add failing contract tests**

```ts
expect(moduleAppProductSchema.parse({
  billingPeriod: 'yearly', currency: 'CNY', licenseScope: 'workspace',
  price: 12000, productType: 'subscription',
})).toMatchObject({ productType: 'subscription' });

expect(() => moduleAppBillingConfigSchema.parse({ defaultMultiplier: 101 })).toThrow();
expect(() => moduleAppPurchaseInputSchema.parse({ licenseScope: 'workspace' })).toThrow();
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/types/src/moduleAppCommerce.test.ts packages/types/src/moduleApp.test.ts src/features/Admin/moduleApps/formSchema.test.ts`

Expected: FAIL because commerce contracts and multiplier bounds are absent.

- [ ] **Step 3: Implement explicit commerce schemas**

```ts
export const moduleAppProductTypeSchema = z.enum(['free', 'one_time', 'subscription']);
export const moduleAppLicenseScopeSchema = z.enum(['personal', 'workspace_seat', 'workspace']);
export const moduleAppOrderStatusSchema = z.enum(['pending', 'paid', 'cancelled', 'refunded']);
export const moduleAppBillingPayerSchema = z.discriminatedUnion('scopeType', [
  z.object({ scopeType: z.literal('personal'), userId: z.string() }),
  z.object({ scopeType: z.literal('workspace'), workspaceId: z.string() }),
]);
```

Bound default and action multipliers to administrator-configured limits, represented as decimal strings or fixed-scale numeric values rather than floats. Include free, plan, one-time, monthly, yearly, trial, coupon, and promotion snapshots.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add packages/types/src/moduleAppCommerce.ts packages/types/src/moduleAppCommerce.test.ts packages/types/src/moduleApp.ts packages/types/src/index.ts src/features/Admin/moduleApps/formSchema.ts src/features/Admin/moduleApps/formSchema.test.ts
git commit -m "feat: define module app commerce contracts"
```

### Task 2: Credit Reservations And Workspace Accounts

**Files:**
- Create: `packages/database/migrations/0138_add_module_app_commerce.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/commercial.ts`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Create: `packages/database/src/models/moduleAppCredit.ts`
- Create: `packages/database/src/models/__tests__/moduleAppCredit.test.ts`
- Modify: `packages/database/src/models/commercial.ts`
- Modify: `packages/database/src/models/__tests__/commercial.test.ts`

**Interfaces:**
- Produces: `ModuleAppCreditModel.reserve`, `settle`, `release`, and `transferToWorkspace`.
- Consumes: current user `credit_accounts` and `credit_ledger_entries` without rewriting their history.

- [ ] **Step 1: Add failing concurrency and idempotency tests**

```ts
const reservation = await model.reserve({ amount: 100, idempotencyKey: 'install:run:node', payer });
await expect(model.reserve({ amount: 100, idempotencyKey: 'install:run:node', payer })).resolves.toEqual(reservation);
await Promise.all([
  model.settle({ actualAmount: 80, reservationId: reservation.id }),
  model.settle({ actualAmount: 80, reservationId: reservation.id }),
]);
expect(await ledgerCount('install:run:node')).toBe(1);
```

Also prove two concurrent reservations cannot exceed available balance and released reservations do not debit the account.

- [ ] **Step 2: Run database tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleAppCredit.test.ts packages/database/src/models/__tests__/commercial.test.ts`

Expected: FAIL because reservations and workspace accounts are absent.

- [ ] **Step 3: Add reservation and workspace account tables**

Create:

- `credit_reservations` with payer scope, amount, idempotency key, status, expiry, and settlement ledger reference;
- `workspace_credit_accounts` with balance and debit/credit totals;
- `workspace_credit_ledger_entries` with immutable amount, balance, reference, and metadata;
- module commerce tables listed in Task 5, in the same migration but exposed by their own model task.

```ts
export interface ModuleAppCreditReservationService {
  reserve(input: ReserveCreditsInput): Promise<CreditReservation>;
  settle(input: { actualAmount: number; metadata: Record<string, unknown>; reservationId: string }): Promise<CreditSettlement>;
  release(input: { reason: string; reservationId: string }): Promise<CreditReservation>;
}
```

Lock the selected account row, subtract active unexpired reservations when checking availability, and create the consume ledger entry only during settlement. Preserve `CommercialModel.preCharge` behavior for existing callers.

- [ ] **Step 4: Verify balances and commit**

Run the focused command from Step 2.

Expected: PASS, including expired reservation cleanup, insufficient funds, duplicate settlement, and workspace transfer audit.

```bash
git add packages/database/migrations/0138_add_module_app_commerce.sql packages/database/migrations/meta/_journal.json packages/database/src/schemas/commercial.ts packages/database/src/schemas/moduleApp.ts packages/database/src/models/moduleAppCredit.ts packages/database/src/models/__tests__/moduleAppCredit.test.ts packages/database/src/models/commercial.ts packages/database/src/models/__tests__/commercial.test.ts
git commit -m "feat: reserve and settle module app credits"
```

### Task 3: Central Entitlement Service

**Files:**
- Create: `packages/business-server/src/module-apps/entitlement.ts`
- Create: `packages/business-server/src/module-apps/entitlement.test.ts`
- Modify: `packages/database/src/models/moduleApp.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.test.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.test.ts`
- Modify: `apps/server/src/workflows/moduleApp/run.ts`

**Interfaces:**
- Produces: `resolveModuleAppEntitlement` and `assertModuleAppEntitlement`.
- Used by marketplace visibility, install, launch, interactive action, queue, schedule, and webhook paths.

- [ ] **Step 1: Add a failing entitlement matrix**

```ts
expect(resolveModuleAppEntitlement({ planIncluded: true, operation: 'run' })).toMatchObject({ allowed: true, source: 'plan' });
expect(resolveModuleAppEntitlement({ license: null, operation: 'run', productType: 'one_time' })).toMatchObject({ allowed: false, reason: 'purchase_required' });
expect(resolveModuleAppEntitlement({ license: expiredLicense, operation: 'job' })).toMatchObject({ allowed: false, reason: 'license_expired' });
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/entitlement.test.ts apps/server/src/routers/lambda/moduleApp.test.ts packages/business-server/src/module-apps/runModuleAppAction.test.ts apps/server/src/workflows/moduleApp/run.test.ts`

Expected: FAIL because entitlement checks are spread across plan-only logic.

- [ ] **Step 3: Implement one decision contract**

```ts
export type ModuleAppEntitlementDecision =
  | { allowed: true; licenseId?: string; source: 'free' | 'plan' | 'purchase' | 'trial' }
  | { allowed: false; reason: 'hidden' | 'install_denied' | 'purchase_required' | 'license_expired' | 'suspended' };
```

Pass explicit operation, installation, plan snapshot, license, team membership, and current time. Do not let background tasks reuse a stale client-side entitlement result.

- [ ] **Step 4: Verify all call sites and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add packages/business-server/src/module-apps/entitlement.ts packages/business-server/src/module-apps/entitlement.test.ts packages/database/src/models/moduleApp.ts apps/server/src/routers/lambda/moduleApp.ts apps/server/src/routers/lambda/moduleApp.test.ts packages/business-server/src/module-apps/runModuleAppAction.ts packages/business-server/src/module-apps/runModuleAppAction.test.ts apps/server/src/workflows/moduleApp/run.ts
git commit -m "feat: centralize module app entitlements"
```

### Task 4: User AI Router And Multiplier Settlement

**Files:**
- Create: `apps/server/src/services/moduleAppAi/index.ts`
- Create: `apps/server/src/services/moduleAppAi/index.test.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.test.ts`
- Modify: `packages/business-server/src/module-apps/runners/contentGenerationRunner.ts`
- Modify: `packages/business-server/src/module-apps/runners/contentGenerationRunner.test.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.test.ts`
- Modify: `packages/business-server/src/commercialBilling.ts`
- Modify: `packages/business-server/src/commercialBilling.test.ts`

**Interfaces:**
- Produces: `createModuleAppTextGenerator` and multiplier-aware settlement metadata.
- Consumes: `initModelRuntimeFromDB`, `recordCommercialAiUsage`, and Task 2 reservations.

- [ ] **Step 1: Add failing AI routing and settlement tests**

```ts
const result = await generator({ model: 'model-a', prompt: 'hello', provider: 'provider-a', userId });
expect(initModelRuntimeFromDB).toHaveBeenCalledWith(db, userId, 'provider-a', expect.anything());
expect(creditModel.settle).toHaveBeenCalledWith(expect.objectContaining({
  actualAmount: baseCredits * 1.35,
  metadata: expect.objectContaining({ actionMultiplier: '1.35', model: 'model-a', provider: 'provider-a' }),
}));
```

Test that a failed pre-provider request releases the reservation, while a provider response with usage settles actual usage exactly once.

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppAi/index.test.ts apps/server/src/routers/lambda/moduleApp.test.ts packages/business-server/src/module-apps/runners/contentGenerationRunner.test.ts packages/business-server/src/module-apps/runModuleAppAction.test.ts packages/business-server/src/commercialBilling.test.ts`

Expected: FAIL with the current `MODULE_APP_TEXT_GENERATOR_REQUIRED` path.

- [ ] **Step 3: Implement the existing-router adapter**

```ts
export const createModuleAppTextGenerator = (deps: ModuleAppAiDependencies): ModuleAppTextGenerator =>
  async ({ model, prompt, provider, userId }) => {
    const runtime = await initModelRuntimeFromDB(deps.db, userId, provider!, deps.workspaceId);
    return deps.generateAndMeasure({ model: model!, prompt, provider: provider!, runtime });
  };
```

Collect streamed text and final token/cost usage through runtime callbacks. Calculate base credits through the current commercial pricing path, apply app default then action override within admin bounds, settle the reservation, and store provider/model/instance/cost-source/token/multiplier snapshots. Do not call `recordCommercialAiUsage` and reservation settlement separately in a way that double-debits; add a module settlement adapter that reuses pricing resolution but writes one ledger entry.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS; content generation no longer throws `MODULE_APP_TEXT_GENERATOR_REQUIRED` in the user router.

```bash
git add apps/server/src/services/moduleAppAi apps/server/src/routers/lambda/moduleApp.ts apps/server/src/routers/lambda/moduleApp.test.ts packages/business-server/src/module-apps/runners/contentGenerationRunner.ts packages/business-server/src/module-apps/runners/contentGenerationRunner.test.ts packages/business-server/src/module-apps/runModuleAppAction.ts packages/business-server/src/module-apps/runModuleAppAction.test.ts packages/business-server/src/commercialBilling.ts packages/business-server/src/commercialBilling.test.ts
git commit -m "feat: bill module app AI through the user router"
```

### Task 5: Products, Orders, Licenses, And Refunds

**Files:**
- Create: `packages/database/src/models/moduleAppCommerce.ts`
- Create: `packages/database/src/models/__tests__/moduleAppCommerce.test.ts`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Modify: `packages/database/src/schemas/moduleApp.schema.test.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.test.ts`
- Modify: `src/services/moduleApp.ts`
- Modify: `src/services/moduleApp.test.ts`

**Interfaces:**
- Produces: catalog listing, quote, order creation, manual/payment-webhook settlement adapter, license resolution, cancellation, and refund.
- Consumes: product schemas from Task 1 and tables created by migration `0138`.

- [ ] **Step 1: Add failing order-state tests**

```ts
const order = await model.createOrder({ productId, purchaserUserId, scopeType: 'personal' });
expect(order.status).toBe('pending');
const paid = await model.settleOrder({ orderId: order.id, paymentReference: 'manual:admin:1' });
expect(await model.resolveLicense({ appId, userId })).toMatchObject({ orderId: paid.id, status: 'active' });
await model.refundOrder({ actorUserId: adminId, orderId: order.id, reason: 'requested' });
expect(await model.resolveLicense({ appId, userId })).toBeNull();
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleAppCommerce.test.ts packages/database/src/schemas/moduleApp.schema.test.ts apps/server/src/routers/lambda/moduleApp.test.ts src/services/moduleApp.test.ts`

Expected: FAIL because commerce models and procedures are absent.

- [ ] **Step 3: Implement immutable catalog and order snapshots**

Use `module_app_products`, `module_app_prices`, `module_app_orders`, `module_app_licenses`, and `module_app_subscriptions`. Store price, currency, billing period, promotion, scope, seat count, revenue-share rate, and terms snapshots on the order. Settlement is idempotent by payment reference. Refund revokes or shortens the license and appends revenue reversal records.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add packages/database/src/models/moduleAppCommerce.ts packages/database/src/models/__tests__/moduleAppCommerce.test.ts packages/database/src/schemas/moduleApp.ts packages/database/src/schemas/moduleApp.schema.test.ts apps/server/src/routers/lambda/moduleApp.ts apps/server/src/routers/lambda/moduleApp.test.ts src/services/moduleApp.ts src/services/moduleApp.test.ts
git commit -m "feat: add module app orders and licenses"
```

### Task 6: Developer Revenue And Administrator Controls

**Files:**
- Create: `packages/business-server/src/module-apps/revenue.ts`
- Create: `packages/business-server/src/module-apps/revenue.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`
- Modify: `src/features/Admin/moduleApps/BillingEditor.tsx`
- Modify: `src/features/Admin/moduleApps/editors.test.tsx`
- Create: `src/features/Admin/moduleApps/CommerceTable.tsx`
- Create: `src/features/Admin/moduleApps/CommerceTable.test.tsx`

**Interfaces:**
- Produces: revenue accrual, reversal, settlement batch, and audited admin catalog/refund controls.
- Revenue records reference the package submitter until publisher verification in plan 5 binds a verified publisher.

- [ ] **Step 1: Add failing revenue tests**

```ts
expect(calculateRevenue({ gross: 10000, platformRate: '0.20', refundableReserveRate: '0.10' })).toEqual({
  developerPending: 7200, platformFee: 2000, reserve: 800,
});
await expect(service.settleBatch({ actorUserId, entryIds: [refundedEntryId] })).rejects.toThrow('MODULE_APP_REVENUE_NOT_SETTLEABLE');
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/revenue.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/features/Admin/moduleApps/editors.test.tsx src/features/Admin/moduleApps/CommerceTable.test.tsx`

Expected: FAIL because revenue service and controls are absent.

- [ ] **Step 3: Implement append-only revenue transitions**

Create pending revenue when an order settles, reversal when refunded, and settled entries only after the configured delay. Never include AI, runtime, storage, or network cost in developer share. Require finance-write permission and `module_app_audit_logs` for manual refund or settlement.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add packages/business-server/src/module-apps/revenue.ts packages/business-server/src/module-apps/revenue.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/features/Admin/moduleApps/BillingEditor.tsx src/features/Admin/moduleApps/editors.test.tsx src/features/Admin/moduleApps/CommerceTable.tsx src/features/Admin/moduleApps/CommerceTable.test.tsx
git commit -m "feat: govern module app revenue settlement"
```

### Task 7: Marketplace Purchase And Cost UX

**Files:**
- Create: `src/features/ModuleAppMarket/PurchaseModal.tsx`
- Create: `src/features/ModuleAppMarket/PurchaseModal.test.tsx`
- Modify: `src/features/ModuleAppMarket/AppCard.tsx`
- Modify: `src/features/ModuleAppMarket/AppDetail.tsx`
- Modify: `src/features/ModuleAppMarket/index.test.tsx`
- Modify: `src/features/ModuleAppRuntime/RunResultPanel.tsx`
- Modify: `src/features/ModuleAppRuntime/RunResultPanel.test.tsx`
- Modify: `packages/locales/src/default/common.ts`
- Modify: `locales/en-US/common.json`
- Modify: `locales/zh-CN/common.json`

**Interfaces:**
- Produces: honest quote/order state, license display, estimate-before-run, and settled-cost details.
- Consumes: quote, order, entitlement, and run billing snapshots.

- [ ] **Step 1: Add failing UX tests**

```tsx
expect(screen.getByText('等待支付')).toBeVisible();
expect(screen.queryByText('购买成功')).not.toBeInTheDocument();
expect(screen.getByText('预计消耗 1.35 M 积分')).toBeVisible();
expect(screen.getByText('实际消耗 1.21 M 积分')).toBeVisible();
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' src/features/ModuleAppMarket/PurchaseModal.test.tsx src/features/ModuleAppMarket/index.test.tsx src/features/ModuleAppRuntime/RunResultPanel.test.tsx`

Expected: FAIL because purchase and cost UX are absent.

- [ ] **Step 3: Implement purchase and cost states**

Use segmented controls for monthly/yearly options, explicit personal/team scope, promotion breakdown, pending-payment state, retry, cancellation, and refund status. Do not show a success state before server settlement. Display model, base cost, multiplier, fixed fee, and total from server snapshots rather than recomputing prices in the browser.

- [ ] **Step 4: Run plan verification**

Run the focused command from Step 2.

Expected: PASS.

Run: `bun run type-check`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Update governance docs and commit**

Update `docs/FEATURE_REGISTRY.md` and `docs/CHANGELOG_INTERNAL.md` with pricing, ledger, AI Router, payment-adapter status, database, and deployment impact.

```bash
git add src/features/ModuleAppMarket src/features/ModuleAppRuntime/RunResultPanel.tsx src/features/ModuleAppRuntime/RunResultPanel.test.tsx packages/locales/src/default/common.ts locales/en-US/common.json locales/zh-CN/common.json docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git commit -m "feat: add module app purchase and usage UX"
```

## Plan Acceptance Gate

- One entitlement decision governs marketplace, install, launch, interactive, job, schedule, and webhook paths.
- Concurrent reservations cannot overspend user or workspace balances.
- Reservation settlement writes one immutable consume entry and releases unused credit.
- Module AI generation uses the current user AI Router and no longer requires an unconfigured generator.
- Module multipliers are bounded, snapshotted, and visible before and after execution.
- Free, plan, one-time, monthly, yearly, personal, and team licenses resolve consistently.
- Pending orders are not presented as paid; refunds reverse license and revenue state.
- Developer revenue excludes platform resource costs and is fully auditable.
- Targeted tests, type-check, and `git diff --check` pass.
