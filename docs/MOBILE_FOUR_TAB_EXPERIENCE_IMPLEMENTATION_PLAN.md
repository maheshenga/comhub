# Mobile Four-Tab Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current mobile three-tab experience with a configurable four-tab workspace containing Recent, Design, Discover, and Apps while preserving desktop behavior and existing domain services.

**Architecture:** Add one versioned mobile configuration contract shared by the public client and admin preview. A thin mobile shell renders configured navigation and delegates each top-level route to a focused feature adapter. Existing session, recent, document, image, PPT, community, model, and module-app services remain authoritative.

**Tech Stack:** Next.js 16, React 19, React Router, TypeScript, `@lobehub/ui`, `@lobehub/ui/base-ui`, antd-style, SWR, TRPC, Drizzle/PostgreSQL, Vitest, Playwright.

## Global Constraints

- Preserve all desktop routes and desktop page behavior.
- Keep platform online payments disabled.
- Use four stable navigation slots; at least two must remain visible.
- Bottom navigation labels, Lucide icons, order, visibility, and internal paths are admin configurable.
- Mobile brand name and logo inherit global branding when blank.
- User pinning remains personal and reuses the existing persisted session `pinned` state.
- Discover renders at most four configured assistants in a two-by-two grid and shows a validated recommended model.
- Design aggregates existing document, image, and PPT records without copying source data.
- Apps combines a controlled built-in registry with authorized installed module apps.
- Run targeted tests during implementation and one final browser matrix only.

---

### Task 1: Versioned Mobile Configuration Contract

**Files:**

- Create: `src/const/mobileConfig.ts`
- Create: `src/const/mobileConfig.test.ts`
- Modify: `src/const/appSettingsRegistry.ts`
- Modify: `src/const/appSettingsRegistry.test.ts`

**Interfaces:**

- Produces: `MobilePublicConfigV1`, `DEFAULT_MOBILE_CONFIG`, `normalizeMobileConfig`, `validateMobileInternalPath`, `MOBILE_ICON_NAMES`.
- Produces: `APP_SETTING_KEYS.mobileConfig` in the `mobile` app-settings section.
- Consumes: no runtime services; all functions are pure.

- [ ] **Step 1: Write failing contract tests**

```ts
expect(normalizeMobileConfig(undefined)).toEqual(DEFAULT_MOBILE_CONFIG);
expect(normalizeMobileConfig({ version: 999 })).toEqual(DEFAULT_MOBILE_CONFIG);
expect(validateMobileInternalPath('javascript:alert(1)')).toBe(false);
expect(validateMobileInternalPath('/design')).toBe(true);
expect(
  normalizeMobileConfig({
    navigation: { items: [{ id: 'slot-1', visible: true }] },
    version: 1,
  }).navigation.items.filter((item) => item.visible).length,
).toBeGreaterThanOrEqual(2);
```

- [ ] **Step 2: Run the tests and confirm RED**

Run:

```powershell
bunx vitest run --silent='passed-only' src/const/mobileConfig.test.ts src/const/appSettingsRegistry.test.ts
```

Expected: failure because the contract and `mobileConfig` setting key do not exist.

- [ ] **Step 3: Implement the pure contract**

```ts
export interface MobilePublicConfigV1 {
  applications: {
    builtins: MobileBuiltinAppV1[];
    featuredModuleAppIds: string[];
  };
  brand: { displayName: null | string; logoUrl: null | string };
  design: { tools: MobileDesignToolV1[] };
  discover: { assistants: MobileFeaturedAssistantV1[]; title: string };
  navigation: { items: MobileNavigationItemV1[] };
  version: 1;
}

export const normalizeMobileConfig = (input: unknown): MobilePublicConfigV1 => {
  // Parse unknown data, restrict IDs/icons/routes, repair order, enforce four slots,
  // and restore enough visible defaults to keep primary navigation usable.
};
```

The implementation must use structured validation, return fresh immutable arrays, cap discover assistants at four, enforce label lengths, and only accept controlled icon names.

- [ ] **Step 4: Register the setting and section**

```ts
mobileConfig: 'mobile.config',
```

Add `'mobile'` to `APP_SETTINGS_SECTIONS` and map only `APP_SETTING_KEYS.mobileConfig` into that section.

- [ ] **Step 5: Run GREEN verification**

Run the Task 1 Vitest command and:

