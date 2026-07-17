# Admin Governance Task 4 Report

## Result

Implemented application-setting secret encryption and dedicated desktop-release authentication.

- Added the `app-setting:v1:<key>:` codec on top of `KeyVaultsGateKeeper.initWithEnvKey()`.
- Encrypted all new non-empty writes for `composio.apiKey`, `cron.secret`,
  `docmee.ppt.apiKey`, and `storage.s3.secretAccessKey`.
- Preserved historical plaintext reads, legacy non-string `cron.secret` environment fallback,
  explicit PPT API-key clearing, and blank/masked write no-ops.
- Decrypted only at Composio, S3, maintenance, PPT, and admin masking consumption points.
- Changed desktop-release authentication precedence to `DESKTOP_RELEASE_TOKEN`, followed only by
  the explicitly enabled legacy `cron.secret` / `CRON_SECRET` bridge.
- Kept `desktop.oss.accessKeySecret` externally owned and non-writable.

## TDD Red Evidence

Tests were added before the corresponding production changes.

1. Codec import red: `1 failed` suite because `src/server/services/appSettings/secrets.ts` did not
   exist.
2. Runtime/PPT red: `2 failed` files, `3 failed | 16 passed` tests. Ciphertext reached Composio,
   S3, and Docmee without decryption.
3. Maintenance red: `1 failed | 4 passed`. Encrypted `cron.secret` was rejected instead of
   authenticated.
4. Desktop-release red: `4 failed | 2 passed`. The route still preferred shared `cron.secret` and
   ignored the dedicated-token/legacy-bridge precedence.
5. Admin router/catalog red: `3 failed` files, `13 failed | 51 passed` tests. Secret writes were
   plaintext, masked placeholders overwrote values, ciphertext was masked directly, and catalog
   metadata still described JSON/shared-auth behavior.

## Green Evidence

### Focused root suites

Command:

```text
node node_modules/vitest/vitest.mjs run --silent='passed-only' <codec> <app-settings> <docmee> <maintenance> <desktop-release>
```

Output: `5 passed` files, `34 passed` tests.

### Focused business-server suites and Task 1 catalog regression

Command from `packages/business-server`:

```text
bunx vitest run --silent='passed-only' src/lambda-routers/admin/settings.test.ts src/lambda-routers/admin/ppt.test.ts src/appSettings/catalog.test.ts
```

Output: `3 passed` files, `64 passed` tests.

### Type, lint, and diff gates

```text
bun run type-check
```

Output: `$ tsgo --noEmit`, exit code 0.

Targeted ESLint over all changed TypeScript files: exit code 0, no findings.

```text
git diff --check
```

Output: exit code 0, no findings.

## Self-review

- No plaintext secret is included in admin responses or audit payloads.
- Invalid prefixed ciphertext is rejected before any environment fallback.
- Generic secret batches finish encryption preparation before opening the write transaction.
- PPT encryption is prepared before any settings writes, preventing plaintext fallback or partial
  writes when `KEY_VAULTS_SECRET` is unavailable.
- No deployment, live secret probe, payment, Module App payment flow, Worker deployment, or cleanup
  operation was run or changed.

## Concerns

None.
