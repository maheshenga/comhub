# Mobile Workspace UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one coherent, responsive mobile design system for the four ComHub workspace tabs and make the admin preview accurately represent those production tabs.

**Architecture:** Add small presentational primitives inside `src/features/MobileWorkspace/components`, then migrate Recent, Design, Discover, Apps, the shell, and the admin preview onto those primitives. Keep all existing services, SWR keys, workspace routing, configuration version 1, and publication contracts unchanged.

**Tech Stack:** React 19, TypeScript, Next.js SPA routes, `@lobehub/ui`, `@lobehub/ui/base-ui`, `@lobehub/ui/mobile`, `antd-style`, SWR, Vitest, Testing Library.

## Global Constraints

- Use DingTalk-like information hierarchy and compact density with LobeHub tokens and interaction language.
- Keep `MobileTabBar` as semantic native buttons; do not replace it with `@lobehub/ui/mobile` `TabBar`.
- Use `src/components`, then `@lobehub/ui/base-ui`, then `@lobehub/ui`; antd is the last resort.
- Use `createStaticStyles` and `cssVar`; do not add a hard-coded palette or antd `Spin`.
- Keep all touch targets at least 44px and preserve reduced motion, focus restoration, and scroll restoration.
- Keep mobile config schema version 1 and existing data/service contracts.
- Do not upgrade or fork `@lobehub/ui` for this work.
- Per the user's verification preference, write tests before implementation but run one consolidated targeted verification round after all tasks.

---

## File Structure

### New shared files

- `src/features/MobileWorkspace/components/MobileContentFrame.tsx`: readable-width and page padding contract.
- `src/features/MobileWorkspace/components/MobileWorkspaceHeader.tsx`: standard root-page title and action slots.
- `src/features/MobileWorkspace/components/MobileSection.tsx`: unframed section heading/action layout.
- `src/features/MobileWorkspace/components/MobileStateView.tsx`: empty, filtered-empty, and error feedback with actions.
- `src/features/MobileWorkspace/components/MobileIconGrid.tsx`: stable responsive launcher grid.
- `src/features/MobileWorkspace/components/MobileListSkeleton.tsx`: geometry-matched list placeholders.
- `src/features/MobileWorkspace/components/index.ts`: public exports.
- `src/features/MobileWorkspace/components/index.test.tsx`: shared contracts.

### Existing files changed by page ownership

- Shell/navigation: `MobileWorkspaceShell.tsx`, `MobileTabBar.tsx`, `MobilePageLayout.tsx`, related tests, and `src/const/layoutTokens.ts`.
- Recent: `Recent/index.tsx`, `Recent/RecentConversationRow.tsx`, and their tests.
- Design: `Design/index.tsx` and `Design/index.test.tsx`.
- Discover: `Discover/index.tsx` and `Discover/index.test.tsx`.
- Apps: `Apps/index.tsx` and `Apps/index.test.tsx`.
- Admin: `src/features/Admin/MobileConfigPreview.tsx` and its test; preview mode state stays inside this component.
- Copy: `packages/locales/src/default/common.ts`, `locales/en-US/common.json`, `locales/zh-CN/common.json`, and existing mobile i18n tests.

---

### Task 1: Shared Mobile Workspace Primitives

**Files:**
- Create all files under `src/features/MobileWorkspace/components/` listed above.
- Modify: `src/const/layoutTokens.ts`.
- Test: `src/features/MobileWorkspace/components/index.test.tsx`.

**Interfaces:**
- Produces `MOBILE_WORKSPACE_CONTENT_MAX_WIDTH = 640`.
- Produces `MobileContentFrame`, `MobileWorkspaceHeader`, `MobileSection`, `MobileStateView`, `MobileIconGrid`, and `MobileListSkeleton`.

- [ ] **Step 1: Write shared-component tests before implementation**

Cover semantic headings, 44px header actions, action callbacks, state actions, row skeleton count, and the grid/frame data attributes used by responsive contract tests.

```tsx
render(
  <MobileStateView
    action={{ label: 'Retry', onClick }}
    description="Connection failed"
    title="Unable to load"
    variant="error"
  />,
);
fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
expect(onClick).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Add the layout token and component interfaces**

```ts
export const MOBILE_WORKSPACE_CONTENT_MAX_WIDTH = 640;

