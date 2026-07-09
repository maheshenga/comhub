# Module App Platform Unification P2 Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Module App Platform first-class plugin-style runtime parity for API actions, content generation, artifacts, failure records, and audit logs without depending on `platform-plugins`.

**Architecture:** Add Module App-owned runtime helpers under `packages/business-server/src/module-apps/`, then wire them into `runModuleAppAction`. Keep the runtime dependency-injected for tests and future production services: API calls use injected `fetchImpl`, content generation uses injected `textGenerator`, artifacts use injected `artifactStorage`, and persistence uses `ModuleAppRuntimeModel`. Existing MCP, Skills, and deprecated Platform Plugin code remain unchanged.

**Tech Stack:** TypeScript, Zod-style runtime config parsing by narrow type guards, Drizzle/PostgreSQL model methods, Vitest.

## Global Constraints

- Internal Module App domain stays stable: `module_app_*`, `ModuleAppModel`, `lambda.moduleApp`, `admin.moduleApps`, `ModuleAppMarket`, `ModuleAppRuntime`, `Admin/moduleApps`.
- Platform Plugin Marketplace remains deprecated compatibility code during this slice.
- Do not import from `packages/business-server/src/platform-plugins/*` in new Module App runtime files.
- MCP and Skills remain unchanged.
- Do not introduce uploaded code execution, iframe execution, Docker execution, MCP runtime execution, or Skill runtime execution.
- Do not drop or rename production `platform_plugin_*` tables.
- Keep changes small and reversible.

---

## File Structure

- Create `packages/business-server/src/module-apps/runtimeTemplate.ts`: Module App-owned template rendering and artifact filename sanitization.
- Create `packages/business-server/src/module-apps/logRedaction.ts`: Module App-owned secret-key/value redaction for run input/output/error snapshots.
- Modify `packages/business-server/src/module-apps/safeUrl.ts`: add async DNS-aware URL safety assertion while preserving the existing sync `isSafeModuleAppApiUrl` export.
- Create `packages/business-server/src/module-apps/runners/apiActionRunner.ts`: execute `api_action` from `action.runtimeConfig` with safe URL validation, templated headers/body, response extraction, timeout, and redacted snapshots.
- Create `packages/business-server/src/module-apps/runners/contentGenerationRunner.ts`: execute `content_generation` from `action.runtimeConfig` through an injected text generator and optional markdown artifact output.
- Create `packages/business-server/src/module-apps/artifactWriter.ts`: upload Module App runtime artifacts and persist `module_app_artifacts` through the runtime model.
- Modify `packages/business-server/src/module-apps/runModuleAppAction.ts`: resolve built-in runners when no explicit runner is supplied, write artifacts, store failure runs, calculate failure billing consistently, and write audit events.
- Modify `packages/database/src/models/moduleApp.ts`: add `createArtifact` so runtime code can persist artifact metadata without importing database schemas directly.
- Modify `packages/business-server/src/module-apps/runModuleAppAction.test.ts`: cover automatic API/content runners, artifact creation, failed run persistence, and audit events.
- Create focused tests for new helpers/runners:
  - `packages/business-server/src/module-apps/safeUrl.test.ts`
  - `packages/business-server/src/module-apps/runners/apiActionRunner.test.ts`
  - `packages/business-server/src/module-apps/runners/contentGenerationRunner.test.ts`
- Modify `docs/FEATURE_REGISTRY.md` and `docs/CHANGELOG_INTERNAL.md`: document P2 runtime parity completion.

## Task 1: Runtime Helpers

**Files:**
- Create: `packages/business-server/src/module-apps/runtimeTemplate.ts`
- Create: `packages/business-server/src/module-apps/logRedaction.ts`
- Modify: `packages/business-server/src/module-apps/safeUrl.ts`
- Create: `packages/business-server/src/module-apps/safeUrl.test.ts`

**Interfaces:**
- Produces: `renderModuleAppTemplateString`, `renderModuleAppTemplateValue`, `sanitizeModuleAppArtifactFileName`, `redactModuleAppLogValue`, `redactResolvedModuleAppSecretValues`, `assertSafeModuleAppApiUrl`.
- Consumes: Node `dns/promises.lookup`, Node `net.isIP`.

