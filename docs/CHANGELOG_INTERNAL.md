# Internal Changelog

## 2026-07-07

### Governance

- GOV-001: Added admin settings guardrails for app setting form classification, registry metadata completeness, and sensitive desktop OSS values in public desktop config.
- Verification: `src/features/Admin/adminSettingsForm.test.ts`, `src/server/services/appSettings/governance.test.ts`, and `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
- GOV-002: Added ledger provider/model display-name formatting so user credit ledger rows prefer metadata display names and hide raw provider UUIDs.
- Verification: `src/business/client/BusinessSettingPages/ledgerDisplay.test.ts`.
- GOV-003: Added Community/MCP/Skill market fallback normalization so placeholder `UN` labels and blank descriptions render as readable fallback content.
- Verification: `src/features/SkillStore/SkillList/normalizeMarketItems.test.ts`, `apps/server/src/services/discover/index.test.ts`, and `apps/server/src/services/market/index.test.ts`.
- GOV-004 to GOV-015: Executed Governance Sprint 002 with 12 small tasks covering the sprint register, admin settings map, commercial page boundaries, deployment version probe, governance index, long-term registry/changelog updates, secret-like settings guard, public desktop config allowlist, ledger/plans/top-up formatter guardrails, top-up serializer cleanup, and referral input formatter extraction.
- Verification: `src/server/services/appSettings/governance.test.ts`, `src/const/billingPresentation.test.ts`, `src/business/client/BusinessSettingPages/referralDisplay.test.ts`, `src/business/client/BusinessSettingPages/ledgerDisplay.test.ts`, `src/business/client/BusinessSettingPages/plansDisplay.test.ts`, and `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
- GOV-016 to GOV-025: Executed Governance Sprint 003 with model catalog display resolvers, cross-provider duplicate model diagnostics, credit ledger allocation formatter extraction, model catalog display rules documentation, registry updates, and governance index updates.
- Verification: `src/server/services/modelCatalog/visibleModels.test.ts`, `src/server/services/modelCatalog/diagnostics.test.ts`, `src/business/client/BusinessSettingPages/creditsDisplay.test.ts`, `src/business/client/BusinessSettingPages/ledgerDisplay.test.ts`, and `git diff --check`.
- GOV-026: Added server brand cache invalidation to the admin runtime cache refresh action so loading SVG, favicon, and brand config can be refreshed without waiting for the brand TTL.
- Verification: `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
- GOV-027: Extended the public `/api/version` probe with safe deployment metadata and injected commit/image build metadata through the Docker build workflow.
- Verification: `src/app/(backend)/api/version/route.test.ts`.
- GOV-028: Added explicit user default settings sync priority coverage. Default assistant meta is preserved by default during backend default sync, while the admin "save and sync" action can explicitly force default assistant meta into existing users and records that force flag in the audit payload.
- Verification: `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