export interface MobileStateAction {
  label: ReactNode;
  onClick: () => void;
  primary?: boolean;
}
```

`MobileContentFrame` must center content, use `width: 100%`, apply responsive 12/16px inline padding, and expose `data-testid="mobile-content-frame"`.

- [ ] **Step 3: Implement the presentational primitives**

`MobileWorkspaceHeader` wraps `ChatHeader`; `MobileSection` renders an accessible heading and optional trailing action; `MobileStateView` renders one primary action at most; `MobileIconGrid` uses `repeat(auto-fit, minmax(var(--mobile-grid-min-cell), 1fr))`; `MobileListSkeleton` renders final-row-shaped placeholders.

- [ ] **Step 4: Export the components without exporting page data dependencies**

```ts
export { default as MobileContentFrame } from './MobileContentFrame';
export { default as MobileIconGrid } from './MobileIconGrid';
export { default as MobileListSkeleton } from './MobileListSkeleton';
export { default as MobileSection } from './MobileSection';
export { default as MobileStateView } from './MobileStateView';
export { default as MobileWorkspaceHeader } from './MobileWorkspaceHeader';
```

- [ ] **Step 5: Commit the shared primitives**

```bash
git add src/const/layoutTokens.ts src/features/MobileWorkspace/components
git commit -m "feat: add shared mobile workspace UI primitives"
```

### Task 2: Responsive Shell And Bottom Navigation

**Files:**
- Modify: `src/features/MobileWorkspace/MobileWorkspaceShell.tsx`.
- Modify: `src/features/MobileWorkspace/MobileTabBar.tsx`.
- Modify: `src/features/MobileWorkspace/MobilePageLayout.tsx`.
- Test: `src/features/MobileWorkspace/MobileWorkspaceShell.test.tsx`.
- Test: `src/features/MobileWorkspace/MobileTabBar.test.tsx`.

**Interfaces:**
- Consumes `MOBILE_WORKSPACE_CONTENT_MAX_WIDTH`.
- Preserves `shouldShowMobileTabBar`, `resolveMobileActiveSlot`, and configured navigation behavior.

- [ ] **Step 1: Extend tests for inner-width framing and semantic navigation**

Assert the footer remains `role="navigation"`, each item remains a native button, one item exposes `aria-current="page"`, hidden slots are absent, and an inner element exposes the max-width layout contract.

- [ ] **Step 2: Add a centered inner tab group**

Keep the fixed viewport-wide footer and safe-area padding. Move grid columns to an inner element with `max-width: 640px`, `margin-inline: auto`, and `width: 100%`.

- [ ] **Step 3: Constrain the offline notice and root content without duplicating safe-area padding**

The shell owns bottom clearance; `MobilePageLayout` must not add a second bottom inset. Offline feedback follows the content max width and remains above the tab bar.

- [ ] **Step 4: Preserve accessibility and motion behavior**

Retain `aria-current`, `:focus-visible`, label ellipsis, and active icon treatment. Do not add pointer-only interactions.

- [ ] **Step 5: Commit shell changes**

```bash
git add src/features/MobileWorkspace/MobileWorkspaceShell.tsx src/features/MobileWorkspace/MobileTabBar.tsx src/features/MobileWorkspace/MobilePageLayout.tsx src/features/MobileWorkspace/*test.tsx
git commit -m "feat: make the mobile workspace shell responsive"
```

### Task 3: Recent Page Redesign

**Files:**
- Modify: `src/features/MobileWorkspace/Recent/index.tsx`.
- Modify: `src/features/MobileWorkspace/Recent/RecentConversationRow.tsx`.
- Test: `src/features/MobileWorkspace/Recent/index.test.tsx`.
- Test: `src/features/MobileWorkspace/Recent/RecentConversationRow.test.tsx`.
- Modify copy files listed above.

**Interfaces:**
- Consumes shared frame, section, state, and skeleton components.
- Uses `toast` and `DropdownMenu` from `@lobehub/ui/base-ui`.
- Preserves `recentService.getMobileWorkspace`, pagination, pinning APIs, and `useMobileSlotState`.

- [ ] **Step 1: Add tests for the corrected information hierarchy**

Assert there is one visible "Latest" section heading, first-use empty has create-assistant, filtered-empty has clear-search, pin failure exposes a retry action, and group/unread/date semantics remain.

- [ ] **Step 2: Replace generic states with shared states and row skeletons**

Loading geometry must match a 40px avatar plus two text lines and trailing action. Error state calls `refresh`. Empty actions reuse existing create/search behavior.

- [ ] **Step 3: Remove the duplicate page heading and place refresh in section chrome**

Search remains directly below the header. Pinned and Latest each use `MobileSection`; refresh is attached once to the first list section.

- [ ] **Step 4: Make pin failure recoverable**

Capture the failed item and show:

```ts
toast.error({
  actions: [{ label: t('mobile.recent.retryPin'), onClick: () => void togglePin(item) }],
  title: t('mobile.recent.pinError'),
});
```

Remove the passive page-wide `pinError` paragraph.

- [ ] **Step 5: Migrate the overflow menu to base-ui and tighten row metadata**

Use two main text lines. Keep group/date metadata in one compact line and prevent the trailing 44px menu action from shrinking content below zero.

- [ ] **Step 6: Commit Recent changes**

```bash
git add src/features/MobileWorkspace/Recent packages/locales/src/default/common.ts locales/en-US/common.json locales/zh-CN/common.json
git commit -m "feat: refine the mobile recent experience"
```

### Task 4: Design Page Redesign

**Files:**
- Modify: `src/features/MobileWorkspace/Design/index.tsx`.
- Test: `src/features/MobileWorkspace/Design/index.test.tsx`.
- Modify mobile copy files when adding recovery labels.

**Interfaces:**
- Consumes shared header, frame, section, icon grid, state, and skeleton components.
- Preserves `mobileDesignService.getRecent`, `createNewPage`, tool registry, focus restoration, and navigation.

- [ ] **Step 1: Add tests for narrow-safe row structure and actionable states**

Assert title, kind/status, and date are separate elements; loading renders row skeletons; error retries; empty offers create-document; tool actions retain existing routes.

- [ ] **Step 2: Move header and creation tools to shared primitives**

Use the configured slot label and `MobileIconGrid`. Keep exactly one refresh action in the header.

- [ ] **Step 3: Rebuild recent rows with a three-area grid**

Use `grid-template-columns: 44px minmax(0, 1fr) auto`; title and kind/status stack inside the middle cell. Date stays in the trailing cell and never concatenates with status.

- [ ] **Step 4: Add recoverable creation failure**

Keep the tool enabled after failure and present a retry action for the same tool without clearing page data.

- [ ] **Step 5: Commit Design changes**

```bash
git add src/features/MobileWorkspace/Design packages/locales/src/default/common.ts locales/en-US/common.json locales/zh-CN/common.json
git commit -m "feat: make mobile design browsing responsive"
```

### Task 5: Discover Page Redesign

**Files:**
- Modify: `src/features/MobileWorkspace/Discover/index.tsx`.
- Test: `src/features/MobileWorkspace/Discover/index.test.tsx`.
- Modify mobile copy files.

**Interfaces:**
- Preserves `buildFeaturedAssistantCards`, published mobile configuration, and escape navigation.
- Consumes shared header, frame, section/state, and skeleton components.

- [ ] **Step 1: Add tests for compact recommended-assistant rows**

Assert every assistant renders title, at most two description lines by class contract, display model, 44px avatar, and an accessible open command. Assert empty state links to `/community` with escape navigation.

- [ ] **Step 2: Replace tall cards with compact assistant rows**

Portrait uses one column. The shared frame may use two columns only at wide/landscape widths. Model metadata remains secondary and cannot resize the row.

- [ ] **Step 3: Replace generic states**

Loading mirrors assistant rows; error retries configuration fetch; empty explains the admin-curated state and offers Community as a secondary action.

- [ ] **Step 4: Commit Discover changes**

```bash
git add src/features/MobileWorkspace/Discover packages/locales/src/default/common.ts locales/en-US/common.json locales/zh-CN/common.json
git commit -m "feat: streamline mobile assistant discovery"
```

### Task 6: Apps Page Redesign

**Files:**
- Modify: `src/features/MobileWorkspace/Apps/index.tsx`.
- Test: `src/features/MobileWorkspace/Apps/index.test.tsx`.
- Modify mobile copy files only when required.

**Interfaces:**
- Preserves module app service, scope-aware routing, built-in registry, and featured module ordering.
- Consumes shared header, frame, section, icon grid, state, and skeleton components.

- [ ] **Step 1: Add tests for action hierarchy and responsive launcher grid**

Assert market is the named destination action, refresh remains secondary, standard portrait uses the shared grid, and empty modules expose one market CTA.

- [ ] **Step 2: Migrate built-ins and module apps to `MobileIconGrid`**

Cells retain 44px icons, two-line labels, focus restoration, and personal/workspace navigation behavior.

- [ ] **Step 3: Compact module states**

Use cell-shaped loading skeletons. Empty state must fit within the 320x568 scroll viewport with its CTA reachable and with bottom clearance.

- [ ] **Step 4: Commit Apps changes**

```bash
git add src/features/MobileWorkspace/Apps
git commit -m "feat: refine the mobile app launcher"
```

### Task 7: Accurate Four-Mode Admin Preview

**Files:**
- Modify: `src/features/Admin/MobileConfigPreview.tsx`.
- Test: `src/features/Admin/MobileConfigPreview.test.tsx`.
- Modify: `src/features/Admin/MobileSettings/styles.ts` only for preview layout compatibility.

**Interfaces:**
- Consumes normalized `MobilePublicConfigV1` only; it must not call services.
- Produces preview modes `'recent' | 'design' | 'discover' | 'apps'` controlled by a base-ui segmented control or equivalent existing project control.

- [ ] **Step 1: Replace combined-preview tests with per-mode contracts**

Assert configured brand/navigation appear in every mode; Design uses tools; Discover uses configured assistants/models; Apps uses built-ins/featured IDs; Recent shows representative row geometry without claiming live data.

- [ ] **Step 2: Add preview mode state and segmented control**

```ts
type MobilePreviewMode = 'recent' | 'design' | 'discover' | 'apps';
```

Default to `recent`; switching modes changes only the preview body and active bottom tab.

- [ ] **Step 3: Reuse production spacing constants and remove the combined fake dashboard**

Keep the preview deterministic and side-effect free. Mirror production header, section, row/grid density, and bottom navigation at preview scale.

- [ ] **Step 4: Keep publishing as the page's only primary action**

The preview switch is a view control, not a command button. Do not change draft/save/publish semantics.

- [ ] **Step 5: Commit admin preview changes**

```bash
git add src/features/Admin/MobileConfigPreview.tsx src/features/Admin/MobileConfigPreview.test.tsx src/features/Admin/AdminMobileSettingsPage.tsx
git commit -m "feat: make the admin mobile preview match production"
```

### Task 8: Consolidated Root-Workspace Verification

**Files:**
- Test and inspect the files changed in Tasks 1-7; verification corrections stay in those same files.

- [ ] **Step 1: Run the focused test group once**

```powershell
bunx vitest run --silent='passed-only' "src/features/MobileWorkspace/**/*.test.{ts,tsx}" "src/features/Admin/MobileConfigPreview.test.tsx"
```

Expected: all selected test files pass.

- [ ] **Step 2: Run type and style gates once**

```powershell
bun run type-check
bunx eslint src/features/MobileWorkspace src/features/Admin/MobileConfigPreview.tsx
bunx stylelint "src/features/MobileWorkspace/**/*.{ts,tsx}" "src/features/Admin/MobileConfigPreview.tsx"
git diff --check
```

Expected: zero errors in changed scope and no whitespace errors.

- [ ] **Step 3: Run the browser matrix**

Verify `/`, `/design`, `/discover`, and `/apps` at 320x568, 390x844, 430x932, and 844x390. Check personal and one workspace-prefixed route, loading/error/empty/normal states where controllable, long labels, focus restoration, tab clearance, light/dark theme, and no overlap.

- [ ] **Step 4: Review the complete root-workspace diff**

Read the diff for duplicated state logic, root `@lobehub/ui` imports that have base-ui equivalents, accidental data-contract changes, untranslated copy, and unrelated formatting churn.

- [ ] **Step 5: Commit verification-only corrections**

```bash
git add src/features/MobileWorkspace src/features/Admin/MobileConfigPreview.tsx src/features/Admin/MobileConfigPreview.test.tsx src/const/layoutTokens.ts packages/locales/src/default/common.ts locales/en-US/common.json locales/zh-CN/common.json
git commit -m "fix: close mobile workspace verification gaps"
```

Skip this commit when verification requires no corrections.