- [ ] **Step 1: Write URL safety tests**

Create `packages/business-server/src/module-apps/safeUrl.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { assertSafeModuleAppApiUrl, isSafeModuleAppApiUrl } from './safeUrl';

describe('module app safe URL validation', () => {
  it('keeps the sync compatibility helper for simple public URLs', () => {
    expect(isSafeModuleAppApiUrl('https://api.example.com/v1')).toBe(true);
    expect(isSafeModuleAppApiUrl('ftp://api.example.com/v1')).toBe(false);
    expect(isSafeModuleAppApiUrl('http://localhost:3000')).toBe(false);
  });

  it('rejects credentials and DNS results pointing to private addresses', async () => {
    await expect(
      assertSafeModuleAppApiUrl('https://user:pass@example.com/v1', {
        resolveHostname: () => ['93.184.216.34'],
      }),
    ).rejects.toThrow('MODULE_APP_UNSAFE_API_URL');

    await expect(
      assertSafeModuleAppApiUrl('https://api.example.com/v1', {
        resolveHostname: () => ['127.0.0.1'],
      }),
    ).rejects.toThrow('MODULE_APP_UNSAFE_API_URL');
  });

  it('normalizes safe public URLs after DNS verification', async () => {
    await expect(
      assertSafeModuleAppApiUrl('https://api.example.com/v1', {
        resolveHostname: () => ['93.184.216.34'],
      }),
    ).resolves.toBe('https://api.example.com/v1');
  });
});
```

- [ ] **Step 2: Run failing helper test**

Run:

```bash
cd packages/business-server && bunx vitest run --silent='passed-only' src/module-apps/safeUrl.test.ts
```

Expected: FAIL because `assertSafeModuleAppApiUrl` does not exist yet.

- [ ] **Step 3: Implement runtime template helpers**

Create `packages/business-server/src/module-apps/runtimeTemplate.ts`:

```typescript
export const renderModuleAppTemplateString = (
  template: string,
  values: Record<string, unknown>,
): string =>
  template.replace(/\{\{\s*([\w:-]+)\s*\}\}|\{([\w:-]+)\}/g, (_match, doubleKey, singleKey) => {
    const key = doubleKey || singleKey;
    const value = values[key];

    if (value === undefined || value === null) return '';

    return String(value);
  });

export const renderModuleAppTemplateValue = (
  value: unknown,
  values: Record<string, unknown>,
): unknown => {
  if (typeof value === 'string') return renderModuleAppTemplateString(value, values);

  if (Array.isArray(value)) return value.map((item) => renderModuleAppTemplateValue(item, values));

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        renderModuleAppTemplateValue(item, values),
      ]),
    );
  }

  return value;
};

export const sanitizeModuleAppArtifactFileName = (value: string): string => {
  const sanitized = value
    .trim()
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'module-app-result.md';
};
```

- [ ] **Step 4: Implement log redaction helpers**

Create `packages/business-server/src/module-apps/logRedaction.ts`:

```typescript
const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_LOG_KEY_PATTERN =
  /authorization|api.?key|access.?token|refresh.?token|secret|password|credential|cookie/i;

export const redactModuleAppLogValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => redactModuleAppLogValue(item));

  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_LOG_KEY_PATTERN.test(key) ? REDACTED_VALUE : redactModuleAppLogValue(item),
    ]),
  );
};

export const redactResolvedModuleAppSecretValues = (
  value: unknown,
  secrets: Record<string, string>,
): unknown => {
  const secretValues = Object.values(secrets).filter(Boolean);

  if (secretValues.length === 0) return redactModuleAppLogValue(value);

  const redactText = (text: string) =>
    secretValues.reduce((current, secret) => current.split(secret).join(REDACTED_VALUE), text);

  const redactValue = (item: unknown): unknown => {
    if (typeof item === 'string') return redactText(item);
    if (Array.isArray(item)) return item.map((entry) => redactValue(entry));

    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>).map(([key, entry]) => [
          key,
          redactValue(entry),
        ]),
      );
    }

    return item;
  };

  return redactModuleAppLogValue(redactValue(value));
};
```

