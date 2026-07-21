# Dependabot Runtime Remediation Design

**Date:** 2026-07-21

## Context

Dependabot reports 15 open alerts in three dependency families:

- `better-auth` 1.4.6 accounts for 10 runtime alerts, including two critical
  vulnerabilities in two-factor authentication and OAuth refresh-token flows.
- `nodemailer` ^8.0.4 accounts for one high-severity runtime alert.
- `vite` 8.0.14 accounts for four development-time alerts across the root and
  desktop manifests, including a Windows filesystem-deny bypass.

The GitHub governance PR is intentionally separate and has already merged. This
branch has been rebased onto protected `origin/main` so the remediation can be
reviewed and reverted independently.

## Goals

1. Raise Better Auth to the minimum version that resolves every open Better
   Auth alert without weakening ComHub authentication settings.
2. Raise Nodemailer to its patched version while preserving the existing SMTP
   transport and the restricted email payload shape.
3. Raise Vite in both manifests to the fixed patch release.
4. Preserve production deployment, secrets, database schema, and user data.
5. Keep each dependency family in an independently reviewable commit.

## Non-Goals

- No authentication-flow redesign, provider migration, database migration, or
  session invalidation beyond behavior supplied by the patched dependency.
- No email template redesign, SMTP credential change, or delivery to real
  recipients during verification.
- No production deployment or merge from this branch.
- No bulk update of unrelated Dependabot findings.

## Version Decisions

| Family | Current | Target | Reason |
| --- | --- | --- | --- |
| `better-auth` declarations | 1.4.6 | 1.6.13 | Covers all 10 Better Auth alerts; update `overrides`, `dependencies`, and `pnpm.overrides` together. |
| `@better-auth/expo` | 1.4.6 | 1.6.13 | Declares a peer dependency on `better-auth ^1.6.13`. |
| `@better-auth/passkey` | 1.4.6 | 1.6.13 | Declares a peer dependency on `better-auth ^1.6.13`. |
| Root `better-call` pins | 1.1.8 | removed | No source imports it. `.pnpmfile.cjs` makes Better Call 1.3.5 own Zod 4 while root and workspace Zod 3 consumers remain unchanged. |
| `drizzle-orm` declarations | ^0.45.1 | ^0.45.2 | Better Auth 1.6.13 requires `drizzle-orm ^0.45.2`; update all three declaration locations together. |
| `nodemailer` | ^8.0.4 | ^9.0.1 | First patched version for the high-severity advisory. |
| `vite` root and desktop | 8.0.14 | 8.0.16 | First patched version for both Vite advisories. |

## Risk Model

### Better Auth

This is the highest-risk change because ComHub uses email/password login,
social and generic OAuth, OIDC, email OTP, passkeys, organization controls,
and `session.cookieCache`. The existing configuration keeps email verification,
trusted origins, password-reset session revocation, database-backed sessions,
and custom rate limits. The upgrade changes dependency code only unless a
focused test identifies an API incompatibility. Those security settings must
remain present.

Better Call 1.3.5 declares Zod 4 as an optional peer, while the root project
and several workspace packages intentionally use Zod 3. The tracked
`.pnpmfile.cjs` changes only Better Call 1.3.5 during Pnpm resolution: it owns
its Zod 4 dependency instead of inheriting root Zod 3. This keeps Better Auth,
Passkey, Core, Expo, and Better Call on the same Zod 4 runtime without an
application-wide Zod migration.

### Nodemailer

The current SMTP implementation constructs a transporter from server-side
environment variables and passes only `from`, `to`, `subject`, `text`, `html`,
`replyTo`, and typed attachments to `sendMail`. It does not pass Nodemailer's
`raw` option implicated by the advisory. The version bump is still required;
the focused test verifies that the transport construction and supported payload
mapping remain unchanged.

### Vite

This is a patch-level development dependency upgrade. The root SPA and desktop
Electron manifests both directly pin Vite 8.0.14, so both declarations must
move together to prevent a vulnerable desktop development path.

## Implementation Sequence

1. Update the three Better Auth package declarations and the Drizzle override.
   Remove obsolete root Better Call pins and add the scoped Pnpm resolution
   hook. Add or extend focused tests around the existing Better Auth
   configuration so security-sensitive options and plugin registration remain
   intact.
2. Update Nodemailer and add a focused `NodemailerImpl` regression test that
   asserts the supported payload mapping does not introduce `raw`, URL, or file
   access options.
3. Update both Vite declarations to 8.0.16 and validate the Vite configuration
   still loads in the supported Node 22 runtime.
4. Run one focused verification round after the three commits: changed auth and
   email tests, relevant Vite configuration validation, and TypeScript checking.
5. Push the security branch only after the governance PR has merged or rebase
   it onto the protected `main`; then open a separate security PR.

## Dependency Installation Boundary

The tracked source tree has no `pnpm-lock.yaml`; `pnpm install --frozen-lockfile`
is not a valid verification command in this checkout. Use the project-standard
`pnpm install --no-frozen-lockfile` only in an isolated worktree or CI runner.
Do not add an unreviewed lockfile as part of this remediation.

## Acceptance Criteria

- Package declarations exactly match the target versions above.
- Better Auth, Core, Passkey, Expo, and Better Call resolve to the same Zod 4
  installation; root and workspace Zod 3 declarations remain unchanged.
- Better Auth configuration retains trusted origins, email verification,
  database-backed sessions, password-reset revocation, rate limits, OTP,
  passkey, OAuth, and existing custom plugins.
- Nodemailer continues to construct the SMTP transporter and sends only the
  supported typed payload fields.
- Both root and desktop Vite declarations are 8.0.16.
- No deployment workflow, secret, environment, database schema, or application
  business logic changes.
- The separate PR passes the protected-branch checks after it is based on the
  merged governance configuration.
