# Task 3 Report: Admin Operations UI

## Status

DONE_WITH_CONCERNS

## Scope Delivered

- Extended `platformPlugins` admin form normalization to carry operations metadata fields:
  - `featured`
  - `sortWeight`
  - `promoLabel`
  - `useCase`
  - `planBenefitSummary`
  - `upgradeCta`
- Added `OperationsEditor` and wired it into the platform plugin editor modal.
- Extended admin plugin item typing to include `operations` and `stats`.
- Added admin service wrapper for `admin.platformPlugins.updateOperations`.
- Added admin table columns and overview details for operations metadata and summarized stats.

## TDD Record

1. Added failing test in `src/features/Admin/platformPlugins/formSchema.test.ts` for operations normalization.
2. Ran:

```bash
bunx vitest run --silent='passed-only' src/features/Admin/platformPlugins/formSchema.test.ts
```

Observed expected failure:

- `input.operations` only contained default `{ featured: false, sortWeight: 0 }`
- missing normalized operations fields from form values

3. Implemented schema normalization and UI wiring.
4. Re-ran the same focused test and it passed.

## Verification

### Passed

```bash
bunx vitest run --silent='passed-only' src/features/Admin/platformPlugins/formSchema.test.ts
```

Result: 3 tests passed in `src/features/Admin/platformPlugins/formSchema.test.ts`.

### Concern

```bash
bun run type-check
```

Result: failed outside the task-owned files.

Primary failures were in broader repo areas that still construct platform plugin objects without the now-required `operations` field, including:

- `apps/server/src/routers/lambda/platformPlugin.ts`
- `packages/business-server/src/lambda-routers/admin/platformPlugins.ts`
- `packages/business-server/src/platform-plugins/runPlatformPlugin.test.ts`
- `packages/database/src/models/__tests__/platformPlugin.marketplace.test.ts`
- `scripts/seedPlatformPlugins.ts`

These are outside the files assigned for Task 3, so they were not changed here.

## Files Changed

- `src/features/Admin/platformPlugins/formSchema.ts`
- `src/features/Admin/platformPlugins/formSchema.test.ts`
- `src/features/Admin/platformPlugins/OperationsEditor.tsx`
- `src/features/Admin/platformPlugins/types.ts`
- `src/features/Admin/platformPlugins/PluginEditorModal.tsx`
- `src/features/Admin/AdminPlatformPluginsPage.tsx`
- `src/services/adminCommercial.ts`

## Notes

- No MCP/Skills marketplace integration was added.
- No desktop-only integration was added.
- No billing formula changes were made; only operations metadata and stats presentation were exposed in admin UI.

## Review Fixes

- Wired `adminCommercialService.platformPlugins.updateOperations` into the existing admin plugin edit save path.
  - It now runs only after a successful `upsert` on edits.
  - It is skipped on create.
  - It only fires when the submitted operations payload differs from the current `editingPlugin.operations`, so the second mutation is avoided when there is no real change.
- Replaced the Task 3 admin-facing English strings in the plugin editor with `useTranslation('subscription')` keys and added the matching `admin.platformPlugins.*` entries in both locale files.
- Kept the operations block in the modal on a plain container instead of a nested `Form.Item` wrapper to avoid brittle antd composition.

## Review Verification

- `bunx vitest run --silent='passed-only' src/features/Admin/platformPlugins/formSchema.test.ts`
- `git diff --check`
