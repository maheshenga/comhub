# Admin Runtime Layout and Provider Display Design

**Date:** 2026-08-20

## Goal

Correct the admin console layout and make every AI runtime model selection show its effective provider without allowing an inconsistent model/provider pair.

## Scope

This change covers four reported problems:

1. The admin navigation search label is visibly displaced above its input.
2. The main application navigation panel remains visible beside the admin console.
3. Vector retrieval settings do not reliably show the selected model provider.
4. Memory analysis settings do not reliably show the selected model provider.

It does not change provider credentials, provider enablement, synchronized model data, pricing, database schemas, or production deployment.

## Design

### Admin shell

`NavPanelShell` will use the existing cross-platform active-location abstraction to identify `/settings/admin` and its descendant routes. It will return no main application panel for those routes. The dedicated admin navigation remains mounted by `AdminLayout` at desktop widths and remains available through its existing sheet at narrower widths.

Keeping the route check in the shared shell applies the same behavior to the web router and Electron's active-tab router without duplicating logic across the main layout twins.

### Navigation search

The search input already has an accessible `aria-label`. The separate `span.sr-only` duplicates that accessible name, but this repository does not provide a matching global `sr-only` utility, so the span renders visibly. The duplicate span will be removed. The input retains its label, placeholder, search icon, focus behavior, and filtering behavior.

### Runtime model and provider fields

The enabled model catalog returned in `sharedHealth.enabledNewapiModels` is the source of selectable models and provider metadata.

Each runtime model row will use one model selection control and one read-only provider display:

- Vector Embedding uses enabled `embedding` models.
- Vector Reranker uses the complete enabled model catalog because the current model type contract has no dedicated `rerank` category. Each option retains its actual catalog type in the label.
- Memory gatekeeper, layer extractor, and persona writer use enabled `chat` models.
- Memory Embedding uses enabled `embedding` models.

Selecting a catalog model updates both stored fields: the raw model ID and the provider ID. The provider display resolves the human-readable managed-provider label from provider type and instance name while the persisted value remains the provider ID required by the runtime.

Existing configured model/provider pairs that are not currently present in the enabled catalog remain in form state and remain saveable. Their provider display falls back to the stored provider value rather than clearing it.

Provider fields are not independently editable. This makes the model selection the single source of truth and prevents unsupported model/provider combinations.

### Data flow

1. The settings section loads the saved runtime configuration and enabled model catalog.
2. Catalog entries are partitioned by model type and converted into model options.
3. Selecting an option writes its model ID and provider ID into the form.
4. The read-only provider display derives its label from the selected or saved pair.
5. Saving writes the existing app-setting keys for both model and provider; no persistence contract changes.

### Empty and legacy states

- When no enabled model of the required type exists, the model control shows its empty state and does not fabricate a provider.
- A saved value outside the current catalog remains visible as the model control value.
- A saved provider outside the current catalog is shown verbatim.
- Clearing a model also clears its associated provider so stale providers are not saved.

## Testing

Regression tests will prove these behaviors before implementation:

- Admin route recognition hides `NavPanelShell` for `/settings/admin` and descendants while preserving it for ordinary routes.
- The admin search input has one accessible name and no duplicate visible label node.
- Chat, Embedding, and Reranker options are filtered from the correct catalog types.
- Selecting a model derives the provider ID and human-readable provider label.
- Clearing a model clears its provider.
- Legacy saved values outside the catalog remain visible and saveable.
- Existing admin authorization, desktop navigation, responsive admin sheet, and settings serialization tests remain green.

Rendered validation will use the local debug proxy at desktop and narrow viewports. It will verify page identity, nonblank content, no framework overlay, relevant console health, hidden main application navigation, correctly aligned search, visible read-only providers after model selection, and the responsive admin navigation interaction.

## Acceptance Criteria

- No displaced `搜索管理功能` text appears above the search input.
- The leftmost main application panel is absent throughout `/settings/admin`; the admin navigation is still available.
- Selecting any supported runtime model immediately shows its provider in a read-only field.
- Saved model/provider pairs remain compatible with the existing backend settings keys.
- Existing out-of-catalog values are not silently erased.
- Focused checks, type checks, and rendered browser verification pass before completion is claimed.
