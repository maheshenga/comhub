# Mobile UI/UX Overhaul Design

Date: 2026-07-20

## Goal

Turn the existing four-tab mobile workspace into a coherent, production-grade mobile product. The information architecture and density should feel familiar to DingTalk users, while visual styling, tokens, accessibility, and AI interaction patterns remain native to ComHub/LobeHub.

This design extends the production-readiness contract in `2026-07-20-mobile-workspace-production-readiness-design.md`. It does not replace the existing data, routing, workspace-scope, publication, or restoration contracts.

## Confirmed Direction

The user authorized execution after the recommended direction was presented. The selected direction is:

- Use DingTalk-like information hierarchy, compact workbench density, and predictable four-tab navigation.
- Use LobeHub tokens, icons, mobile headers, base-ui primitives, loading conventions, and interaction feedback.
- Preserve the semantic custom bottom navigation rather than replacing it with `@lobehub/ui/mobile` `TabBar`, whose current implementation uses clickable non-button containers.
- Keep the four configurable tabs and current public mobile configuration schema.
- Treat root workbench pages and deep task pages as one mobile journey; a polished launcher that opens an unusable desktop page is not complete.

## Evidence From The Current Product

### What already works

- Four configurable bottom tabs with workspace-aware destinations.
- Safe-area clearance, tab hiding on deep pages, offline feedback, and reduced-motion support.
- Semantic bottom-tab buttons with `aria-current` and 44px targets.
- Recent conversations use the same assistant/group/topic data as desktop, including pinning, groups, unread counts, pagination, search, focus restoration, and scroll restoration.
- Design, Discover, and Apps have loading, error, empty, and normal branches.
- Mobile settings support brand, labels, icons, destinations, design tools, featured assistants, module apps, draft/publish history, and rollback.

### Material gaps observed at 320x568, 390x844, 430x932, and 844x390

- Recent, Design, Discover, and Apps use different visual density and hierarchy.
- Recent repeats the same "Latest" title at page and section level.
- Generic paragraph skeletons do not match the final row/card geometry.
- First-use empty states and filtered-empty states do not provide different recovery actions.
- Pin failures are rendered as passive text with no direct recovery.
- Design row title, kind, status, and date collide or become visually ambiguous on narrow screens.
- Discover uses tall cards for at most four assistants, producing low information density and a large blank empty state.
- Apps uses a rigid four-column grid and a tall module empty state; its market action can begin below the first viewport at 320px.
- Landscape pages stretch a single narrow information column across the whole screen.
- The admin preview combines unrelated sections in one mock screen and does not accurately preview any production tab.
- The PPT deep page renders the desktop editor squeezed into a mobile viewport, leaving tiny controls and simultaneous side panels. It is not a usable mobile editor.
- The image creation page is already materially mobile-ready and should be preserved, not rewritten.
- The app market has a functional back route but an unfinished empty state and inconsistent title placement.

## Approaches Considered

### 1. Conservative consistency pass

Only normalize spacing, colors, headings, and empty states in the four root pages.

Advantages: small diff and low short-term risk.

Rejected because: it leaves the PPT and other deep-route failures intact, keeps duplicated page contracts, and does not make the complete mobile journey usable.

### 2. Shared mobile design system plus journey redesign

Create a small set of ComHub-owned mobile workspace primitives, rebuild the four root pages on them, make the admin preview reflect the real tabs, and add purpose-built responsive modes to deep pages.

Advantages: solves consistency at the ownership boundary, preserves upstream absorbability, and allows focused tests.

Selected because: it gives the best product improvement without forking LobeHub or rewriting desktop data flows.

### 3. Fork or broadly replace Lobe UI mobile components

Move the mobile shell and pages into a custom `lobe-ui` fork or replace all local controls with package components.

Rejected because: installed `@lobehub/ui` 5.20.2 and latest 5.22.3 expose the same small mobile set (`ChatHeader`, `ChatInputArea`, `ChatSendButton`, `SafeArea`, and `TabBar`). A dependency upgrade does not solve ComHub's information architecture, and the package `TabBar` would reduce current button semantics and accessibility.

## Visual System

### Layout

- Root surfaces use one shared scroll container, header contract, content frame, and bottom clearance.
- Main content is full width on portrait phones and constrained to a maximum readable width of 640px on large or landscape viewports.
- The bottom bar remains viewport-wide, while its item group follows the same readable-width constraint on wide screens.
- Stable dimensions prevent loading, labels, badges, and actions from shifting rows or grids.
- Safe-area insets apply at the shell boundary exactly once.

### Density and type

