# Mobile Deep Pages UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure mobile workspace destinations open purpose-built mobile layouts instead of squeezed desktop surfaces, with first priority on Docmee PPT and module app market/detail flows.

**Architecture:** Keep the generic `MobileDeepPageGuard` as the route-owned back and overflow boundary. Enable upstream mobile contracts where they exist (`@docmee/sdk-ui`), and add responsive presentational layouts to shared desktop pages without duplicating their services or mutations.

**Tech Stack:** React 19, TypeScript, React Router, `@docmee/sdk-ui`, `@lobehub/ui`, `@lobehub/ui/base-ui`, `antd-style`, SWR, Vitest, Testing Library.

## Global Constraints

- Keep existing mobile router paths, workspace prefixes, deep-return behavior, services, payment validation, and authorization.
- Prefer an upstream component's documented mobile mode over host-side reimplementation.
- Do not attempt to style cross-origin Docmee internals.
- Use project loaders; do not use antd `Spin`.
- Use one primary action per surface and 44px minimum touch targets.
- Keep desktop behavior unchanged unless a shared defect requires a narrow fix.
- Per the user's verification preference, write tests before implementation but run one consolidated targeted verification round after all tasks.

---

## File Structure

- `src/routes/(main)/(create)/ppt/features/PptWorkspace.tsx`: select Docmee mobile mode and size the SDK container.
- `src/routes/(main)/(create)/ppt/features/PptWorkspace.test.tsx`: SDK-option and lifecycle coverage.
- `src/features/ModuleAppMarket/index.tsx`: responsive market list and designed data states.
- `src/features/ModuleAppMarket/AppCard.tsx`: responsive app entity card with semantic actions.
- `src/features/ModuleAppMarket/AppDetail.tsx`: responsive detail/actions/metadata and project loader.
- Existing tests beside each Module App Market file.
- `src/features/MobileWorkspace/MobileDeepPageGuard.tsx`: only targeted safe-area/overflow/action fixes proven by tests.
- Common locale files for new empty/error/retry labels.

---

### Task 1: Enable Docmee Native Mobile Mode

**Files:**
- Modify: `src/routes/(main)/(create)/ppt/features/PptWorkspace.tsx`.
- Test: `src/routes/(main)/(create)/ppt/features/PptWorkspace.test.tsx`.

**Interfaces:**
- Consumes `useIsMobile(): boolean` from `@/hooks/useIsMobile`.
- Passes the documented `InitOptions.isMobile` option to `new DocmeeUI(...)`.
- Preserves token creation, saved `pptId`, event reporting, retries, downloads, and destruction.

- [ ] **Step 1: Add SDK option tests before implementation**

Mock `useIsMobile` with a mutable boolean. Assert mobile creation and saved-editor flows pass `isMobile: true`; desktop passes `isMobile: false`; all existing `page`, `pptId`, token, and event options remain.

```tsx
expect(docmeeConstructor).toHaveBeenCalledWith(
  expect.objectContaining({ isMobile: true, page: 'editor', pptId: 'upstream/ppt-1' }),
);
```

- [ ] **Step 2: Wire `useIsMobile` into the SDK constructor**

```ts
const isMobile = useIsMobile();

const ui = new DocmeeUI({
  // existing options
  isMobile,
});
```

Include `isMobile` in the mount effect dependencies so a breakpoint change rebuilds the SDK with the correct mode and destroys the prior instance.

- [ ] **Step 3: Make the SDK container use the deep-page viewport**

Replace `100vh` assumptions with parent-owned `height: 100%`, `minHeight: 0`, and `overflow: hidden` so the 44px guard header is subtracted exactly once. Keep loading/error states centered inside the same container contract.

- [ ] **Step 4: Commit PPT mobile mode**

```bash
git add "src/routes/(main)/(create)/ppt/features/PptWorkspace.tsx" "src/routes/(main)/(create)/ppt/features/PptWorkspace.test.tsx"
git commit -m "fix: enable the native mobile PPT workspace"
```

### Task 2: Harden The Deep Page Boundary

