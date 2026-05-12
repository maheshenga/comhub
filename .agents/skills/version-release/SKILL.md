---
name: version-release
description: "Version release workflow. Use when the user mentions 'release', 'hotfix', 'version upgrade', 'weekly release', or '发版'/'发布'/'小班车'. This skill is for release process and GitHub Release notes (not docs/changelog page writing)."
disable-model-invocation: true
argument-hint: '[minor|patch] [version?]'
---

# Version Release Workflow

This skill is a router. The detailed steps live in `references/`.

## Scope Boundary (Important)

This skill is only for:

1. Release branch / PR workflow
2. CI trigger constraints (`auto-tag-release.yml`)
3. GitHub Release note writing

This skill is **not** for writing `docs/changelog/*.mdx`.\
If the user asks for website changelog pages, load `../docs-changelog/SKILL.md`.

## Mandatory Companion Skill

For every `/version-release` execution, you MUST load and apply:

- `../microcopy/SKILL.md`

## Overview

The primary development branch is **canary**. All day-to-day development happens on canary. When releasing, canary is merged into main. After merge, `auto-tag-release.yml` automatically handles tagging, version bumping, creating a GitHub Release, and syncing back to the canary branch.

Only two release types are used in practice (major releases are extremely rare and can be ignored):

| Type  | Use Case                                       | Frequency             | Source Branch  | PR Title Format                      | Version       | Reference                               |
| ----- | ---------------------------------------------- | --------------------- | -------------- | ------------------------------------ | ------------- | --------------------------------------- |
| Minor | Feature iteration release                      | \~Every 4 weeks       | canary         | `🚀 release: v{x.y.0}`               | Manually set  | `references/minor-release.md`           |
| Patch | Weekly release / hotfix / model / DB migration | \~Weekly or as needed | canary or main | Custom (e.g. `🚀 release: 20260222`) | Auto patch +1 | `references/patch-release-scenarios.md` |

For writing the release-note body (any release type), see `references/release-notes-style.md`.

## Auto-Release Trigger Rules (`auto-tag-release.yml`)

After a PR is merged into main, CI determines whether to release based on the following priority:

### 1. Minor Release (Exact Version)

PR title matches `🚀 release: v{x.y.z}` -> uses the version number from the title.

### 2. Patch Release (Auto patch +1)

Triggered by the following priority:

- **Branch name match**: `hotfix/*` or `release/*` -> triggers directly (skips title detection)
- **Title prefix match**: PRs with the following title prefixes will trigger:
  - `style` / `💄 style`
  - `feat` / `✨ feat`
  - `fix` / `🐛 fix`
  - `refactor` / `♻️ refactor`
  - `hotfix` / `🐛 hotfix` / `🩹 hotfix`
  - `build` / `👷 build`

### 3. No Trigger

PRs that don't match any conditions above (e.g. `docs`, `chore`, `ci`, `test`) will not trigger a release when merged into main.

## Post-Release Automated Actions

1. **Bump `package.json`** — commits `🔖 chore(release): release version v{x.y.z} [skip ci]`
2. **Create annotated tag** — `v{x.y.z}`
3. **Create GitHub Release**
4. **Dispatch `sync-main-to-canary`** — syncs main back to canary

## Agent Action Guide

When the user requests a release:

### Precheck (applies to all release types)

Before creating the release branch, verify the source branch:

- **Weekly Release** (`release/weekly-*`): must branch from `canary`
- **All other release/hotfix branches**: must branch from `main`; run `git merge-base --is-ancestor main <branch> && echo OK`
- If the branch is based on the wrong source, recreate from the correct base

### Routing

Pick the right reference and follow it end-to-end:

- **Minor release** → `references/minor-release.md`
- **Patch release** (weekly / hotfix / model launch / DB migration) → `references/patch-release-scenarios.md`
- **Writing the PR body / release notes** (any release type) → `references/release-notes-style.md`

### Hard Rules (apply to every release type)

<<<<<<< HEAD
- **Weekly Release**: create `release/weekly-{YYYYMMDD}` from canary; use `git log main..canary` for release note inputs; title like `🚀 release: 20260222`
- **Bug Hotfix**: create `hotfix/` from main; use gitmoji prefix title (e.g. `🐛 fix: ...`)
- **New Model Launch**: community PRs trigger automatically via title prefix (`feat` / `style`)
- **DB Migration**: create `release/db-migration-{name}` from main; cherry-pick migration commits; include dedicated migration notes

### Hard Rules

- **Do NOT** manually modify `package.json` version
- **Do NOT** manually create tags
- Minor PR title format is strict
- Patch PRs do not need explicit version number
- Keep release facts accurate; do not invent metrics or availability statements

## GitHub Release Changelog Standard (Long-Form Style)

Use this section for writing **GitHub Release notes** (or release PR body when the PR body is intended to become release notes).\
Do not use this as `docs/changelog` page guidance.

### Positioning

This release-note style is:

1. **Data-backed at the top** (date, range, key metrics)
2. **Narrative first, then structured detail**
3. **Deep but scannable** (clear sectioning + compact bullets)
4. **Contributor-forward** (credits are part of the release story)

### Required Inputs Before Writing

Collect these inputs first:

1. Compare range (`<prev_tag>...<current_tag>`)
2. Release metrics (commits, merged PRs, resolved issues, contributors, optional files/insertions/deletions)
3. High-impact changes by domain (core loop, platform/gateway, UX, tooling, security, reliability)
4. Contributor list (with standout contributions if known)
5. Known risks / migrations / rollout notes (if any)

