import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createModuleDraftScope, loadModuleDraft } from '../../shared/draftStorage';

import ModuleAppEntitlementsPage from './ModuleAppEntitlementsPage';

const { billing, entitlements, moduleApps, refresh, roleState, translate } = vi.hoisted(() => ({
  billing: {
    chargeMode: 'free',
    defaultMultiplier: 1,
    externalApiCostCredits: 0,
    failureFixedFeePolicy: 'do_not_charge',
    fixedServiceFeeCredits: 0,
  },
  entitlements: [
    {
      discountPercent: 0,
      freeQuotaCredits: 10,
      installable: true,
      plan: 'pro',
      runnable: true,
      visible: true,
    },
  ],
  moduleApps: {
    upsertActions: vi.fn(),
    upsertBilling: vi.fn().mockResolvedValue(undefined),
    upsertEntitlements: vi.fn().mockResolvedValue(undefined),
    upsertPages: vi.fn(),
  },
  refresh: vi.fn().mockResolvedValue(undefined),
  roleState: { canWrite: true },
  translate: (key: string, values?: Record<string, string>) =>
    ({
      'moduleApps.admin.entitlements.billing': 'Billing',
      'moduleApps.admin.entitlements.entitlements': 'Plan entitlements',
      'moduleApps.admin.entitlements.partialSave': `Saved: ${values?.accepted}. Not saved: ${values?.failed}. Your full draft is still available.`,
      'moduleApps.admin.entitlements.save': 'Save entitlements',
      'moduleApps.admin.entitlements.saved': 'Entitlements saved',
      'moduleApps.admin.entitlements.title': 'Entitlements',
    })[key] ?? key,
}));

vi.mock('react-router', () => ({
  useOutletContext: () => ({
    app: {
      actions: [],
      appType: 'standard_app',
      billing,
      category: 'Operations',
      description: 'Manage records',
      displayName: 'Records',
      entitlements,
      icon: 'Blocks',
      id: 'app-1',
      pages: [],
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
  hasAdminCapability: () => roleState.canWrite,
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
  Switch: (props: any) => <input type="checkbox" {...props} />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

describe('ModuleAppEntitlementsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(
      {},
      '',
      '/settings/admin/modules/apps/app-1/entitlements?view=plans',
    );
    roleState.canWrite = true;
    moduleApps.upsertActions.mockReset();
    moduleApps.upsertBilling.mockReset().mockResolvedValue(undefined);
    moduleApps.upsertEntitlements.mockReset().mockResolvedValue(undefined);
    moduleApps.upsertPages.mockReset();
    refresh.mockReset().mockResolvedValue(undefined);
  });

  it('saves only entitlements and billing when finance write is available', async () => {
    render(<ModuleAppEntitlementsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Save entitlements' }));

    await waitFor(() =>
      expect(moduleApps.upsertEntitlements).toHaveBeenCalledWith({ appId: 'app-1', entitlements }),
    );
    expect(moduleApps.upsertBilling).toHaveBeenCalledWith({ appId: 'app-1', billing });
    expect(moduleApps.upsertPages).not.toHaveBeenCalled();
    expect(moduleApps.upsertActions).not.toHaveBeenCalled();
  });

  it('retains the complete draft and reports a partial save until a retry fully succeeds', async () => {
    moduleApps.upsertBilling.mockRejectedValueOnce(new Error('billing unavailable'));
    const originalUrl = window.location.href;
    const draftScope = createModuleDraftScope('app-1', 'entitlements');
    const { unmount } = render(<ModuleAppEntitlementsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Save entitlements' }));

    expect(
      await screen.findByText(
        'Saved: Plan entitlements. Not saved: Billing. Your full draft is still available.',
      ),
    ).toBeInTheDocument();
    expect(loadModuleDraft(draftScope)).toMatchObject({ billing, entitlements });
    expect(window.location.href).toBe(originalUrl);
    expect(refresh).not.toHaveBeenCalled();

    unmount();
    render(<ModuleAppEntitlementsPage />);
    expect(screen.getByDisplayValue('pro')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save entitlements' }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(moduleApps.upsertEntitlements).toHaveBeenCalledTimes(2);
    expect(moduleApps.upsertBilling).toHaveBeenCalledTimes(2);
    expect(loadModuleDraft(draftScope)).toBeNull();
    expect(screen.getByText('Entitlements saved')).toBeInTheDocument();
    expect(window.location.href).toBe(originalUrl);
  });

  it('continues to billing and reports it accepted when entitlements fail first', async () => {
    moduleApps.upsertEntitlements.mockRejectedValueOnce(new Error('entitlements unavailable'));
    render(<ModuleAppEntitlementsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Save entitlements' }));

    expect(
      await screen.findByText(
        'Saved: Billing. Not saved: Plan entitlements. Your full draft is still available.',
      ),
    ).toBeInTheDocument();
    expect(moduleApps.upsertEntitlements).toHaveBeenCalledTimes(1);
    expect(moduleApps.upsertBilling).toHaveBeenCalledTimes(1);
    expect(loadModuleDraft(createModuleDraftScope('app-1', 'entitlements'))).toMatchObject({
      billing,
      entitlements,
    });
  });

  it('renders entitlement values without Save when finance write is unavailable', () => {
    roleState.canWrite = false;

    render(<ModuleAppEntitlementsPage />);

    expect(screen.getByDisplayValue('pro')).toBeDisabled();
    expect(screen.getByText('Plan entitlements')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save entitlements' })).not.toBeInTheDocument();
    expect(moduleApps.upsertEntitlements).not.toHaveBeenCalled();
    expect(moduleApps.upsertBilling).not.toHaveBeenCalled();
  });
});