**Files:**
- Modify: `src/features/MobileWorkspace/MobileDeepPageGuard.tsx` only where required.
- Test: `src/features/MobileWorkspace/MobileDeepPageGuard.test.tsx`.

**Interfaces:**
- Preserves workspace-aware fallback paths and browser-history behavior.
- Produces one 44px back action, one header border, and one flex child that can size embedded editors correctly.

- [ ] **Step 1: Extend layout and navigation tests**

Assert `/ppt`, `/image`, `/page/:id`, `/apps/market`, and `/apps/:id` hide the bottom bar, render one named back button, use `/design` or `/apps` as the default-history fallback, and give the outlet container `min-height: 0` plus hidden horizontal overflow.

- [ ] **Step 2: Replace manual icon-button styling with the established header action contract where compatible**

Keep the native button if `ActionIcon` changes browser-history semantics or the test surface. The final control must remain 44px, titled, and keyboard focusable.

- [ ] **Step 3: Prevent nested horizontal scrolling**

The guard content may scroll vertically for documents and markets, but embedded editors can opt into `height: 100%`; never allow the guard itself to expose horizontal overflow from a desktop child.

- [ ] **Step 4: Commit the boundary fix**

```bash
git add src/features/MobileWorkspace/MobileDeepPageGuard.tsx src/features/MobileWorkspace/MobileDeepPageGuard.test.tsx
git commit -m "fix: harden mobile deep page containment"
```

### Task 3: Responsive Module App Market

**Files:**
- Modify: `src/features/ModuleAppMarket/index.tsx`.
- Modify: `src/features/ModuleAppMarket/AppCard.tsx`.
- Test: `src/features/ModuleAppMarket/index.test.tsx`.
- Test: `src/features/ModuleAppMarket/AppCard.test.tsx`.
- Modify common locale files for retry/empty descriptions if absent.

**Interfaces:**
- Preserves `moduleAppService.listMarketplace`, team/my modes, exact detail URLs, and workspace query parameters.
- Consumes `MobileStateView` and `MobileListSkeleton` from the root-workspace plan.
- Uses base-ui `Button` rather than antd link buttons.

- [ ] **Step 1: Add market data-state and responsive-card tests**

Assert loading uses a status/skeleton, errors expose retry calling `apps.mutate`, empty is a purpose-built state, app cards are semantic articles with a unique details link, and workspace query parameters remain encoded.

- [ ] **Step 2: Replace plain text states**

Use `MobileStateView` for mobile and a compatible centered state on desktop. Error retry invokes `apps.mutate`; empty copy explains that no apps are published.

- [ ] **Step 3: Add a responsive content frame and app grid**

Use `createStaticStyles` with `grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr))`, 12-16px gaps, 16px mobile padding, and 24px desktop padding. Constrain very wide content without changing mode-specific queries.

- [ ] **Step 4: Rebuild `AppCard` with project components**

Keep cards at 8px radius or less, avoid nested cards, render description/category/version metadata without overflow, and make "View details" the only command action.

- [ ] **Step 5: Commit market changes**

```bash
git add src/features/ModuleAppMarket/index.tsx src/features/ModuleAppMarket/AppCard.tsx src/features/ModuleAppMarket/index.test.tsx src/features/ModuleAppMarket/AppCard.test.tsx packages/locales/src/default/common.ts locales/en-US/common.json locales/zh-CN/common.json
git commit -m "feat: make the module app market mobile-ready"
```

### Task 4: Responsive Module App Detail And Purchase Entry

**Files:**
- Modify: `src/features/ModuleAppMarket/AppDetail.tsx`.
- Test: `src/features/ModuleAppMarket/AppDetail.test.tsx`.
- Modify: `src/features/ModuleAppMarket/PurchaseModal.tsx`.
- Test: `src/features/ModuleAppMarket/PurchaseModal.test.tsx`.

**Interfaces:**
- Preserves order scoping, payment form validation, license refresh, install/uninstall mutations, and existing URLs.
- Uses `NeuralNetworkLoading` instead of antd `Spin`.
- Uses base-ui `FloatingSheet` for the mobile purchase flow while preserving the current desktop modal.

- [ ] **Step 1: Add tests for loading, error retry, mobile action order, and metadata wrapping**

