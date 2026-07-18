import { ConfigProvider } from '@lobehub/ui';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as m from 'motion/react-m';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MOBILE_CONFIG, type MobilePublicConfigV1 } from '@/const/mobileConfig';
import { adminCommercialService } from '@/services/adminCommercial';
import { discoverService } from '@/services/discover';

import AdminMobileSettingsPage from './AdminMobileSettingsPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: {
    getAiProviderModelCatalogDiagnostics: vi.fn(),
    getMobileSettings: vi.fn(),
    moduleApps: {
      list: vi.fn(),
    },
    saveMobileSettings: vi.fn(),
  },
}));

vi.mock('@/services/discover', () => ({
  discoverService: {
    getAssistantList: vi.fn(),
  },
}));

const mobileConfig = (patch: Partial<MobilePublicConfigV1> = {}): MobilePublicConfigV1 => ({
  ...DEFAULT_MOBILE_CONFIG,
  ...patch,
  applications: {
    ...DEFAULT_MOBILE_CONFIG.applications,
    ...patch.applications,
  },
  brand: {
    ...DEFAULT_MOBILE_CONFIG.brand,
    ...patch.brand,
  },
  design: {
    ...DEFAULT_MOBILE_CONFIG.design,
    ...patch.design,
  },
  discover: {
    ...DEFAULT_MOBILE_CONFIG.discover,
    ...patch.discover,
  },
  navigation: {
    ...DEFAULT_MOBILE_CONFIG.navigation,
    ...patch.navigation,
  },
});

const setupLoaders = (config: MobilePublicConfigV1 = mobileConfig()) => {
  vi.mocked(adminCommercialService.getMobileSettings).mockResolvedValue(config);
  vi.mocked(adminCommercialService.getAiProviderModelCatalogDiagnostics).mockResolvedValue({
    enabledModels: [
      {
        displayName: 'GPT 4.1',
        modelId: 'gpt-4.1',
        modelType: 'chat',
        provider: 'openai',
      },
    ],
  } as any);
  vi.mocked(adminCommercialService.moduleApps.list).mockResolvedValue({
    items: [
      {
        appId: 'design-kit',
        displayName: 'Design Kit',
        name: 'Design Kit',
        status: 'published',
      },
    ],
  } as any);
  vi.mocked(discoverService.getAssistantList).mockResolvedValue({
    currentPage: 1,
    items: [
      {
        author: 'ComHub',
        createdAt: '2026-01-01',
        description: 'Planning assistant',
        homepage: '',
        identifier: 'agent-alpha',
        knowledgeCount: 0,
        pluginCount: 0,
        status: 'published',
        title: 'Alpha Assistant',
        tokenUsage: 0,
      },
    ],
    pageSize: 20,
    totalCount: 1,
    totalPages: 1,
  } as any);
};

const renderPage = (ui: ReactElement = <AdminMobileSettingsPage />) =>
  render(<ConfigProvider motion={m}>{ui}</ConfigProvider>);

const switchByLabel = (label: string) => screen.getAllByLabelText(label)[0];

