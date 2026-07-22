import { ConfigProvider } from '@lobehub/ui';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as m from 'motion/react-m';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchParams } from 'react-router';

import {
  ADMIN_DESKTOP_OVERVIEW_SWR_KEY,
  ADMIN_SETTINGS_SECTION_SWR_KEY,
} from '@/const/adminCacheKeys';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import DesktopControlCenter from './index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router', () => ({
  useSearchParams: vi.fn(),
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: vi.fn(),
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: {
    archiveBuildProfile: vi.fn(),
    completeBuildAssetUpload: vi.fn(),
    createBuildAssetUpload: vi.fn(),
    createDesktopRelease: vi.fn(),
    getBuildProfile: vi.fn(),
    getDesktopOverview: vi.fn(),
    getSettingsSection: vi.fn(),
    listBuildProfiles: vi.fn(),
    listDesktopReleases: vi.fn(),
    saveBuildProfileDraft: vi.fn(),
    setAppSettingsBatch: vi.fn(),
  },
}));

const availableArtifact = (type: 'linux' | 'mac-arm' | 'mac-intel' | 'windows') => ({
  assetName:
    type === 'windows'
      ? 'ComHub-2.3.0-setup.exe'
      : type === 'linux'
        ? 'ComHub-2.3.0.AppImage'
        : `ComHub-2.3.0-${type}.dmg`,
  publishedAt: '2026-07-21T00:00:00.000Z',
  size: 1024 * 1024,
  status: 'available' as const,
  type,
  url: `https://releases.example.com/${type}`,
  version: '2.3.0',
});

const overviewData = {
  configuredChannel: 'stable',
  configuredVersion: '2.3.0',
  diagnostics: {
    baseUrl: 'https://releases.example.com',
    channels: [
      {
        channel: 'stable' as const,
        platforms: {
          'linux': availableArtifact('linux'),
          'mac-arm': availableArtifact('mac-arm'),
          'mac-intel': availableArtifact('mac-intel'),
          'windows': availableArtifact('windows'),
        },
        publishedAt: '2026-07-21T00:00:00.000Z',
        status: 'healthy' as const,
        version: '2.3.0',
      },
      {
        channel: 'canary' as const,
        platforms: {
          'linux': availableArtifact('linux'),
          'mac-arm': availableArtifact('mac-arm'),
          'mac-intel': availableArtifact('mac-intel'),
          'windows': availableArtifact('windows'),
        },
        publishedAt: '2026-07-21T00:00:00.000Z',
        status: 'healthy' as const,
        version: '2.3.0',
      },
    ],
    checkedAt: '2026-07-21T00:00:00.000Z',
    configured: true,
  },
};

const defaultSettingsData = {
  desktopDownloadLabel: 'Download desktop',
  desktopDownloadUrl: 'https://downloads.example.com',
  desktopLoginConfig: {},
  desktopOssConfig: {
    bucket: 'releases',
    credentialsConfigured: true,
    endpoint: 'oss.example.com',
    path: 'releases',
  },
  desktopUpdateConfig: {
    autoCheck: true,
    channel: 'stable',
    checkInterval: 60,
    currentVersion: '2.3.0',
    releaseNotes: '',
    serverUrl: 'https://releases.example.com',
  },
  section: 'desktop-update' as const,
};

const setSearchParams = vi.fn();
const overviewMutate = vi.fn().mockResolvedValue(undefined);
const settingsMutate = vi.fn().mockResolvedValue(undefined);
const profilesMutate = vi.fn().mockResolvedValue(undefined);
const releasesMutate = vi.fn().mockResolvedValue(undefined);
let setSettingsData: (data: typeof defaultSettingsData) => void;

