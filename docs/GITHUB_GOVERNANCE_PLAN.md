# ComHub GitHub Governance Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with a focused
> verification gate after each task.

**Goal:** Make `maheshenga/comhub` a governed public GitHub repository without
changing production runtime behavior or deploying any service.

**Architecture:** Repository files establish pull-request validation, code
ownership, security feedback, and accurate public documentation. GitHub REST
API settings protect `main` and scope deployment environments after the PR
check workflow is available remotely. A pull request is opened but never
merged automatically.

**Tech Stack:** GitHub Actions, GitHub REST API through `gh`, Node.js test
runner, YAML, pnpm, Bun, TypeScript.

## Global Constraints

- Work only in `E:\code\comhub\comhub-worktree` on
  `codex/worktree-setup`.
- Do not deploy, migrate, rotate, print, create, or copy secret values.
- Keep production and Worker deployment workflows manual and build-free.
- Run exactly one focused verification round after repository file changes.
- Do not merge the resulting pull request.
- Keep the repository administrator emergency bypass for `main`.

---

### Task 1: Add a Required PR Validation Check

**Files:**
- Create: `.github/workflows/comhub-pr-check.yml`
- Modify: `.github/workflows/comhubDeploymentWorkflows.test.mjs`

**Interfaces:**
- Produces the GitHub Actions Check Run `verify`.
- Consumed by the `main` branch protection rule in Task 5.

- [ ] **Step 1: Add the failing workflow contract test**

Add this test before creating the workflow:

```js
test('PR checks validate main-bound changes without deployment capability', () => {
  const { source, workflow } = loadWorkflow('comhub-pr-check.yml');

  assert.deepEqual(workflow.on.pull_request.branches, ['main']);
  assert.equal(workflow.permissions.contents, 'read');
  assert.deepEqual(Object.keys(workflow.jobs), ['verify']);
  assert.equal(workflow.jobs.verify.environment, undefined);
  assert.match(source, /node --test .github\/workflows\/comhubDeploymentWorkflows\.test\.mjs/);
  assert.match(source, /pnpm type-check/);
  assert.doesNotMatch(source, /docker\/build-push-action/);
  assert.doesNotMatch(source, /COMHUB_SSH_PRIVATE_KEY/);
  assert.doesNotMatch(source, /MODULE_APP_ALIPAY_/);
  assert.doesNotMatch(source, /deploy_module_worker/);
});
```

- [ ] **Step 2: Verify the test fails for the missing workflow**

Run:

```powershell
node --test .github/workflows/comhubDeploymentWorkflows.test.mjs
```

Expected: failure with `ENOENT` for `comhub-pr-check.yml`.

- [ ] **Step 3: Create the minimal PR workflow**

Create `.github/workflows/comhub-pr-check.yml` with this content:

```yaml
name: ComHub PR Checks

on:
  pull_request:
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: comhub-pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  verify:
    name: verify
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          run_install: false

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      - name: Verify deployment workflow contracts
        run: node --test .github/workflows/comhubDeploymentWorkflows.test.mjs

      - name: Type check
        run: pnpm type-check
```

Use `pnpm type-check` in CI because this workflow installs pnpm and Node.js;
it invokes the same package script as the local `bun run type-check` command
without adding a second runtime setup action.

- [ ] **Step 4: Verify the contract suite passes**

Run:

```powershell
node --test .github/workflows/comhubDeploymentWorkflows.test.mjs
```

Expected: all workflow contract tests pass.

### Task 2: Add Security Feedback Workflows

**Files:**
- Create: `.github/workflows/codeql.yml`
- Create: `.github/workflows/dependency-review.yml`

**Interfaces:**
- Produces CodeQL alerts for JavaScript/TypeScript and dependency-review PR
  annotations.
- Does not become a required `main` check in this change.

- [ ] **Step 1: Add CodeQL workflow**

Create `.github/workflows/codeql.yml`:

