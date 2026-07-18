# Mobile Business Settings UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将套餐、积分、账单、用量和推荐奖励五个 Mobile Web 设置页从桌面内容缩放提升为适合手机高频操作的渐进式体验。

**Architecture:** 保留 `/settings/:tab`、`SettingsContent`、现有 SWR 请求和 `commercialService` 契约，在 `src/business/client/BusinessSettingPages/mobile/` 增加共享移动呈现组件。五个页面继续持有业务状态和 mutation，只在 `mobile` 分支切换标签、折叠区、记录卡片和条件式底部操作条；桌面继续渲染原有 `SettingHeader`、`FormGroup` 和表格。

**Tech Stack:** React 19、TypeScript、React Router、react-i18next、SWR、`@lobehub/ui`、`@lobehub/ui/base-ui`、antd-style、Vitest、Testing Library、Playwright。

## Global Constraints

- 只修改 `SettingsTabs.Plans`、`SettingsTabs.Credits`、`SettingsTabs.Billing`、`SettingsTabs.Usage`、`SettingsTabs.Referral` 及其共享移动呈现组件。
- 不开发原生 App、Expo、PWA，不启用在线支付，不修改数据库、计费规则或生产功能开关。
- 不新增 mobile subscription API；继续使用 `src/services/commercial.ts`、`usageService` 和现有 `lambdaClient` 路由。
- 桌面 `1280px` 下继续使用原有标题、表格和页面结构；移动差异必须由 `mobile` 分支明确控制。
- 手机触控目标最小高度 `44px`；移动正文横向 padding 为 `16px`；固定操作条必须适配 `env(safe-area-inset-bottom)`。
- 页面级滚动容器不得横向溢出；只有标签条、套餐卡片和明确允许的内部内容可以横向滚动。
- 新用户文案同步维护 `packages/locales/src/default/subscription.ts`、`locales/en-US/subscription.json`、`locales/zh-CN/subscription.json`。
- 每个行为变更先写失败测试，再实现最小代码；只运行当前任务的聚焦测试，最终统一运行一次完整聚焦验证。
- Browser plugin 当前不可用，渲染验证使用仓库已有 Playwright；临时脚本和截图写到 `%TEMP%`，不得进入仓库。
- 不推送、不部署；最终提交遵循项目 Lore commit protocol。

## File Map

**Create:**

- `src/business/client/BusinessSettingPages/mobile/BusinessMobileTabs.tsx`：五页快捷导航和活动项可见性。
- `src/business/client/BusinessSettingPages/mobile/BusinessMobileTabs.test.tsx`：导航、ARIA、滚动测试。
- `src/business/client/BusinessSettingPages/mobile/BusinessMobileSection.tsx`：移动折叠区和桌面 `FormGroup` 适配器。
- `src/business/client/BusinessSettingPages/mobile/BusinessMobileSection.test.tsx`：默认状态和折叠测试。
- `src/business/client/BusinessSettingPages/mobile/BusinessMobileActionBar.tsx`：安全区底部主操作。
- `src/business/client/BusinessSettingPages/mobile/BusinessMobileActionBar.test.tsx`：操作和布局契约测试。
- `src/business/client/BusinessSettingPages/mobile/BusinessMobileRecordList.tsx`：记录卡片、空/错/加载状态和详情抽屉。
- `src/business/client/BusinessSettingPages/mobile/BusinessMobileRecordList.test.tsx`：记录交互和焦点恢复测试。
- `src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.tsx`：商业记录到移动描述对象的纯映射。
- `src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.test.tsx`：字段完整性测试。

**Modify:**

- `src/business/client/BusinessSettingPages/BusinessSettingsPageShell.tsx`
- `src/business/client/BusinessSettingPages/Billing.tsx`
- `src/business/client/BusinessSettingPages/Credits.tsx`
- `src/business/client/BusinessSettingPages/Plans.tsx`
- `src/business/client/BusinessSettingPages/Referral.tsx`
- `src/business/client/BusinessSettingPages/Usage.tsx`
- `src/business/client/BusinessSettingPages/mobilePresentation.test.ts`
- `src/business/client/BusinessSettingPages/plansDisplay.ts`
- `src/business/client/BusinessSettingPages/plansDisplay.test.ts`
- `src/routes/(main)/settings/stats/features/usage/UsageTable.tsx`
- `packages/locales/src/default/subscription.ts`
- `locales/en-US/subscription.json`
- `locales/zh-CN/subscription.json`
- `src/features/Admin/adminChineseCopy.test.ts`

---

### Task 1: Mobile Commercial Navigation Tabs

**Files:**

- Create: `src/business/client/BusinessSettingPages/mobile/BusinessMobileTabs.tsx`
- Create: `src/business/client/BusinessSettingPages/mobile/BusinessMobileTabs.test.tsx`
- Modify: `src/business/client/BusinessSettingPages/BusinessSettingsPageShell.tsx`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`
- Modify: `src/features/Admin/adminChineseCopy.test.ts`

**Interfaces:**

- Consumes: `SettingsTabs`, `useWorkspaceAwareNavigate`, `useLocation`, `#lobe-mobile-scroll-container`。
- Produces: `BusinessMobileTabs: FC`，由 `BusinessSettingsPageShell` 在 `mobile=true` 时渲染。

- [ ] **Step 1: 写失败测试，覆盖五个标签、活动态、personal-only 导航和滚动复位**

```tsx
it('renders the five commercial tabs and keeps navigation personal-only', () => {
  render(<BusinessMobileTabs />);

  expect(screen.getAllByRole('tab')).toHaveLength(5);
  expect(screen.getByRole('tab', { name: '套餐' })).toHaveAttribute('aria-selected', 'true');

  fireEvent.click(screen.getByRole('tab', { name: '积分' }));

  expect(navigate).toHaveBeenCalledWith('/settings/credits', { escape: true });
  expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', top: 0 });
});

it('scrolls a clipped active tab into view', () => {
  render(<BusinessMobileTabs />);
  expect(scrollIntoView).toHaveBeenCalledWith({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest',
  });
});
```

测试 setup 必须为 container 和 active tab 分别 mock `getBoundingClientRect()`，让 active tab 的 `right` 大于 container 的 `right`；同时在 `afterEach` 恢复 `Element.prototype.scrollIntoView` 和滚动容器的 `scrollTo`，避免污染其他测试。