describe('AdminMobileSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupLoaders();
    vi.mocked(adminCommercialService.saveMobileSettings).mockImplementation(
      async (config) => config as any,
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('loads mobile settings, normalizes values, and renders the live preview', async () => {
    setupLoaders(
      mobileConfig({
        brand: { displayName: 'ComHub App', logoUrl: '/brand/mobile.png' },
        navigation: {
          items: [
            {
              icon: 'not-allowed',
              id: 'slot-1',
              label: 'Chat',
              order: 1,
              path: 'https://external.example.com',
              visible: true,
            },
          ] as any,
        },
      }),
    );

    renderPage();

    expect(await screen.findByDisplayValue('ComHub App')).toBeInTheDocument();
    expect(screen.getByLabelText('Tab slot-1 path')).toHaveValue('/');
    expect(screen.getByTestId('mobile-config-preview')).toHaveTextContent('ComHub App');
    expect(screen.getByTestId('mobile-config-preview')).toHaveTextContent('Visible tabs: 4');
    expect(adminCommercialService.getMobileSettings).toHaveBeenCalledTimes(1);
  });

  it('tracks dirty state, edits bottom navigation fields, validates icon/path choices, and reorders tabs', async () => {
    renderPage();

    await screen.findByLabelText('Brand display name');
    const saveButton = screen.getByRole('button', { name: 'Save mobile settings' });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Tab slot-1 label'), { target: { value: 'Chats' } });
    fireEvent.change(screen.getByLabelText('Tab slot-1 path'), { target: { value: '/chat' } });
    fireEvent.change(screen.getByLabelText('Tab slot-1 icon'), {
      target: { value: 'message-square-more' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move slot-1 down' }));

    expect(saveButton).toBeEnabled();
    const bottomNav = screen.getByRole('region', { name: 'Bottom Navigation' });
    expect(within(bottomNav).getAllByLabelText(/Tab slot-/)[0]).toHaveAccessibleName(
      'Tab slot-2 label',
    );

    fireEvent.change(screen.getByLabelText('Tab slot-1 path'), {
      target: { value: 'https://evil.example.com' },
    });
    expect(
      await screen.findByText('Visible tab paths must be internal and unique.'),
    ).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });

  it('blocks saves when fewer than two tabs are visible', async () => {
    renderPage();

    await screen.findAllByLabelText('Tab slot-1 visible');

    fireEvent.click(switchByLabel('Tab slot-2 visible'));
    fireEvent.click(switchByLabel('Tab slot-3 visible'));
    fireEvent.click(switchByLabel('Tab slot-4 visible'));

    expect(
      await screen.findByText('At least two bottom tabs must be visible.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save mobile settings' })).toBeDisabled();
  });

  it('uses controlled assistant, model, and published module app selectors', async () => {
    renderPage();

    await screen.findByRole('option', { name: 'Alpha Assistant' });

    expect(discoverService.getAssistantList).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 20, source: 'new' }),
    );
    expect(adminCommercialService.getAiProviderModelCatalogDiagnostics).toHaveBeenCalledTimes(1);
    expect(adminCommercialService.moduleApps.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published' }),
    );

    fireEvent.change(screen.getByLabelText('Featured assistant'), {
      target: { value: 'agent-alpha' },
    });
    fireEvent.change(screen.getByLabelText('Recommended model'), {
      target: { value: 'openai/gpt-4.1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add featured assistant' }));
    fireEvent.change(screen.getByLabelText('Featured module app'), {
      target: { value: 'design-kit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add module app' }));

    expect(screen.getAllByText('Alpha Assistant').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Design Kit').length).toBeGreaterThan(1);
  });

  it('restores normalized defaults after confirmation', async () => {
    renderPage();

    await screen.findByLabelText('Brand display name');
    fireEvent.change(screen.getByLabelText('Brand display name'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults' }));

    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByLabelText('Brand display name')).toHaveValue('');
    expect(screen.getByTestId('mobile-config-preview')).toHaveTextContent('Visible tabs: 4');
  });

  it('saves the normalized config once and reports success or failure', async () => {
    renderPage();

    await screen.findByLabelText('Brand display name');
    fireEvent.change(screen.getByLabelText('Brand display name'), {
      target: { value: 'ComHub App' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save mobile settings' }));

    await waitFor(() => {
      expect(adminCommercialService.saveMobileSettings).toHaveBeenCalledTimes(1);
      expect(adminCommercialService.saveMobileSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          brand: expect.objectContaining({ displayName: 'ComHub App' }),
          version: 1,
        }),
      );
    });
    expect(await screen.findByText('Mobile settings saved.')).toBeInTheDocument();

    vi.mocked(adminCommercialService.saveMobileSettings).mockRejectedValueOnce(new Error('nope'));
    fireEvent.change(screen.getByLabelText('Brand display name'), {
      target: { value: 'ComHub Two' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Save mobile settings/ }));

    expect(await screen.findByText('Failed to save mobile settings.')).toBeInTheDocument();
  });
});
