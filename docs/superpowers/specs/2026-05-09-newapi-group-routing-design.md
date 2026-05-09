# NewAPI Group Routing Design

## Goal

Add first-class NewAPI group support so commercial routing, plan access, billing, and audit records can distinguish the same model across different upstream NewAPI groups.

The first implementation should make the runtime correct before making the admin UI rich. A user request must route to an instance whose group is allowed by the user's current plan, and final billing must record the selected instance and group.

## Current System

The project already supports admin-managed NewAPI instances:

- `admin_newapi_instances` stores `baseUrl`, `apiKey`, `enabled`, and `priority`.
- `admin_newapi_instance_models` stores per-instance `modelId`, `modelType`, `enabled`, and metadata.
- Runtime NewAPI routing chooses enabled instances by `modelId + modelType`, then falls back by instance priority.
- Plan access rules are stored as `plan_catalog.model_rules` and currently match only model IDs per model type.
- Commercial billing rules are stored in `pricing.modelRules` and currently match `provider + model`.

This is not enough for NewAPI groups because the same model can exist in multiple groups with different upstream availability and cost.

## Design Summary

Treat a configured NewAPI instance as a routeable upstream channel:

```text
NewAPI route = baseUrl + apiKey + groupKey + usageScope + priority
```

The group is admin-controlled. Users still see normal model names. The system resolves the correct group behind the scenes based on their plan.

The MVP should add:

- Group fields to NewAPI instances.
- Group-aware model routing.
- Group-aware plan access.
- Group-aware pricing rules.
- Billing audit metadata for the resolved instance and group.
- Admin UI fields for instance groups and a grouped model matrix.

## Data Model

### NewAPI Instances

Add these columns to `admin_newapi_instances`:

- `group_key text not null default 'default'`
- `group_name text`
- `group_multiplier numeric`
- `usage_scope jsonb`

`group_key` is the stable routing key, such as `default`, `basic`, `pro`, `image`, or `video`.

`group_name` is display-only.

`group_multiplier` is optional. It can be used as a local cost/margin factor when a pricing rule does not override the group.

`usage_scope` is an optional list of model types allowed on this instance, for example:

```json
["chat", "embedding"]
```

When missing, the instance can serve any enabled model type registered under it.

### NewAPI Instance Models

Keep the current primary key for the MVP:

```text
instanceId + modelId + modelType
```

Do not add `group_key` to the model table primary key in the first step because the instance itself owns the group. This avoids a larger migration and keeps failover simple.

Extend model `metadata` with upstream pricing fields:

```json
{
  "enableGroups": ["default", "vip"],
  "quotaType": 0,
  "modelRatio": 15,
  "modelPrice": null,
  "completionRatio": 3,
  "supportedEndpointTypes": ["chat_completions"]
}
```

### Plan Model Rules

Extend the rule entry format to support group-qualified model IDs while preserving old model-only rules.

Existing:

```json
{
  "chat": {
    "mode": "allowlist",
    "allowlist": ["gpt-4o-mini"]
  }
}
```

New accepted values:

```json
{
  "chat": {
    "mode": "allowlist",
    "allowlist": ["basic:gpt-4o-mini", "pro:gpt-4o"]
  }
}
```

Matching rules:

- `group:model` matches only that group and model.
- `*:model` matches any group for that model.
- `group:*` matches all models in that group.
- `model` remains backward-compatible and means any group for that model.

### Pricing Rules

Extend `pricing.modelRules` with optional `group`:

```json
{
  "provider": "newapi",
  "group": "pro",
  "model": "gpt-4o",
  "multiplier": 1.65,
  "creditsPerDollar": 1000000
}
```

Matching priority:

1. `provider + group + model`
2. `provider + group + *`
3. `provider + * + model`
4. `provider + * + *`
5. legacy `provider + model`
6. global pricing multiplier

## Runtime Routing

Add a resolver for NewAPI requests:

```text
resolveNewapiInstancesForModel(db, {
  userId,
  modelId,
  modelType,
  preferredGroupKey?
})
```

The resolver should:

1. Read the user's active plan.
2. Read that plan's model rules.
3. Find enabled instances with enabled model rows for `modelId + modelType`.
4. Filter instances by `usage_scope` if configured.
5. Filter candidates by plan rules using `groupKey + modelId`.
6. Sort by priority within the allowed group candidates.
7. Return the primary instance plus same-group failover candidates.