```powershell
.\node_modules\.bin\tsgo.cmd --noEmit
```

- [ ] **Step 6: Commit**

```text
feat: define versioned mobile configuration

Constraint: Reject unsafe paths and preserve four stable navigation slots.
Tested: mobileConfig and appSettingsRegistry Vitest; tsgo --noEmit.
```

### Task 2: Backend Read Models and Public Configuration

**Files:**

- Modify: `packages/business-server/src/appSettings/adminReadModel.ts`
- Modify: `packages/business-server/src/appSettings/adminReadModel.test.ts`
- Modify: `packages/business-server/src/appSettings/readers/publicProcedures.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.test.ts`
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/services/adminCommercial.test.ts`

**Interfaces:**

- Consumes: `normalizeMobileConfig`, `DEFAULT_MOBILE_CONFIG`, `APP_SETTING_KEYS.mobileConfig`.
- Produces: `buildMobileSettings(snapshot)` and `getPublicMobileConfig()`.
- Produces client service methods `getMobileSettings()` and `saveMobileSettings(config)` using existing settings read/batch-write procedures.

- [ ] **Step 1: Add failing backend tests**

```ts
expect(buildMobileSettings(snapshot)).toEqual(normalizeMobileConfig(rawConfig));
await expect(caller.getPublicMobileConfig()).resolves.toEqual(expectedConfig);
expect(result.brand.displayName).toBeNull();
```

Cover missing settings, malformed versions, invalid routes, assistant overflow, and valid version 1 data.

- [ ] **Step 2: Run backend tests and confirm RED**

```powershell
bunx vitest run --silent='passed-only' packages/business-server/src/appSettings/adminReadModel.test.ts packages/business-server/src/lambda-routers/admin/settings.test.ts src/services/adminCommercial.test.ts
```

- [ ] **Step 3: Implement read models and public procedure**

```ts
export const buildMobileSettings = (snapshot: AppSettingsSnapshot) =>
  normalizeMobileConfig(snapshot.get(APP_SETTING_KEYS.mobileConfig));