const completeAssets = {
  appPreview: {
    contentType: 'image/png',
    key: 'desktop-build-assets/profile/app-preview.png',
    kind: 'appPreview',
    sha256: 'a'.repeat(64),
    size: 1024,
  },
  nsisHeader: {
    contentType: 'image/bmp',
    key: 'desktop-build-assets/profile/header.bmp',
    kind: 'nsisHeader',
    sha256: 'b'.repeat(64),
    size: 1024,
  },
  nsisSidebar: {
    contentType: 'image/bmp',
    key: 'desktop-build-assets/profile/sidebar.bmp',
    kind: 'nsisSidebar',
    sha256: 'c'.repeat(64),
    size: 1024,
  },
  windowsIcon: {
    contentType: 'image/x-icon',
    key: 'desktop-build-assets/profile/icon.ico',
    kind: 'windowsIcon',
    sha256: 'd'.repeat(64),
    size: 1024,
  },
};

const buildProfileData = {
  currentDraft: {
    assetManifest: completeAssets,
    id: 'revision-1',
    payload: {
      applicationId: 'com.qingyou.comhub',
      applicationName: 'ComHub',
      description: 'ComHub desktop',
      executableName: 'ComHub',
      homepage: 'https://chat.qingyouai.com',
      installerArtifactName: '${productName}-${version}-${arch}.${ext}',
      protocolScheme: 'comhub',
      publisher: 'Qingyou',
      shortcutName: 'ComHub',
      uninstallDisplayName: 'ComHub',
    },
    state: 'draft',
  },
  currentRevision: 1,
  id: '00000000-0000-4000-8000-000000000001',
  identityLocked: false,
  name: 'ComHub',
};

const releaseData = [
  {
    actorUserId: 'admin-1',
    artifacts: [
      { fileName: 'ComHub-2.4.0-x64.exe', storageKey: 'desktop-build-releases/setup.exe' },
    ],
    channel: 'canary',
    createdAt: '2026-07-21T00:00:00.000Z',
    errorSummary: null,
    frozenRevisionId: 'revision-1',
    id: 'release-1',
    profileId: buildProfileData.id,
    status: 'queued',
    version: '2.4.0-canary.1',
    workflowRunUrl: 'https://github.com/maheshenga/comhub/actions/runs/1',
  },
];

const useSettingsTestResource = (initialData: typeof defaultSettingsData) => {
  const [data, setData] = useState(initialData);
  setSettingsData = setData;

  return {
    data,
    error: undefined,
    isLoading: false,
    mutate: settingsMutate,
  };
};

const renderControlCenter = (options?: {
  buildProfileData?: typeof buildProfileData;
  overview?: Record<string, unknown>;
  overviewData?: typeof overviewData;
  search?: string;
  settingsData?: typeof defaultSettingsData;
}) => {
  vi.mocked(useSearchParams).mockReturnValue([
    new URLSearchParams(options?.search),
    setSearchParams,
  ] as any);
  vi.mocked(useClientDataSWR).mockImplementation(((key: unknown) => {
    if (key === ADMIN_DESKTOP_OVERVIEW_SWR_KEY) {
      return {
        data: options?.overviewData ?? overviewData,
        error: undefined,
        isLoading: false,
        mutate: overviewMutate,
        ...options?.overview,
      };
    }
    if (JSON.stringify(key) === JSON.stringify(ADMIN_SETTINGS_SECTION_SWR_KEY('desktop-update'))) {
      return useSettingsTestResource(options?.settingsData ?? defaultSettingsData);
    }
    if (JSON.stringify(key) === JSON.stringify(['admin-desktop-build-profiles'])) {
      return {
        data: { items: [options?.buildProfileData ?? buildProfileData], nextCursor: undefined },
        error: undefined,
        isLoading: false,
        mutate: profilesMutate,
      };
    }
    if (JSON.stringify(key) === JSON.stringify(['admin-desktop-releases', buildProfileData.id])) {
      return {
        data: releaseData,
        error: undefined,
        isLoading: false,
        mutate: releasesMutate,
      };
    }
    throw new Error(`Unexpected SWR key: ${JSON.stringify(key)}`);
  }) as any);

  const view = render(
    <ConfigProvider motion={m}>
      <DesktopControlCenter />
    </ConfigProvider>,
  );

  return {
    ...view,
    updateSettingsData: (data: typeof defaultSettingsData) => act(() => setSettingsData(data)),
  };
};