- [ ] **Step 2: 运行测试并确认因组件不存在而失败**

Run:

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobile/BusinessMobileTabs.test.tsx"
```

Expected: FAIL，错误包含 `Cannot find module './BusinessMobileTabs'`。

- [ ] **Step 3: 实现固定标签配置、路由活动态和可见性逻辑**

```tsx
const tabs = [
  { key: SettingsTabs.Plans, labelKey: 'tab.plans' },
  { key: SettingsTabs.Credits, labelKey: 'tab.credits' },
  { key: SettingsTabs.Billing, labelKey: 'tab.billing' },
  { key: SettingsTabs.Usage, labelKey: 'tab.usage' },
  { key: SettingsTabs.Referral, labelKey: 'tab.referral' },
] as const;

const BusinessMobileTabs = memo(() => {
  const { t } = useTranslation('subscription');
  const { pathname } = useLocation();
  const navigate = useWorkspaceAwareNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTab = pathname.split('/').filter(Boolean).at(-1);

  useEffect(() => {
    const active = containerRef.current?.querySelector<HTMLElement>(
      `[data-tab-id="${activeTab}"]`,
    );
    if (!active || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.left < containerRect.left || activeRect.right > containerRect.right) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTab]);

  const changeTab = (tab: string) => {
    document
      .getElementById('lobe-mobile-scroll-container')
      ?.scrollTo({ behavior: 'auto', top: 0 });
    navigate(`/settings/${tab}`, { escape: true });
  };

  return (
    <div aria-label={t('mobile.tabs.ariaLabel')} className={styles.root} role="tablist">
      <div className={styles.scroller} ref={containerRef}>
        {tabs.map(({ key, labelKey }) => (
          <button
            aria-selected={activeTab === key}
            className={cx(styles.tab, activeTab === key && styles.active)}
            data-tab-id={key}
            key={key}
            role="tab"
            type="button"
            onClick={() => changeTab(key)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
});
```

样式必须包含：`position: sticky`、`inset-block-start: 0`、不透明 token 背景、底边框、横向滚动、`44px` 标签高度和活动指示线。`BusinessSettingsPageShell` 在移动模式下把标签放在正文 padding 外、桌面模式继续渲染 `SettingHeader`。

- [ ] **Step 4: 增加并同步翻译键**

```ts
'mobile.tabs.ariaLabel': '商业设置',
```

```json
"mobile.tabs.ariaLabel": "Commercial settings"
```

```json
"mobile.tabs.ariaLabel": "商业设置"
```

在 `adminChineseCopy.test.ts` 断言默认和 `zh-CN` 值为“商业设置”。

- [ ] **Step 5: 运行聚焦测试并提交**

Run:

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobile/BusinessMobileTabs.test.tsx" "src/features/Admin/adminChineseCopy.test.ts"
```

Expected: PASS。

Commit:

```powershell
git add -- "src/business/client/BusinessSettingPages/mobile/BusinessMobileTabs.tsx" "src/business/client/BusinessSettingPages/mobile/BusinessMobileTabs.test.tsx" "src/business/client/BusinessSettingPages/BusinessSettingsPageShell.tsx" "packages/locales/src/default/subscription.ts" "locales/en-US/subscription.json" "locales/zh-CN/subscription.json" "src/features/Admin/adminChineseCopy.test.ts"
git commit -m "📱 add mobile commercial settings tabs"
```

---

### Task 2: Responsive Sections And Safe-Area Action Bar

**Files:**

- Create: `src/business/client/BusinessSettingPages/mobile/BusinessMobileSection.tsx`
- Create: `src/business/client/BusinessSettingPages/mobile/BusinessMobileSection.test.tsx`
- Create: `src/business/client/BusinessSettingPages/mobile/BusinessMobileActionBar.tsx`
- Create: `src/business/client/BusinessSettingPages/mobile/BusinessMobileActionBar.test.tsx`
- Modify: `src/business/client/BusinessSettingPages/BusinessSettingsPageShell.tsx`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**

```ts
export interface BusinessMobilePrimaryAction {
  href?: string;
  label: ReactNode;
  loading?: boolean;
  onClick?: () => void;
}

export interface BusinessSettingsSectionProps {
  children: ReactNode;
  defaultOpen?: boolean;
  desktopExtra?: ReactNode;
  mobile?: boolean;
  summary?: ReactNode;
  title: ReactNode;
}
```

- Consumes: Task 1 的 `BusinessMobileTabs`。
- Produces: `BusinessMobileSection`、`BusinessSettingsSection`、`BusinessMobileActionBar`，以及 `BusinessSettingsPageShellProps.mobileAction`。

- [ ] **Step 1: 写失败测试，覆盖折叠 ARIA、桌面适配和底部操作条件**

```tsx
it('starts secondary content collapsed and exposes aria state', () => {
  render(
    <BusinessMobileSection defaultOpen={false} title="套餐对比">
      <div>comparison</div>
    </BusinessMobileSection>,
  );

  const trigger = screen.getByRole('button', { name: '展开 套餐对比' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('comparison')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  expect(screen.getByText('comparison')).toBeVisible();
});

it('renders a full-width executable primary action', () => {
  render(
    <BusinessMobileActionBar action={{ label: '升级套餐', onClick }} />,
  );
  const button = screen.getByRole('button', { name: '升级套餐' });
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  expect(screen.getByTestId('business-mobile-action-bar')).toHaveAttribute(
    'data-safe-area',
    'true',
  );
});
```

- [ ] **Step 2: 运行两个测试文件并确认失败**

Run:

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobile/BusinessMobileSection.test.tsx" "src/business/client/BusinessSettingPages/mobile/BusinessMobileActionBar.test.tsx"
```

Expected: FAIL，两个目标模块均不存在。

- [ ] **Step 3: 实现折叠区和桌面适配器**

`BusinessMobileSection` 使用 `useId` 关联 trigger 与 panel，整行 button 高度不低于 `44px`。`BusinessSettingsSection` 必须执行以下唯一分支：

```tsx
export const BusinessSettingsSection = ({
  children,
  defaultOpen = true,
  desktopExtra,
  mobile,
  summary,
  title,
}: BusinessSettingsSectionProps) => {
  if (mobile) {
    return (
      <BusinessMobileSection defaultOpen={defaultOpen} summary={summary} title={title}>
        {children}
      </BusinessMobileSection>
    );
  }

  return (
    <FormGroup
      collapsible={false}
      extra={desktopExtra}
      gap={16}
      title={title}
      variant="filled"
    >
      {children}
    </FormGroup>
  );
};
```

- [ ] **Step 4: 实现固定操作条并接入外壳**

```tsx
export interface BusinessSettingsPageShellProps {
  children: ReactNode;
  className?: string;
  mobile?: boolean;
  mobileAction?: BusinessMobilePrimaryAction;
  title: ReactNode;
}

{mobile && mobileAction ? <BusinessMobileActionBar action={mobileAction} /> : null}
```

操作条使用 `Button` from `@lobehub/ui`。组件在 `useEffect` 后通过 `createPortal` 渲染到 `document.body`，SSR 首次渲染返回 `null`；这样 `position: fixed` 不受滚动容器祖先影响。层级使用 `${cssVar.zIndexPopupBase}`，不得写任意数字。padding 必须为：

```css
padding-block: 10px calc(10px + env(safe-area-inset-bottom, 0px));
padding-inline: 16px;
```

外壳在存在 `mobileAction` 时将正文底部 padding 提升为：

```css
padding-block-end: calc(96px + env(safe-area-inset-bottom, 0px));
```

操作条不存在时保持现有 `64px` 底部空间。新增 `mobile.section.expand` 和 `mobile.section.collapse` 英中翻译，值分别使用 `展开 {{title}}` / `Expand {{title}}` 与 `收起 {{title}}` / `Collapse {{title}}`。

- [ ] **Step 5: 运行测试、检查格式并提交**

Run:

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobile/BusinessMobileSection.test.tsx" "src/business/client/BusinessSettingPages/mobile/BusinessMobileActionBar.test.tsx"
node ".\node_modules\prettier\bin\prettier.cjs" --check "src/business/client/BusinessSettingPages/mobile/BusinessMobileSection.tsx" "src/business/client/BusinessSettingPages/mobile/BusinessMobileActionBar.tsx" "src/business/client/BusinessSettingPages/BusinessSettingsPageShell.tsx"
```

Expected: PASS。

Commit:

```powershell
git add -- "src/business/client/BusinessSettingPages/mobile/BusinessMobileSection.tsx" "src/business/client/BusinessSettingPages/mobile/BusinessMobileSection.test.tsx" "src/business/client/BusinessSettingPages/mobile/BusinessMobileActionBar.tsx" "src/business/client/BusinessSettingPages/mobile/BusinessMobileActionBar.test.tsx" "src/business/client/BusinessSettingPages/BusinessSettingsPageShell.tsx" "packages/locales/src/default/subscription.ts" "locales/en-US/subscription.json" "locales/zh-CN/subscription.json"
git commit -m "📱 add mobile business sections and actions"
```

---

### Task 3: Mobile Record Cards, Details Sheet, And Record Builders

**Files:**

- Create: `src/business/client/BusinessSettingPages/mobile/BusinessMobileRecordList.tsx`
- Create: `src/business/client/BusinessSettingPages/mobile/BusinessMobileRecordList.test.tsx`
- Create: `src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.tsx`
- Create: `src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.test.tsx`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**

```ts
export interface BusinessMobileRecordField {
  label: ReactNode;
  value: ReactNode;
}

export interface BusinessMobileRecord {
  fields: BusinessMobileRecordField[];
  id: Key;
  meta?: ReactNode;
  status?: ReactNode;
  title: ReactNode;
  value?: ReactNode;
}

export interface BusinessMobileRecordListProps {
  emptyAction?: ReactNode;
  emptyDescription: ReactNode;
  error?: ReactNode;
  isLoading?: boolean;
  onRetry?: () => void;
  records: BusinessMobileRecord[];
  sheetTitle: ReactNode;
}

export interface BusinessRecordFormatters {
  creditLedgerAllocation: (item: CreditLedgerEntryItem) => string | undefined;
  creditLedgerDescription: (item: CreditLedgerEntryItem) => string;
  formatCredits: (value: number) => string;
  formatCurrency: (value: number, currency?: string | null) => string;
  formatDate: (value?: Date | null) => string;
  formatNumber: (value?: number | null, digits?: number) => string;
  formatSignedCredits: (value: number) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
}
```

- Produces: `buildBillingChangeRecord`、`buildTopUpOrderRecord`、`buildCreditLedgerRecord`、`buildReferralHistoryRecord`、`buildUsageRecord`。

- [ ] **Step 1: 写失败测试，覆盖四种数据状态、抽屉和焦点恢复**

```tsx
it('opens record details and restores focus after closing', () => {
  render(
    <BusinessMobileRecordList
      emptyDescription="暂无记录"
      records={[
        {
          fields: [{ label: '创建时间', value: '2026-07-18' }],
          id: 'record-1',
          status: '已完成',
          title: '基础版 → 进阶版',
          value: '按年',
        },
      ]}
      sheetTitle="套餐变更详情"
    />,
  );

  const trigger = screen.getByRole('button', { name: /基础版 → 进阶版/ });
  fireEvent.click(trigger);
  expect(screen.getByText('创建时间')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(trigger).toHaveFocus();
});

it('shows retry only for an error state', () => {
  render(
    <BusinessMobileRecordList
      emptyDescription="暂无记录"
      error="加载失败"
      onRetry={onRetry}
      records={[]}
      sheetTitle="详情"
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(onRetry).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: 运行测试并确认目标组件不存在**

Run:

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobile/BusinessMobileRecordList.test.tsx"
```

Expected: FAIL with missing module。

- [ ] **Step 3: 实现记录列表和 `FloatingSheet`**

实现必须遵循以下状态优先级：`error` → `isLoading` → empty → records。加载态固定渲染 3 个 Skeleton；empty 使用 `Empty` from `@lobehub/ui`；错误态提供唯一重试按钮。记录使用原生 `button`，最小高度 `64px`，整行可点击并带 `ChevronRight`。

详情抽屉使用：

```tsx
<FloatingSheet
  dismissible
  maxHeight={720}
  minHeight={320}
  mode="overlay"
  open={selectedRecord !== undefined}
  restingHeight={480}
  snapPoints={[480, 720]}
  title={sheetTitle}
  variant="elevated"
  onOpenChange={handleOpenChange}
>
  <dl className={styles.details}>
    {selectedRecord?.fields.map((field, index) => (
      <div className={styles.field} key={index}>
        <dt>{field.label}</dt>
        <dd>{field.value}</dd>
      </div>
    ))}
  </dl>
</FloatingSheet>
```

关闭时调用保存的 trigger ref 的 `focus()`。组件测试必须 mock `FloatingSheet` 为带有可访问名称 `Close` 的关闭按钮，并在点击时执行 `onOpenChange(false)`，不能依赖第三方组件内部 DOM。

- [ ] **Step 4: 实现并测试五种记录描述映射**

字段映射固定如下：

| Builder | Card title | Card value/status | Sheet fields |
| --- | --- | --- | --- |
| `buildBillingChangeRecord` | `fromPlan → toPlan` | cycle/status | id, fromPlan, toPlan, cycle, reason, status, createdAt, updatedAt |
| `buildTopUpOrderRecord` | credits | amount/status | id, amount, credits, source, provider, externalOrderId, createdAt, paidAt |
| `buildCreditLedgerRecord` | title or referenceType | signed amount/type | id, amount, balanceAfter, type, description, allocation, referenceId, createdAt |
| `buildReferralHistoryRecord` | inviteeEmail or masked id | reward/status | id, inviteeEmail, status, reward, createdAt, rewardedAt |
| `buildUsageRecord` | model | spend/type | id, provider, model, type, input/output/total tokens, tps, ttft, spend, createdAt |

每个 builder 的第二个参数使用 `Pick<BusinessRecordFormatters, ...>` 声明其实际需要的 formatter，不要求调用方构造无关函数，也不自行拼接货币、日期或翻译规则。`businessRecordBuilders.test.tsx` 为每种输入构造完整记录，并断言 card title、status 和字段 label 数组；测试 formatter 返回带字段名的稳定字符串，以便证明每个字段调用了正确 formatter。

- [ ] **Step 5: 增加通用翻译、运行测试并提交**

新增：`mobile.records.viewDetails`、`mobile.records.details`、`mobile.error.title`、`mobile.error.retry`。运行：

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobile/BusinessMobileRecordList.test.tsx" "src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.test.tsx"
```

Expected: PASS。

Commit:

```powershell
git add -- "src/business/client/BusinessSettingPages/mobile/BusinessMobileRecordList.tsx" "src/business/client/BusinessSettingPages/mobile/BusinessMobileRecordList.test.tsx" "src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.tsx" "src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.test.tsx" "packages/locales/src/default/subscription.ts" "locales/en-US/subscription.json" "locales/zh-CN/subscription.json"
git commit -m "📱 add mobile commercial record details"
```

---

### Task 4: Plans Mobile Selection, Scroll Snap, And Progressive Disclosure

**Files:**

- Modify: `src/business/client/BusinessSettingPages/Plans.tsx`
- Modify: `src/business/client/BusinessSettingPages/plansDisplay.ts`
- Modify: `src/business/client/BusinessSettingPages/plansDisplay.test.ts`
- Modify: `src/business/client/BusinessSettingPages/mobilePresentation.test.ts`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**

```ts
export const getDefaultMobilePlanTarget = (
  visiblePlans: Plans[],
  currentPlan: Plans,
  isAvailable: (plan: Plans) => boolean,
): Plans | undefined;
```

- Consumes: Tasks 1-2 shell, tabs, sections and action bar。
- Produces: one selected actionable plan for the bottom action; desktop card actions remain unchanged。

- [ ] **Step 1: 写失败测试，明确默认移动目标选择规则**

```ts
it('chooses the first available non-current plan for the mobile action', () => {
  expect(
    getDefaultMobilePlanTarget(
      [Plans.Hobby, Plans.Starter, Plans.Premium],
      Plans.Hobby,
      (plan) => plan === Plans.Premium,
    ),
  ).toBe(Plans.Premium);
});

it('returns undefined when no non-current plan can be purchased', () => {
  expect(getDefaultMobilePlanTarget([Plans.Hobby], Plans.Hobby, () => false)).toBeUndefined();
});
```

- [ ] **Step 2: 运行 `plansDisplay.test.ts` 并确认新导出不存在**

Run:

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/plansDisplay.test.ts"
```

Expected: FAIL because `getDefaultMobilePlanTarget` is not exported。

- [ ] **Step 3: 实现目标解析和移动选择状态**

实现函数必须按输入顺序寻找 `plan !== currentPlan && isAvailable(plan)`。`Plans.tsx` 在 catalog 或 billing cycle 改变时仅在当前选择不可购买时更新 `mobileSelectedPlan`，不能覆盖用户仍然有效的手动选择。

移动主操作按以下唯一规则生成：

```tsx
const mobileAction = mobileSelectedCatalogPlan && mobileSelectedPrice?.isAvailable
  ? {
      label: t('mobile.plans.upgradeTo', {
        plan:
          mobileSelectedCatalogPlan.displayName ||
          t(`plans.plan.${mobileSelectedPlan}.title`),
      }),
      onClick: () => handleUpgradeClick(mobileSelectedCatalogPlan),
    }
  : {
      label: t('billing.redeem.title'),
      onClick: () => setRedeemOpen(true),
    };
```

- [ ] **Step 4: 接入移动区块和 scroll snap**

移动布局顺序固定为：当前状态/周期（展开）、套餐卡片（展开）、套餐对比（折叠）、模型价格（折叠）、FAQ（折叠）。桌面保留现有三个 `Card` 和 `Table`。

`listPlanCatalog` 与 `listPlanFaq` 两个 SWR 调用必须读取 `error` 和 `mutate`。catalog 失败时在套餐卡片区显示 `mobile.plans.catalogError` 和重试按钮，不移除当前套餐摘要；FAQ 失败只在已展开的 FAQ 区显示错误和重试，不影响套餐卡片。default/zh-CN 文案为“套餐信息加载失败”“常见问题加载失败”，en-US 为“Failed to load plans”“Failed to load FAQ”。

套餐 grid 的移动样式必须包含：

```css
scroll-padding-inline: 16px;
scroll-snap-type: x mandatory;
overscroll-behavior-inline: contain;

> .ant-card {
  flex-basis: min(320px, calc(100vw - 48px));
  scroll-snap-align: start;
}
```

移动卡片点击更新 `mobileSelectedPlan`，选中态使用边框和 `aria-current`；移动卡片不重复显示 primary upgrade button，兑换码和升级由底部操作条承担。桌面按钮保持原样。

- [ ] **Step 5: 扩展移动呈现契约测试并运行**

先在 `mobilePresentation.test.ts` 提取后续任务共用的读取函数：

```ts
const readBusinessPage = (pageName: string) =>
  readFile(
    path.join(process.cwd(), `src/business/client/BusinessSettingPages/${pageName}.tsx`),
    'utf8',
  );
```

然后对 `Plans.tsx` 断言包含 `getDefaultMobilePlanTarget`、`scroll-snap-type`、三个 `defaultOpen={false}` 和 `mobileAction={mobileAction}`。新增 `mobile.plans.upgradeTo` 英中翻译。

Run:

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/plansDisplay.test.ts" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts"
```

Expected: PASS。

Commit:

```powershell
git add -- "src/business/client/BusinessSettingPages/Plans.tsx" "src/business/client/BusinessSettingPages/plansDisplay.ts" "src/business/client/BusinessSettingPages/plansDisplay.test.ts" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts" "packages/locales/src/default/subscription.ts" "locales/en-US/subscription.json" "locales/zh-CN/subscription.json"
git commit -m "📱 optimize mobile plan selection"
```

---

### Task 5: Credits Mobile Hierarchy And Record Cards

**Files:**

- Modify: `src/business/client/BusinessSettingPages/Credits.tsx`
- Modify: `src/business/client/BusinessSettingPages/mobilePresentation.test.ts`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**

- Consumes: `BusinessSettingsSection`、`BusinessMobileRecordList`、`buildTopUpOrderRecord`、`buildCreditLedgerRecord`。
- Produces: free-plan upgrade action or paid-plan redemption anchor; desktop tables unchanged。

- [ ] **Step 1: 写失败的移动页面契约断言**

```ts
it('uses mobile record cards and hides non-executable purchase controls on Credits', async () => {
  const source = await readBusinessPage('Credits');
  expect(source).toContain('buildTopUpOrderRecord');
  expect(source).toContain('buildCreditLedgerRecord');
  expect(source).toContain('mobile ? (');
  expect(source).toContain('mobileAction={mobileAction}');
  expect(source).toContain('defaultOpen={false}');
});
```

- [ ] **Step 2: 运行测试并确认缺少移动记录分支**

Run:

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts"
```

Expected: FAIL on missing builder/action strings。

- [ ] **Step 3: 将六个 `FormGroup` 替换为响应式区块**

固定默认状态：余额和补充积分路径展开；自动充值、兑换码、积分包记录、积分明细折叠。`Segmented` 在移动模式放入可横向滚动容器，`InputNumber` 和有效主按钮宽度为 `100%`。

在线支付关闭时，移动“购买积分”区不渲染当前 `handleTopUpAction` primary button；说明文字保留。桌面行为不变。

- [ ] **Step 4: 映射记录和错误重试状态**

从两个 SWR 调用读取 `error` 和 `mutate`。移动分支：

```tsx
const recordFormatters: BusinessRecordFormatters = {
  creditLedgerAllocation: getLedgerAllocationText,
  creditLedgerDescription: (item) =>
    formatCreditLedgerDescription(item.description, item.metadata),
  formatCredits,
  formatCurrency: formatCurrencyAmount,
  formatDate: formatBusinessDate,
  formatNumber: formatBusinessNumber,
  formatSignedCredits,
  t: (key, options) => t(key as any, options as any),
};

<BusinessMobileRecordList
  emptyDescription={t('credits.topUp.orders.empty')}
  error={ordersError ? t('mobile.error.title') : undefined}
  isLoading={isOrdersLoading}
  onRetry={() => void refreshOrders()}
  records={topUpOrders.map((item) => buildTopUpOrderRecord(item, recordFormatters))}
  sheetTitle={t('credits.topUp.orders.details')}
/>
```

积分流水使用同一结构和 `buildCreditLedgerRecord`。桌面继续渲染两个 `InlineTable`。

移动 action：免费计划使用 `{ href: '/settings/plans', label: t('upgradePlan') }`；付费计划使用 `{ href: '#credit-redemption', label: t('billing.redeem.title') }`。兑换区必须带 `id="credit-redemption"`。

- [ ] **Step 5: 增加所需英中文案、运行测试并提交**

新增 keys：`credits.topUp.orders.empty`、`credits.topUp.orders.details`、`credits.ledger.details`。运行：

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts" "src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.test.tsx"
```

Expected: PASS。

Commit:

```powershell
git add -- "src/business/client/BusinessSettingPages/Credits.tsx" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts" "packages/locales/src/default/subscription.ts" "locales/en-US/subscription.json" "locales/zh-CN/subscription.json"
git commit -m "📱 optimize mobile credits workflow"
```

---

### Task 6: Billing Mobile Summary And Change History

**Files:**

- Modify: `src/business/client/BusinessSettingPages/Billing.tsx`
- Modify: `src/business/client/BusinessSettingPages/mobilePresentation.test.ts`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**

- Consumes: `BusinessSettingsSection`、`BusinessMobileRecordList`、`buildBillingChangeRecord`。
- Produces: upgrade bottom action and mobile change-detail sheet。

- [ ] **Step 1: 添加失败契约测试**

```ts
it('uses a collapsed mobile change history and upgrade action on Billing', async () => {
  const source = await readBusinessPage('Billing');
  expect(source).toContain('buildBillingChangeRecord');
  expect(source).toContain("href: '/settings/plans'");
  expect(source).toContain('defaultOpen={false}');
  expect(source).toContain('BusinessMobileRecordList');
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts"
```

Expected: FAIL on missing builder and mobile list。

- [ ] **Step 3: 重排区块并保持桌面结构**

订阅摘要、待处理提示和当前套餐默认展开；兑换码和变更记录默认折叠。移动摘要只保留金额、状态、周期和续费/结束时间在首屏；subscription ID、开始时间和完整说明放入同一区块次级内容。

`BusinessSettingsPageShell` 接收：

```tsx
mobileAction={
  mobile
    ? { href: '/settings/plans', label: t('upgradePlan') }
    : undefined
}
```

- [ ] **Step 4: 用记录卡片替换移动表格并处理错误**

读取 history SWR 的 `error` 和 `mutate`。移动分支使用 `buildBillingChangeRecord`；桌面保留 `InlineTable`。空状态使用 `billing.changeHistory.empty`，抽屉标题使用 `billing.changeHistory.details`，错误重试调用当前 SWR `mutate()`。三份 locale 增加以下值：default/zh-CN 为“暂无套餐变更记录”“套餐变更详情”，en-US 为“No plan change history”“Plan change details”。

- [ ] **Step 5: 运行测试并提交**

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts" "src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.test.tsx"
```

Expected: PASS。

Commit:

```powershell
git add -- "src/business/client/BusinessSettingPages/Billing.tsx" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts" "packages/locales/src/default/subscription.ts" "locales/en-US/subscription.json" "locales/zh-CN/subscription.json"
git commit -m "📱 optimize mobile billing summary"
```

---

### Task 7: Referral Mobile Actions, Records, And Rules

**Files:**

- Modify: `src/business/client/BusinessSettingPages/Referral.tsx`
- Modify: `src/business/client/BusinessSettingPages/mobilePresentation.test.ts`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**

- Consumes: `BusinessSettingsSection`、`BusinessMobileRecordList`、`buildReferralHistoryRecord`。
- Produces: conditional reward action; no fixed action when reward is unavailable。

- [ ] **Step 1: 添加失败契约测试**

```ts
it('shows referral records as cards and gates the reward action', async () => {
  const source = await readBusinessPage('Referral');
  expect(source).toContain('buildReferralHistoryRecord');
  expect(source).toContain('canActivateReward');
  expect(source).toContain('mobileAction={mobileAction}');
  expect(source).toContain('BusinessMobileRecordList');
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run the existing `mobilePresentation.test.ts`; expected FAIL on record/action assertions。

- [ ] **Step 3: 实现移动信息层级和条件式 action**

推荐概览、推荐码、推荐链接和补填邀请码展开；推荐记录和计划规则折叠。`mobileAction` 必须为：

```tsx
const mobileAction = mobile && canActivateReward
  ? {
      label: t('referral.activateReward'),
      loading: isActivatingReward,
      onClick: () => void handleActivateReward(),
    }
  : undefined;
```

复制、编辑和保存按钮在 `360px` 下换行且高度至少 `44px`。保存失败继续保留 `draftCode`；不得在 catch 中清空。

- [ ] **Step 4: 接入记录卡片和重试**

从 referral history SWR 读取 `error`、`mutate`。移动记录使用 `buildReferralHistoryRecord`；空状态包含一个调用现有 `copyText(effectiveReferralLink, ...)` 的复制链接按钮；桌面继续使用 `InlineTable`。

- [ ] **Step 5: 运行测试并提交**

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts" "src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.test.tsx"
```

Expected: PASS。

Commit:

```powershell
git add -- "src/business/client/BusinessSettingPages/Referral.tsx" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts" "packages/locales/src/default/subscription.ts" "locales/en-US/subscription.json" "locales/zh-CN/subscription.json"
git commit -m "📱 optimize mobile referral workflow"
```

---

### Task 8: Usage Mobile Filters, Collapsible Charts, And Record Details

**Files:**

- Modify: `src/business/client/BusinessSettingPages/Usage.tsx`
- Modify: `src/routes/(main)/settings/stats/features/usage/UsageTable.tsx`
- Modify: `src/business/client/BusinessSettingPages/mobilePresentation.test.ts`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**

- Consumes: existing `UsageChartProps.mobile`、`BusinessMobileRecordList`、`buildUsageRecord`。
- Produces: `UsageTable` desktop table or mobile record list from the same SWR response。

- [ ] **Step 1: 写失败测试，锁定移动 prop 和单一数据请求**

```ts
it('passes mobile through to UsageTable and keeps the query inside UsageTable', async () => {
  const usagePage = await readBusinessPage('Usage');
  const usageTable = await readFile(
    path.join(
      process.cwd(),
      'src/routes/(main)/settings/stats/features/usage/UsageTable.tsx',
    ),
    'utf8',
  );

  expect(usagePage).toContain('<UsageTable dateStrings={month} mobile={mobile} />');
  expect(usageTable).toContain('mobile ? (');
  expect(usageTable).toContain('buildUsageRecord');
  expect(usageTable.match(/usageService\.findByMonth/g)).toHaveLength(1);
});
```

- [ ] **Step 2: 运行测试并确认 `mobile` 尚未传入**

Run `mobilePresentation.test.ts`; expected FAIL on exact `UsageTable` prop assertion。

- [ ] **Step 3: 重排筛选与图表区块**

移动模式把 DatePicker 和 Segmented 放入正文顶部 `styles.mobileFilters`，使用两行 `grid-template-columns: 1fr`；桌面继续通过 `desktopExtra` 放在第一个 FormGroup 标题区。核心指标默认展开，趋势图和详细记录默认折叠。

`UsageCards` 保持展开，`UsageTrends` 放入 `BusinessSettingsSection defaultOpen={false}`。移动不渲染桌面 FormGroup extra，避免控件压缩。

- [ ] **Step 4: 在 `UsageTable` 内使用同一 SWR 数据切换呈现**

组件签名改为：

```tsx
const UsageTable = memo<UsageChartProps>(({ dateStrings, mobile }) => {
```

移动分支：

```tsx
const usageFormatters: Pick<BusinessRecordFormatters, 'formatDate' | 'formatNumber' | 't'> = {
  formatDate: (value) => (value ? formatDate(new Date(value)) : '--'),
  formatNumber,
  t: (key, options) => t(key as any, options as any),
};

if (mobile) {
  return (
    <BusinessMobileRecordList
      emptyDescription={t('subscription:mobile.usage.records.empty')}
      error={error ? t('subscription:mobile.error.title') : undefined}
      isLoading={isLoading}
      onRetry={() => void mutate()}
      records={(data ?? []).map((item) => buildUsageRecord(item, usageFormatters))}
      sheetTitle={t('subscription:mobile.usage.records.details')}
    />
  );
}
```

桌面 `InlineTable`、分页 query params、filters 和 sorter 保持不变。

- [ ] **Step 5: 运行测试并提交**

新增 subscription keys `mobile.usage.records.empty` 和 `mobile.usage.records.details`：default/zh-CN 为“当前月份暂无用量记录”“用量记录详情”，en-US 为“No usage records for this month”“Usage record details”。运行：

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts" "src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.test.tsx"
```

Expected: PASS。

Commit:

```powershell
git add -- "src/business/client/BusinessSettingPages/Usage.tsx" "src/routes/(main)/settings/stats/features/usage/UsageTable.tsx" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts" "packages/locales/src/default/subscription.ts" "locales/en-US/subscription.json" "locales/zh-CN/subscription.json"
git commit -m "📱 optimize mobile usage details"
```

---

### Task 9: Integrated Responsive QA, Review, And Final Commit

**Files:**

- Review all files changed by Tasks 1-8。
- Temporary Playwright script: `%TEMP%\comhub-mobile-business-ux-check.cjs`，不得提交。
- Screenshots: `%TEMP%\comhub-mobile-business-*.png`，不得提交。

**Interfaces:**

- Validates all public behavior and desktop preservation; introduces no runtime API。

- [ ] **Step 1: 启动 Mobile 与 Web SPA 并验证两个 HTML 入口**

Start hidden:

```powershell
Start-Process -FilePath "pnpm.cmd" -ArgumentList @("dev:spa:mobile", "--", "--host", "127.0.0.1") -WorkingDirectory "E:\code\comhub\ci-verify-3bbf64f" -WindowStyle Hidden
Start-Process -FilePath "pnpm.cmd" -ArgumentList @("dev:spa", "--", "--host", "127.0.0.1") -WorkingDirectory "E:\code\comhub\ci-verify-3bbf64f" -WindowStyle Hidden
```

Verify:

```powershell
curl.exe -sS --max-time 8 -H "Accept: text/html" http://127.0.0.1:3012/settings/plans
curl.exe -sS --max-time 8 -H "Accept: text/html" http://127.0.0.1:9876/settings/plans
```

Expected: 两个请求均为 HTTP 200；3012 references `entry.mobile.tsx` and not `entry.web.tsx`，9876 references `entry.web.tsx` and not `entry.mobile.tsx`。

- [ ] **Step 2: 使用 Playwright 跑三个移动视口**

临时 Playwright 脚本在导航前注册 TRPC fixture。只拦截下列 procedure；其他请求继续走本地 proxy，因此仍可观察真实配置缺失错误。TRPC batch response 使用当前客户端需要的 `{ result: { data: { json } } }` envelope：

```js
const source = {
  other: { available: 0, consumed: 0, credited: 0 },
  referral: { available: 50_000_000, consumed: 0, credited: 50_000_000 },
  subscription: { available: 360_000_000, consumed: 140_000_000, credited: 500_000_000 },
  topup: { available: 240_000_000, consumed: 60_000_000, credited: 300_000_000 },
};
const fixtures = {
  'referral.getOverview': {
    currentReferralStatus: 'rewarded',
    referralCode: '1234567',
    rewardCreditsPerInvite: 50_000_000,
    totalInvites: 3,
    totalRewarded: 1,
    totalRewardedAmount: 50_000_000,
  },
  'referral.listHistory': [
    {
      createdAt: '2026-07-17T08:00:00.000Z',
      id: 'ref-1',
      inviteeEmail: 'mobile@example.com',
      inviterRewardAmount: 50_000_000,
      rewardedAt: '2026-07-18T08:00:00.000Z',
      status: 'rewarded',
    },
  ],
  'spend.listLedger': {
    items: [
      {
        amount: -20_000_000,
        balanceAfter: 650_000_000,
        createdAt: '2026-07-18T06:00:00.000Z',
        description: 'Mobile fixture usage',
        id: 'ledger-1',
        title: 'AI chat',
        type: 'consume',
      },
    ],
  },
  'spend.listTopUpOrders': [
    {
      amount: 29,
      createdAt: '2026-07-16T06:00:00.000Z',
      credits: 300_000_000,
      currency: 'CNY',
      id: 'order-1',
      source: 'redemption',
      status: 'paid',
    },
  ],
  'spend.listTopUpPackages': [],
  'subscription.getOverview': {
    account: {
      balance: 650_000_000,
      breakdown: source,
      currency: 'CNY',
      totalCredited: 850_000_000,
      totalDebited: 200_000_000,
      updatedAt: '2026-07-18T08:00:00.000Z',
    },
    subscription: {
      currency: 'CNY',
      cycle: 'monthly',
      isFreePlan: false,
      monthlyCredits: 500_000_000,
      monthlyPrice: 29,
      plan: 'starter',
      renewsAt: '2026-08-18T08:00:00.000Z',
      startedAt: '2026-07-18T08:00:00.000Z',
      status: 'active',
    },
  },
  'subscription.getPendingChangeRequest': null,
  'subscription.listChangeRequests': [
    {
      createdAt: '2026-07-18T08:00:00.000Z',
      cycle: 'yearly',
      fromPlan: 'starter',
      id: 'change-1',
      reason: 'upgrade',
      status: 'completed',
      toPlan: 'premium',
      updatedAt: '2026-07-18T09:00:00.000Z',
    },
  ],
  'subscription.listPlanCatalog': [],
  'subscription.listPlanFaq': [],
  'usage.findAndGroupByDay': [],
  'usage.findByMonth': [
    {
      createdAt: '2026-07-18T08:00:00.000Z',
      id: 'usage-1',
      model: 'gpt-mobile-fixture',
      provider: 'openai',
      spend: 0.012345,
      totalInputTokens: 1200,
      totalOutputTokens: 300,
      totalTokens: 1500,
      tps: 22.5,
      ttft: 640,
      type: 'chat',
      updatedAt: '2026-07-18T08:00:01.000Z',
      userId: 'user-1',
    },
  ],
};
const trpcResult = (json) => ({ result: { data: { json } } });

await page.route('**/trpc/**', async (route) => {
  const url = new URL(route.request().url());
  const encoded = url.pathname.split('/trpc/')[1];
  const procedures = decodeURIComponent(encoded || '').split(',');
  if (!procedures.every((procedure) => Object.hasOwn(fixtures, procedure))) {
    await route.continue();
    return;
  }
  await route.fulfill({
    body: JSON.stringify(procedures.map((procedure) => trpcResult(fixtures[procedure]))),
    contentType: 'application/json',
    status: 200,
  });
});
```

对 `360x800`、`390x844`、`430x932` 逐页执行：

1. 打开五个 `/settings/:tab` 路由。
2. 断言 `document.documentElement.scrollWidth === window.innerWidth`。
3. 断言一个移动 Header、一个 sticky tablist、活动 tab 可见。
4. 点击另一个 tab，断言 URL 变更且滚动容器 `scrollTop === 0`。
5. 展开和折叠 secondary section，断言 `aria-expanded` 与内容可见性一致。
6. 套餐 carousel 设置 `scrollLeft` 后断言数值大于 0，并检查 card snap CSS。
7. 打开一条记录卡片，断言 FloatingSheet 字段可见；关闭后断言触发按钮重新获得焦点。
8. 有 action bar 的状态检查安全区 padding 和最后一条内容可滚出遮挡区；无 action 的状态断言 action bar 不存在。
9. 收集 console/page errors；仅允许因本地 3010 未启动产生的已记录 proxy 502，禁止框架 overlay、React error 和布局异常。

- [ ] **Step 3: 在 9876 Web SPA 跑桌面回归**

以 `1280x900` 打开 `http://127.0.0.1:9876/settings/:tab` 五个路由，断言：

- `SettingHeader` 可见。
- `BusinessMobileTabs` 和 `BusinessMobileActionBar` 不存在。
- Billing、Credits、Referral、Usage 的 `InlineTable` 仍可见。
- Plans 套餐对比表仍可见。
- 页面内容 max width 和现有桌面 padding 未改变。

- [ ] **Step 4: 运行最终一次聚焦验证**

```powershell
node ".\node_modules\vitest\vitest.mjs" run "--silent=passed-only" "src/business/client/BusinessSettingPages/mobile/BusinessMobileTabs.test.tsx" "src/business/client/BusinessSettingPages/mobile/BusinessMobileSection.test.tsx" "src/business/client/BusinessSettingPages/mobile/BusinessMobileActionBar.test.tsx" "src/business/client/BusinessSettingPages/mobile/BusinessMobileRecordList.test.tsx" "src/business/client/BusinessSettingPages/mobile/businessRecordBuilders.test.tsx" "src/business/client/BusinessSettingPages/plansDisplay.test.ts" "src/business/client/BusinessSettingPages/mobilePresentation.test.ts" "src/routes/(main)/settings/features/SettingsContent.test.tsx" "src/spa/router/mobileRouter.test.tsx" "src/features/Admin/adminChineseCopy.test.ts"
& ".\node_modules\.bin\tsgo.cmd" --noEmit
$lintFiles = git diff --name-only ab462c85b3..HEAD -- "*.ts" "*.tsx"
node ".\node_modules\eslint\bin\eslint.js" --quiet $lintFiles
node ".\node_modules\prettier\bin\prettier.cjs" --check "src/business/client/BusinessSettingPages" "src/routes/(main)/settings/stats/features/usage/UsageTable.tsx" "packages/locales/src/default/subscription.ts" "locales/en-US/subscription.json" "locales/zh-CN/subscription.json"
git diff --check
```

Expected: all focused Vitest files pass, `tsgo` and targeted ESLint exit 0, Prettier reports all matched files formatted, `git diff --check` prints no errors。Stylelint若仍因本地缺少 `stylelint-config-standard` 无法启动，必须保留原始错误并记录为环境阻塞，不能宣称通过。

- [ ] **Step 5: 按项目 review checklist 审查并修复发现**

逐项检查：

- 没有重复移动标题、hover-only 操作、嵌套装饰卡片或无效支付 CTA。
- 所有新文案存在 default/en-US/zh-CN 三份。
- 移动记录卡片完整保留桌面表格字段。
- action bar 只在可执行状态出现，并且每页最多一个 primary action。
- 没有新增 API、依赖、数据库、路由或生产功能开关。
- 无临时截图、日志、Playwright 脚本或服务器清理记录进入项目。

- [ ] **Step 6: 停止 3012 和 9876 临时服务、检查状态并提交最终修正**

使用 `Get-NetTCPConnection` 读取 3012 与 9876 的实际 `OwningProcess`，仅停止这两个已核对命令行为当前仓库 Vite 的进程，然后运行：

```powershell
git status --short --branch
git diff --stat
git diff --check
```

若 review 产生尚未提交的修正，使用：

```powershell
git add -- "src/business/client/BusinessSettingPages" "src/routes/(main)/settings/stats/features/usage/UsageTable.tsx" "packages/locales/src/default/subscription.ts" "locales/en-US/subscription.json" "locales/zh-CN/subscription.json" "src/features/Admin/adminChineseCopy.test.ts"
git commit -m "✅ verify mobile commercial settings UX"
```

最终状态必须为干净工作区。不得 push 或 deploy。

## Spec Coverage Audit

| Design requirement | Implemented by |
| --- | --- |
| 五页吸顶切换、personal-only 路由、活动项可见 | Task 1 |
| 核心展开、次要折叠、44px 触控 | Task 2 and Tasks 4-8 |
| 条件式底部主操作、安全区、不遮挡内容 | Task 2 and Tasks 4-7 |
| 记录卡片、四种数据状态、详情抽屉、焦点恢复 | Task 3 and Tasks 5-8 |
| 套餐选择、横滑提示、scroll snap、折叠对比/价格/FAQ | Task 4 |
| 积分层级、不可支付状态、两类记录 | Task 5 |
| 账单摘要、升级操作、变更详情 | Task 6 |
| 推荐复制/编辑/奖励、记录和规则 | Task 7 |
| 用量筛选、指标、折叠图表、记录详情且不复制请求 | Task 8 |
| default/en-US/zh-CN 文案 | Tasks 1-8 and final review |
| 360/390/430 移动、1280 桌面、交互和 console 验证 | Task 9 |
| 不新增 API/支付/数据库/PWA/原生端，不 push/deploy | Global Constraints and Task 9 review |

Self-review result: every design acceptance criterion maps to at least one implementation task and one verification step; no uncovered requirement remains.
