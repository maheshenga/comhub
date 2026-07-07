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
- GOV-029: Added before/after credit-account snapshots to the admin `credits.adjust` audit payload so manual credit changes have a reversible asset trail.
- Verification: `packages/business-server/src/lambda-routers/admin/credits.test.ts`.
- GOV-030: Added before/after plan-catalog snapshots to admin plan update/delete audit payloads while preserving the existing payload fields.
- Verification: `packages/business-server/src/lambda-routers/admin/plans.test.ts`.
- GOV-031: Added before/after plan-catalog snapshots to admin `plan.setActive` and `plan.setModelRules` audit payloads.
- Verification: `packages/business-server/src/lambda-routers/admin/plans.test.ts`.
- GOV-032: Added structured operation, status, scope, and cache-domain result metadata to admin settings cache refresh and user-default sync audit payloads.
- Verification: `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
- GOV-033: Added a pure business model pricing margin transform for model-bank pricing objects. The first P0-04 slice covers fixed, tiered, lookup, and approximate media price fields without mutating source pricing or changing billing transactions.
- Verification: `src/business/client/hooks/useBusinessModelPricing.test.ts`.
- GOV-034: Added a server-side model pricing snapshot helper that records whether pricing comes from admin/database metadata, static model-bank data, or is missing while preserving the existing pricing-only helper output.
- Verification: `packages/business-server/src/serverModelPricing.test.ts`.
- GOV-035: Added admin model billing matrix pricing-source visibility so rows can distinguish manual overrides, database/admin pricing, model-bank pricing, and missing pricing without changing billing transactions.
- Verification: `src/features/Admin/adminModelBillingMatrix.test.ts`.
- GOV-036: Added `pricingSource` to the admin enabled AI provider models API so the billing matrix can receive database/missing pricing source metadata from the backend.
- Verification: `packages/business-server/src/lambda-routers/admin/newapiProviders.test.ts`.
