# Desktop Control Center Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the experimental desktop settings form with an operational control center that reports Stable/Canary release health, shows platform installers, and cleanly separates update, distribution, and brand settings.

**Architecture:** Extend the existing `desktopRelease` server service into a bounded diagnostics reader, expose it through a read-only `admin.desktop` tRPC router, and consume it from a feature-owned tabbed admin page. Existing application settings remain authoritative for editable configuration; GitHub Actions and object storage remain authoritative for release artifacts.

**Tech Stack:** TypeScript, React 19, Next.js SPA routes, tRPC, SWR, Vitest, `yaml`, `@lobehub/ui`, antd, `antd-style`.

## Global Constraints

- Keep `/settings/admin/desktop-update` as the canonical route.
- Keep `OFFICIAL_CLOUD_SERVER` build-time only and read-only in the admin UI.
- Keep OSS credentials and signing credentials outside the database and browser response.
- Support exactly `stable` and `canary` release channels in this phase.
- Report Windows, macOS Apple Silicon, macOS Intel, and Linux independently; one missing platform must not fail the whole page.
- Do not add database migrations, release dispatch, release history, installation inventory, remote disable, rollback, or forced-update enforcement in Phase 1.
- Preserve the existing public desktop update contract and the existing desktop updater behavior.
- Use `systemRead` for diagnostics and the existing settings write permission for setting changes.
- Route files remain thin; business UI belongs under `src/features/Admin/DesktopControlCenter/`.
- Use project loaders or skeletons, not antd `Spin`.
- Every list or status surface has loading, empty, error, and populated states.
- Keep exactly one primary action per tab.
- Add English source strings to `packages/locales/src/default/subscription.ts` and `locales/en-US/subscription.json`, and hand-written Chinese strings to `locales/zh-CN/subscription.json`.
- Run one focused verification round after implementation, per the user's testing preference; do not run the full test suite.
- Preserve unrelated user changes and never reset or revert the worktree.
- Each implementation commit follows the Lore protocol: intent line first, then only useful trailers.

---

## File Structure

### New server files

- `packages/business-server/src/lambda-routers/admin/desktop.ts`: read-only admin desktop diagnostics router.
- `packages/business-server/src/lambda-routers/admin/desktop.test.ts`: router registration, permission binding, settings-to-service integration.

### New frontend feature files

- `src/features/Admin/DesktopControlCenter/index.tsx`: page shell, URL-backed tabs, shared data loading and refresh.
- `src/features/Admin/DesktopControlCenter/types.ts`: tab IDs and view-only aliases.
- `src/features/Admin/DesktopControlCenter/styles.ts`: stable full-width layout, status band and platform grid styles.
- `src/features/Admin/DesktopControlCenter/OverviewPage.tsx`: release health and version summary.
- `src/features/Admin/DesktopControlCenter/DistributionPage.tsx`: platform installer matrix and public download form.
- `src/features/Admin/DesktopControlCenter/UpdateSettingsPage.tsx`: update server, channel, check interval and release metadata form.
- `src/features/Admin/DesktopControlCenter/BrandPage.tsx`: login-page branding form and read-only business URL.
- `src/features/Admin/DesktopControlCenter/desktopSettingsForm.ts`: pure initial-value and settings-diff builders.
- `src/features/Admin/DesktopControlCenter/desktopSettingsForm.test.ts`: update-key and no-op behavior.
- `src/features/Admin/DesktopControlCenter/DesktopControlCenter.test.tsx`: shell, state and save-flow tests.

### Existing files changed together

- `apps/server/src/services/desktopRelease/index.ts`: channel-aware manifest diagnostics.
- `apps/server/src/services/desktopRelease/index.test.ts`: manifest, channel, platform and partial-failure tests.
- `packages/business-server/src/lambda-routers/admin/index.ts`: register `admin.desktop`.
- `src/services/adminCommercial.ts`: expose `getDesktopOverview`.
- `src/services/adminCommercial.test.ts`: tRPC delegation contract.
- `src/const/adminCacheKeys.ts`: desktop overview SWR key.
- `src/features/Admin/AdminDesktopUpdatePage.tsx`: compatibility re-export to the new feature.
- `src/features/Admin/adminDesktopUpdateSettings.ts`: shared keys and final section metadata only.
- `src/features/Admin/adminDesktopUpdateSettings.test.ts`: section/key compatibility.
- `src/features/Admin/adminCatalog.ts`: active menu label and description.
- `src/features/Admin/adminCatalog.test.ts`: active catalog contract.
- `src/routes/(main)/admin/desktop-update/index.tsx`: import the feature export while remaining a thin route.
- `packages/locales/src/default/subscription.ts`: English source strings.
- `locales/en-US/subscription.json`: English translations.
- `locales/zh-CN/subscription.json`: Chinese translations.

---

### Task 1: Add Channel-Aware Desktop Release Diagnostics

**Files:**
- Modify: `apps/server/src/services/desktopRelease/index.ts`
- Modify: `apps/server/src/services/desktopRelease/index.test.ts`

**Interfaces:**
- Consumes: existing `resolveDesktopDownloadFromUrls`, YAML manifests at `{base}/{channel}/{channel}[-mac|-linux].yml`, and `DesktopDownloadType`.
- Produces: `DesktopReleaseChannel`, `DesktopArtifactDiagnostic`, `DesktopChannelDiagnostic`, `DesktopReleaseDiagnostics`, and `getDesktopReleaseDiagnostics(options)`.

- [ ] **Step 1: Add diagnostics contract tests**

