# Platform Plugin Ops Market Design

Date: 2026-07-08
Status: Approved draft for planning
Scope: Platform Plugin Marketplace P2-lite, focused on lightweight commercial operations and user marketplace experience

## Context

ComHub already has the Platform Plugin Marketplace P1 foundation. P1 introduced the `platformPlugin` domain, `platform_plugin_*` database tables, admin plugin management, plan visibility/install/run entitlements, API action and content generation runtimes, secrets masking, billing calculation, run records, artifacts, audit logs, seed data, user marketplace routes, and a chat input shortcut.

The current registry still marks the feature as experimental and high risk. The next phase should not expand the runtime too broadly. The priority is to turn the existing P1 feature into a product surface that admins can operate and users can understand.

## Goal

Build a lightweight commercial operations loop for platform plugins: admins can promote, order, explain, and measure plugins; users can discover, filter, understand plan availability, run plugins, and review recent usage.

## Non-Goals

This phase does not import existing MCP entries or Skills into the platform plugin marketplace.

This phase does not add desktop client integration, desktop update prompts, or desktop-only plugin execution.

This phase does not add new runtime types beyond P1 `api_action` and `content_generation`.

This phase does not add multi-step workflows, async long-running job queues, plugin reviews, payment gateway integration, refunds, invoices, or deep plan quota rules.

This phase does not change the existing fixed fee and multiplier billing formula except to expose clearer user-facing estimates and admin-facing summary metrics.

## Product Shape

### Admin Experience

The admin platform plugin area gains lightweight operations controls. Admins can mark a plugin as featured, set a sort weight, add a short promotion label, explain the use case, define a plan benefit summary, and customize upgrade guidance copy.

The admin plugin list should remain a management table. It should show release status, featured state, sort weight, runtime type, plan availability summary, installation count, run count, success rate, total charged credits, and fixed service fee estimate.

The admin editor should add an Operations section after basic information and before billing. This keeps marketing and discovery metadata near identity fields while leaving cost configuration in the billing section.

The admin detail or list API should return lightweight stats computed from existing installation and run tables. The first iteration should use aggregate counts, not charts.

### User Marketplace Experience

The `/plugins` marketplace gains search, category filtering, featured-first ordering, runtime type labels, and plan availability state.

Plugin cards should show name, description, category, tags, promotion label, featured marker, runtime type, and current plan state. Plugins unavailable to the current plan stay visible when the user can see them, but they display a clear upgrade reason rather than disappearing.

Plugin detail should show current plan availability, install/run status, usage restriction copy, upgrade guidance, expected billing summary, run entry, and recent run history.

Recent run history should include status, created time, charged credits, fixed service fee state, artifact presence, and a result entry when available. It must only expose the current user's runs.

## Data Model

Prefer storing operations metadata in existing JSON metadata or version config fields unless the implementation discovers that an indexed column is required for efficient list ordering. If a migration is needed, keep it small and additive.

The operations metadata shape is:

```typescript
export type PlatformPluginOperationsMetadata = {
  featured: boolean;
  planBenefitSummary?: string;
  promoLabel?: string;
  sortWeight: number;
  upgradeCta?: string;
  useCase?: string;
};
```

Default values are:

```typescript
const DEFAULT_PLATFORM_PLUGIN_OPERATIONS_METADATA = {
  featured: false,
  sortWeight: 0,
} satisfies PlatformPluginOperationsMetadata;
```

The stats shape returned by admin APIs is:

```typescript
export type PlatformPluginAdminStats = {
  failedRuns: number;
  fixedServiceFeeCredits: number;
  installations: number;
  runs: number;
  successRate: number;
  succeededRuns: number;
  totalChargedCredits: number;
};
```

The user run history item shape is:

```typescript
export type PlatformPluginRunHistoryItem = {
  artifactIds: string[];
  chargedCredits: number;
  createdAt: string;
  fixedServiceFeeCharged: boolean;
  pluginId: string;
  pluginName: string;
  preview?: string;
  runId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'denied';
};
```

## API Design

Extend `admin.platformPlugins` with operations metadata support in create/update/detail/list. Add a stats endpoint or embed stats in list/detail only when the implementation can do so without heavy queries.

Recommended admin procedures:

- `admin.platformPlugins.list` returns operations metadata and stats summary.
- `admin.platformPlugins.detail` returns operations metadata, entitlements, billing config, actions, secrets metadata, and stats summary.
- `admin.platformPlugins.updateOperations` updates featured state, sort weight, promo label, use case, upgrade CTA, and plan benefit summary.

