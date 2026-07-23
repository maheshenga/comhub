import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createModuleDraftScope, loadModuleDraft } from '../../shared/draftStorage';

import ModuleAppConfigurationPage from './ModuleAppConfigurationPage';

const { actions, moduleApps, pages, refresh, translate } = vi.hoisted(() => ({
  actions: [
    {
      id: 'archive_records',
      inputSchema: { fields: [] },
      moduleMultiplier: 1,
      name: 'Archive records',
      outputSchema: {},
      runtimeConfig: { functionKey: 'archive_records' },
      runtimeType: 'executable_action',
    },
  ],
  moduleApps: {
    upsertActions: vi.fn().mockResolvedValue(undefined),
    upsertBilling: vi.fn(),
    upsertEntitlements: vi.fn(),
    upsertPages: vi.fn().mockResolvedValue(undefined),
  },
  pages: [
    {
      actionBindings: [],
      dataSource: {},
      key: 'overview',
      layoutSchema: {},
      routePath: '/',
      sortOrder: 0,
      title: 'Overview',
      type: 'overview',
    },
  ],
  refresh: vi.fn().mockResolvedValue(undefined),
  translate: (key: string, values?: Record<string, string>) =>
    ({
      'moduleApps.admin.configuration.actions': 'Actions',
      'moduleApps.admin.configuration.pages': 'Pages',
      'moduleApps.admin.configuration.partialSave': `Saved: ${values?.accepted}. Not saved: ${values?.failed}. Your full draft is still available.`,
      'moduleApps.admin.configuration.save': 'Save configuration',
      'moduleApps.admin.configuration.saved': 'Configuration saved',
      'moduleApps.admin.configuration.title': 'Configuration',
      'moduleApps.admin.configuration.validationError': 'Review the JSON fields and try again.',
    })[key] ?? key,
}));

vi.mock('react-router', () => ({
  useOutletContext: () => ({
    app: {
      actions,
      appType: 'standard_app',
      billing: { chargeMode: 'free', defaultMultiplier: 1 },
      category: 'Operations',
      description: 'Manage records',
      displayName: 'Records',
      entitlements: [],
      icon: 'Blocks',
      id: 'app-1',
      pages,
      slug: 'records',
      status: 'draft',
    },
    refresh,
  }),
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: { moduleApps },
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: unknown) => unknown) => selector({}),
}));
vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: { userProfile: () => ({ role: 'admin' }) },
}));
vi.mock('@lobechat/types', async (importOriginal) => ({
  ...(await importOriginal()),
  hasAdminCapability: () => true,
}));
vi.mock('../../shared/useUnsavedChangesGuard', () => ({ useUnsavedChangesGuard: vi.fn() }));
vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({
    children,
    danger: _danger,
    htmlType,
    icon: _icon,
    loading: _loading,
    type: _type,
    ...props
  }: any) => (
    <button type={htmlType} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

describe('ModuleAppConfigurationPage', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(
      {},
      '',
      '/settings/admin/modules/apps/app-1/configuration?tab=advanced',
    );
    moduleApps.upsertActions.mockReset().mockResolvedValue(undefined);
    moduleApps.upsertBilling.mockReset();
    moduleApps.upsertEntitlements.mockReset();
    moduleApps.upsertPages.mockReset().mockResolvedValue(undefined);
    refresh.mockReset().mockResolvedValue(undefined);
  });

  it('saves only pages and actions for the outlet application', async () => {
    render(<ModuleAppConfigurationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Save configuration' }));

    await waitFor(() =>
      expect(moduleApps.upsertPages).toHaveBeenCalledWith({ appId: 'app-1', pages }),
    );
    expect(moduleApps.upsertActions).toHaveBeenCalledWith({ actions, appId: 'app-1' });
    expect(moduleApps.upsertEntitlements).not.toHaveBeenCalled();
    expect(moduleApps.upsertBilling).not.toHaveBeenCalled();
  });

  it('retains the complete draft and reports a partial save until a retry fully succeeds', async () => {
    moduleApps.upsertActions.mockRejectedValueOnce(new Error('actions unavailable'));
    const originalUrl = window.location.href;
    const draftScope = createModuleDraftScope('app-1', 'configuration');
    const { unmount } = render(<ModuleAppConfigurationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Save configuration' }));

    expect(
      await screen.findByText(
        'Saved: Pages. Not saved: Actions. Your full draft is still available.',
      ),
    ).toBeInTheDocument();
    expect(loadModuleDraft(draftScope)).toEqual({
      actions: [
        expect.objectContaining({
          id: 'archive_records',
          inputSchema: { fields: [] },
          inputSchemaJson: expect.stringContaining('"fields"'),
          runtimeConfig: { functionKey: 'archive_records' },
          runtimeConfigJson: expect.stringContaining('"functionKey": "archive_records"'),
          runtimeType: 'executable_action',
        }),
      ],
      pages: [
        expect.objectContaining({
          actionBindings: [],
          actionBindingsJson: '',
          dataSource: {},
          dataSourceJson: '',
          key: 'overview',
          layoutSchema: {},
          layoutSchemaJson: '',
          routePath: '/',
        }),
      ],
    });
    expect(window.location.href).toBe(originalUrl);
    expect(refresh).not.toHaveBeenCalled();

    unmount();
    render(<ModuleAppConfigurationPage />);
    expect(screen.getByDisplayValue('archive_records')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save configuration' }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(moduleApps.upsertPages).toHaveBeenCalledTimes(2);
    expect(moduleApps.upsertActions).toHaveBeenCalledTimes(2);
    expect(moduleApps.upsertPages).toHaveBeenLastCalledWith({ appId: 'app-1', pages });
    expect(moduleApps.upsertActions).toHaveBeenLastCalledWith({ actions, appId: 'app-1' });
    expect(loadModuleDraft(draftScope)).toBeNull();
    expect(screen.getByText('Configuration saved')).toBeInTheDocument();
    expect(window.location.href).toBe(originalUrl);
  });

  it('does not persist sensitive identifiers embedded in action runtime JSON', async () => {
    const draftScope = createModuleDraftScope('app-1', 'configuration');
    render(<ModuleAppConfigurationPage />);

    fireEvent.change(screen.getByLabelText('moduleApps.admin.configuration.runtimeConfigJson'), {
      target: { value: '{"paymentRecipientId":"recipient-1"}' },
    });

    await waitFor(() => expect(loadModuleDraft(draftScope)).toBeNull());
  });

  it('shows localized validation feedback without mutating when action JSON is invalid', async () => {
    render(<ModuleAppConfigurationPage />);
    fireEvent.change(screen.getByLabelText('moduleApps.admin.configuration.runtimeConfigJson'), {
      target: { value: '{invalid' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save configuration' }));

    expect(await screen.findByText('Review the JSON fields and try again.')).toBeInTheDocument();
    expect(moduleApps.upsertPages).not.toHaveBeenCalled();
    expect(moduleApps.upsertActions).not.toHaveBeenCalled();
  });
});
