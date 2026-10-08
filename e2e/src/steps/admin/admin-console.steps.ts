import { Given, Then, When } from '@cucumber/cucumber';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import {
  ADMIN_TEST_USER,
  loginAdminUser,
  seedAdminTestUser,
} from '../../support/seedAdminTestUser';
import type { CustomWorld } from '../../support/world';

// ============================================
// Helpers
// ============================================

/**
 * Locate the admin data table wrapper: AdminResponsiveTable renders a
 * `role="region"` with aria-label (AdminPage.tsx:462), InlineTable renders an
 * antd Table inside it. Labels with an existing i18n key (admin.*.tableLabel)
 * switch with the browser language, so match both en-US and zh-CN — same
 * dual-language approach as community/smoke.steps.ts.
 */
const adminTable = (page: Page, zhLabel: string, enLabel: string): Locator =>
  page.locator(
    `[role="region"][aria-label="${zhLabel}"], [role="region"][aria-label="${enLabel}"]`,
  );

/**
 * antd Modal: the typed-confirmation dialog opened by AdminDangerousActionButton.
 * `.ant-modal-hidden` stays in the DOM for closed dialogs, so exclude it.
 */
const adminModal = (page: Page): Locator =>
  page.locator('.ant-modal:not(.ant-modal-hidden)').first();

/**
 * Section/aside headings backed by existing i18n keys — dual-language locators.
 */
const zhOrEn = (zh: string, en: string) => `text="${zh}", text="${en}"`;

// ============================================
// Given Steps (Preconditions)
// ============================================

Given('I am logged in as an admin test user', async function (this: CustomWorld) {
  // Seed/upsert the admin user (role = admin) directly into the database,
  // then sign in via the auth API and restore the session cookies.
  await seedAdminTestUser();
  await loginAdminUser(this.page);
  console.log(`✅ Logged in as admin test user (${ADMIN_TEST_USER.email})`);
});

// ============================================
// Then Steps (Assertions)
// ============================================

Then('the admin layout shell should be visible', async function (this: CustomWorld) {
  // AdminLayout gates on `isUserStateInit`; wait for the shell testid so we
  // don't assert against the loading skeleton (admin/_layout/index.tsx:205).
  const shell = this.page.getByTestId('admin-layout-shell');
  await expect(shell).toBeVisible({ timeout: 30_000 });
});

