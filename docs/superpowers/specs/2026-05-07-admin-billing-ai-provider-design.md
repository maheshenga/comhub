# Admin Billing and AI Provider Optimization Design

## Purpose

The admin console should let an operator complete one clear commercial setup flow:

1. Configure AI provider capacity.
2. Publish usable models.
3. Choose the default model.
4. Define plans and monthly credits.
5. Define which plans can use which models.
6. Define how model usage is converted into credits.
7. Monitor users, orders, usage, and billing exceptions.

The current project already has most of the underlying pieces, but they are spread across settings, plans, pricing, NewAPI provider pages, and user billing pages. This design reorganizes the admin experience around the actual operating workflow and reduces duplicated or confusing settings.

## Current System Summary

Billing is based on credits, not direct per-request payment. Plans grant credits into `credit_accounts`, usage writes `credit_ledger_entries`, and AI usage is converted from USD cost to credits using `CREDITS_PER_DOLLAR`, `pricing.creditMultiplier`, and optional `pricing.modelRules`.

AI provider configuration has two paths:

- Preferred path: admin-managed NewAPI instances in `admin_newapi_instances` and model catalogs in `admin_newapi_instance_models`.
- Legacy path: `app_settings` keys `newapi.apiKey`, `newapi.proxyUrl`, and `newapi.enabledModels`.

Plan model access is stored separately in `plan_catalog.model_rules`. This is separate from pricing rules, but the current naming and page layout make them easy to confuse.

Payment gateway endpoints currently return `PAYMENT_GATEWAY_NOT_CONFIGURED`, so commercial operation is not yet a full self-service payment flow. Manual order settlement and admin credit adjustments still exist.

## Design Goals

- Make the admin console default to Chinese text, with English terms only as parenthetical notes when useful.
- Make NewAPI multi-instance configuration the primary AI provider flow.
- Keep legacy NewAPI app settings as fallback behavior, but remove them from the main operator path.
- Let default model selection use the enabled model catalog instead of free-form text.
- Unify model availability, plan access, and pricing into a visible matrix.
- Clearly separate three concepts:
  - Model source: where the model comes from.
  - Model permission: who may use the model.
  - Pricing rule: how much the model costs in credits.
- Surface incomplete commercial infrastructure, especially missing payment gateway configuration.
- Avoid large backend rewrites in the first UI cleanup phase.

## Admin Information Architecture

The admin console remains under `/settings/admin`.

### Overview

The overview page should show the operator's current system state:

- Total users, active users, new users.
- Current default model.
- Enabled NewAPI instances.
- Enabled models by type.
- Credit consumption summary.
- Revenue/order summary.
- Pending orders and billing exceptions.
- Quick links to provider setup, model matrix, plans, and orders.

### Users

User management should include:

- User list and search.
- User detail.
- Role and ban status.
- Current plan.
- Credit balance.
- Credit ledger.
- Manual credit adjustment.
- Manual plan adjustment.

### Models and API

This section owns model supply and runtime policy.

Pages:

- Provider Instances: NewAPI instance CRUD, priority, enable state, API key, base URL, and health status.
- Model Catalog: all enabled and disabled models across all NewAPI instances.
- Default Model: select provider and model from the enabled catalog.
- Global Model Policy: global allowlist/blocklist and scope settings.

Legacy NewAPI settings should be moved into an advanced/collapsed compatibility area. The UI should explain that multi-instance NewAPI is the recommended path.

### Commercialization

This section owns plans, pricing, orders, and credits.

Pages:

- Plan Management: display name, prices, monthly credits, active state, features, sort order.
- Model Permission Matrix: plan-by-model access control.
- Pricing Rules: global multiplier, model/provider-specific credit conversion.
- Top-up Packages: package CRUD and active state.
- Orders: pending, paid, canceled, expired, failed, manual settlement.
- Redemption Codes: generate, list, disable, expire.

### Operations

This section owns user-facing operational content:

- Signup and onboarding settings.
- Initial credits.
- Referral reward settings.
- Recommendation content.
- Announcements.
- Help menu.

### System

This section owns platform-level settings:

- Brand settings.
- Domain/site metadata.
- Desktop update configuration.
- Maintenance jobs.
- Audit logs.

## Core Feature: Model and Billing Matrix

The model and billing matrix is the central improvement.

Each row represents one effective model entry. Columns:

- Model ID.
- Display name.
- Model type: chat, image, video, embedding, tts, stt, text2music, realtime.
- Source provider: normally NewAPI.
- Source instance names.
- Enabled state.
- Default model marker.
- Plan access columns: Free, Hobby, Starter, Premium, Ultimate, or whatever plans exist in `plan_catalog`.
- Pricing multiplier.
- Credits per dollar override.
- Last known runtime status.

Supported actions:

- Enable or disable a model.
- Set display name.
- Set default model.
- Edit plan access for the model.
- Edit pricing rule for the model.
- Open source instance detail.

The matrix should persist to existing storage first:

- Model source and enabled state: `admin_newapi_instance_models`.
- Default model: `defaultAgent.provider` and `defaultAgent.model`.
- Plan access: `plan_catalog.model_rules`.
- Pricing: `pricing.modelRules` and `pricing.creditMultiplier`.

This avoids a new schema in phase 1. A later phase can introduce a normalized `model_commercial_rules` table if the JSON settings become too hard to maintain.

## Data Flow

### Provider and Model Publication

1. Admin creates or updates a NewAPI instance.
2. Admin adds models to that instance.
3. Server global config reads enabled instance models through `getAllEnabledModels`.
4. The frontend receives enabled model lists in server config.
5. Runtime resolves a model through `resolveNewapiInstancesForModel`.
6. Runtime uses the highest-priority matching instance and fallback instances for chat failover.

### Default Model

1. Admin selects an enabled model from the catalog.
2. UI saves `defaultAgent.provider` and `defaultAgent.model`.
3. Server app settings cache is invalidated.
4. Server global config merges app settings over environment default agent config.
5. Client refreshes server config and user state.

### Plan Access

1. Admin edits plan access in the matrix.
2. UI writes `plan_catalog.model_rules`.
3. Runtime checks `assertPlanModelAllowed`.
4. Client model lists are filtered using the current plan model rules.

### Pricing

1. Admin edits global multiplier or model/provider pricing rules.
2. UI writes `pricing.creditMultiplier` and `pricing.modelRules`.
3. On final usage billing, `CommercialModel` calculates charged credits from USD cost, credits-per-dollar, and multiplier.
4. Ledger metadata records matched pricing rule and usage details.

## Error Handling and Operator Feedback

The admin UI should explicitly show these states:

- No NewAPI instance configured.
- NewAPI instance configured but no enabled models.
- Default model points to a disabled or missing model.
- Plan has no model rule, meaning unrestricted access for that model type.
- Pricing rule JSON is invalid.
- Payment gateway is not configured.
- Chat billing skipped because final usage metadata is missing.
- Final charge failed because balance became insufficient after generation.

Where possible, errors should include direct repair actions, such as "Select default model", "Enable model", or "Configure payment gateway".

## Implementation Phases

### Phase 1: Admin Cleanup

Scope:

- Fix Chinese text and mojibake in admin pricing, plans, and NewAPI pages.
- Rename labels so pricing rules and plan model rules are not confused.
- Move legacy NewAPI fields into an advanced compatibility section.
- Change default model fields from free-form text to provider/model selectors backed by enabled models.
- Add clear payment gateway status messaging.

No schema changes are required.

### Phase 2: Model and Billing Matrix

Scope:

- Add a matrix page under `/settings/admin`.
- Load enabled models, plans, existing plan rules, and pricing rules.
- Support editing default model, plan access, and pricing from one screen.
- Save changes through existing admin routers.
- Add focused tests for rule conversion and save payloads.

No schema changes are required unless existing JSON settings prove insufficient.

### Phase 3: Billing Reliability

Scope:

- Introduce credit reservation or pre-authorization for chat requests.
- Ensure all billable runtime calls have a generated billing reference.
- Treat missing billing reference as a recoverable server-side generation issue, not a silent free request.
- Add billing exception reporting to admin overview.

This phase may require schema changes for reserved credit state.

### Phase 4: Payment Gateway

Scope:

- Replace `PAYMENT_GATEWAY_NOT_CONFIGURED` stubs with real payment provider integration.
- Keep manual settlement as an admin fallback.
- Add payment provider config status.
- Add webhook idempotency and order reconciliation.

Provider choice is intentionally outside this design. The first implementation should keep a clean payment adapter interface.

### Phase 5: Provider Health and Cost Analytics

Scope:

- Track NewAPI instance health and recent failures.
- Show fallback usage counts.
- Show cost and credit consumption by model, provider, and plan.
- Add warnings for models with no pricing signal and fallback-rate billing.

## Testing Strategy

Unit tests:

- Pricing rule parsing and matching.
- Plan model rule matrix conversion.
- Default model save payload generation.
- Legacy NewAPI compatibility visibility logic.

Server tests:

- NewAPI instance model aggregation.
- Default model config resolution.
- Plan rule enforcement.
- Billing metadata and final charge failure paths.

UI tests:

- Admin default model selector loads enabled models.
- Matrix saves plan access and pricing changes.
- Payment gateway unconfigured state is visible.

Manual verification:

- Configure one NewAPI instance.
- Add one chat model.
- Set it as default.
- Assign access to one paid plan.
- Apply a pricing multiplier.
- Confirm a user on that plan can use the model and a user outside the plan is blocked.

## Out of Scope

- Replacing the whole credit ledger model.
- Removing legacy NewAPI fallback behavior from the backend.
- Implementing payment provider integration in the cleanup phase.
- Adding a normalized commercial model rules table in phase 1.
- Changing public user billing pages before admin setup is clarified.

## Open Decisions

- Which payment provider should be integrated first.
- Whether the model matrix should support bulk import/export.
- Whether `pricing.modelRules` should support wildcard patterns beyond exact model and `*`.
- Whether NewAPI health checks should be active probes or passive failure aggregation in the first version.