Assert loading uses `NeuralNetworkLoading`; load failure provides retry; installed apps show Open as primary and Uninstall as secondary/danger; non-installed apps expose only Purchase or Install as primary; descriptions render in one column on narrow layouts.

- [ ] **Step 2: Replace antd loading and passive error text**

Use a shared error state with `detail.mutate` retry. Do not clear fetched catalog/license/order state when retrying detail.

- [ ] **Step 3: Make the header and actions responsive**

Use CSS grid/flex wrapping: content first, action group second, full-width primary action on narrow phones only. Preserve a single primary action.

- [ ] **Step 4: Replace two-column `Descriptions` on mobile**

Use responsive CSS or a semantic definition list that becomes one column below 600px. Keep category, version, source, and action count.

- [ ] **Step 5: Render the purchase flow in a mobile `FloatingSheet`**

Extract the existing purchase body into one shared render branch. On mobile, render it in a base-ui `FloatingSheet` with `minHeight={320}`, `restingHeight={520}`, a 720px upper snap point, a named close action, and scrollable content. On desktop, preserve the current modal behavior. Both variants must retain selected product, quote, order, payment, cancellation, and install state.

- [ ] **Step 6: Commit detail changes**

```bash
git add src/features/ModuleAppMarket/AppDetail.tsx src/features/ModuleAppMarket/AppDetail.test.tsx src/features/ModuleAppMarket/PurchaseModal.tsx src/features/ModuleAppMarket/PurchaseModal.test.tsx
git commit -m "feat: make module app details responsive"
```

### Task 5: Consolidated Deep-Route Verification

**Files:**
- Update only the deep-page files whose browser evidence contradicts acceptance criteria.

- [ ] **Step 1: Run focused deep-page tests once**

```powershell
bunx vitest run --silent='passed-only' "src/routes/(main)/(create)/ppt/features/PptWorkspace.test.tsx" "src/features/MobileWorkspace/MobileDeepPageGuard.test.tsx" "src/features/ModuleAppMarket/*.test.tsx"
```

Expected: all selected tests pass.

- [ ] **Step 2: Run changed-scope type/style gates once**

```powershell
bun run type-check
bunx eslint "src/routes/(main)/(create)/ppt/features/PptWorkspace.tsx" src/features/MobileWorkspace/MobileDeepPageGuard.tsx src/features/ModuleAppMarket
bunx stylelint "src/routes/(main)/(create)/ppt/features/PptWorkspace.tsx" "src/features/MobileWorkspace/MobileDeepPageGuard.tsx" "src/features/ModuleAppMarket/**/*.{ts,tsx}"
git diff --check
```

Expected: zero errors in changed scope and no whitespace errors.

- [ ] **Step 3: Verify deep pages in the browser matrix**

At 320x568, 390x844, 430x932, and 844x390 verify: `/ppt` new mode, a saved PPT editor, `/image`, `/apps/market`, an available app detail/runtime when data exists, and back restoration. Confirm no squeezed desktop sidebar, horizontal page scrolling, obscured primary action, duplicate safe-area padding, or blank error path.

- [ ] **Step 4: Audit preserved deep routes**

Open one chat, one Community list/detail, one commercial settings page, and one existing Page document when production data provides it. Treat image creation as a preserve-and-polish surface. Record a code change only for a reproducible overlap, overflow, unreachable action, or broken data state.

- [ ] **Step 5: Review the deep-page diff**

Confirm Docmee events and teardown are unchanged, payment form security checks are untouched, workspace query parameters remain, desktop rendering is unchanged, and no unrelated route was reformatted.

- [ ] **Step 6: Commit verification-only corrections**

```bash
git add "src/routes/(main)/(create)/ppt/features" src/features/MobileWorkspace/MobileDeepPageGuard.tsx src/features/MobileWorkspace/MobileDeepPageGuard.test.tsx src/features/ModuleAppMarket packages/locales/src/default/common.ts locales/en-US/common.json locales/zh-CN/common.json
git commit -m "fix: close mobile deep-route verification gaps"
```

Skip this commit when verification requires no corrections.