```yaml
name: CodeQL

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
  schedule:
    - cron: '23 3 * * 1'

permissions:
  actions: read
  contents: read
  security-events: write

jobs:
  analyze:
    name: Analyze JavaScript and TypeScript
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v4
        with:
          languages: javascript-typescript
          build-mode: none

      - name: Analyze
        uses: github/codeql-action/analyze@v4
```

- [ ] **Step 2: Add dependency-review workflow**

Create `.github/workflows/dependency-review.yml`:

```yaml
name: Dependency Review

on:
  pull_request:
    branches:
      - main

permissions:
  contents: read

jobs:
  review:
    name: review
    runs-on: ubuntu-latest
    steps:
      - name: Dependency review
        uses: actions/dependency-review-action@v5
```

- [ ] **Step 3: Validate the workflow YAML with the existing parser**

Run:

```powershell
node -e "const fs=require('node:fs'); const {parse}=require('yaml'); for (const f of ['.github/workflows/codeql.yml','.github/workflows/dependency-review.yml']) parse(fs.readFileSync(f,'utf8'));"
```

Expected: exit code `0`.

### Task 3: Establish ComHub Ownership and Public Documentation

**Files:**
- Modify: `.github/CODEOWNERS`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `SECURITY.md`

**Interfaces:**
- Public repository pages point contributors and vulnerability reporters to
  `maheshenga/comhub`.
- GitHub resolves sensitive areas to `@maheshenga`.

- [ ] **Step 1: Replace CODEOWNERS with ComHub ownership**

Use this content:

```text
# ComHub maintainer ownership
* @maheshenga

# Release, infrastructure, and data-boundary changes
/.github/ @maheshenga
/docker-compose/deploy/ @maheshenga
/packages/database/migrations/ @maheshenga
/scripts/comhub-upstream-sync/ @maheshenga
```

- [ ] **Step 2: Replace the one-line README with a public ComHub entry point**

The README must include these exact sections: `ComHub`, `Features`, `Quick
Start`, `Contribution`, `Security`, `Upstream Sync`, and `License`. It must:

- describe ComHub as an independently maintained customization based on
  LobeHub, without claiming affiliation;
- list assistant workspace, mobile workspace, design, community, applications,
  and administration as maintained areas;
- show `pnpm install --no-frozen-lockfile`, `bun run dev`, and `bun run dev:spa`;
- state that GitHub Actions publishes immutable GHCR images and production
  deployment is manually dispatched from `main`;
