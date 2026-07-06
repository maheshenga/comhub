# Internal Changelog

## 2026-07-07

### Governance

- GOV-001: Added admin settings guardrails for app setting form classification, registry metadata completeness, and sensitive desktop OSS values in public desktop config.
- Verification: `src/features/Admin/adminSettingsForm.test.ts`, `src/server/services/appSettings/governance.test.ts`, and `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
- GOV-002: Added ledger provider/model display-name formatting so user credit ledger rows prefer metadata display names and hide raw provider UUIDs.
- Verification: `src/business/client/BusinessSettingPages/ledgerDisplay.test.ts`.
- GOV-003: Added Community/MCP/Skill market fallback normalization so placeholder `UN` labels and blank descriptions render as readable fallback content.
- Verification: `src/features/SkillStore/SkillList/normalizeMarketItems.test.ts`, `apps/server/src/services/discover/index.test.ts`, and `apps/server/src/services/market/index.test.ts`.
