# Governance Index

Date: 2026-07-07

This index tells future agents which governance artifact to read or update.

## Core Documents

| Document | Purpose | Update when |
| --- | --- | --- |
| `docs/PROJECT_AUDIT.md` | broad architecture and risk audit | a major subsystem changes or a new audit is requested |
| `docs/FEATURE_REGISTRY.md` | long-term feature register | any feature is added, removed, renamed, or materially changed |
| `docs/REFACTOR_PLAN.md` | prioritized refactor roadmap | priorities change or a refactor item is completed/decomposed |
| `docs/CHANGELOG_INTERNAL.md` | internal implementation record | every governance or feature sprint |
| `docs/GOVERNANCE_SPRINT_001.md` | first executable governance batch | historical record only |
| `docs/GOVERNANCE_SPRINT_002.md` | second executable governance batch | update verification status for this batch |
| `docs/GOVERNANCE_SPRINT_003.md` | third executable governance batch | update verification status for this batch |
| `docs/ADMIN_SETTINGS_MAP.md` | app settings registry and cache ownership map | app setting keys/domains/cache scopes change |
| `docs/COMMERCIAL_PAGE_BOUNDARIES.md` | commercial page data ownership rules | plans/credits/billing/usage/referral responsibilities change |
| `docs/DEPLOYMENT_VERSION_PROBE.md` | deployment evidence checklist | deployment pipeline or smoke checks change |
| `docs/MODEL_CATALOG_DISPLAY_RULES.md` | provider/model display and duplicate grouping rules | model catalog display, grouping, diagnostics, or pricing metadata changes |

## Agent Workflow

Before modifying code, read:

- `docs/FEATURE_REGISTRY.md`
- `docs/PROJECT_AUDIT.md`
- `docs/REFACTOR_PLAN.md`
- the sprint file for the current governance batch
- `AGENTS.md`

When modifying an existing feature, record impact across:

- pages
- components
- API / server actions
- database dependencies
- config keys
- environment variables
- Docker/deployment behavior

When adding a feature, update:

- `docs/FEATURE_REGISTRY.md`
- `docs/CHANGELOG_INTERNAL.md`

When deleting a feature:

- mark it deprecated first
- check references
- confirm no dependency remains
- then remove code in a later, reviewed change

## Current Priority

Keep executing small P0/P1/P2 slices:

1. settings registry and public config guardrails
2. AI provider/model/pricing display consistency
3. commercial page ViewModel extraction
4. brand/runtime/deployment smoke checks
5. diagnostics for desktop, Composio, notifications, memory, and market data