Append fixtures and expectations to `index.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getDesktopReleaseDiagnostics,
  type DesktopDownloadType,
} from './index';

const manifest = (version: string, files: Array<{ sha512?: string; size?: number; url: string }>) =>
  [
    `version: ${version}`,
    'files:',
    ...files.flatMap((file) => [
      `  - url: ${file.url}`,
      ...(file.sha512 ? [`    sha512: ${file.sha512}`] : []),
      ...(file.size ? [`    size: ${file.size}`] : []),
    ]),
    'releaseDate: 2026-07-21T00:00:00.000Z',
  ].join('\n');

it('reports stable and canary platform artifacts independently', async () => {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/stable/stable-mac.yml')) {
      return new Response(
        manifest('2.3.0', [
          { size: 11, url: 'ComHub-2.3.0-arm64.dmg' },
          { size: 12, url: 'ComHub-2.3.0-x64.dmg' },
        ]),
      );
    }
    if (url.includes('/stable/stable-linux.yml')) {
      return new Response(manifest('2.3.0', [{ url: 'ComHub-2.3.0.AppImage' }]));
    }
    if (url.includes('/stable/stable.yml')) {
      return new Response(manifest('2.3.0', [{ sha512: 'win-hash', url: 'ComHub-2.3.0-setup.exe' }]));
    }
    return new Response('missing', { status: 404 });
  });

  const result = await getDesktopReleaseDiagnostics({
    baseUrl: 'https://releases.example.com',
    fetcher: fetcher as typeof fetch,
    now: () => new Date('2026-07-21T01:00:00.000Z'),
  });

  expect(result.configured).toBe(true);
  expect(result.checkedAt).toBe('2026-07-21T01:00:00.000Z');
  expect(result.channels.find(({ channel }) => channel === 'stable')).toMatchObject({
    channel: 'stable',
    status: 'healthy',
    version: '2.3.0',
  });
  expect(
    result.channels.find(({ channel }) => channel === 'stable')?.platforms.windows,
  ).toMatchObject({ assetName: 'ComHub-2.3.0-setup.exe', sha512: 'win-hash', status: 'available' });
  expect(result.channels.find(({ channel }) => channel === 'canary')?.status).toBe('unavailable');
});

it('keeps healthy platforms when one manifest is unavailable', async () => {
  const fetcher = vi.fn(async (input: string | URL | Request) =>
    String(input).includes('-linux.yml')
      ? new Response('upstream unavailable', { status: 503 })
      : new Response(manifest('2.3.0', [{ url: 'ComHub-2.3.0-setup.exe' }])),
  );

  const result = await getDesktopReleaseDiagnostics({
    baseUrl: 'https://releases.example.com',
    channels: ['stable'],
    fetcher: fetcher as typeof fetch,
  });

  expect(result.channels[0].status).toBe('degraded');
  expect(result.channels[0].platforms.windows.status).toBe('available');
  expect(result.channels[0].platforms.linux).toMatchObject({
    reason: expect.stringContaining('503'),
    status: 'unavailable',
  });
});

it('returns an unconfigured result without making network requests', async () => {
  const fetcher = vi.fn();
  const result = await getDesktopReleaseDiagnostics({ baseUrl: '', fetcher });

  expect(result).toMatchObject({ configured: false, channels: [] });
  expect(fetcher).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Extend manifest and diagnostics types**

Add these exported contracts to `index.ts`:

```ts
export type DesktopReleaseChannel = 'canary' | 'stable';
export type DesktopDiagnosticStatus = 'available' | 'missing' | 'unavailable';

export interface DesktopArtifactDiagnostic {
  assetName?: string;
  publishedAt?: string;
  reason?: string;
  sha512?: string;
  size?: number;
  status: DesktopDiagnosticStatus;
  type: DesktopDownloadType;
  url?: string;
  version?: string;
}

export interface DesktopChannelDiagnostic {
  channel: DesktopReleaseChannel;
  platforms: Record<DesktopDownloadType, DesktopArtifactDiagnostic>;
  publishedAt?: string;
  status: 'degraded' | 'healthy' | 'unavailable';
  version?: string;
}

export interface DesktopReleaseDiagnostics {
  baseUrl: null | string;
  channels: DesktopChannelDiagnostic[];
  checkedAt: string;
  configured: boolean;
}

export interface DesktopReleaseDiagnosticsOptions {
  baseUrl?: string | null;
  channels?: DesktopReleaseChannel[];
  fetcher?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}
