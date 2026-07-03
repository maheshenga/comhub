# Docmee PPT Integration Design

## Goal

Integrate Docmee AiPPT as a first-class PPT creation capability in ComHub, using the full commercial path:

- server-side Docmee API key storage and token generation
- user-facing PPT creation entry
- admin-controlled enablement and settings
- plan and quota enforcement
- local usage and billing records

The integration must not expose the Docmee API key to the browser. The browser only receives a short-lived Docmee UI token created by the ComHub server for the current signed-in user.

References:

- Docmee UI SDK: <https://github.com/docmee/sdk-ui>
- Docmee UI integration docs: <https://open.docmee.cn/open/doc/ui>
- Docmee authentication docs: <https://open.docmee.cn/open/doc/authentication>
- Docmee API docs: <https://open.docmee.cn/open/doc/api>

## Product Scope

Add a new user feature at:

```text
/create/ppt
```

This keeps PPT alongside existing creation flows such as image and video generation. The feature should feel like part of ComHub, not a raw third-party embed.

The first production-ready version includes:

- a PPT creation page that embeds `@docmee/sdk-ui`
- backend token creation using the configured Docmee API key
- admin settings for enablement, API key, permissions, and charging rules
- plan-level PPT availability and monthly quota
- user-facing errors for disabled, unconfigured, no-permission, quota-insufficient, and upstream-service-failed states
- local records for PPT sessions and successful generations

The first version does not need to reimplement Docmee's editor UI or template marketplace. The SDK remains responsible for the actual PPT authoring surface.

## Recommended UX

### User Entry

Add `PPT` to the creation area near image and video. The route is `/create/ppt`.

Page states:

- Loading: "正在加载 PPT 创作服务"
- Disabled: "PPT 创作功能暂未开启"
- Unconfigured: "管理员尚未配置 PPT 服务"
- No permission: "当前套餐暂不支持 PPT 创作"
- Quota exhausted: "PPT 生成额度不足"
- Upstream error: "PPT 服务暂时不可用，请稍后重试"

No Docmee API implementation detail should leak into end-user messages unless it helps support troubleshoot.

### Admin Entry

Add an admin page:

```text
/settings/admin/ppt
```

The page should use the current admin layout and Chinese labels.

Sections:

- Basic settings: enable switch, API key, token TTL, default language, theme color
- Export settings: allow PPTX download, allow PDF export
- Plan access: free, basic, advanced, professional, star plan enablement
- Quota and billing: monthly generation limit, per-generation credit cost, failure refund policy
- Safety: daily limit per user, concurrent session limit, audit logging switch

The API key field should support "configured / not configured" display and allow replacement, but should not reveal the saved secret after storage.

## Architecture

### Frontend

Add:

```text
src/routes/(main)/(create)/ppt/index.tsx
src/routes/(main)/(create)/ppt/features/PptWorkspace.tsx
src/routes/(main)/(create)/ppt/features/PptErrorState.tsx
src/routes/(main)/(create)/ppt/features/useDocmeeToken.ts
```

Responsibilities:

- request a ComHub backend token endpoint
- dynamically load or import `@docmee/sdk-ui`
- mount `DocmeeUI` into a stable full-height workspace
- pass current theme and language options
- handle SDK lifecycle cleanup on unmount
- map backend errors into Chinese UI states

The page should avoid decorative landing content. It should open directly into the PPT workspace when available.

### Backend

Add:

```text
src/server/services/docmee/index.ts
src/server/routers/lambda/docmee.ts
```

Service responsibilities:

- read Docmee settings from admin configuration
- validate feature enablement
- validate authenticated user
- validate user plan and PPT quota
- create a Docmee UI token with `uid` bound to the ComHub user ID
- create a local PPT session record
- process completion or callback events when available

Router methods:

```text
docmee.getPptRuntime()
docmee.createPptToken()
docmee.reportPptEvent()
```