Failover must not cross group boundaries unless an explicit admin setting allows cross-group failover. The MVP should not allow cross-group failover.

## Runtime Call Sites

Many call sites initialize `initModelRuntimeFromDB` without passing model context. Group routing requires model context.

High-priority call sites:

- Main chat runtime executor.
- Structured output chat route.
- Embedding routes for files, chunks, memory, and RAG eval.
- System agent and task lifecycle structured output calls when they use NewAPI.

The first code change should update the most important call sites to pass:

```ts
{
  model,
  modelType: 'chat' | 'embedding' | 'image' | 'video'
}
```

Image and video already mostly pass model context and should be kept as the reference pattern.

## Billing And Audit

When NewAPI routing selects an instance, the runtime should carry route metadata into billing hooks:

```json
{
  "provider": "newapi",
  "model": "gpt-4o",
  "instanceId": "...",
  "instanceName": "T8Star Pro",
  "groupKey": "pro",
  "groupName": "高级 GPT 分组"
}
```

Credit ledger metadata should include:

- `provider`
- `model`
- `instanceId`
- `instanceName`
- `groupKey`
- `groupName`
- `matchedPricingRule`
- `pricingMultiplier`
- `usdCost`
- `usageType`
- token counts or generation cost fields

This makes later margin analysis possible.

## Admin Experience

### NewAPI Instances

Add fields to create/edit:

- 分组标识
- 分组名称
- 分组倍率
- 用途范围

The table should show group and usage scope next to base URL and priority.

### Model Sync

Model sync should store `enable_groups` in metadata. If the configured instance group is not included in the upstream `enable_groups`, the UI should warn:

```text
该模型上游未标记为支持当前实例分组，请确认 API Key 分组是否可用。
```

Do not block import because some NewAPI deployments may omit `enable_groups`.

### Model And Billing Matrix

Rows should become `group + model + type`, not just `model + type`.

Example rows:

```text
basic / gpt-4o-mini / chat
pro / gpt-4o-mini / chat
image / imagen-4 / image
video / veo-3 / video
```

Columns remain plans. Toggles write group-qualified plan rules.

Pricing columns should save group-aware rules.

## Compatibility

Existing deployments should continue working after migration:

- Existing instances get `group_key = 'default'`.
- Existing plan rules with plain model IDs keep working.
- Existing pricing rules without `group` keep working.
- Existing billing entries remain readable.

## Non-Goals For MVP

The MVP will not:

- Manage NewAPI groups through NewAPI's admin API.
- Create or edit upstream NewAPI API keys.
- Expose group choice to end users.
- Implement cross-group load balancing.
- Automatically compute final profit per request.

These can be added after routing and audit data are reliable.

## Testing Strategy

Unit tests:

- Parse and match group-qualified plan rules.
- Resolve NewAPI instances by plan, group, model, type, and priority.
- Confirm failover candidates stay in the selected group.
- Match pricing rules with `group` priority before legacy rules.
- Preserve legacy `model` allowlist behavior.

Integration-style tests:

- Main chat initializes NewAPI runtime with model context.
- Image and video routing still pass model type.
- Billing ledger metadata includes group and instance fields when NewAPI is used.

Admin tests:

- Instance form serializes group fields.
- Matrix rows group by `groupKey + modelId + modelType`.
- Saved access rules use `group:model` entries.
- Saved pricing rules include `group`.

## Rollout Plan

1. Add model-context routing fixes to high-priority runtime call sites.
2. Add database migration and schema fields for NewAPI instance groups.
3. Extend NewAPI catalog sync metadata for upstream group and pricing fields.
4. Implement group-aware instance resolver.
5. Extend plan model rule matching to support `group:model`.
6. Extend pricing rule matching and billing metadata.
7. Update admin NewAPI instance page.
8. Update model and billing matrix.
9. Run targeted tests, type check, lint, and local Docker build before deployment.

## Open Decisions

The recommended defaults are:

- `group_key = 'default'` for existing instances.
- Same-group failover only.
- Users do not see group names in normal model selectors.
- Admin matrix shows group names.

The only decision that may need business confirmation is whether a paid plan should automatically prefer the highest-cost group or the lowest-cost allowed group when multiple groups expose the same model. The recommended behavior is lowest-priority number wins, controlled by admin instance priority.