If metrics cannot be reliably computed, omit unknown numbers instead of guessing.

### Canonical Structure

Follow this section order unless the user asks otherwise:

1. `# 🚀 LobeHub Release (<YYYYMMDD>)`
2. Metadata lines:
   - `Release Date`
   - `Since <Previous Version>` metrics
3. One quoted release thesis (single paragraph, 1-2 lines)
4. `## ✨ Highlights` (6-12 bullets for major releases; 3-8 for weekly)
5. Domain blocks with optional `###` subsections:
   - `## 🏗️ Core Agent & Architecture` (or equivalent product core)
   - `## 📱 Platforms / Integrations`
   - `## 🖥️ CLI & User Experience`
   - `## 🔧 Tooling`
   - `## 🔒 Security & Reliability`
   - `## 📚 Documentation` (optional if meaningful)
6. `## 👥 Contributors`
7. `**Full Changelog**: <prev>...<current>`

Use `---` separators between major blocks for long releases.

### Writing Rules (Hard)

1. **No fabricated metrics**: all numbers must be traceable.
2. **No vague headline bullets**: each bullet must include capability + impact.
3. **No internal-only framing**: phrase from user/operator perspective.
4. **Security must be explicit** when security-sensitive fixes are present.
5. **PR/issue linkage**: use `(#1234)` when IDs are available.
6. **Terminology consistency**: same feature/provider name across sections.
7. **Do not bury migration or breaking changes**: elevate to dedicated section or callout.

### Style Rules (Long-Form)

1. Start with an "everyday use" framing, not implementation internals.
2. Mix narrative sentence + evidence bullets.
3. Keep bullets compact but informative:
   - Good: `**Fast Mode (`/fast`)** — Priority routing for OpenAI and Anthropic, reducing latency on supported models. (#6875, #6960)`
4. Use bold only for capability names, not for whole sentences.
5. Keep heading depth <= 3 levels.

### Release Size Heuristics

- **Minor / major milestone release**
  - Include full structure with multiple domain blocks.
  - `Highlights` usually 8-12 bullets.
- **Weekly patch release**
  - Keep full skeleton but reduce subsection count.
  - `Highlights` usually 4-8 bullets.
- **DB migration release**
  - Keep concise.
  - Must include `Migration overview`, operator impact, and rollback/backup note.

### Contributor Ordering

Render contributors as a **single flat list** (no separate "Community" / "Core Team" subsections). Order: **community contributors first, team members after**. Within each group, sort by PR count desc. Bots (`@lobehubbot`, `renovate[bot]`) go on a separate "maintenance" line.

**LobeHub team roster** — anyone in this list is a team member; anyone not in this list is a community contributor:

- @arvinxx
- @Innei
- @tjx666 (commit author name: YuTengjing)
- @LiJian
- @Neko
- @Rdmclin2
- @AmAzing129
- @sudongyuer
- @rivertwilight
- @CanisMinor

> **Resolving handles** — git author names (e.g. `YuTengjing`) are not always the GitHub handle. Verify via `gh pr view <PR> --json author` or `gh api search/users -f q='<email>'` before listing.

If a new contributor appears who is not on this list, treat them as community by default and ask the user whether to add them to the roster.

### GitHub Release Changelog Template

```md
# 🚀 LobeHub Release (<YYYYMMDD>)

**Release Date:** <Month DD, YYYY>  
**Since <Previous Version>:** <N merged PRs> · <N resolved issues> · <N contributors>

> <One release thesis sentence: what this release unlocks in practice.>

---

## ✨ Highlights

- **<Capability A>** — <What changed and why it matters>. (#1234)
- **<Capability B>** — <What changed and why it matters>. (#2345)
- **<Capability C>** — <What changed and why it matters>. (#3456)

---

## 🏗️ Core Product & Architecture

### <Subdomain>

- <Concrete change + impact>. (#...)
- <Concrete change + impact>. (#...)

---

## 📱 Platforms / Integrations

- <Platform update + impact>. (#...)
- <Compatibility/reliability fix + impact>. (#...)

---

## 🖥️ CLI & User Experience

- <User-facing workflow improvement>. (#...)
- <Quality-of-life fix>. (#...)

---

## 🔧 Tooling

- <Tool/runtime improvement>. (#...)

---

## 🔒 Security & Reliability

- **Security:** <hardening or vulnerability fix>. (#...)
- **Reliability:** <stability/performance behavior improvement>. (#...)

---

## 👥 Contributors

Huge thanks to **<N contributors>** who shipped **<N merged PRs>** this cycle.

@<community-handle> · @<community-handle> · @<team-handle> · @<team-handle>

Plus @lobehubbot and renovate[bot] for maintenance.

---

**Full Changelog**: <previous_tag>...<current_tag>
```

### Quick Checklist

- [ ] Uses top metadata and a clear release thesis
- [ ] Includes `Highlights` plus domain-grouped sections
- [ ] Every major bullet states both change and user/operator impact
- [ ] Security and reliability updates are explicitly surfaced (when present)
- [ ] Contributor credits and compare range are included
- [ ] All numbers and claims are verifiable
=======
- **Do NOT** manually modify `package.json` version — CI handles it.
- **Do NOT** manually create tags — CI handles them.
- Minor PR title format is strict (`🚀 release: v{x.y.z}`).
- Patch PRs do not need an explicit version number.
- Keep release facts accurate; do not invent metrics or availability statements. Release-note inputs (compare base, PR refs, contributor list) **must be derived from `git`** per `references/release-notes-style.md` § Computing Inputs — never from memory or descriptions.
>>>>>>> v2.1.58-canary.16
