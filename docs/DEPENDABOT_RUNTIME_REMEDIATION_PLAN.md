# Dependabot Runtime Remediation Implementation Plan

> **For agentic workers:** Execute this plan in the isolated
> `fix/dependabot-runtime-security` worktree. Keep the remediation independent
> from the GitHub governance PR.

**Goal:** Remove the 15 Dependabot alerts in Better Auth, Nodemailer, and Vite
without changing ComHub deployment behavior or authentication product settings.

**Architecture:** Each dependency family receives its own focused commit.
Existing Better Auth configuration remains the behavioral contract; new and
existing tests confirm that session, verification, plugin, SMTP, and Vite
boundaries remain intact. The branch is rebased onto the protected `main` only
after the governance PR has merged.

**Tech Stack:** pnpm, Bun, Vitest, TypeScript, Better Auth 1.6.13,
Nodemailer 9.0.1, Vite 8.0.16.

## Global Constraints

- Do not deploy, run database migrations, change secrets, or send real email.
- Do not alter Better Auth options unless the package upgrade produces a tested
  API incompatibility.
- Do not add a lockfile; this source tree does not track `pnpm-lock.yaml`.
- Use `pnpm install --no-frozen-lockfile` only in this isolated worktree or CI.
- Keep Better Auth, Nodemailer, and Vite changes in separate commits.
- Run one focused verification round after all three commits.

---

### Task 1: Upgrade Better Auth and Preserve Authentication Configuration

**Files:**
- Modify: `package.json`
- Modify: `src/libs/better-auth/define-config.test.ts`

**Interfaces:**
- Produces Better Auth 1.6.13-compatible dependency declarations.
- Preserves `defineConfig()` security settings consumed by all login, OAuth,
  OIDC, OTP, passkey, and organization flows.

- [ ] **Step 1: Extend the configuration contract before changing versions**

Add this test to `src/libs/better-auth/define-config.test.ts`:

```ts
it('preserves session, verification, rate-limit, and security plugins', async () => {
  const { defineConfig } = await import('./define-config');

  defineConfig({ plugins: [] });

  expect(mocks.betterAuth).toHaveBeenCalledWith(
    expect.objectContaining({
      emailAndPassword: expect.objectContaining({
        requireEmailVerification: true,
        revokeSessionsOnPasswordReset: true,
      }),
      rateLimit: expect.objectContaining({
        customRules: expect.objectContaining({
          '/request-password-reset': { max: 3, window: 60 },
          '/send-verification-email': { max: 3, window: 60 },
        }),
      }),
      session: expect.objectContaining({
        cookieCache: { enabled: true, maxAge: 120 },
        storeSessionInDatabase: true,
      }),
    }),
  );
});
```

- [ ] **Step 2: Run the focused baseline test**

```powershell
bunx vitest run --silent='passed-only' src/libs/better-auth/define-config.test.ts
```

Expected: both existing password-reset and new configuration-contract tests
pass before the version change.

- [ ] **Step 3: Update the Better Auth dependency family**

In `package.json`, make these exact replacements:

```json
"better-auth": "1.6.13",
"@better-auth/expo": "1.6.13",
"@better-auth/passkey": "1.6.13",
"drizzle-orm": "^0.45.2"
```

Apply the `better-auth` value in both `overrides` and `dependencies`; apply
the `drizzle-orm` value in both places too. Leave `better-call` unchanged
unless package installation reports an explicit peer dependency conflict.

- [ ] **Step 4: Install and re-run the configuration contract**

```powershell
pnpm.cmd install --no-frozen-lockfile
bunx vitest run --silent='passed-only' src/libs/better-auth/define-config.test.ts
```

Expected: installation completes without a Better Auth or Drizzle peer conflict
and both tests pass.

- [ ] **Step 5: Commit the authentication remediation**

```powershell
git add package.json src/libs/better-auth/define-config.test.ts
git commit -m "fix(auth): upgrade Better Auth security baseline" -m "Constraint: preserve existing authentication configuration" -m "Tested: define-config contract"
```

### Task 2: Upgrade Nodemailer and Lock Down the Outbound Payload Shape

**Files:**
- Modify: `package.json`
- Create: `apps/server/src/services/email/impls/nodemailer/index.test.ts`

**Interfaces:**
- Produces Nodemailer 9.0.1.
- Verifies `NodemailerImpl.sendMail()` retains the typed SMTP payload contract
  and never supplies the vulnerable `raw` option.

- [ ] **Step 1: Create a focused Nodemailer implementation test**

Create `apps/server/src/services/email/impls/nodemailer/index.test.ts` with
hoisted mocks for `nodemailer` and `@/envs/email`. The mocked transport must
provide `sendMail` and `verify`; the environment must provide SMTP user,
password, host, port, secure flag, and sender.

Add this behavioral test:

```ts
it('maps only the supported email payload fields to Nodemailer', async () => {
  const { NodemailerImpl } = await import('./index');
  const service = new NodemailerImpl();

  await service.sendMail({
    attachments: [{ content: 'invoice', filename: 'invoice.txt' }],
    html: '<p>Invoice</p>',
    replyTo: 'support@example.com',
    subject: 'Invoice',
    text: 'Invoice',
    to: 'member@example.com',
  });

  const message = vi.mocked(mocks.sendMail).mock.calls[0][0];
  expect(message).toMatchObject({
    from: 'noreply@example.com',
    replyTo: 'support@example.com',
    subject: 'Invoice',
    to: 'member@example.com',
  });
  expect(message).not.toHaveProperty('raw');
  expect(message).not.toHaveProperty('disableFileAccess');
  expect(message).not.toHaveProperty('disableUrlAccess');
});
```

- [ ] **Step 2: Verify the test fails before implementation exists**

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/email/impls/nodemailer/index.test.ts
```

Expected: failure because the test file does not yet exist.

- [ ] **Step 3: Upgrade Nodemailer**

Change the root declaration to:

```json
"nodemailer": "^9.0.1"
```

Do not change `NodemailerImpl` unless the 9.x type contract requires a minimal
compatibility adjustment proven by the test.

- [ ] **Step 4: Run the Nodemailer regression test**

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/email/impls/nodemailer/index.test.ts
```

Expected: pass without a real SMTP connection.

- [ ] **Step 5: Commit the mail transport remediation**

```powershell
git add package.json apps/server/src/services/email/impls/nodemailer/index.test.ts
git commit -m "fix(email): upgrade Nodemailer security baseline" -m "Constraint: retain typed SMTP payload mapping" -m "Tested: Nodemailer implementation regression"
```

### Task 3: Upgrade Vite in Root and Desktop Manifests

**Files:**
- Modify: `package.json`
- Modify: `apps/desktop/package.json`

**Interfaces:**
- Produces Vite 8.0.16 for the root SPA and Electron desktop development
  servers.

- [ ] **Step 1: Apply the matching Vite patch update**

Change both direct declarations from:

```json
"vite": "8.0.14"
```

to:

```json
"vite": "8.0.16"
```

- [ ] **Step 2: Validate both package declarations**

```powershell
node -e "const fs=require('node:fs'); for (const file of ['package.json','apps/desktop/package.json']) { const pkg=JSON.parse(fs.readFileSync(file,'utf8')); if (pkg.devDependencies.vite !== '8.0.16') throw new Error(file + ' must use Vite 8.0.16'); }"
```

Expected: exit code `0`.

- [ ] **Step 3: Commit the development-server remediation**

```powershell
git add package.json apps/desktop/package.json
git commit -m "fix(build): update Vite security patches" -m "Constraint: keep root and desktop Vite aligned" -m "Tested: package declaration assertion"
```

### Task 4: Run One Focused Verification Round

**Files:** All Task 1-3 files.

- [ ] **Step 1: Run authentication and email regression tests**

```powershell
bunx vitest run --silent='passed-only' src/libs/better-auth/define-config.test.ts apps/server/src/services/email/impls/nodemailer/index.test.ts
```

Expected: pass.

- [ ] **Step 2: Run Vite declaration assertion and type checking**

```powershell
node -e "const fs=require('node:fs'); for (const file of ['package.json','apps/desktop/package.json']) { const pkg=JSON.parse(fs.readFileSync(file,'utf8')); if (pkg.devDependencies.vite !== '8.0.16') throw new Error(file + ' must use Vite 8.0.16'); }"
bun run type-check
git diff --check
```

Expected: all commands pass. If type checking is blocked by an environment
dependency baseline, report the exact blocker and rely on the protected GitHub
PR check for the clean-install result.

### Task 5: Deliver the Isolated Security Branch

**Files:** The completed feature branch and GitHub repository state.

- [ ] **Step 1: Confirm governance PR integration before opening this PR**

```powershell
gh api repos/maheshenga/comhub/pulls/24 --jq "{state: .state, merged_at: .merged_at}"
```

Expected: `state` is `closed` and `merged_at` is non-null. If not, push the
security branch only when requested but do not open a PR lacking the protected
branch workflow; wait to rebase on the merged `main` first.

- [ ] **Step 2: Rebase onto the protected main branch and push**

```powershell
git fetch origin main
git rebase origin/main
git push --set-upstream origin fix/dependabot-runtime-security
```

- [ ] **Step 3: Open a dedicated security PR**

```powershell
gh api --method POST repos/maheshenga/comhub/pulls -f title="fix(security): remediate runtime Dependabot alerts" -f head="fix/dependabot-runtime-security" -f base="main" -f body="Updates Better Auth, Nodemailer, and Vite to patched versions. No deployment, migration, secret, or authentication configuration change is included."
```

- [ ] **Step 4: Verify the PR checks and alert state**

Use explicit REST endpoints for `maheshenga/comhub` to confirm the protected
`verify` check passes. After merge, re-read Dependabot alerts on `main`; the
expected result is zero open alerts for Better Auth, Nodemailer, and Vite.

## Plan Review

- Coverage: Tasks 1-3 resolve all three alert families; Task 4 provides the
  single verification round; Task 5 preserves the separation from governance.
- No placeholders: every edited file, target version, command, and expected
  result is specified.
- Consistency: Better Auth and Drizzle are upgraded together; both Vite
  declarations remain equal; no lockfile or deployment behavior is introduced.