Then('the admin workbench should not be blank', async function (this: CustomWorld) {
  // AdminOverviewPage renders hardcoded zh labels for the page shell:
  // h1 后台工作台 and section 管理模块 (AdminOverviewPage.tsx:170-285) —
  // these have no i18n key, so they render identically in every language.
  await expect(this.page.getByRole('heading', { level: 1, name: '后台工作台' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(this.page.getByRole('heading', { name: '管理模块' })).toBeVisible();

  // Metric strip aria-label comes from an existing i18n key
  // (admin.overview.metricsLabel → en "Key metrics" / zh "关键指标").
  await expect(
    this.page.locator(`section[aria-label="${zhOrEn('关键指标', 'Key metrics')}"]`).first(),
  ).toBeVisible();

  // Sidebar aria-label comes from admin.navigation.title
  // (admin/_layout/index.tsx:207 → en "Administration" / zh "管理后台").
  await expect(
    this.page.locator(`aside[aria-label="${zhOrEn('管理后台', 'Administration')}"]`),
  ).toBeVisible();
});

Then('the admin user list should be loaded', async function (this: CustomWorld) {
  // Section header (admin.users.listTitle → "用户列表"/"User list") + table
  // region (admin.users.tableLabel → "用户数据表"/"User data table").
  await expect(this.page.getByRole('heading', { name: /用户列表|User list/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(adminTable(this.page, '用户数据表', 'User data table')).toBeVisible();
});

Then('the user table should show the empty state', async function (this: CustomWorld) {
  // antd Empty inside the table after filtering a non-matching query.
  const empty = this.page.locator('.ant-empty');
  await expect(empty.first()).toBeVisible({ timeout: 30_000 });
});

Then('the admin order list should be loaded', async function (this: CustomWorld) {
  // Section 订单记录 (admin.orders.listTitle → "Order records") + table region
  // 订单数据表 (admin.orders.tableLabel → "Order data table").
  await expect(this.page.getByRole('heading', { name: /订单记录|Order records/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(adminTable(this.page, '订单数据表', 'Order data table')).toBeVisible();
});

Then(
  'the audit actor filter should be prefilled with {string}',
  async function (this: CustomWorld, expected: string) {
    // The actor filter Input placeholder has no i18n entry, so the hardcoded
    // defaultValue 操作者用户 ID renders in every language
    // (admin/audit/index.tsx:283-287); the value is initialized from the
    // ?actorUserId= search param (index.tsx:98).
    const actorInput = this.page.getByPlaceholder('操作者用户 ID');
    await expect(actorInput).toBeVisible({ timeout: 30_000 });
    await expect(actorInput).toHaveValue(expected);
  },
);

Then(
  'the audit page should keep rendering without a load error',
  async function (this: CustomWorld) {
    // Section 操作日志 (no i18n key → constant defaultValue,
    // admin/audit/index.tsx:276) stays mounted; the AdminPageError fallback
    // (审计日志加载失败, index.tsx:353) must NOT appear.
    await expect(this.page.getByRole('heading', { name: '操作日志' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(this.page.getByText('审计日志加载失败，请重试。')).toHaveCount(0);
  },
);

// ============================================
// When Steps (Actions)
// ============================================

When('I search users for {string}', async function (this: CustomWorld, query: string) {
  // Input.Search placeholder (no i18n key → constant 搜索用户,
  // routes/(main)/admin/users/index.tsx:550); antd Search submits on Enter.
  const search = this.page.getByPlaceholder('搜索用户');
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(query);
  await search.press('Enter');
});

When('I set the audit actor filter to {string}', async function (this: CustomWorld, value: string) {
  const actorInput = this.page.getByPlaceholder('操作者用户 ID');
  await expect(actorInput).toBeVisible({ timeout: 30_000 });
  await actorInput.fill(value);
});

When('I open the {string} confirmation', async function (this: CustomWorld, buttonText: string) {
  // Danger zone button on /settings/admin/users
  // (users/index.tsx:680-705, requires isFullAdminRole); its label has no
  // i18n key, so the defaultValue renders in every language.
  const trigger = this.page.getByRole('button', { name: buttonText }).first();
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();
});

Then(
  'the confirmation dialog should require typing {string}',
  async function (this: CustomWorld, requiredText: string) {
    const modal = adminModal(this.page);
    await expect(modal).toBeVisible({ timeout: 30_000 });

    // AdminDangerousActionButton renders the typed-confirm hint
    // (`admin.dangerousAction.typedConfirm` → "输入 {{text}} 以确认。" /
    // "Type {{text}} to confirm.") plus the Input whose placeholder is the
    // required action id (AdminDangerousActionButton.tsx:140-155).
    await expect(
      modal
        .getByText(`输入 ${requiredText} 以确认。`)
        .or(modal.getByText(`Type ${requiredText} to confirm.`)),
    ).toBeVisible();
    await expect(modal.locator('.ant-input').first()).toHaveAttribute('placeholder', requiredText);
  },
);

Then(
  'confirming with a wrong text should show a mismatch error',
  async function (this: CustomWorld) {
    const modal = adminModal(this.page);

    // Type a wrong value and submit: validateAdminDangerousActionConfirmation
    // pushes 'confirmation_text_mismatch' before any request is made, so this
    // is a pure-UI gate with no side effects.
    await modal.locator('.ant-input').first().fill('wrong-confirmation');
    await modal.getByRole('button', { name: /重置所有用户为免费套餐/ }).click();
    await expect(
      modal
        .getByText('确认文本不匹配。')
        .or(modal.getByText('The confirmation text does not match.')),
    ).toBeVisible({ timeout: 30_000 });

    // The modal stays open — the action was not executed.
    await expect(modal).toBeVisible();
    // Close via the antd close icon (footer button label depends on locale).
    await modal.locator('.ant-modal-close').click();
  },
);