```

Extend `UpdateServerManifestFile` to carry `sha512` and `size`:

```ts
type UpdateServerManifestFile = {
  sha512?: string;
  size?: number;
  url: string;
};
```

- [ ] **Step 3: Implement bounded manifest reads and channel aggregation**

Replace the private manifest fetcher with an injected, timeout-bounded variant and add the exported aggregator:

```ts
const fetchUpdateServerManifest = async (
  baseUrl: string,
  manifestName: string,
  options: { fetcher: typeof fetch; timeoutMs: number },
): Promise<UpdateServerManifest> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const res = await options.fetcher(urlJoin(baseUrl, manifestName), {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`manifest ${manifestName}: HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > 512 * 1024) throw new Error(`manifest ${manifestName}: response too large`);
    return (parse(text) || {}) as UpdateServerManifest;
  } finally {
    clearTimeout(timeout);
  }
};

export const getDesktopReleaseDiagnostics = async (
  options: DesktopReleaseDiagnosticsOptions = {},
): Promise<DesktopReleaseDiagnostics> => {
  const checkedAt = (options.now ?? (() => new Date()))().toISOString();
  const baseUrl = options.baseUrl?.trim().replace(/\/$/, '') || null;
  if (!baseUrl) return { baseUrl, channels: [], checkedAt, configured: false };

  const channels = await Promise.all(
    (options.channels ?? ['stable', 'canary']).map((channel) =>
      getDesktopChannelDiagnostic({
        baseUrl,
        channel,
        fetcher: options.fetcher ?? fetch,
        timeoutMs: options.timeoutMs ?? 5000,
      }),
    ),
  );

  return { baseUrl, channels, checkedAt, configured: true };
};
```

Add these private helpers immediately before `getDesktopReleaseDiagnostics`:

```ts
type ManifestResult =
  | { manifest: UpdateServerManifest; reason?: never }
  | { manifest?: never; reason: string };

const readManifest = async (
  channelBaseUrl: string,
  manifestName: string,
  options: { fetcher: typeof fetch; timeoutMs: number },
): Promise<ManifestResult> => {
  try {
    return {
      manifest: await fetchUpdateServerManifest(channelBaseUrl, manifestName, options),
    };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : String(error) };
  }
};

const resolveManifestArtifact = (options: {
  baseUrl: string;
  manifest?: UpdateServerManifest;
  reason?: string;
  type: DesktopDownloadType;
}): DesktopArtifactDiagnostic => {
  if (!options.manifest) {
    return {
      reason: options.reason || 'manifest unavailable',
      status: 'unavailable',
      type: options.type,
    };
  }

  const version = options.manifest.version?.replace(/^v/i, '');
  if (!version) {
    return {
      reason: 'manifest version is missing',
      status: 'unavailable',
      type: options.type,
    };
  }

  const resolved = resolveDesktopDownloadFromUrls({
    publishedAt: options.manifest.releaseDate,
    tag: `v${version}`,
    type: options.type,
    urls: normalizeManifestUrls(options.baseUrl, options.manifest),
    version,
  });
  if (!resolved) {
    return {
      publishedAt: options.manifest.releaseDate,
      reason: `No ${options.type} installer in manifest`,
      status: 'missing',
      type: options.type,
      version,
    };
  }

  const file = options.manifest.files?.find(
    ({ url }) => getBasename(url) === resolved.assetName,
  );
  return {
    ...resolved,
    sha512: file?.sha512,
    size: file?.size,
    status: 'available',
  };
};

const getDesktopChannelDiagnostic = async (options: {
  baseUrl: string;
  channel: DesktopReleaseChannel;
  fetcher: typeof fetch;
  timeoutMs: number;
}): Promise<DesktopChannelDiagnostic> => {
  const channelBaseUrl = urlJoin(options.baseUrl, options.channel);
  const [windowsManifest, macManifest, linuxManifest] = await Promise.all([
    readManifest(channelBaseUrl, `${options.channel}.yml`, options),
    readManifest(channelBaseUrl, `${options.channel}-mac.yml`, options),
    readManifest(channelBaseUrl, `${options.channel}-linux.yml`, options),
  ]);
  const platforms: DesktopChannelDiagnostic['platforms'] = {
    linux: resolveManifestArtifact({
      baseUrl: channelBaseUrl,
      manifest: linuxManifest.manifest,
      reason: linuxManifest.reason,
      type: 'linux',
    }),
    'mac-arm': resolveManifestArtifact({
      baseUrl: channelBaseUrl,
      manifest: macManifest.manifest,
      reason: macManifest.reason,
      type: 'mac-arm',
    }),
    'mac-intel': resolveManifestArtifact({
      baseUrl: channelBaseUrl,
      manifest: macManifest.manifest,
      reason: macManifest.reason,
      type: 'mac-intel',
    }),
    windows: resolveManifestArtifact({
      baseUrl: channelBaseUrl,
      manifest: windowsManifest.manifest,
      reason: windowsManifest.reason,
      type: 'windows',
    }),
  };
  const artifacts = Object.values(platforms);
  const availableCount = artifacts.filter(({ status }) => status === 'available').length;
  const version = artifacts.find(({ version }) => version)?.version;
  const publishedAt = artifacts.find(({ publishedAt }) => publishedAt)?.publishedAt;

  return {
    channel: options.channel,
    platforms,
    publishedAt,
    status:
      availableCount === artifacts.length
        ? 'healthy'
        : availableCount === 0
          ? 'unavailable'
          : 'degraded',
    version,
  };
};
```

- [ ] **Step 4: Preserve the existing stable download helper**

Update `getStableDesktopReleaseInfoFromUpdateServer` to pass the new helper arguments and read from the `stable` channel directory while keeping its public return type and environment-variable fallback unchanged:

```ts
const channelBaseUrl = urlJoin(baseUrl, 'stable');
const fetchOptions = { fetcher: fetch, timeoutMs: 5000 };
const [mac, win, linux] = await Promise.all([
  fetchUpdateServerManifest(channelBaseUrl, `stable-mac.yml?t=${timestamp}`, fetchOptions).catch(
    () => null,
  ),
  fetchUpdateServerManifest(channelBaseUrl, `stable.yml?t=${timestamp}`, fetchOptions).catch(
    () => null,
  ),
  fetchUpdateServerManifest(channelBaseUrl, `stable-linux.yml?t=${timestamp}`, fetchOptions).catch(
    () => null,
  ),
]);
```

Pass `channelBaseUrl` rather than `baseUrl` to `normalizeManifestUrls` so relative artifact names resolve under `/stable/`. Existing callers and return fields do not change.

- [ ] **Step 5: Commit the diagnostics service**

```powershell
git add apps/server/src/services/desktopRelease/index.ts apps/server/src/services/desktopRelease/index.test.ts
git commit -m "feat(desktop): diagnose release channels and installers" -m "Constraint: Keep platform failures isolated and preserve the existing stable download API." -m "Not-tested: Deferred to the single Phase 1 verification round."
```

---

### Task 2: Expose Diagnostics Through The Admin Router

**Files:**
- Create: `packages/business-server/src/lambda-routers/admin/desktop.ts`
- Create: `packages/business-server/src/lambda-routers/admin/desktop.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/index.ts`

**Interfaces:**
- Consumes: `buildDesktopSettings(snapshot)`, `loadAppSettingsSectionSnapshot(db, 'desktop-update')`, `getDesktopReleaseDiagnostics({ baseUrl })`, and `ADMIN_CAPABILITIES.systemRead`.
- Produces: `lambdaClient.admin.desktop.getOverview.query()` returning `{ configuredChannel, configuredVersion, diagnostics }`.

- [ ] **Step 1: Add router tests with service isolation**

Create `desktop.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDesktopReleaseDiagnostics } from '@/server/services/desktopRelease';

import { adminDesktopRouter } from './desktop';
import { adminRouter } from './index';

vi.mock('@/server/services/desktopRelease', () => ({
  getDesktopReleaseDiagnostics: vi.fn(),
}));

vi.mock('../../appSettings/loader', () => ({
  loadAppSettingsSectionSnapshot: vi.fn(async () =>
    new Map([
      ['desktop.update.channel', 'stable'],
      ['desktop.update.currentVersion', '2.2.7'],
      ['desktop.update.serverUrl', 'https://releases.example.com'],
    ]),
  ),
}));

describe('adminDesktopRouter', () => {
  beforeEach(() => {
    vi.mocked(getDesktopReleaseDiagnostics).mockResolvedValue({
      baseUrl: 'https://releases.example.com',
      channels: [],
      checkedAt: '2026-07-21T00:00:00.000Z',
      configured: true,
    });
  });

  it('is registered under admin.desktop', () => {
    expect(adminRouter._def.record.desktop).toBeDefined();
  });

  it('uses the configured update server without exposing OSS credentials', async () => {
    const result = await adminDesktopRouter
      .createCaller({ serverDB: {} as any, userId: 'system-admin-user' } as any)
      .getOverview();

    expect(getDesktopReleaseDiagnostics).toHaveBeenCalledWith({
      baseUrl: 'https://releases.example.com',
    });
    expect(result).toMatchObject({
      configuredChannel: 'stable',
      configuredVersion: '2.2.7',
      diagnostics: { configured: true },
    });
    expect(result).not.toHaveProperty('desktopOssConfig');
  });
});
```

Use the same global admin-procedure mocks as neighboring admin router tests if the middleware test harness requires them; do not replace the real production permission binding in `desktop.ts`.

- [ ] **Step 2: Implement the read-only router**

Create `desktop.ts`:

```ts
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';
import { getDesktopReleaseDiagnostics } from '@/server/services/desktopRelease';

import { buildDesktopSettings } from '../../appSettings/adminReadModel';
import { loadAppSettingsSectionSnapshot } from '../../appSettings/loader';

const systemReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemRead);

export const adminDesktopRouter = router({
  getOverview: systemReadProcedure.query(async ({ ctx }) => {
    const settings = buildDesktopSettings(
      await loadAppSettingsSectionSnapshot(ctx.serverDB, 'desktop-update'),
    );
    const diagnostics = await getDesktopReleaseDiagnostics({
      baseUrl: settings.desktopUpdateConfig.serverUrl,
    });

    return {
      configuredChannel: settings.desktopUpdateConfig.channel,
      configuredVersion: settings.desktopUpdateConfig.currentVersion || null,
      diagnostics,
    };
  }),
});
```

- [ ] **Step 3: Register `admin.desktop`**

Add the import and router member to `packages/business-server/src/lambda-routers/admin/index.ts`:

```ts
import { adminDesktopRouter } from './desktop';

export const adminRouter = router({
  // existing routers
  desktop: adminDesktopRouter,
});
```

- [ ] **Step 4: Commit the admin API**

```powershell
git add packages/business-server/src/lambda-routers/admin/desktop.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts packages/business-server/src/lambda-routers/admin/index.ts
git commit -m "feat(admin): expose desktop release diagnostics" -m "Constraint: Bind diagnostics to systemRead and return no deployment credentials." -m "Not-tested: Deferred to the single Phase 1 verification round."
```

---

### Task 3: Add The Client Service And Control Center Shell

**Files:**
- Modify: `src/const/adminCacheKeys.ts`
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/services/adminCommercial.test.ts`
- Create: `src/features/Admin/DesktopControlCenter/index.tsx`
- Create: `src/features/Admin/DesktopControlCenter/types.ts`
- Create: `src/features/Admin/DesktopControlCenter/styles.ts`
- Modify: `src/features/Admin/AdminDesktopUpdatePage.tsx`
- Modify: `src/routes/(main)/admin/desktop-update/index.tsx`

**Interfaces:**
- Consumes: `lambdaClient.admin.desktop.getOverview`, `ADMIN_SETTINGS_SECTION_SWR_KEY('desktop-update')`, and React Router search parameters.
- Produces: `ADMIN_DESKTOP_OVERVIEW_SWR_KEY`, `adminCommercialService.getDesktopOverview()`, and the `DesktopControlCenter` page shell.

- [ ] **Step 1: Add the client delegation test**

Extend the existing lambda client mock in `src/services/adminCommercial.test.ts` with `admin.desktop.getOverview.query`, then add:

```ts
it('delegates desktop overview reads to admin.desktop', async () => {
  await adminCommercialService.getDesktopOverview();
  expect(lambdaClient.admin.desktop.getOverview.query).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Add the SWR key and service method**

In `src/const/adminCacheKeys.ts` add:

```ts
export const ADMIN_DESKTOP_OVERVIEW_SWR_KEY = ['admin-desktop-overview'] as const;
```

In `AdminCommercialService` add:

```ts
getDesktopOverview = async () => lambdaClient.admin.desktop.getOverview.query();
```

- [ ] **Step 3: Define URL-backed tab IDs**

Create `types.ts`:

```ts
export const DESKTOP_CONTROL_CENTER_TABS = [
  'overview',
  'distribution',
  'updates',
  'brand',
] as const;

export type DesktopControlCenterTab = (typeof DESKTOP_CONTROL_CENTER_TABS)[number];

export const resolveDesktopControlCenterTab = (
  value: null | string,
): DesktopControlCenterTab =>
  DESKTOP_CONTROL_CENTER_TABS.includes(value as DesktopControlCenterTab)
    ? (value as DesktopControlCenterTab)
    : 'overview';
```

- [ ] **Step 4: Build the page shell**

Create `index.tsx` with a shared settings request, diagnostics request and URL-backed antd `Tabs`. The shell must render one page body at a time and keep a user-selected tab in `?tab=`:

```tsx
'use client';

import { Flexbox } from '@lobehub/ui';
import { Tabs, Typography } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import {
  ADMIN_DESKTOP_OVERVIEW_SWR_KEY,
  ADMIN_SETTINGS_SECTION_SWR_KEY,
} from '@/const/adminCacheKeys';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import BrandPage from './BrandPage';
import DistributionPage from './DistributionPage';
import OverviewPage from './OverviewPage';
import UpdateSettingsPage from './UpdateSettingsPage';
import { resolveDesktopControlCenterTab } from './types';

const DesktopControlCenter = memo(() => {
  const { t } = useTranslation('subscription');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeKey = resolveDesktopControlCenterTab(searchParams.get('tab'));
  const settings = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY('desktop-update'), () =>
    adminCommercialService.getSettingsSection('desktop-update'),
  );
  const overview = useClientDataSWR(ADMIN_DESKTOP_OVERVIEW_SWR_KEY, () =>
    adminCommercialService.getDesktopOverview(),
  );

  return (
    <Flexbox gap={16} padding={24} width="100%">
      <Typography.Title level={2}>{t('admin.desktopControl.title')}</Typography.Title>
      <Tabs
        activeKey={activeKey}
        items={[
          { children: <OverviewPage resource={overview} />, key: 'overview', label: t('admin.desktopControl.tabs.overview') },
          { children: <DistributionPage resource={overview} settings={settings} />, key: 'distribution', label: t('admin.desktopControl.tabs.distribution') },
          { children: <UpdateSettingsPage settings={settings} />, key: 'updates', label: t('admin.desktopControl.tabs.updates') },
          { children: <BrandPage settings={settings} />, key: 'brand', label: t('admin.desktopControl.tabs.brand') },
        ]}
        onChange={(tab) => setSearchParams(tab === 'overview' ? {} : { tab })}
      />
    </Flexbox>
  );
});

DesktopControlCenter.displayName = 'DesktopControlCenter';
export default DesktopControlCenter;
```

Use typed resource props rather than `any` in the final implementation. Preserve an unrelated query parameter when changing tabs by cloning `searchParams` and only setting or deleting `tab`.

- [ ] **Step 5: Add stable layout styles**

Create `styles.ts` with `createStaticStyles` and CSS variables. Define a full-width status band using `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`, a platform table wrapper with horizontal overflow, and responsive padding without viewport-scaled fonts.

- [ ] **Step 6: Replace the compatibility page and thin route import**

Replace `AdminDesktopUpdatePage.tsx` with:

```tsx
export { default } from './DesktopControlCenter';
```

Update the route to import from the feature directory:

```tsx
'use client';

import DesktopControlCenter from '@/features/Admin/DesktopControlCenter';

export default DesktopControlCenter;
```

- [ ] **Step 7: Commit the shell**

```powershell
git add src/const/adminCacheKeys.ts src/services/adminCommercial.ts src/services/adminCommercial.test.ts src/features/Admin/DesktopControlCenter src/features/Admin/AdminDesktopUpdatePage.tsx 'src/routes/(main)/admin/desktop-update/index.tsx'
git commit -m "feat(admin): establish the desktop control center shell" -m "Constraint: Preserve the canonical route and existing settings source." -m "Not-tested: Deferred to the single Phase 1 verification round."
```

---

### Task 4: Implement Overview And Distribution States

**Files:**
- Create: `src/features/Admin/DesktopControlCenter/OverviewPage.tsx`
- Create: `src/features/Admin/DesktopControlCenter/DistributionPage.tsx`
- Create: `src/features/Admin/DesktopControlCenter/DesktopControlCenter.test.tsx`

**Interfaces:**
- Consumes: `getDesktopOverview()` output and the desktop settings SWR resource.
- Produces: status summary, channel health, platform artifact matrix, refresh action and public download settings surface.

- [ ] **Step 1: Add shell and state tests**

Create `DesktopControlCenter.test.tsx` with mocks for `useSearchParams`, `useClientDataSWR`, translations and `adminCommercialService`. Cover these exact behaviors:

```tsx
it('lands on overview and renders stable channel health', () => {
  render(<DesktopControlCenter />);
  expect(screen.getByRole('heading', { name: 'admin.desktopControl.title' })).toBeInTheDocument();
  expect(screen.getByText('2.3.0')).toBeInTheDocument();
  expect(screen.getByText('ComHub-2.3.0-setup.exe')).toBeInTheDocument();
});

it('renders a retry action when diagnostics fail', () => {
  renderControlCenter({ overview: { error: new Error('offline'), isLoading: false, mutate } });
  fireEvent.click(screen.getByRole('button', { name: 'admin.desktopControl.retry' }));
  expect(mutate).toHaveBeenCalledTimes(1);
});

it('renders an unconfigured state with a link to update settings', () => {
  renderControlCenter({ overviewData: { diagnostics: { configured: false, channels: [] } } });
  expect(screen.getByText('admin.desktopControl.unconfigured.title')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'admin.desktopControl.configure' }));
  expect(setSearchParams).toHaveBeenCalledWith(expect.objectContaining({ tab: 'updates' }));
});
```

Use a complete diagnostics fixture with all four platform keys so component tests exercise table stability.

- [ ] **Step 2: Implement the overview states**

`OverviewPage.tsx` must implement:

```tsx
if (resource.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;
if (resource.error) return <Result status="error" title={t('admin.desktopControl.error.title')} extra={<Button icon={<Icon icon={RefreshCw} />} onClick={() => resource.mutate()}>{t('admin.desktopControl.retry')}</Button>} />;
if (!resource.data?.diagnostics.configured) return <Empty description={t('admin.desktopControl.unconfigured.title')} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
```

For populated data, render a status band for configured version, Stable, Canary and checked time. Render separate channel sections with status tags: green `healthy`, gold `degraded`, red `unavailable`. No section should be wrapped in another card.

- [ ] **Step 3: Implement the platform matrix**

`DistributionPage.tsx` must flatten each channel's `platforms` record into rows with stable keys `${channel}:${type}` and columns for channel, platform, version, asset, size, published time and status. Use `InlineTable` if its generic contract supports these rows; otherwise use antd `Table` with `pagination={false}` inside the horizontal-overflow wrapper.

Map labels explicitly:

```ts
const PLATFORM_LABELS = {
  linux: 'Linux',
  'mac-arm': 'macOS Apple Silicon',
  'mac-intel': 'macOS Intel',
  windows: 'Windows',
} as const;
```

The download link uses an icon-only external-link button with a tooltip and `target="_blank"`; unavailable rows render their diagnostic reason without a dead link.

- [ ] **Step 4: Add the public download form below the matrix**

The distribution tab owns only `desktop.download.url` and `desktop.download.label`. It receives settings data, uses the pure diff builder from Task 5, and has one primary Save button. OSS Bucket, Endpoint, Access Key ID and path render as a read-only `Descriptions` block with a “managed by CI” alert; never render the masked secret as an editable input.

- [ ] **Step 5: Commit overview and distribution UI**

```powershell
git add src/features/Admin/DesktopControlCenter/OverviewPage.tsx src/features/Admin/DesktopControlCenter/DistributionPage.tsx src/features/Admin/DesktopControlCenter/DesktopControlCenter.test.tsx
git commit -m "feat(admin): show desktop release and installer health" -m "Constraint: Isolate platform failures and keep deployment credentials read-only." -m "Not-tested: Deferred to the single Phase 1 verification round."
```

---

### Task 5: Split Update, Distribution, And Brand Settings

**Files:**
- Create: `src/features/Admin/DesktopControlCenter/desktopSettingsForm.ts`
- Create: `src/features/Admin/DesktopControlCenter/desktopSettingsForm.test.ts`
- Create: `src/features/Admin/DesktopControlCenter/UpdateSettingsPage.tsx`
- Create: `src/features/Admin/DesktopControlCenter/BrandPage.tsx`
- Modify: `src/features/Admin/DesktopControlCenter/DistributionPage.tsx`
- Modify: `src/features/Admin/adminDesktopUpdateSettings.ts`
- Modify: `src/features/Admin/adminDesktopUpdateSettings.test.ts`

**Interfaces:**
- Consumes: `AdminSettingsSectionData<'desktop-update'>` and `DESKTOP_UPDATE_SETTING_KEYS`.
- Produces: typed initial values and three diff builders returning `Array<{ key: string; value: unknown }>`.

- [ ] **Step 1: Add pure diff tests**

Create `desktopSettingsForm.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  buildBrandUpdates,
  buildDistributionUpdates,
  buildUpdateSettingsUpdates,
  getDesktopSettingsValues,
} from './desktopSettingsForm';

const settings = {
  desktopDownloadLabel: 'Download',
  desktopDownloadUrl: 'https://downloads.example.com/app.exe',
  desktopLoginConfig: { title: 'Sign in' },
  desktopOssConfig: { bucket: 'releases' },
  desktopUpdateConfig: {
    autoCheck: true,
    channel: 'stable',
    checkInterval: 60,
    currentVersion: '2.2.7',
    releaseNotes: 'Current notes',
    serverUrl: 'https://releases.example.com',
  },
} as any;

it('returns no updates for unchanged values', () => {
  const values = getDesktopSettingsValues(settings);
  expect(buildUpdateSettingsUpdates(values, values)).toEqual([]);
  expect(buildDistributionUpdates(values, values)).toEqual([]);
  expect(buildBrandUpdates(values, values)).toEqual([]);
});

it('limits update settings saves to update keys', () => {
  const initial = getDesktopSettingsValues(settings);
  expect(
    buildUpdateSettingsUpdates(initial, {
      ...initial,
      channel: 'canary',
      serverUrl: 'https://canary.example.com',
    }),
  ).toEqual([
    { key: 'desktop.update.serverUrl', value: 'https://canary.example.com' },
    { key: 'desktop.update.channel', value: 'canary' },
  ]);
});

it('does not write read-only OSS values', () => {
  const initial = getDesktopSettingsValues(settings);
  const updates = buildDistributionUpdates(initial, {
    ...initial,
    downloadLabel: 'Get desktop',
    ossBucket: 'malicious-change',
  });
  expect(updates).toEqual([{ key: 'desktop.download.label', value: 'Get desktop' }]);
});
```

- [ ] **Step 2: Implement form types and diff builders**

Move `FormValues` and `getInitialValues` out of the old page into `desktopSettingsForm.ts` as exported `DesktopSettingsValues` and `getDesktopSettingsValues`. Implement a shared comparison helper:

```ts
type SettingUpdate = { key: string; value: unknown };

const changedText = (
  updates: SettingUpdate[],
  initial: DesktopSettingsValues,
  next: DesktopSettingsValues,
  field: keyof DesktopSettingsValues,
  key: string,
) => {
  const value = String(next[field] ?? '').trim();
  if (value !== String(initial[field] ?? '')) updates.push({ key, value });
};
```

`buildUpdateSettingsUpdates` handles update server, channel, auto check, interval, current version and release notes. `buildDistributionUpdates` handles only public download URL and label. `buildBrandUpdates` handles the six `desktop.login.*` fields. None of the builders accepts or emits `desktop.oss.*` keys.

- [ ] **Step 3: Implement the update settings tab**

`UpdateSettingsPage.tsx` renders update server URL, default channel, automatic check, interval, current version and release notes. Validate server URL as HTTPS or an explicit `http://localhost`/`http://127.0.0.1` development address. On save:

```ts
const updates = buildUpdateSettingsUpdates(initialValues, values);
if (updates.length === 0) {
  message.info(t('admin.desktopUpdate.noChanges'));
  return;
}
await adminCommercialService.setAppSettingsBatch({ updates });
await settings.mutate();
message.success(t('admin.desktopUpdate.saveSuccess'));
```

Keep values in the form when saving fails. Disable the Save button only while the request is active or settings are loading.

- [ ] **Step 4: Implement the brand tab**

`BrandPage.tsx` renders the read-only `DESKTOP_DEFAULT_BUSINESS_SERVER_URL` alert and the six login branding fields. Use `buildBrandUpdates`, the same save/error behavior, and one primary Save button. Preserve the existing logo URL help text and textarea row bounds.

- [ ] **Step 5: Complete the distribution save flow**

Use `buildDistributionUpdates` in `DistributionPage.tsx`. Refresh both the settings resource and `ADMIN_DESKTOP_OVERVIEW_SWR_KEY` after a successful save because changing the update server affects diagnostics.

- [ ] **Step 6: Reduce shared section metadata to the final ownership map**

Update `DESKTOP_SETTINGS_SECTIONS` to:

```ts
export const DESKTOP_SETTINGS_SECTIONS = [
  { key: 'overview', readonly: true, title: 'Overview' },
  { key: 'distribution', readonly: false, title: 'Installation and distribution' },
  { key: 'updates', readonly: false, title: 'Update settings' },
  { key: 'brand', readonly: false, title: 'Brand and login' },
] as const;
```

Update its test to assert the four final section keys and retain explicit key assertions for server URL, download URL, login title and OSS secret compatibility.

- [ ] **Step 7: Commit form extraction**

```powershell
git add src/features/Admin/DesktopControlCenter/desktopSettingsForm.ts src/features/Admin/DesktopControlCenter/desktopSettingsForm.test.ts src/features/Admin/DesktopControlCenter/UpdateSettingsPage.tsx src/features/Admin/DesktopControlCenter/BrandPage.tsx src/features/Admin/DesktopControlCenter/DistributionPage.tsx src/features/Admin/adminDesktopUpdateSettings.ts src/features/Admin/adminDesktopUpdateSettings.test.ts
git commit -m "refactor(admin): separate desktop setting ownership" -m "Constraint: Keep OSS credentials read-only and preserve existing setting keys." -m "Not-tested: Deferred to the single Phase 1 verification round."
```

---

### Task 6: Finalize Catalog And Localization Contracts

**Files:**
- Modify: `src/features/Admin/adminCatalog.ts`
- Modify: `src/features/Admin/adminCatalog.test.ts`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`
- Modify: `src/features/Admin/DesktopControlCenter/DesktopControlCenter.test.tsx`

**Interfaces:**
- Consumes: existing admin catalog and `subscription` namespace.
- Produces: active “Desktop Control Center” navigation and complete bilingual UI copy.

- [ ] **Step 1: Add catalog expectations**

Add to `adminCatalog.test.ts`:

```ts
it('publishes the desktop control center as an active client surface', () => {
  expect(ADMIN_CATALOG.find(({ id }) => id === 'desktop-update')).toMatchObject({
    description: '统一管理桌面安装、版本、客户端状态和更新设置',
    label: '桌面端控制中心',
    status: 'active',
  });
});
```

- [ ] **Step 2: Update the catalog entry**

Change only the `desktop-update` item:

```ts
{
  backendDomains: ['settings', 'desktop-release'],
  debugId: 'Desktop > Admin > desktop-update',
  description: '统一管理桌面安装、版本、客户端状态和更新设置',
  group: 'client-integrations',
  icon: 'desktop',
  id: 'desktop-update',
  label: '桌面端控制中心',
  owner: 'client',
  path: pathFor('desktop-update'),
  readCapability: ADMIN_CAPABILITIES.systemRead,
  segment: 'desktop-update',
  status: 'active',
  writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
}
```

- [ ] **Step 3: Add exact locale keys**

Add English values to the default source and `en-US`, and Chinese values to `zh-CN`, for these keys:

```text
admin.desktopControl.title
admin.desktopControl.tabs.overview
admin.desktopControl.tabs.distribution
admin.desktopControl.tabs.updates
admin.desktopControl.tabs.brand
admin.desktopControl.retry
admin.desktopControl.configure
admin.desktopControl.error.title
admin.desktopControl.unconfigured.title
admin.desktopControl.status.configuredVersion
admin.desktopControl.status.stable
admin.desktopControl.status.canary
admin.desktopControl.status.checkedAt
admin.desktopControl.channel.healthy
admin.desktopControl.channel.degraded
admin.desktopControl.channel.unavailable
admin.desktopControl.platform
admin.desktopControl.asset
admin.desktopControl.size
admin.desktopControl.publishedAt
admin.desktopControl.managedByCi
```

English uses concise operational wording such as `Desktop Control Center`, `Installation & Distribution`, and `Release service is not configured`. Chinese uses `桌面端控制中心`, `安装与分发`, and `尚未配置更新服务`.

- [ ] **Step 4: Remove fallback-only assertions**

Update component tests so the translation mock returns keys and assertions use exact keys. Do not depend on Chinese fallback arguments; this catches missing namespace keys.

- [ ] **Step 5: Commit catalog and copy**

```powershell
git add src/features/Admin/adminCatalog.ts src/features/Admin/adminCatalog.test.ts packages/locales/src/default/subscription.ts locales/en-US/subscription.json locales/zh-CN/subscription.json src/features/Admin/DesktopControlCenter/DesktopControlCenter.test.tsx
git commit -m "feat(admin): activate the desktop control center" -m "Constraint: Ship English and Chinese operational copy together." -m "Not-tested: Deferred to the single Phase 1 verification round."
```

---

### Task 7: Run One Verification Round And Review The Phase

**Files:**
- Review: all files changed by Tasks 1-6
- Update only when verification identifies a Phase 1 defect.

**Interfaces:**
- Consumes: all Phase 1 contracts.
- Produces: a clean, type-safe, review-ready Phase 1 branch.

- [ ] **Step 1: Format the changed source files**

Run the repository formatter only on changed TypeScript, TSX and JSON files. Do not reformat unrelated files.

```powershell
bunx prettier --write apps/server/src/services/desktopRelease/index.ts apps/server/src/services/desktopRelease/index.test.ts packages/business-server/src/lambda-routers/admin/desktop.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts packages/business-server/src/lambda-routers/admin/index.ts src/const/adminCacheKeys.ts src/services/adminCommercial.ts src/services/adminCommercial.test.ts src/features/Admin/DesktopControlCenter src/features/Admin/AdminDesktopUpdatePage.tsx src/features/Admin/adminDesktopUpdateSettings.ts src/features/Admin/adminDesktopUpdateSettings.test.ts src/features/Admin/adminCatalog.ts src/features/Admin/adminCatalog.test.ts 'src/routes/(main)/admin/desktop-update/index.tsx' packages/locales/src/default/subscription.ts locales/en-US/subscription.json locales/zh-CN/subscription.json
```

Expected: formatting completes without touching files outside the explicit arguments.

- [ ] **Step 2: Run the single focused test command**

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/desktopRelease/index.test.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts src/services/adminCommercial.test.ts src/features/Admin/adminDesktopUpdateSettings.test.ts src/features/Admin/adminCatalog.test.ts src/features/Admin/DesktopControlCenter/desktopSettingsForm.test.ts src/features/Admin/DesktopControlCenter/DesktopControlCenter.test.tsx
```

Expected: all selected test files pass in one invocation.

- [ ] **Step 3: Run type checking once**

```powershell
bun run type-check
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 4: Run static diff checks**

```powershell
git diff --check
git status --short
```

Expected: `git diff --check` emits no output; status contains only intended Phase 1 files.

- [ ] **Step 5: Review against the design**

Confirm these points directly in the diff:

- No token, secret or credential value is returned by `admin.desktop`.
- A failed Linux or macOS manifest does not hide Windows status.
- Existing `getPublicDesktopUpdate` and Electron updater inputs are unchanged.
- The route remains `/settings/admin/desktop-update`.
- Settings tabs emit only their owned setting keys.
- Loading, unconfigured, error and populated states are all reachable.
- The page has one primary action per tab and no nested cards.

- [ ] **Step 6: Commit verification fixes only if required**

If formatting or verification changed tracked files, commit those narrowly:

```powershell
git add apps/server/src/services/desktopRelease/index.ts apps/server/src/services/desktopRelease/index.test.ts packages/business-server/src/lambda-routers/admin/desktop.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts packages/business-server/src/lambda-routers/admin/index.ts src/const/adminCacheKeys.ts src/services/adminCommercial.ts src/services/adminCommercial.test.ts src/features/Admin/DesktopControlCenter src/features/Admin/AdminDesktopUpdatePage.tsx src/features/Admin/adminDesktopUpdateSettings.ts src/features/Admin/adminDesktopUpdateSettings.test.ts src/features/Admin/adminCatalog.ts src/features/Admin/adminCatalog.test.ts 'src/routes/(main)/admin/desktop-update/index.tsx' packages/locales/src/default/subscription.ts locales/en-US/subscription.json locales/zh-CN/subscription.json
git commit -m "fix(desktop): close control center verification gaps" -m "Tested: Focused desktop control center Vitest suite; bun run type-check; git diff --check."
```

If no fixes were required, do not create an empty commit.

## Phase 1 Exit Criteria

- `/settings/admin/desktop-update` renders the new control center.
- Stable and Canary diagnostics are loaded from the configured update server.
- Windows, macOS Apple Silicon, macOS Intel and Linux are reported independently.
- Unconfigured, partial outage and complete outage states are actionable.
- Update, distribution and brand settings preserve existing keys and save behavior.
- Deployment credentials remain outside browser responses and editable forms.
- Focused tests, type checking and static diff checks pass in one verification round.

## Follow-On Plans

After Phase 1 is reviewed, create separate implementation plans from the approved design for:

1. Phase 2: release records, GitHub workflow dispatch, callbacks and protected rollback.
2. Phase 3: desktop installation registration, reporting, inventory, disable and restore.
3. Phase 4: minimum version, stable rollout buckets, forced update, maintenance and offline grace.
4. Phase 5: production rollout, observability, browser QA and deployment verification.