- [ ] **Step 5: Add async URL safety assertion**

Modify `packages/business-server/src/module-apps/safeUrl.ts` to keep `isSafeModuleAppApiUrl` and add:

```typescript
export type ModuleAppUrlResolver = (
  hostname: string,
) => Promise<readonly string[]> | readonly string[];

export interface ModuleAppUrlSafetyOptions {
  resolveHostname?: ModuleAppUrlResolver;
}

export const assertSafeModuleAppApiUrl = async (
  value: string,
  options: ModuleAppUrlSafetyOptions = {},
): Promise<string> => {
  // parse http/https URLs, reject credentials, reject localhost/private IPs,
  // resolve public hostnames through options.resolveHostname or dns.lookup,
  // reject empty/private/multicast/link-local DNS results, then return parsed.toString().
};
```

Use the same IPv4/IPv6 private-address coverage as the deprecated Platform Plugin helper, but keep error code `MODULE_APP_UNSAFE_API_URL`.

- [ ] **Step 6: Run passing helper test**

Run:

```bash
cd packages/business-server && bunx vitest run --silent='passed-only' src/module-apps/safeUrl.test.ts
```

Expected: PASS.

## Task 2: API Action Runner

**Files:**
- Create: `packages/business-server/src/module-apps/runners/apiActionRunner.ts`
- Create: `packages/business-server/src/module-apps/runners/apiActionRunner.test.ts`

**Interfaces:**
- Consumes: `ModuleAppActionConfig`, `assertSafeModuleAppApiUrl`, runtime template helpers, log redaction helpers.
- Produces: `runModuleAppApiAction`, `ModuleAppFetch`, `ModuleAppRunnerArtifactRequest`, `ModuleAppRunnerResult`.

- [ ] **Step 1: Write API runner tests**

Create tests that prove:

```typescript
runModuleAppApiAction({
  action: {
    id: 'lookup',
    inputSchema: { fields: [] },
    moduleMultiplier: 1,
    name: 'Lookup',
    outputSchema: {},
    runtimeConfig: {
      bodyTemplate: { keyword: '{{keyword}}', token: '{{apiKey}}' },
      headers: { Authorization: 'Bearer {{apiKey}}' },
      method: 'POST',
      responsePath: 'data.summary',
      url: 'https://api.example.com/search',
    },
    runtimeType: 'api_action',
  },
  fetchImpl,
  input: { keyword: 'apple' },
  resolvedSecrets: { apiKey: 'secret-token' },
  resolveHostname: () => ['93.184.216.34'],
});
```

Expected result:

- calls `fetchImpl` with safe URL, POST, JSON body, and rendered headers
- returns `preview: 'fruit'`
- returns `output.request` and `output.response` with `secret-token` redacted
- rejects missing URL with `MODULE_APP_API_ACTION_NOT_CONFIGURED`

- [ ] **Step 2: Run failing API runner test**

Run:

```bash
cd packages/business-server && bunx vitest run --silent='passed-only' src/module-apps/runners/apiActionRunner.test.ts
```

Expected: FAIL because the runner file does not exist yet.

- [ ] **Step 3: Implement API runner**

Implement:

```typescript
export type ModuleAppFetch = (input: string, init: RequestInit) => Promise<FetchResponse>;
export type ModuleAppRunnerArtifactRequest = {
  content: Buffer | string;
  expiresAt?: Date | null;
  fileName: string;
  mimeType: string;
};
export type ModuleAppRunnerResult = {
  actualAiCredits: number;
  artifacts: ModuleAppRunnerArtifactRequest[];
  output: Record<string, unknown>;
  preview: string;
};
export const runModuleAppApiAction = async (...): Promise<ModuleAppRunnerResult> => { ... };
```

Runtime config keys:

- `url` or `endpoint`
- `method`, default `POST`
- `headers`
- `bodyTemplate`
- `responsePath`
- `timeoutMs`, default `30000`

- [ ] **Step 4: Run passing API runner test**

Run:

```bash
cd packages/business-server && bunx vitest run --silent='passed-only' src/module-apps/runners/apiActionRunner.test.ts
```

Expected: PASS.

## Task 3: Content Generation Runner

