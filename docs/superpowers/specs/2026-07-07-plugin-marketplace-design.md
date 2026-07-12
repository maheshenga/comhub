# Plugin Marketplace Design

Date: 2026-07-07
Project: ComHub / LobeHub customization
Status: Approved design draft

## 1. Goal

Build a platform-controlled plugin marketplace for ComHub that supports commercialized functional plugins without disrupting the existing MCP and Skills systems.

The first version focuses on two plugin types:

- API action plugins: search, translation, data lookup, third-party service calls.
- Content generation plugins: PPT, image, copywriting, report, table, and document generation.

Existing MCP and Skills remain in their current pages and runtime paths. The new plugin marketplace only reserves compatibility fields for future bridge work.

## 2. Non-goals for P1

- Do not migrate existing MCP entries into the plugin marketplace.
- Do not migrate existing Skills into the plugin marketplace.
- Do not support uploaded executable code.
- Do not support Git repository based plugins.
- Do not support user-submitted public plugins.
- Do not build a full developer revenue-sharing ecosystem.
- Do not build visual workflow orchestration in P1.

These items are reserved for later phases after the core registry, permission, billing, storage, and audit paths are stable.

## 3. Recommended approach

Use a unified plugin framework, but keep P1 limited to controlled plugin types.

The system should introduce a separate plugin product domain instead of placing plugin settings under system defaults, AI providers, model pricing, or plan pages. The admin console gets a first-level "Plugins" area. The user side gets a plugin marketplace plus runtime entry points.

This approach avoids creating another scattered settings system while still leaving room for future MCP, Skill, package, script, and Git plugin compatibility.

## 4. Architecture

Core concept: Plugin Registry.

The Plugin Registry stores plugin metadata, version snapshots, capability declarations, plan entitlements, billing rules, secret references, runtime configuration, artifact behavior, and audit history.

P1 plugin runtime types:

- `api_action`: calls a configured external API with schema-driven input, request mapping, response mapping, timeout, and error handling.
- `content_generation`: uses AI model calls and prompt templates to generate text or files such as reports, PPT files, images, or tables.

Recommended runtime flow:

```text
User selects plugin
-> Check authentication
-> Check plugin status
-> Check plan visibility / install / run entitlement
-> Check plugin installation
-> Check Agent binding
-> Resolve plugin version and action configuration
-> Resolve secrets on the server
-> Estimate cost where possible
-> Execute API action or content generation
-> Persist run log and billing details
-> Persist artifact metadata when files are produced
-> Return chat preview, result summary, and file links
```

Suggested backend service boundaries:

- `PluginRegistry`: reads published plugin metadata and version snapshots.
- `PluginPermissionChecker`: validates visibility, install, run, user group, and Agent binding rules.
- `PluginBillingCalculator`: calculates AI multiplier, module multiplier, fixed service fee, discounts, and free quota.
- `PluginSecretResolver`: injects server-side secrets without exposing them to the frontend.
- `PluginRunner`: dispatches `api_action` and `content_generation` execution.
- `PluginArtifactWriter`: stores generated file metadata and delegates real file storage to existing storage providers.
- `PluginAuditLogger`: records admin, user, runtime, billing, and secret events.

## 5. Admin experience

Add a dedicated admin first-level section: "Plugins".

Suggested sub-sections:

- Overview: plugin count, published count, run count, failure rate, credit consumption, revenue, recent errors.
- Plugin management: create, edit, publish, unpublish, version history, changelog, rollback fields reserved for later implementation.
- Marketplace settings: category, tags, recommendation slots, sorting, cover, screenshots, detail copy.
- Permission and plans: visible plans, installable plans, runnable plans, user groups, forced enablement, free quota, discounts.
- Billing settings: default multiplier, module multiplier, fixed service fee, external API cost fields reserved for later implementation.
- Secrets: platform-level secrets, plugin-level secrets, encrypted storage, masked display.
- Run records: user, Agent, plugin, action, version, model, duration, status, credits, error summary.
- Artifacts: generated file name, type, size, storage URL reference, expiration, download count.
- Review and publishing: reserved for user submissions, review, grayscale release, and advanced lifecycle states.

Plugin creation uses a layered configurator:

- Basic information: name, icon, category, description, author, version, status, display switch.
- Capability declaration: API call, content generation, file artifact, chat preview, page entry.
- Input form: field name, type, default value, required flag, validation rule, help text.
- Runtime configuration: API URL, method, headers, request mapping, response mapping, model, prompt template, output format.
- Permission configuration: visible plans, installable plans, runnable plans, user groups, forced enablement.
- Billing configuration: default multiplier, module multiplier, fixed service fee, failure billing policy.
- Advanced JSON: escape hatch for complex configuration, not required for normal admin usage.