describe('DesktopControlCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminCommercialService.setAppSettingsBatch).mockResolvedValue({ ok: true } as any);
    vi.mocked(adminCommercialService.saveBuildProfileDraft).mockResolvedValue({
      profileId: buildProfileData.id,
      revision: 2,
      revisionId: 'revision-2',
    } as any);
    vi.mocked(adminCommercialService.createDesktopRelease).mockResolvedValue(releaseData[0] as any);
  });

  it('lands on overview and renders stable channel health', () => {
    renderControlCenter();

    expect(screen.getByRole('heading', { name: 'admin.desktopControl.title' })).toBeInTheDocument();
    expect(screen.getAllByText('2.3.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ComHub-2.3.0-setup.exe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('admin.desktopControl.channel.healthy').length).toBeGreaterThan(0);
  });

  it('renders a retry action when diagnostics fail', () => {
    renderControlCenter({
      overview: { data: undefined, error: new Error('offline'), isLoading: false },
    });

    fireEvent.click(screen.getByRole('button', { name: 'admin.desktopControl.retry' }));
    expect(overviewMutate).toHaveBeenCalledTimes(1);
  });

  it('renders an unconfigured state with a link to update settings', () => {
    renderControlCenter({
      overviewData: {
        ...overviewData,
        diagnostics: { ...overviewData.diagnostics, channels: [], configured: false },
      },
    });

    expect(screen.getByText('admin.desktopControl.unconfigured.title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'admin.desktopControl.configure' }));
    const nextSearchParams = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(nextSearchParams.get('tab')).toBe('updates');
  });

  it('preserves unrelated query parameters when switching tabs', () => {
    renderControlCenter({ search: 'source=admin-menu' });

    fireEvent.click(screen.getByRole('tab', { name: 'admin.desktopControl.tabs.brand' }));
    const nextSearchParams = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(nextSearchParams.get('source')).toBe('admin-menu');
    expect(nextSearchParams.get('tab')).toBe('brand');
  });

  it('delegates cache refresh to the settings service after update settings are saved', async () => {
    renderControlCenter({ search: 'tab=updates' });

    fireEvent.change(screen.getByLabelText('admin.desktopUpdate.serverUrl'), {
      target: { value: 'https://new-releases.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'admin.desktopUpdate.save' }));

    await waitFor(() => {
      expect(adminCommercialService.setAppSettingsBatch).toHaveBeenCalledWith({
        updates: [
          {
            key: 'desktop.update.serverUrl',
            value: 'https://new-releases.example.com',
          },
        ],
      });
    });
    expect(settingsMutate).not.toHaveBeenCalled();
    expect(overviewMutate).not.toHaveBeenCalled();
  });

  it('keeps update settings input after a save failure', async () => {
    vi.mocked(adminCommercialService.setAppSettingsBatch).mockRejectedValueOnce(
      new Error('offline'),
    );
    renderControlCenter({ search: 'tab=updates' });

    const serverUrlInput = screen.getByLabelText('admin.desktopUpdate.serverUrl');
    fireEvent.change(serverUrlInput, {
      target: { value: 'https://retry-releases.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'admin.desktopUpdate.save' }));

    await waitFor(() => {
      expect(adminCommercialService.setAppSettingsBatch).toHaveBeenCalledTimes(1);
    });
    expect(serverUrlInput).toHaveValue('https://retry-releases.example.com');
  });

  it('keeps unsaved update settings when SWR data revalidates', () => {
    const options = { search: 'tab=updates', settingsData: defaultSettingsData };
    const view = renderControlCenter(options);
    const serverUrlInput = screen.getByLabelText('admin.desktopUpdate.serverUrl');

    fireEvent.change(serverUrlInput, {
      target: { value: 'https://draft-releases.example.com' },
    });
    view.updateSettingsData({
      ...defaultSettingsData,
      desktopUpdateConfig: {
        ...defaultSettingsData.desktopUpdateConfig,
        serverUrl: 'https://externally-updated.example.com',
      },
    });

    expect(serverUrlInput).toHaveValue('https://draft-releases.example.com');
  });

  it('syncs untouched fields and saves only edited fields after SWR data revalidates', async () => {
    const options = { search: 'tab=updates', settingsData: defaultSettingsData };
    const view = renderControlCenter(options);
    const releaseNotesInput = screen.getByLabelText('admin.desktopUpdate.releaseNotes');

    fireEvent.change(releaseNotesInput, { target: { value: 'Draft release notes' } });
    view.updateSettingsData({
      ...defaultSettingsData,
      desktopUpdateConfig: {
        ...defaultSettingsData.desktopUpdateConfig,
        currentVersion: '2.4.0',
      },
    });

    expect(screen.getByLabelText('admin.desktopUpdate.currentVersion')).toHaveValue('2.4.0');
    expect(releaseNotesInput).toHaveValue('Draft release notes');

    fireEvent.click(screen.getByRole('button', { name: 'admin.desktopUpdate.save' }));

    await waitFor(() => {
      expect(adminCommercialService.setAppSettingsBatch).toHaveBeenCalledWith({
        updates: [{ key: 'desktop.update.releaseNotes', value: 'Draft release notes' }],
      });
    });
  });

  it('stops protecting a field after the user restores its server value', () => {
    const options = { search: 'tab=updates', settingsData: defaultSettingsData };
    const view = renderControlCenter(options);
    const serverUrlInput = screen.getByLabelText('admin.desktopUpdate.serverUrl');

    fireEvent.change(serverUrlInput, { target: { value: 'https://draft.example.com' } });
    fireEvent.change(serverUrlInput, {
      target: { value: defaultSettingsData.desktopUpdateConfig.serverUrl },
    });
    view.updateSettingsData({
      ...defaultSettingsData,
      desktopUpdateConfig: {
        ...defaultSettingsData.desktopUpdateConfig,
        serverUrl: 'https://externally-updated.example.com',
      },
    });

    expect(serverUrlInput).toHaveValue('https://externally-updated.example.com');
  });

  it('does not revalidate resources twice after distribution settings are saved', async () => {
    renderControlCenter({ search: 'tab=distribution' });

    fireEvent.change(screen.getByLabelText('admin.desktopUpdate.downloadLabel'), {
      target: { value: 'Get desktop' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'admin.desktopUpdate.save' }));

    await waitFor(() => {
      expect(adminCommercialService.setAppSettingsBatch).toHaveBeenCalledTimes(1);
    });
    expect(settingsMutate).not.toHaveBeenCalled();
    expect(overviewMutate).not.toHaveBeenCalled();
  });

  it('saves a draft without creating a release', async () => {
    renderControlCenter({ search: 'tab=build-profile' });

    fireEvent.change(screen.getByLabelText('admin.desktopBuild.applicationName'), {
      target: { value: 'ComHub Pro' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'admin.desktopBuild.saveDraft' }));

    await waitFor(() => {
      expect(adminCommercialService.saveBuildProfileDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ComHub Pro',
          profileId: buildProfileData.id,
          payload: expect.objectContaining({ applicationName: 'ComHub Pro' }),
        }),
      );
    });
    expect(adminCommercialService.createDesktopRelease).not.toHaveBeenCalled();
  });

  it('requires confirmation before creating a build', () => {
    renderControlCenter({ search: 'tab=build-profile' });

    fireEvent.click(screen.getByRole('button', { name: 'admin.desktopBuild.createBuild' }));

    expect(screen.getByRole('dialog', { name: 'admin.desktopBuild.release.title' })).toBeVisible();
  });

  it('does not save or release a build profile until Windows assets are complete', () => {
    renderControlCenter({
      buildProfileData: {
        ...buildProfileData,
        currentDraft: {
          ...buildProfileData.currentDraft,
          assetManifest: { appPreview: completeAssets.appPreview } as any,
        },
      },
      search: 'tab=build-profile',
    });

    expect(screen.getByRole('button', { name: 'admin.desktopBuild.saveDraft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'admin.desktopBuild.createBuild' })).toBeDisabled();
  });
});