getPublicMobileConfig: publicDbProcedure.query(async ({ ctx }) =>
  buildMobileSettings(await loadAppSettingsSectionSnapshot(ctx.serverDB, 'mobile')),
```

Admin saves must normalize before persistence and use one batch update so the versioned object cannot be partially written.

- [ ] **Step 4: Add service wrappers and GREEN verification**

Run the Task 2 Vitest command and targeted ESLint for changed files.

- [ ] **Step 5: Commit**

```text
feat: expose validated mobile configuration

Constraint: Return safe defaults for missing or malformed persisted settings.
Tested: admin settings read-model, router, and client service Vitest.
```

### Task 3: Admin Mobile Settings Page

**Files:**

- Create: `src/features/Admin/AdminMobileSettingsPage.tsx`
- Create: `src/features/Admin/AdminMobileSettingsPage.test.tsx`
- Create: `src/features/Admin/MobileConfigPreview.tsx`
- Create: `src/features/Admin/MobileConfigPreview.test.tsx`
- Create: `src/routes/(main)/admin/mobile/index.tsx`
- Modify: `src/features/Admin/adminCatalog.ts`
- Modify: `src/features/Admin/adminCatalog.test.ts`
- Modify: `src/features/Admin/adminNavigation.test.ts`
- Modify: `src/business/client/adminSettingsRouteRegistry.ts`
- Create: `src/business/client/adminSettingsRouteRegistry.test.ts`
- Modify: `src/features/Admin/index.ts`

**Interfaces:**

- Consumes: `MobilePublicConfigV1`, `normalizeMobileConfig`, `MOBILE_ICON_NAMES`, admin commercial service, assistant/model/module-app selectors.
- Produces: `/settings/admin/mobile` under the `client-integrations` group with `systemRead/systemWrite` access.

- [ ] **Step 1: Add failing catalog and route tests**

```ts
expect(ADMIN_CATALOG).toContainEqual(
  expect.objectContaining({
    id: 'mobile',
    path: '/settings/admin/mobile',
  }),
);
expect(ADMIN_SETTINGS_ROUTE_SEGMENTS).toContain('mobile');
```

- [ ] **Step 2: Add failing page interaction tests**

Cover loading, normalized initial values, label/icon/path edits, reordering, visibility validation, assistant/model selection, restoring defaults, dirty state, preview updates, and successful/failed save feedback.

- [ ] **Step 3: Implement the page and preview**

The page uses six un-nested sections: Brand, Bottom Navigation, Design Tools, Featured Assistants, App Entries, and Preview. Reordering uses explicit arrow icon buttons; icon selection uses a controlled menu; boolean visibility uses switches; numeric order is not directly editable.

```tsx
<AdminMobileSettingsPage />
<MobileConfigPreview config={normalizeMobileConfig(formValues)} />
```

- [ ] **Step 4: Run targeted page, route, and catalog tests**

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/AdminMobileSettingsPage.test.tsx src/features/Admin/MobileConfigPreview.test.tsx src/features/Admin/adminCatalog.test.ts src/features/Admin/adminNavigation.test.ts src/business/client/adminSettingsRouteRegistry.test.ts
```

- [ ] **Step 5: Commit**

```text
feat: add mobile experience administration

Constraint: Use controlled icons, internal paths, and atomic versioned saves.
Tested: admin page, preview, catalog, navigation, and route registry Vitest.
```

### Task 4: Configurable Mobile Shell and Routes

**Files:**

- Create: `src/features/MobileWorkspace/useMobileConfig.ts`
- Create: `src/features/MobileWorkspace/useMobileConfig.test.tsx`
- Create: `src/features/MobileWorkspace/MobileTabBar.tsx`
- Create: `src/features/MobileWorkspace/MobileTabBar.test.tsx`
- Create: `src/features/MobileWorkspace/MobilePageLayout.tsx`
- Create: `src/features/MobileWorkspace/navigation.ts`
- Create: `src/features/MobileWorkspace/navigation.test.ts`
- Modify: `src/routes/(mobile)/_layout/index.tsx`
- Remove: `src/routes/(mobile)/_layout/NavBar.tsx`
- Modify: `src/spa/router/mobileRouter.config.tsx`
- Modify: `src/spa/router/mobileRouter.test.tsx`

**Interfaces:**

- Consumes: public mobile config endpoint and normalized fallback.
- Produces: dynamic four-slot tab bar, active-route resolver, main-page layout, and routes `/design`, `/discover`, `/apps` before `/:workspaceSlug`.

- [ ] **Step 1: Add failing navigation tests**

```ts
expect(resolveMobileActiveSlot('/', config)).toBe('slot-1');
expect(resolveMobileActiveSlot('/community/agent/demo', config)).toBe('slot-3');
expect(shouldShowMobileTabBar('/agent/a/topic')).toBe(false);
```

Cover renamed tabs, reordered tabs, hidden tabs, custom valid paths, and safe fallback.

- [ ] **Step 2: Add failing router tests**

Assert all three reserved root paths appear before the workspace slug route and deep community routes remain registered.

- [ ] **Step 3: Implement config hook and shell**

```tsx
const { config, error, mutate } = useMobileConfig();
const visibleItems = config.navigation.items
  .filter((item) => item.visible)
  .sort((a, b) => a.order - b.order);
```

Use `MobileContentLayout`, a stable safe-area tab height, accessible icon labels, workspace-aware navigation, and route-based tab visibility. Do not let async config loading resize the shell.

- [ ] **Step 4: Register thin route elements**

Route files must import features only. Deep chat, group, community, settings, and business routes remain unchanged.

- [ ] **Step 5: Run targeted tests and commit**

```text
feat: add configurable mobile workspace shell

Constraint: Reserve mobile root routes before workspace slug matching.
Tested: mobile navigation, config hook, tab bar, and router Vitest.
```

### Task 5: Recent Page with Personal Pins and AI Groups

**Files:**

- Create: `src/features/MobileWorkspace/Recent/index.tsx`
- Create: `src/features/MobileWorkspace/Recent/index.test.tsx`
- Create: `src/features/MobileWorkspace/Recent/recentItems.ts`
- Create: `src/features/MobileWorkspace/Recent/recentItems.test.ts`
- Create: `src/features/MobileWorkspace/Recent/RecentConversationRow.tsx`
- Modify: `src/routes/(mobile)/(home)/index.tsx`
- Modify: `src/services/recent/index.ts`
- Modify: `apps/server/src/routers/lambda/recent.ts`
- Modify: `packages/database/src/models/recent.ts` only if the existing query cannot filter topic records without changing result semantics.

**Interfaces:**

- Consumes: existing `sessionSelectors.pinnedSessions`, all sessions, `recentService.getAll({ types: ['topic'] })`, and existing session pin mutation.
- Produces: `buildMobileRecentItems` pure selector and compact recent page.

- [ ] **Step 1: Write failing selector tests**

Cover pinned agents first, pinned AI groups, group topic route mapping, duplicate removal, pinned removal from normal recents, invalid orphan records, and descending time order.

```ts
expect(buildMobileRecentItems(input)).toEqual({
  pinned: [pinnedAgent, pinnedGroup],
  recent: [newerTopic, olderGroupTopic],
});
```

- [ ] **Step 2: Add failing component tests**

Cover search filtering, loading skeleton, empty state, retry, refresh, long-press alternative via More menu, pin/unpin, group badge, route navigation, and bottom padding.

- [ ] **Step 3: Implement backwards-compatible recent filtering**

```ts
getAll: recentProcedure.input(
  z
    .object({
      limit: z.number().optional(),
      types: z.array(z.enum(['topic', 'document', 'task'])).optional(),
    })
    .optional(),
);
```

Existing callers without `types` must receive unchanged results.

- [ ] **Step 4: Implement compact page and reuse SessionHydration**

Do not duplicate pin persistence. Use the existing session action that updates `pinned` and refreshes session state.

- [ ] **Step 5: Run targeted tests and commit**

```text
feat: build pinned mobile recent conversations

Constraint: Reuse user-owned session pins and preserve existing recent API callers.
Tested: recent model/router/service, selector, and mobile recent page Vitest.
```

### Task 6: Mobile Design Center

**Files:**

- Create: `src/features/MobileWorkspace/Design/index.tsx`
- Create: `src/features/MobileWorkspace/Design/index.test.tsx`
- Create: `src/features/MobileWorkspace/Design/designItems.ts`
- Create: `src/features/MobileWorkspace/Design/designItems.test.ts`
- Create: `src/routes/(mobile)/design/index.tsx`
- Add or modify a focused Lambda query under `apps/server/src/routers/lambda/` for recent design work.
- Add focused service wrapper under `src/services/`.

**Interfaces:**

- Consumes: normalized design tools and authoritative document/image/PPT repositories.
- Produces: `MobileRecentDesignItem[]` sorted by `updatedAt`, plus create/open actions for all three kinds.

- [ ] **Step 1: Trace existing document, image, and PPT list/create APIs**

Record exact existing repository and route calls in the task notes before editing. Do not create replacement persistence.

- [ ] **Step 2: Add failing aggregation tests**

Cover merged ordering, per-domain permission filtering, partial-domain failure, limit handling, route paths, and empty titles.

- [ ] **Step 3: Implement read-only aggregation and service**

```ts
interface MobileRecentDesignItem {
  id: string;
  kind: 'document' | 'image' | 'ppt';
  routePath: string;
  status?: string;
  title: string;
  updatedAt: Date;
}
```

- [ ] **Step 4: Implement the page**

Render configured quick-create tools first and recent work below. Each tool uses the existing create flow. Each recent item navigates to the existing editor route. Include independent loading/error state for the aggregate query.

- [ ] **Step 5: Run targeted tests and commit**

```text
feat: add mobile design center

Constraint: Aggregate existing design records without copying source data.
Tested: recent-design aggregation, service, and mobile design page Vitest.
```

### Task 7: Recommended Assistant Discover Page

**Files:**

- Create: `src/features/MobileWorkspace/Discover/index.tsx`
- Create: `src/features/MobileWorkspace/Discover/index.test.tsx`
- Create: `src/features/MobileWorkspace/Discover/featuredAssistants.ts`
- Create: `src/features/MobileWorkspace/Discover/featuredAssistants.test.ts`
- Create: `src/routes/(mobile)/discover/index.tsx`
- Modify the public mobile configuration reader to resolve published assistant and valid model display data without exposing private fields.

**Interfaces:**

- Consumes: up to four configured assistant IDs and provider/model pairs.
- Produces: validated assistant cards linking to `/community/agent/:slug`.

- [ ] **Step 1: Write failing resolver tests**

Cover configured order, unpublished assistants, deleted assistants, inaccessible assistants, invalid models, title/description overrides, and a maximum of four results.

- [ ] **Step 2: Write failing page tests**

Cover two-by-two layout, fewer than four cards without filler, model badges, loading, empty state, retry, and detail navigation.

- [ ] **Step 3: Implement resolver and page**

Do not render independent model/provider/MCP/Skill/announcement sections. Invalid cards are skipped without leaving placeholders.

- [ ] **Step 4: Run targeted tests and commit**

```text
feat: add curated mobile assistant discovery

Constraint: Show only valid configured assistants and models, capped at four cards.
Tested: featured assistant resolver and discover page Vitest.
```

### Task 8: Mobile Apps Center

**Files:**

- Create: `src/features/MobileWorkspace/Apps/index.tsx`
- Create: `src/features/MobileWorkspace/Apps/index.test.tsx`
- Create: `src/features/MobileWorkspace/Apps/builtinApps.ts`
- Create: `src/features/MobileWorkspace/Apps/builtinApps.test.ts`
- Create: `src/routes/(mobile)/apps/index.tsx`
- Modify: `src/features/ModuleAppMarket/AppCard.tsx` only for reusable compact/mobile props if required.
- Modify: `src/features/ModuleAppMarket/AppCard.test.tsx` if the shared card contract changes.

**Interfaces:**

- Consumes: configured built-in entries, controlled built-in registry, `moduleAppService.listMyApps()`, and featured module-app IDs.
- Produces: built-in function grid and authorized installed app list.

- [ ] **Step 1: Add failing registry merge tests**

Cover rename, icon override, reorder, hide, unsafe path rejection, unknown built-in IDs, featured app ordering, and unauthorized app removal.

- [ ] **Step 2: Add failing page tests**

Cover loading, empty installed apps, partial service failure, built-in navigation, installed app opening, app-market entry, and bottom padding.

- [ ] **Step 3: Implement controlled merge and page**

The built-in registry owns executable IDs and safe defaults. Admin configuration can alter presentation and valid internal paths but cannot inject code or unpublished module apps.

- [ ] **Step 4: Run targeted tests and commit**

```text
feat: add mobile apps center

Constraint: Merge configured built-ins with authorized installed module apps.
Tested: built-in registry merge and mobile apps page Vitest.
```

### Task 9: Localization, Integration, and Final Verification

**Files:**

- Modify: `packages/locales/src/default/common.ts`
- Modify: `locales/en-US/common.json`
- Modify: `locales/zh-CN/common.json`
- Modify focused tests discovered during Tasks 1-8.
- Create: `e2e` or temporary Playwright coverage only if the repository already has a matching mobile matrix harness.

**Interfaces:**

- Consumes all completed tasks.
- Produces final localized, integrated, reviewed mobile experience.

- [ ] **Step 1: Add English and Chinese keys**

Cover tab defaults, section labels, loading/empty/error/retry states, pin actions, admin labels/help text, validation messages, preview labels, and restore-default confirmation.

- [ ] **Step 2: Run the focused Vitest set once**

Collect every test file changed or created by Tasks 1-8 into one `vitest run` command. Fix only observed failures and rerun failed files, not the entire repository suite.

- [ ] **Step 3: Run static verification**

```powershell
.\node_modules\.bin\tsgo.cmd --noEmit
node .\node_modules\eslint\bin\eslint.js --max-warnings 0 <changed-ts-files>
node .\node_modules\prettier\bin\prettier.cjs --check <changed-files>
git diff --check
```

Parse the three touched locale resources and verify every new key is present.

- [ ] **Step 4: Run one Playwright matrix**

Viewports:

- 360x800
- 390x844
- 430x932
- 1280x900 desktop regression

Cover all four tabs, configured navigation, pin/unpin, AI groups, design quick-create/recent work, four featured assistants, apps, admin preview, deep-page tab hiding, browser back, scroll restoration, focus restoration, horizontal overflow, bottom-bar obstruction, React warnings, and page errors.

- [ ] **Step 5: Request final code review**

Fix all Critical and Important findings. Record any accepted Minor test-depth gaps in the final report.

- [ ] **Step 6: Commit the final integration**

```text
feat: complete configurable mobile workspace

Constraint: Preserve desktop behavior, keep payments disabled, and use one browser QA matrix.
Tested: focused Vitest; tsgo; ESLint; Prettier; locale checks; Playwright matrix; git diff check.
```