Extend `lambda.platformPlugin` with marketplace filtering and run history.

Recommended user procedures:

- `lambda.platformPlugin.list` accepts optional `query`, `category`, and `runtimeType` filters.
- `lambda.platformPlugin.detail` returns operations metadata safe for users and recent run summary.
- `lambda.platformPlugin.listRuns` returns paginated run history for the authenticated user.

Secrets and raw runtime configuration remain server-only. User APIs must not return raw secret values, decrypted headers, or full request bodies.

## Permission And Billing Rules

Visible, installable, and runnable permissions continue to be checked server-side. Frontend availability labels are presentation only and must not become authorization.

Featured and sort weight never override visibility. A featured plugin still appears only if the current user's plan can see it.

Billing estimates should reuse existing billing config fields. The UI may show a conservative estimate such as fixed service fee plus configured external API cost and multiplier explanation. It must avoid promising exact AI token cost before a run.

Failed runs continue not to charge fixed service fee. The run history should show whether fixed service fee was charged.

## UI Structure

Admin files stay under `src/features/Admin/platformPlugins`. Pure formatting and normalization helpers should live near `formSchema.ts` or a new focused helper file if the existing file becomes too large.

User marketplace files stay under `src/features/PlatformPluginMarket`. Filtering, sorting, and status label logic should be pure helper functions with tests.

Route segment files under `src/routes` remain thin and should only import feature components.

Both desktop router configs must remain synchronized when any route shape changes.

## Error Handling

User-facing errors should be explicit and stable:

- `PLUGIN_PLAN_NOT_VISIBLE`
- `PLUGIN_PLAN_NOT_INSTALLABLE`
- `PLUGIN_PLAN_NOT_RUNNABLE`
- `PLUGIN_NOT_INSTALLED`
- `PLUGIN_AGENT_NOT_BOUND`
- `PLUGIN_INSUFFICIENT_CREDITS`
- `PLUGIN_CONFIGURATION_ERROR`
- `PLUGIN_RUNTIME_FAILED`

Admin stats failures should not break the entire plugin list. If stats aggregation fails, the API should return plugin data and a safe empty stats object only when the failure is non-sensitive and recoverable. Hard database errors may still fail the request.

## Testing Strategy

Use focused tests before implementation changes.

Required test areas:

- Shared operations metadata schema defaults and validation.
- Admin form normalization for operations fields.
- Admin router operations update and list/detail stats behavior.
- Admin router secret safety after adding operations fields.
- User marketplace helper filtering, featured-first sorting, and plan status labels.
- User router run history scoping to the current user.
- User detail response hiding raw secrets and raw request snapshots.
- Desktop router sync test if route registration changes.
- `bun run type-check` after implementation slices.

Database integration tests require `DATABASE_TEST_URL`; when unavailable, run all pure and router tests that do not require a real database and record the database test as environment-blocked.

## Rollout Plan

Keep this phase behind existing plugin publication state. Seed plugins remain draft until an admin publishes them.

Deploy in the established blue-green flow. After deployment, smoke test admin plugin list, admin edit operations section, user marketplace filtering, user detail availability labels, plugin run, and run history display.

No existing MCP or Skills route should change. The old plugin, MCP, and skill runtimes must remain isolated from `platformPlugin`.

## Acceptance Criteria

Admin can mark plugins as featured and set sort weight without changing runtime behavior.

Admin can configure promotion label, use case, upgrade CTA, and plan benefit summary.

Admin plugin list or detail shows installation count, run count, success rate, total charged credits, and fixed service fee estimate.

User marketplace supports search, category filter, featured-first sorting, and current-plan availability labels.

User plugin detail shows plan availability, upgrade guidance, expected billing summary, and recent run history.

User run history only includes the authenticated user's runs.

Raw secrets never appear in admin public payloads, user payloads, run history, audit metadata, or frontend state.

Existing MCP and Skills pages and runtimes are unchanged.

Focused tests and `bun run type-check` pass, except database integration tests may be explicitly marked blocked when `DATABASE_TEST_URL` is unavailable.

## Implementation Decomposition

The implementation should be split into reversible commits:

1. Shared operations metadata and helper tests.
2. Admin backend operations metadata and stats tests.
3. Admin UI operations section and table columns.
4. User marketplace filtering, sorting, and availability presentation.
5. User run history backend and detail UI.
6. Documentation, registry updates, type-check, focused verification, and final review.

This is one implementation plan, but each task should be independently testable and reviewable.