`getPptRuntime` returns public runtime state only, such as enabled status and sanitized UI configuration.

`createPptToken` performs all authorization checks and returns a short-lived token plus local session ID.

`reportPptEvent` records generation completion, failure, cancellation, and download events. It should be idempotent by session ID and upstream task ID.

### Admin Backend

Extend the existing admin settings storage rather than creating a separate secret mechanism in the first version. The Docmee API key should be treated as a secret value:

- never returned in full to the client
- only returned as a boolean `configured` flag and masked suffix if needed
- only writable by admins

Plan objects should gain PPT capability fields:

```text
pptEnabled
pptMonthlyQuota
pptCreditCost
```

If the current plan schema already has generic feature limits, use that pattern instead of introducing redundant fields.

## Data Model

Add or extend local records for PPT usage.

Minimum PPT session record:

```text
id
userId
docmeeUid
upstreamTaskId
status
title
planId
creditCost
quotaCost
createdAt
completedAt
errorMessage
metadata
```

Statuses:

```text
created
editing
generated
failed
canceled
downloaded
```

Charging should happen once per successful generation. Duplicate callbacks or repeated frontend reports must not double-charge.

## Billing And Quota Rules

First version rules:

- Opening `/create/ppt` does not charge.
- Creating a token does not charge.
- Successful full PPT generation consumes one PPT quota unit.
- If `pptCreditCost` is greater than zero, successful generation also deducts credits.
- Failed or canceled generation does not charge.
- Download does not charge in the first version.

Suggested default plan policy:

```text
Free: disabled or 1 trial generation
Basic: 5 generations/month
Advanced: 20 generations/month
Professional: 80 generations/month
Star: high quota or unlimited with daily safety cap
```

The implementation should not hard-code these values. They should be admin-configurable.

## Security

Required controls:

- Docmee API key is stored and used only server-side.
- Frontend receives only a temporary Docmee token.
- Token creation requires a signed-in user.
- Token `uid` is the ComHub user ID or a stable derived ID.
- Admin settings endpoints require admin authorization.
- Token endpoint enforces plan availability and quota.
- Rate limits protect token creation and event reporting.
- Logs must not print the full API key or token.

## Error Handling

Backend should return typed errors:

```text
PPT_DISABLED
PPT_NOT_CONFIGURED
PPT_UNAUTHORIZED
PPT_FORBIDDEN_BY_PLAN
PPT_QUOTA_EXHAUSTED
PPT_UPSTREAM_TOKEN_FAILED
PPT_EVENT_INVALID
```

Frontend maps these to Chinese user messages and actionable buttons:

- no permission or quota exhausted: show upgrade and redemption options
- not configured: admin-only hint if current user is admin
- upstream failure: retry button

## Testing

Unit tests:

- Docmee service does not expose API key
- token creation rejects disabled and unconfigured states
- token creation rejects users without plan permission
- successful generation charges once
- duplicate completion event does not double-charge
- failure event does not charge

Frontend tests:

- `/create/ppt` renders disabled, no-permission, quota, and normal loading states
- admin PPT settings masks API key
- admin PPT settings saves sanitized configuration

Manual verification:

- admin configures API key
- eligible user opens `/create/ppt`
- Docmee UI loads
- successful PPT generation creates local usage record
- ineligible user sees no-permission state

## Rollout

Phase 1: Core integration

- add admin settings
- add backend token service
- add `/create/ppt`
- mount SDK
- handle core errors

Phase 2: Commercial integration

- add plan-level PPT quota settings
- record generation events
- deduct quota and credits on success
- show PPT usage in admin user detail

Phase 3: Polish

- brand theme and default template options
- generation history
- edit previous PPT sessions
- usage charts and billing detail

## Open Decisions

The implementation should confirm the exact Docmee SDK event names and token API response shape from the current package before coding. The design assumes the SDK supports token-based initialization and generation lifecycle callbacks as described by Docmee's integration documentation.
