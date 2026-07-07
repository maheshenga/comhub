# Task 1 Report: Shared Platform Plugin Type Contract

## What I implemented

- Added `packages/types/src/platformPlugin.ts` with the shared `platformPlugin` schemas and DTO types from the task brief.
- Exported the new module from `packages/types/src/index.ts`.
- Added `packages/types/src/platformPlugin.test.ts` to cover the required schema behaviors:
  - runtime type acceptance/rejection
  - billing defaults
  - action config validation
  - admin upsert validation

## Tests run and results

- `bunx vitest run --silent='passed-only' packages/types/src/platformPlugin.test.ts`
  - Failed in the root workspace because the root Vitest config excludes `packages/**`.
- `bunx vitest run --silent='passed-only' src/platformPlugin.test.ts` from `packages/types`
  - Passed: 1 file, 4 tests.
- `bun` import check against `./packages/types/src/index.ts`
  - Passed and resolved `platformPluginRuntimeTypeSchema` correctly.

## TDD evidence

### RED

- Command: `bunx vitest run --silent='passed-only' src/platformPlugin.test.ts`
- Failure summary: `Cannot find module './platformPlugin' imported from 'E:/code/comhub/ci-verify-3bbf64f/packages/types/src/platformPlugin.test.ts'`
- Meaning: the new contract file did not exist yet, so the test failed for the expected missing-export/missing-module reason.

### GREEN

- Command: `bunx vitest run --silent='passed-only' src/platformPlugin.test.ts`
- Result: passed, 4 tests green.

## Files changed

- `packages/types/src/platformPlugin.ts`
- `packages/types/src/platformPlugin.test.ts`
- `packages/types/src/index.ts`

## Self-review findings or concerns

- The shared contract is isolated to `packages/types` and does not touch legacy MCP/Skill/plugin runtime paths.
- I verified the new symbols through both the focused test and a direct barrel import check.
- No open concerns.

## Review follow-up

- Hardened `platformPluginActionConfigSchema.api.url` with a schema-level safety refinement that only accepts public `http(s)` targets.
- The refinement now rejects literal localhost, private, loopback, link-local, and metadata IP hosts, including the review examples for IPv4 and IPv6.
- Added regression coverage for:
  - `file:///etc/passwd`
  - `http://localhost:3000`
  - `http://127.0.0.1`
  - `http://10.0.0.1`
  - `http://172.16.0.1`
  - `http://172.31.255.255`
  - `http://192.168.1.1`
  - `http://169.254.169.254`
  - `http://[::1]`
- Added a passing case for a normal public HTTPS URL.
- Verification command: `bunx vitest run --silent='passed-only' src/platformPlugin.test.ts`
- Result: `1 file passed, 14 tests passed`.

## Re-review security fix

- Tightened `isPrivateOrReservedIpv6()` to reject every normalized IPv4-mapped IPv6 literal after lowercasing and bracket stripping, including hex-encoded forms such as `http://[::ffff:7f00:1]`, `http://[::ffff:a9fe:a9fe]`, `http://[::ffff:0a00:0001]`, and `http://[::ffff:0808:0808]`.
- Added regression coverage for those four literals in `packages/types/src/platformPlugin.test.ts`.
- Verification command run from `packages/types`:
  - `bunx vitest run --silent='passed-only' src/platformPlugin.test.ts`
- Result:
  - Red before the fix: 4 failing cases for the IPv4-mapped IPv6 literals.
  - Green after the fix: 1 file passed, 18 tests passed.