**Files:**
- Create: `packages/business-server/src/module-apps/runners/contentGenerationRunner.ts`
- Create: `packages/business-server/src/module-apps/runners/contentGenerationRunner.test.ts`

**Interfaces:**
- Consumes: `ModuleAppActionConfig`, runtime template helpers, `ModuleAppRunnerResult`.
- Produces: `runModuleAppContentGeneration`, `ModuleAppTextGenerator`.

- [ ] **Step 1: Write content runner tests**

Create tests that prove:

- `promptTemplate` is rendered with user input.
- injected `textGenerator` receives `provider`, `model`, `prompt`, and `userId`.
- markdown output creates one artifact request.
- missing text generator throws `MODULE_APP_TEXT_GENERATOR_REQUIRED`.

- [ ] **Step 2: Run failing content runner test**

Run:

```bash
cd packages/business-server && bunx vitest run --silent='passed-only' src/module-apps/runners/contentGenerationRunner.test.ts
```

Expected: FAIL because the runner file does not exist yet.

- [ ] **Step 3: Implement content generation runner**

Runtime config keys:

- `promptTemplate`
- `provider`
- `model`
- `artifactNameTemplate`, default `module-app-result.md`
- `artifactMimeType`, default `text/markdown`

Return:

```typescript
{
  actualAiCredits: generated.actualAiCredits,
  artifacts: markdownArtifactOnly,
  output: { model, provider, text, tokenUsage },
  preview: generated.text,
}
```

- [ ] **Step 4: Run passing content runner test**

Run:

```bash
cd packages/business-server && bunx vitest run --silent='passed-only' src/module-apps/runners/contentGenerationRunner.test.ts
```

Expected: PASS.

## Task 4: Artifact Persistence And Runtime Integration

**Files:**
- Create: `packages/business-server/src/module-apps/artifactWriter.ts`
- Modify: `packages/database/src/models/moduleApp.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.test.ts`

**Interfaces:**
- Consumes: `ModuleAppRunnerArtifactRequest`, `ModuleAppRuntimeModel`.
- Produces: `writeModuleAppArtifact`, `ModuleAppArtifactStorage`, `ModuleAppRuntimeModel.createArtifact`.

- [ ] **Step 1: Extend runtime model test expectations**

Add tests to `runModuleAppAction.test.ts` proving:

- `api_action` without explicit runner uses `fetchImpl` and succeeds.
- `content_generation` without explicit runner uses `textGenerator`, uploads a markdown artifact, and persists artifact metadata through `model.createArtifact`.
- runner failure updates run as `failed`, stores redacted error message, writes `module_app.run_failed` audit, and returns `status: 'failed'`.

- [ ] **Step 2: Run failing integration test**

Run:

```bash
cd packages/business-server && bunx vitest run --silent='passed-only' src/module-apps/runModuleAppAction.test.ts
```

Expected: FAIL because runtime integration is missing.

- [ ] **Step 3: Implement ModuleAppModel.createArtifact**

Add method to `packages/database/src/models/moduleApp.ts`:

```typescript
createArtifact = async (params: {
  appId: string;
  expiresAt?: Date | null;
  fileName: string;
  mimeType: string;
  recordId?: null | string;
  runId: string;
  scopeType: ModuleAppScopeType;
  sizeBytes: number;
  storageKey: string;
  userId: string;
  workspaceId?: string;
}) => {
  const [row] = await this.db
    .insert(moduleAppArtifacts)
    .values({
      appId: params.appId,
      expiresAt: params.expiresAt ?? null,
      fileName: params.fileName,
      mimeType: params.mimeType,
      recordId: params.recordId ?? null,
      runId: params.runId,
      scopeType: params.scopeType,
      sizeBytes: params.sizeBytes,
      storageKey: params.storageKey,
      userId: params.userId,
      workspaceId: params.scopeType === 'workspace' ? params.workspaceId : undefined,
    })
    .returning({ id: moduleAppArtifacts.id });

  if (!row) throw new Error('MODULE_APP_ARTIFACT_CREATE_FAILED');

  return row;
};
```

- [ ] **Step 4: Implement artifact writer**