- Header title: 17px, semibold.
- Primary row title: 14-15px, medium or semibold.
- Secondary content: 13px.
- Metadata and compact labels: 11-12px.
- Spacing follows a 4/8/12/16/24 scale.
- Root list rows target 64-72px and remain at least 44px interactive height.
- Cards are used only for repeated entities that need a visual boundary; ordinary page sections remain unframed.

### Color and interaction

- Use `cssVar` tokens and `createStaticStyles`; no new hard-coded theme palette.
- Active bottom tabs use color plus an icon treatment, never color alone.
- Pointer press uses a restrained fill state; keyboard focus remains visible through `:focus-visible`.
- Honor reduced motion for all loading and transition effects.

## Shared Components

Add a focused set of primitives under `src/features/MobileWorkspace/components`:

- `MobileWorkspaceHeader`: wraps `ChatHeader`, owns title semantics, action spacing, sticky behavior, and a consistent 44px action contract.
- `MobileContentFrame`: applies portrait width, landscape max width, responsive padding, and root-page bottom rhythm.
- `MobileSection`: owns section heading, optional secondary action/count, and consistent spacing without rendering a decorative card.
- `MobileStateView`: purpose-built loading, empty, filtered-empty, and error layouts with optional primary and secondary actions.
- `MobileIconGrid`: stable responsive grid used by Design tools and Apps entries.
- `MobileListSkeleton`: row-shaped placeholders matching avatar/icon, text, and metadata geometry.

These components are presentational. Page-specific data fetching, navigation, and mutations remain in their existing feature modules.

## Component Source Policy

- First use project components under `src/components`.
- Then use `@lobehub/ui/base-ui` for `Button`, `DropdownMenu`, `FloatingSheet`, `ScrollArea`, `Toast`, and related primitives when their APIs fit.
- Then use `@lobehub/ui` for visual components such as `Avatar`, `Icon`, `Flexbox`, and compatible higher-level controls.
- Continue using `@lobehub/ui/mobile` `ChatHeader`, `ChatInputArea`, `ChatSendButton`, and `SafeArea` where appropriate.
- Keep the custom semantic `MobileTabBar` and improve it locally.
- Do not upgrade `@lobehub/ui` solely for this work; 5.22.3 adds no mobile primitive needed by this design.
- Do not use antd `Spin`.

## Page Designs

### Recent

- Header keeps avatar, configured brand, and the single create-assistant command.
- Search remains directly below the header and restores its query.
- Remove the duplicate page-level "Latest" heading. Refresh becomes the trailing action of the first visible section or a compact header action where it remains discoverable.
- Pinned and Recent sections share one list grammar.
- A row shows avatar, assistant/group name, latest topic on the second line, and compact date/group metadata without adding a third competing text line when space is constrained.
- Unread badges remain attached to the avatar and cap at `99+`.
- Pin/unpin remains in the item overflow menu. Pending state blocks duplicate mutations.
- Failure feedback uses a recoverable toast or inline notice tied to the failed item; the user can retry.
- No-data empty state offers the create-assistant action. No-search-result state offers clear-search.
- Pagination uses a full-width low-emphasis load-more command and preserves position.

### Design

- Header uses the configured tab label and one refresh action.
- Creation tools use `MobileIconGrid` with stable 44px icons and labels.
- Recent work uses list rows with separate title, kind/status metadata, and date columns. Narrow widths cannot concatenate title and status.
- Loading uses row skeletons. Error includes retry. Empty includes a primary create-document action and secondary image/PPT choices through the existing tool area.
- Document creation preserves content on failure and gives a retry action.

### Discover

- The page remains a curated recommended-assistant surface. Community remains an Apps entry and a possible empty-state destination; it is not mixed into the recommendation list.
- Replace tall two-column cards with compact assistant rows: 44px avatar, title, two-line description, and a model label that is visually secondary.
- Use one column on portrait and at most two columns within the constrained wide-screen frame.
- Loading mirrors final assistant-row geometry.
- Empty state explains that no recommendations are configured and offers Community as a secondary discovery route.
- Assistant navigation continues to open the existing detail page; configured model metadata is descriptive and does not silently change the assistant runtime model.

### Apps

- Header uses the configured tab label. Market is the primary destination action; refresh remains a secondary icon action.
- Built-in and module apps share `MobileIconGrid` and stable label height.
- The grid uses responsive minimum cell width rather than a hard-coded column count while preserving four columns on standard portrait phones.
- Module loading mirrors app cells.
- Empty module state is compact enough to keep its market action reachable, while still providing context and a clear CTA.
- Personal and workspace module navigation rules remain unchanged.

## Bottom Navigation

- Retain semantic `<button>` items, `role="navigation"`, and `aria-current="page"`.
- Keep exactly the visible, ordered admin-configured slots.
- Add an inner max-width frame for landscape without changing fixed positioning or safe-area behavior.
- Long labels remain single-line and ellipsized; the admin validator continues to bound label length.
- Deep pages continue to hide the bottom bar and expose an explicit back route.

