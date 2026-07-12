# Admin Settings Map

Date: 2026-07-07

Source of truth: `src/const/appSettingsRegistry.ts`.

This document records the current app settings surface so future changes can be checked before they reach production. It is intentionally based on the registry, not on UI screenshots.

## Registry Summary

- Total registered keys: 162.
- Sensitive keys: 5.
- Public runtime keys: 38.
- Every key belongs to the `app-settings` cache scope.

## Domain Counts

| Domain | Keys |
| --- | ---: |
| about | 3 |
| brand | 14 |
| client | 19 |
| composio | 3 |
| content | 40 |
| growth | 7 |
| model | 31 |
| notification | 12 |
| operations | 5 |
| pricing | 3 |
| storage | 10 |
| system | 12 |
| user-defaults | 3 |

## Cache Scope Counts

| Cache scope | Keys | Meaning |
| --- | ---: | --- |
| app-settings | 162 | persisted app setting registry and admin governance view |
| brand | 17 | public brand/about/sidebar/home runtime cache |
| runtime | 34 | model/runtime/user state related server config |
| s3 | 10 | file storage runtime cache |
| user-state | 1 | user settings synchronization defaults |

## Sensitive Keys

These keys must never appear in public runtime config, desktop public config, browser cache payloads, audit values, or deployment logs:

- `composio.apiKey`
- `cron.secret`
- `desktop.oss.accessKeySecret`
- `docmee.ppt.apiKey`
- `storage.s3.secretAccessKey`

Credential-like names are guarded by `hasSecretLikeAppSettingKeyName`. Any future key containing `apiKey`, `secret`, `token`, `password`, `credential`, `accessKey`, or `privateKey` must be reviewed before it can be marked public.

## Ownership Boundaries

| Area | Domain(s) | Cache scope(s) | Notes |
| --- | --- | --- | --- |
| Brand and white-label | `brand`, `about` | `brand`, `app-settings` | logo, favicon, loading SVG, about links, sidebar labels |
| Desktop client | `client` | `app-settings` | public update config is allowlisted; OSS credentials stay private |
| AI defaults and memory models | `model`, `user-defaults` | `runtime`, `user-state` | default agent, image/video defaults, memory analysis, vector retrieval |
| Commercial presentation | `pricing`, `operations`, `growth` | `runtime`, `app-settings` | pricing multiplier, plan FAQ, referral reward, onboarding credits |
| Notifications | `notification` | `app-settings` | channel switches, system announcement, event defaults |
| Storage | `storage` | `s3`, `app-settings` | endpoint, bucket, region, ACL, public domain, secret access key |
| Content/community | `content` | `app-settings` | community home, featured market sections, expert plaza |
| External connectors | `composio`, `system` | `app-settings` | Composio, Docmee PPT, cron and auth settings |

## Change Checklist

Before adding or changing an app setting:

- Add the key to `APP_SETTING_KEYS`.
- Verify `APP_SETTING_REGISTRY` gives it the intended domain.
- Verify the cache scopes include every runtime that must refresh.
- Mark credential values as sensitive.
- Keep secret-like names out of `publicRuntime`.
- Add form classification coverage in `adminSettingsForm.test.ts` when the key is admin editable.
- Add router coverage when the key is read from or written to `admin.settings`.
- Add public allowlist coverage when the key is returned to unauthenticated or client-side callers.
- Update `docs/FEATURE_REGISTRY.md` and `docs/CHANGELOG_INTERNAL.md`.
