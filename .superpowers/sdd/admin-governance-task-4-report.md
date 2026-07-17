# Admin Governance Task 4 Report

## Result

Implemented application-setting secret encryption and dedicated desktop-release authentication.

- Added the `app-setting:v1:<key>:` codec on top of `KeyVaultsGateKeeper.initWithEnvKey()`.
- Encrypted all new non-empty writes for `composio.apiKey`, `cron.secret`,
  `docmee.ppt.apiKey`, and `storage.s3.secretAccessKey`.
- Preserved historical plaintext reads, legacy non-string `cron.secret` environment fallback,
  explicit PPT API-key clearing, Composio blank-clearing, and S3/cron blank/masked write no-ops.
- Decrypted only at Composio, S3, maintenance, PPT, and admin masking consumption points.
- Changed desktop-release authentication precedence to `DESKTOP_RELEASE_TOKEN`, followed only by
  the explicitly enabled legacy `cron.secret` / `CRON_SECRET` bridge.
- Kept `desktop.oss.accessKeySecret` externally owned and non-writable.

## TDD Red Evidence

Tests were added before the corresponding production changes. Unless stated otherwise, commands
ran from `E:\code\comhub\ci-verify-3bbf64f`.

### Codec import red

```text
bunx vitest run --silent='passed-only' 'src/server/services/appSettings/secrets.test.ts'
```

Exit code 1: `1 failed` file, `no tests`. Vite could not resolve `./secrets` because the codec file
did not exist yet.

After the codec file was introduced, the same command produced `3 failed | 1 passed`; the failures
were the test runner's client environment blocking access to the server-only environment. Adding
the existing repository-standard `// @vitest-environment node` directive corrected the test setup;
the same command then produced `1 passed` file and `4 passed` tests.

### Runtime and PPT red

```text
bunx vitest run --silent='passed-only' 'packages/business-server/src/lambda-routers/admin/settings.test.ts' 'packages/business-server/src/lambda-routers/admin/ppt.test.ts' 'src/server/services/appSettings/index.test.ts' 'src/server/services/docmee/index.test.ts' 'packages/business-server/src/appSettings/catalog.test.ts'
```

Exit code 1: the root Vitest configuration selected `2 failed` files with `3 failed | 16 passed`
tests. Ciphertext reached Composio, S3, and Docmee without decryption. Package-local suites were
then run from their package directory as shown below.

### Maintenance red

```text
node node_modules/vitest/vitest.mjs run --silent='passed-only' 'src/app/(backend)/api/admin/maintenance/route.test.ts'
```

Exit code 1: `1 failed` file with `1 failed | 4 passed` tests. Encrypted `cron.secret` was rejected
instead of authenticated.

### Desktop-release red

```text
node node_modules/vitest/vitest.mjs run --silent='passed-only' 'src/app/(backend)/api/admin/desktop-release/__tests__/route.test.ts'
```

Exit code 1: `1 failed` file with `4 failed | 2 passed` tests. The route still preferred shared
`cron.secret` and ignored the dedicated-token/legacy-bridge precedence.

### Admin router and catalog red

Command from `E:\code\comhub\ci-verify-3bbf64f\packages\business-server`:

```text
bunx vitest run --silent='passed-only' 'src/lambda-routers/admin/settings.test.ts' 'src/lambda-routers/admin/ppt.test.ts' 'src/appSettings/catalog.test.ts'
```

Exit code 1: `3 failed` files with `13 failed | 51 passed` tests. Secret writes were plaintext,
masked placeholders overwrote values, ciphertext was masked directly, and catalog metadata still
described JSON/shared-auth behavior.

### Review-fix Composio clear red

Command from `E:\code\comhub\ci-verify-3bbf64f\packages\business-server`:

```text
bunx vitest run --silent='passed-only' 'src/lambda-routers/admin/settings.test.ts'
```

Exit code 1: `1 failed` file with `1 failed | 54 passed` tests. The explicit Composio clear write
made zero database calls instead of replacing the stored ciphertext with the key-specific empty
clear value. The two new S3/cron blank no-op regressions passed in this red run.

## Green Evidence

### Focused root suites

Command from `E:\code\comhub\ci-verify-3bbf64f`:

```text
node node_modules/vitest/vitest.mjs run --silent='passed-only' 'src/server/services/appSettings/secrets.test.ts' 'src/server/services/appSettings/index.test.ts' 'src/server/services/docmee/index.test.ts' 'src/app/(backend)/api/admin/maintenance/route.test.ts' 'src/app/(backend)/api/admin/desktop-release/__tests__/route.test.ts'
```

Final rerun output: exit code 0, `5 passed` files, `34 passed` tests.

### Focused business-server suites and Task 1 catalog regression

Command from `E:\code\comhub\ci-verify-3bbf64f\packages\business-server`:

```text
bunx vitest run --silent='passed-only' 'src/lambda-routers/admin/settings.test.ts' 'src/lambda-routers/admin/ppt.test.ts' 'src/appSettings/catalog.test.ts'
```

Final rerun output: exit code 0, `3 passed` files, `67 passed` tests.

Combined final focused result: `8 passed` files and `101 passed` tests.

### Type, lint, and diff gates

```text
bun run type-check
```

Output: `$ tsgo --noEmit`, exit code 0.

Exact targeted ESLint command from `E:\code\comhub\ci-verify-3bbf64f`:

```text
node node_modules/eslint/bin/eslint.js 'packages/business-server/src/appSettings/catalog.test.fixtures.ts' 'packages/business-server/src/appSettings/catalog.test.ts' 'packages/business-server/src/appSettings/definitions/runtimeConsumers.ts' 'packages/business-server/src/appSettings/definitions/valueDefinitions.ts' 'packages/business-server/src/appSettings/types.ts' 'packages/business-server/src/lambda-routers/admin/ppt.test.ts' 'packages/business-server/src/lambda-routers/admin/ppt.ts' 'packages/business-server/src/lambda-routers/admin/settings.test.ts' 'packages/business-server/src/lambda-routers/admin/settings.ts' 'src/app/(backend)/api/admin/desktop-release/__tests__/route.test.ts' 'src/app/(backend)/api/admin/desktop-release/route.ts' 'src/app/(backend)/api/admin/maintenance/route.test.ts' 'src/app/(backend)/api/admin/maintenance/route.ts' 'src/server/services/appSettings/index.test.ts' 'src/server/services/appSettings/index.ts' 'src/server/services/appSettings/secrets.test.ts' 'src/server/services/appSettings/secrets.ts' 'src/server/services/docmee/index.test.ts' 'src/server/services/docmee/index.ts'
```

Final rerun output: exit code 0, no findings.

```text
git diff --check
```

Output: exit code 0, no findings.

## Review Fix Evidence

- `composio.apiKey` now has a `blank-clears` write policy; its existing clear control persists an
  empty value without encryption and invalidates the prior stored ciphertext.
- `cron.secret` and `storage.s3.secretAccessKey` retain `blank-noop`; `docmee.ppt.apiKey` retains
  its explicit `clearApiKey` contract.
- Settings and PPT routers now use the shared `maskAppSettingSecret` helper without changing any
  response field.
- Ciphertext tampering changes the final character to a guaranteed different value.
- The final focused test total increased from 98 to 101 through the three clear/no-op regressions.

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