## Deep Page Strategy

Deep pages are classified by mobile readiness rather than treated uniformly.

### Preserve and polish

- Chat and image creation already have viable mobile layouts. Changes are limited to header/action consistency, safe-area behavior, and targeted overflow fixes.
- Community detail/list and commercial settings retain their existing mobile routes, with focused fixes only where browser verification finds a concrete defect.

### Adapt shared desktop pages

- Page lists, app market, and module app detail/runtime receive explicit mobile wrappers, designed empty/error states, and overflow-safe content.
- Desktop sidebars are not rendered merely because a desktop page is reused by the mobile router.

### PPT mobile mode

The PPT editor must no longer display desktop sidebars simultaneously on a phone.

- Reuse the existing Docmee document/session/event flow and do not fork PPT business logic.
- Enable the SDK's documented `isMobile` mode at mobile breakpoints. Use its `editorDisplay` contract only when a narrower display set is required after browser verification.
- Treat the upstream SDK as the owner of canvas, slide navigation, formatting, layout, template, and theme interactions. Do not attempt to restyle cross-origin editor internals from ComHub.
- ComHub owns the outer header, back behavior, loading/error states, container sizing, and safe-area clearance.
- At landscape widths, keep mobile mode unless browser evidence proves the SDK's desktop editor remains usable.
- If an advanced upstream action is unavailable in SDK mobile mode, provide honest host-level messaging instead of exposing tiny desktop controls.

## Admin Experience

- Preserve the current version-1 configuration, draft/publish workflow, history, rollback, validation, and unsaved-change guard.
- Replace the all-in-one mock preview with a four-mode preview controlled by a segmented switch: Recent, Design, Discover, Apps.
- Preview uses the same layout constants and presentational primitives as production where possible; it must not duplicate unrelated fake geometry.
- Preview shows configured brand, labels, order, visibility, tools, assistants, built-ins, and featured module IDs in their actual tab context.
- Selector failures remain scoped and retryable; unrelated configuration remains editable.
- Publishing remains the only primary action. Save draft and restore defaults remain secondary.

## Data And State

- No database migration or mobile-config version bump is required.
- Existing SWR keys, workspace scoping, pagination, publication snapshots, and navigation registry remain authoritative.
- Visual components receive normalized view models and do not fetch data.
- Existing scroll/query/focus restoration remains and is covered after component extraction.
- Optimistic interactions must either roll back or provide an explicit retry path when the server rejects them.

## Accessibility

- Every command remains a native button or link.
- Headings preserve page/section hierarchy.
- Current tab is exposed with `aria-current`.
- Icon-only actions have an accessible name and tooltip/title.
- Loading uses `aria-busy` and an appropriate status region without repeatedly announcing each skeleton.
- Errors use an alert region and a reachable retry control.
- Touch targets are at least 44px.
- Focus restoration and reduced motion remain mandatory.

## Verification

Run one consolidated verification round after implementation:

- Focused Vitest files for shared primitives, four root pages, navigation, restoration, admin preview, and changed deep-page responsive logic.
- Type check for changed TypeScript contracts.
- ESLint and Stylelint only for changed files or the narrowest supported project command.
- `git diff --check`.
- Browser matrix at 320x568, 390x844, 430x932, and 844x390.
- Browser flows: all four tabs, long recent title, search/no-result/clear, pin failure recovery, empty/error/loading states, deep return restoration, app market, image creation, and PPT mobile mode.
- Verify both personal and workspace-prefixed root routes.
- Verify light/dark themes, safe-area clearance, keyboard focus, and reduced motion where the runtime can expose them.

The full repository test suite remains out of scope unless a focused failure indicates broader impact.

## Non-Goals

- No desktop UI redesign.
- No `lobe-ui` fork.
- No dependency upgrade without a separately proven requirement.
- No mobile-config schema v2.
- No unrelated admin or billing refactor.
- No replacement of existing workspace authorization, routing, or publication contracts.

## Acceptance Criteria

- The four root tabs read as one product at every target viewport.
- No root page has overlapping, clipped, or concatenated title/metadata content at 320px.
- Landscape content remains readable and intentionally constrained.
- Loading, first-use empty, filtered-empty, error, and normal states are designed for each data surface.
- The admin preview accurately represents each production root tab.
- The custom bottom bar retains semantic and accessibility behavior.
- Opening Design, Discover, Apps, and their supported deep routes never exposes a squeezed desktop layout.
- PPT has a purpose-built mobile editing mode with single-pane content and sheet-based controls.
- Existing data, workspace scope, publication, and restoration contracts remain covered by focused tests.
