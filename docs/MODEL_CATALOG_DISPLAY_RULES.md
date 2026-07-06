# Model Catalog Display Rules

Date: 2026-07-07

Purpose: define a stable display contract for AI providers and models after ComHub admin-created providers are merged with upstream LobeHub model-bank data.

## Scope

These rules apply to:

- user model switchers
- user service-model settings
- admin system-defaults model selectors
- admin model billing matrix
- credit ledger and usage diagnostics
- model catalog health diagnostics

## Provider Display Priority

Provider labels must be resolved in this order:

1. `instanceName`
2. `groupName`
3. model-level `instanceName`
4. model-level `groupName`
5. model-level `providerName`
6. entry `providerType`
7. model-level `providerType`
8. non-UUID `providerId`
9. fallback: `Custom provider`

Never show a UUID-like provider ID as the primary provider label in user-facing surfaces.

## Model Display Priority

Model labels must be resolved in this order:

1. `displayName`
2. `name`
3. `id`
4. fallback: `Untitled model`

The model ID remains the stable technical key. The display label is only for UI and diagnostics.

## Duplicate Model IDs

Duplicate model IDs are valid when they come from different providers. The UI must not collapse them into one invisible entry.

Duplicate grouping key:

```text
<model type>:<model id>
```

Provider instances remain separate children inside that group. Diagnostics should report duplicate model IDs across provider identities so admins can verify price, ability, and plan-rule coverage for every provider/model pair.

## Non-goals

- Do not rewrite `ModelSwitchPanel` data flow in one step.
- Do not delete existing model-bank or DB model sources.
- Do not change billing transactions or persisted pricing snapshots.
- Do not infer official model pricing without a tracked source.

## Verification

Current guard tests:

- `src/server/services/modelCatalog/visibleModels.test.ts`
- `src/server/services/modelCatalog/diagnostics.test.ts`

Future model catalog changes must keep these tests green or update this document with an explicit migration note.