Create `packages/business-server/src/module-apps/artifactWriter.ts`:

```typescript
export interface ModuleAppArtifactStorage {
  uploadBuffer: (
    key: string,
    buffer: Buffer,
    contentType: string,
  ) => Promise<{ key?: string } | void>;
}

export const writeModuleAppArtifact = async (...) => {
  // sanitize file name, upload to module-apps/<appId>/<runId>/<uuid>-<fileName>,
  // then call model.createArtifact and return { id, storageKey }.
};
```

- [ ] **Step 5: Wire built-in runners and failure handling**

Modify `runModuleAppAction.ts`:

- Add optional `fetchImpl`, `resolveHostname`, `resolvedSecrets`, `textGenerator`, `artifactStorage`.
- Keep explicit `runner` support for tests/custom runtime.
- For `api_action`, use `runModuleAppApiAction` when no explicit runner exists.
- For `content_generation`, use `runModuleAppContentGeneration` when no explicit runner exists.
- For runner success, write returned artifacts through `writeModuleAppArtifact`.
- For runner failure, compute failure billing, update run with `status: 'failed'`, `errorType: 'module_app_runtime_error'`, redacted `errorMessage`, and write audit if `model.writeAuditLog` exists.
- On success, write `module_app.run_succeeded` audit if `model.writeAuditLog` exists.

- [ ] **Step 6: Run passing integration test**

Run:

```bash
cd packages/business-server && bunx vitest run --silent='passed-only' src/module-apps/runModuleAppAction.test.ts
```

Expected: PASS.

## Task 5: Documentation And Final Verification

**Files:**
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`

**Interfaces:**
- Produces: documented P2 runtime parity state.

- [ ] **Step 1: Update feature registry**

Add a short note under Module App Platform:

```markdown
#### Module App Platform Unification P2

- Status: experimental
- Runtime parity: Module App owns API action and content generation runners, artifact persistence, failure run snapshots, safe URL validation, and runtime audit events.
- Boundary: P2 keeps Platform Plugin code only as deprecated compatibility and does not execute uploaded package code.
```

- [ ] **Step 2: Update changelog**

Add:

```markdown
- MODULE-APP-UNIFY-P2-001: Added Module App-owned API/content runtime parity with safe URL checks, redacted snapshots, artifacts, failed run records, and audit events.
```

- [ ] **Step 3: Run full targeted verification**

Run:

```bash
cd packages/business-server && bunx vitest run --silent='passed-only' src/module-apps/safeUrl.test.ts src/module-apps/runners/apiActionRunner.test.ts src/module-apps/runners/contentGenerationRunner.test.ts src/module-apps/runModuleAppAction.test.ts
cd ../database && bunx vitest run --silent='passed-only' src/models/__tests__/moduleApp.marketplace.test.ts src/models/moduleApp.package.test.ts
cd ..\\.. && bun run type-check
git diff --check
```

Expected: all targeted tests pass, type-check passes, diff check has no output.

- [ ] **Step 4: Commit**

Run:

```bash
git add -f docs/superpowers/plans/2026-07-10-module-app-unification-p2-runtime.md
git add docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md packages/business-server/src/module-apps packages/database/src/models/moduleApp.ts
git commit -m "feat: add module app runtime parity" -m "Constraint: Platform Plugin Marketplace remains deprecated compatibility only." -m "Constraint: MCP and Skills unchanged." -m "Tested: module app runtime runner tests, database module app tests, type-check, git diff --check."
```

Expected: commit succeeds.

## Self-Review

- Spec coverage: P2 runtime parity covers API action, content generation, safe URL validation, artifact writer, billing snapshot, run history, and audit events. Secret storage parity is intentionally not added as a new storage surface; runtime accepts resolved secrets only, keeping server-only secret handling for a later dedicated credential slice.
- Placeholder scan: No unresolved placeholder remains in task acceptance criteria; helper internals are specified through concrete exported interfaces and test expectations.
- Type consistency: `ModuleAppRunnerResult`, `ModuleAppRunnerArtifactRequest`, `ModuleAppArtifactStorage`, and `ModuleAppRuntimeModel.createArtifact` are consistently named across helper, runner, writer, and integration tasks.