- link to `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, and the LobeHub upstream
  repository;
- omit servers, URLs for private infrastructure, payment credentials, and
  environment variable values.

- [ ] **Step 3: Rewrite contribution and security routing**

`CONTRIBUTING.md` must use this clone target and contribution flow:

```bash
git clone https://github.com/maheshenga/comhub.git
git checkout -b feat/short-description
pnpm install --no-frozen-lockfile
node --test .github/workflows/comhubDeploymentWorkflows.test.mjs
bun run type-check
```

It must direct contributors to PRs targeting `main` and state that upstream
sync is reviewed through the existing `upstream` remote and sync workflow.

`SECURITY.md` must use this advisory link and prohibit public disclosure:

```text
https://github.com/maheshenga/comhub/security/advisories/new
```

It must cover the current ComHub `main` branch and self-hosted deployment
surfaces, and must remove LobeHub Discord and LobeHub advisory references.

- [ ] **Step 4: Validate document references**

Run:

```powershell
rg -n "github.com/lobehub/lobehub/security|Discord.*arvinxu|YourUsername/lobehub" README.md CONTRIBUTING.md SECURITY.md
```

Expected: no matches. Confirm all four modified files are listed by
`git diff --name-only`.

### Task 4: Run the Single Repository Verification Round

**Files:** All Task 1-3 files.

- [ ] **Step 1: Run workflow contract tests**

```powershell
node --test .github/workflows/comhubDeploymentWorkflows.test.mjs
```

Expected: pass.

- [ ] **Step 2: Run type checking**

```powershell
bun run type-check
```

Expected: pass.

- [ ] **Step 3: Check patch whitespace and scope**

```powershell
git diff --check
git diff --name-only
```

Expected: no whitespace errors; only Task 1-3 files plus this plan and the
approved governance design are present.

### Task 5: Deliver Through GitHub Without Deploying

**Files:** GitHub repository settings and the branch created by this worktree.

**Interfaces:**
- Consumes the remotely available GitHub Actions `verify` Check Run.
- Produces a protected `main`, scoped environments, Dependabot security
  updates, and a reviewable pull request.

- [ ] **Step 1: Commit and push repository files**

Use a Lore-style commit message and push only the feature branch:

```powershell
git add .github README.md CONTRIBUTING.md SECURITY.md docs/GITHUB_GOVERNANCE_DESIGN.md docs/GITHUB_GOVERNANCE_PLAN.md
git commit -m "ci: govern ComHub GitHub collaboration" -m "Constraint: production remains manual" -m "Tested: workflow contracts, type check, diff check"
git push --set-upstream origin codex/worktree-setup
```

- [ ] **Step 2: Apply branch protection after the workflow exists remotely**

```powershell
$body = @'
{
  "required_status_checks": {
    "strict": true,
    "checks": [{"context": "verify", "app_id": 15368}]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {"required_approving_review_count": 0},
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
'@
$path = Join-Path $env:TEMP "comhub-main-protection.json"
[System.IO.File]::WriteAllText($path, $body, [System.Text.UTF8Encoding]::new($false))
gh api --method PUT repos/maheshenga/comhub/branches/main/protection --input $path
[System.IO.File]::Delete($path)
```

Re-read the policy afterward; do not assume the API request succeeded.

- [ ] **Step 3: Scope deployment environments**

```powershell
gh api --method PUT repos/maheshenga/comhub/environments/production `
  -F 'deployment_branch_policy[protected_branches]=true' `
  -F 'deployment_branch_policy[custom_branch_policies]=false'
gh api --method PUT repos/maheshenga/comhub/environments/module-app-staging `
  -F 'deployment_branch_policy[protected_branches]=true' `
  -F 'deployment_branch_policy[custom_branch_policies]=false'
```

- [ ] **Step 4: Enable Dependabot security updates**

```powershell
gh api --method PATCH repos/maheshenga/comhub `
  -F 'security_and_analysis[dependabot_security_updates][status]=enabled'
```

- [ ] **Step 5: Enable private vulnerability reporting**

```powershell
gh api --method PUT repos/maheshenga/comhub/private-vulnerability-reporting
```

- [ ] **Step 6: Open the review PR, then re-read platform state**

```powershell
gh pr create --base main --head codex/worktree-setup --title "ci: govern ComHub GitHub collaboration" --body "Add protected PR validation, security feedback, public repository documentation, and scoped deployment environments. Verified with workflow contracts, type checking, and git diff --check."
gh api repos/maheshenga/comhub/branches/main/protection
gh api repos/maheshenga/comhub/environments
gh api repos/maheshenga/comhub --jq ".security_and_analysis"
gh api repos/maheshenga/comhub/private-vulnerability-reporting
```

Expected: the PR is open and unmerged; `main` protection requires the GitHub
Actions `verify` check; both deployment environments use protected-branch policies;
Dependabot security updates and private vulnerability reporting are enabled.

## Plan Review

- Coverage: Tasks 1-3 implement all repository changes; Task 5 implements all
  approved platform changes; Task 4 provides the single verification round.
- No-placeholder scan: the plan names every file, check context, API endpoint,
  command, and expected result.
- Consistency: the branch rule depends only on the check created and pushed in
  Task 1; deployments remain manual and no secret value is handled.