Admin organization principle:

Plugin identity, market display, plan entitlement, billing, secrets, runtime logs, and artifact records should all be owned by the Plugins section. Plan pages should only display included plugin entitlements, not become plugin configuration pages.

## 6. User experience

User-side entry points:

- Plugin marketplace: browse, search, filter, view details, install.
- Agent settings: enable or disable installed plugins per Agent.
- Chat entry: invoke enabled plugins through tool picker or shortcut entry.
- Sidebar page entry: only shown for plugins that declare an independent page entry.

Plugin detail page should show:

- Name, icon, author, version, category, tags.
- Feature description, screenshots, examples.
- Required inputs and output types.
- Current plan availability and upgrade guidance.
- Cost explanation: fixed service fee, AI multiplier, possible external service cost.
- Permission declaration: network access, file generation, model calls, external API calls.
- Installed state and Agent binding state.
- Version history and changelog.

Runtime behavior:

- API action plugins return a result summary in chat and preserve a run record.
- Content generation plugins show progress, preview, generated summary, and download links.
- Generated files appear in plugin artifact records.
- Failure states are user-friendly and retryable.
- Plan restrictions show an upgrade path instead of an opaque error.

P1 should stay practical: users must be able to find a plugin, understand it, install it, enable it for an Agent, run it, see the result, and understand failures.

## 7. Data model

Recommended tables or equivalent schema groups:

- `plugins`: plugin identity, metadata, category, icon, description, author, current version, status, capability type, display configuration.
- `plugin_versions`: version number, configuration snapshot, changelog, publish time, rollback source field reserved for later implementation.
- `plugin_actions`: action or module definitions, runtime type, input schema, output schema, module multiplier.
- `plugin_installations`: user installation state, installed plugin version, install and uninstall timestamps.
- `plugin_agent_bindings`: whether a plugin is enabled for a specific Agent.
- `plugin_plan_entitlements`: plan visibility, installability, run permission, free quota, discount, forced enablement.
- `plugin_secrets`: encrypted secret payload, secret type, plugin reference, masked metadata, last used time.
- `plugin_runs`: run records with user, Agent, plugin, action, version, status, duration, cost, error summary.
- `plugin_artifacts`: generated file metadata, storage reference, file type, size, expiration, download count.
- `plugin_audit_logs`: publish, unpublish, version update, secret change, install, enable, run failure, billing events.

Avoid a single huge JSON blob for all plugin settings. Use structured tables for stable concepts and JSON only for versioned runtime snapshots or advanced extension fields.

## 8. Permissions

Permission checks have three levels:

- Visible: whether the user can see the plugin in the marketplace.
- Installable: whether the user can install the plugin.
- Runnable: whether the user can execute the plugin now.

Runnable checks should include:

- User authentication.
- Plugin published status.
- Plan entitlement.
- Optional user group entitlement.
- Installation state.
- Agent binding state.
- Balance and free quota.
- Risk confirmation where applicable in later phases.

Admin can force-enable system plugins for selected plans or user groups in later phases. P1 can reserve the field and implement basic forced enablement if low risk.

## 9. Billing

Use mixed billing:

```text
Final cost =
AI model actual cost * plugin default multiplier * module multiplier
+ fixed plugin service fee
+ external API cost
- plan discount / free quota
```

P1 billing scope:

- Plugin default multiplier.
- Module-level multiplier.
- Fixed plugin service fee.
- Plan visibility, install, and run entitlements.
- Failure does not charge the fixed plugin service fee.
- AI cost already incurred by a failed generation is recorded as actual model cost.
- External API cost is reserved as a field and can be calculated later.

Action-level multiplier should be reserved in schema for future fine-grained billing, but P1 UI does not need to expose it.

## 10. Secrets

Use a mixed secret model long term:

- Platform-level secrets.
- Plugin-level secrets.
- User private secrets.
- Team or workspace-level secrets.
- Plan or group restrictions.

P1 should implement:

- Admin platform-level secrets.
- Plugin-level secrets.
- Encrypted storage.
- Masked display.
- Server-side resolution only.
- Audit logs for secret creation, update, and use.

Frontend must never receive raw secret values.

## 11. Storage and artifacts

Use mixed storage:

- Default to the existing platform file storage configuration such as OSS, S3, or local storage.
- Store plugin artifact metadata in the database.
- Store real files through existing storage providers.
- Chat messages should contain previews and result links, not large binary payloads.
- Later phases can add plugin-specific storage, capacity limits, sharing links, and artifact versioning.

P1 artifact examples:

- Generated PPT file.
- Generated image.
- Generated report document.
- Generated table file.

## 12. Error handling

User-facing errors should be clear but not leak sensitive internals.

Admin-facing records should capture enough information to debug:

- Error type.
- Plugin id and version.
- Action id.
- User id.
- Agent id.
- Runtime type.
- Model id where applicable.
- HTTP status where applicable.
- Duration.
- Cost details.
- Sanitized request and response summaries.

Failure rules:

- Retry always re-checks permission and balance.
- Failed runs do not charge fixed plugin service fees.
- Actual AI model usage already incurred is recorded.
- Failed artifact generation must not leave broken download links.
- Timeout, external API failure, model failure, insufficient balance, and plan denial should be recorded distinctly.

## 13. Security and audit

Security requirements:

- Never hardcode API keys, Base URLs, or model names in plugin code.
- Validate plugin input schema on the server.
- Restrict API plugin target URLs to safe protocols.
- Block localhost, private network, and metadata service targets.
- Redact authorization, token, cookie, and secret-like fields from logs.
- Keep secrets server-side.
- Avoid uploaded code execution in P1.

Audit events:

- Plugin created, updated, published, unpublished.
- Version changed.
- Secret created or changed.
- Plugin installed, uninstalled, enabled, disabled.
- Plugin run succeeded or failed.
- Billing calculated.
- Artifact created or deleted.

High-risk plugins in later phases should support secondary confirmation before execution.

## 14. Lifecycle

Long-term plugin lifecycle:

- Draft.
- Internal test.
- Review.
- Published.
- Grayscale.
- Unpublished.
- Deprecated.
- Version history.
- Changelog.
- Rollback.

P1 lifecycle:

- Draft.
- Published.
- Unpublished.
- Version history.
- Changelog field.
- Rollback field reserved.

## 15. MVP validation plugins

P1 should include at least two real sample plugins:

- API query plugin: validates external API call, secret resolution, plan entitlement, fixed fee, run logs, and error handling.
- Content generation plugin: validates AI multiplier, module multiplier, artifact storage, chat preview, download link, and run records.

These samples should be simple but production-shaped, so they validate the entire commercial plugin path.

## 16. Rollout plan

P1: Platform-controlled plugin MVP

- Database schema and backend service boundaries.
- Admin plugin section.
- API action and content generation plugin creation.
- Plan entitlement and billing configuration.
- Secret configuration.
- User marketplace and plugin detail.
- Installation and Agent binding.
- Chat invocation.
- Artifact metadata and downloads.
- Run records and audit logs.

P2: Plugin ecosystem enhancements

- User private secrets.
- Plugin artifact detail pages and sharing.
- User private plugins.
- User submission and review center.
- Grayscale release.
- High-risk secondary confirmations.
- External API cost calculation.
- User group and enterprise workspace permissions.
- Recommendation, rating, and ranking.

P3: Advanced plugin platform

- Plugin package upload.
- Git repository plugins.
- Runtime sandbox.
- Developer center.
- Revenue sharing.
- MCP and Skills bridge or compatible marketplace display.
- Visual workflow orchestration.
- Automatic update, rollback, and compatibility checks.

## 17. P1 acceptance criteria

- Admin can create and publish one API query plugin.
- Admin can create and publish one content generation plugin.
- Admin can configure plugin plan entitlement, multipliers, and fixed service fee.
- Admin can configure plugin-level secrets without exposing raw values.
- User only sees plugins visible to the user's plan.
- User can install a plugin.
- User can enable a plugin for a specific Agent.
- Chat can invoke an enabled plugin.
- Content generation plugin can create a file artifact and provide a download link.
- Successful runs record billing details.
- Failed runs record error details and do not charge fixed plugin service fees.
- Insufficient balance and plan denial are handled explicitly.
- Admin can inspect run logs, billing details, error summaries, and audit logs.
- Raw secrets never appear in frontend payloads or ordinary logs.

## 18. Implementation order

Recommended order:

1. Add schema and service boundaries.
2. Add admin plugin management and configuration.
3. Add plan entitlement and billing calculation.
4. Add secret resolution and audit logging.
5. Add user marketplace and plugin details.
6. Add install and Agent binding.
7. Add runtime execution for API actions.
8. Add runtime execution for content generation.
9. Add artifact metadata and downloads.
10. Add focused tests for permission, billing, secret redaction, and failure behavior.

Core runtime, billing, and secret paths should have tests before broad UI polishing.

## 19. Open decisions for implementation planning

These are intentionally left for the implementation plan, not for product scope:

- Exact table names and migration file placement.
- Exact TRPC router or Server Action names.
- Exact admin route path naming.
- Whether P1 forced enablement is fully implemented or only reserved.
- Which two concrete sample plugins are shipped first.

The product direction is fixed: platform-controlled Plugin Registry, P1 API action and content generation plugins, independent admin Plugin section, plan-bound permissions, mixed billing, encrypted secrets, run logs, audit logs, and artifact storage.
