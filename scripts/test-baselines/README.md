# Test red-set baselines

Snapshot baselines for the dual-suite red-set governance mechanism
(blueprint: admin-console redesign §7.3-3). These files let CI and the
upgrade flow answer one question: **after a change, did the count of
deterministic reds grow?**

## Snapshot files

Naming: `redset-<suite>-<tag>.json` where `<suite>` is the vitest project /
workspace and `<tag>` is the milestone or upstream baseline the snapshot was
taken at.

| File                             | Suite                     | Command (working dir)                                                                                                                    | Scale at m0 capture                                |
| -------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `redset-app-m0.json`             | root `app` project        | `npx vitest run --project app` (repo root)                                                                                               | 344 deterministic + 3 flaky + 24 file-level errors |
| `redset-business-server-m0.json` | business-server workspace | `npx vitest run` (working dir `packages/business-server` — it has its own `vitest.config.mts` and is NOT collected by the root projects) | 15 deterministic + 0 flaky + 0 errors              |

(The blueprint's historical narrative counts — 12 files / 25 reds for
business-server, \~350 total failures for app — used a different counting
basis; the snapshot arrays above are the machine-readable truth.)

Snapshots are committed at milestone boundaries (first: M0, then after each
upstream upgrade). Upgrade acceptance = deterministic diff between the two
snapshots is zero.

## Snapshot format

Flat top-level structure (whitelist is optional — present only when reds are
explicitly deferred):

```jsonc
{
  "meta": {
    "suite": "app",
    "runner": "vitest <version> (<platform>, node <version>)",
    "capturedAt": "<ISO timestamp>",
    "baselineRef": "<git ref or explicit 'uncommitted working tree on <sha>' note>",
    "runs": [ /* raw per-run failure counts; null = report not archived, see runsNote */ ],
    "runsNote": "<why runs are null / where the raw reports live>",
    "generatedVia": "double-run",
    "counts": { "deterministic": <n>, "flaky": <n>, "errors": <n> },
    "note": "<construction narrative>"
  },
  "deterministic": [ /* {file, test} red in BOTH of two consecutive runs */ ],
  "flaky": [ /* {file, test} red in only ONE run — watchlist, never blocks */ ],
  "errors": [ /* {file, errorType, firstLine} file-level load/collection failures */ ],
  "whitelist": [ /* {file, reason, closesIn} accepted reds deferred to a milestone */ ]
}
```

## Classification protocol

Every snapshot is taken from **two consecutive full runs** of the same suite:

- red in **both** runs → `deterministic` (blocks diffing; must be fixed or
  explicitly accepted before the milestone closes);
- red in **one** run → `flaky` watchlist (tracked, must not grow, never
  blocks);
- **file-level entries** → `errors`: a reported entry with NO
  `assertionResults` (file failed to load / no suite collected) or whose
  message contains "Unhandled" — both runs must show it. `errorType` is a
  **first-line heuristic classification** of the report message, so it can be
  an assertion class too (e.g. a module-scope `expect` failing at load time
  reports `AssertionError`); do NOT use `errorType` to distinguish assertion
  vs non-assertion — the entry's file-level provenance is what puts it in
  `errors`;
- `whitelist` entries are reds deliberately deferred to a later milestone
  (`closesIn`, e.g. the mobileSettingsI18n `<400` threshold red closed by the
  M3 page split). They are accepted, excluded from deterministic blocking,
  and the diff must verify they shrink or stay — never grow.

## Registry ownership

This directory is fork-new (nothing upstream). It is claimed `owned` by the
`repo-infra` module via a precise rule inserted above the
`p:scripts/` catch-all in `scripts/comhub-customizations/registry.mjs`
(maintained for the admin-console workstream, but repo-infra is its home).
