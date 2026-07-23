import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const moduleApps = vi.hoisted(() => ({
  assignPublisher: vi.fn(),
  createPublisher: vi.fn(),
  listPublishers: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  suspendPublisher: vi.fn(),
  verifyPublisher: vi.fn(),
}));
const state = vi.hoisted(() => ({
  data: { items: [], nextCursor: null } as { items: any[]; nextCursor: null | string },
  role: 'finance_admin',
}));

vi.mock('@lobechat/types', () => ({
  ADMIN_CAPABILITIES: { financeRead: 'finance.read', moduleAppWrite: 'moduleApp.write' },
  hasAdminCapability: (role: string, capability: string) =>
    role === 'admin' || capability === 'finance.read',
}));
vi.mock('@/services/adminCommercial', () => ({ adminCommercialService: { moduleApps } }));
vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: state.role } }),
}));
vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: { userProfile: (state: { user: unknown }) => state.user },
}));
vi.mock('@/libs/swr', () => ({
  mutate: vi.fn(),
  useClientDataSWR: (_key: unknown, fetcher: () => Promise<unknown>) => {
    void fetcher();
    return { data: state.data, error: undefined, isLoading: false };
  },
}));
vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Modal: ({ children, okButtonProps, okText, onOk, open }: any) =>
    open ? (
      <div>
        {children}
        <button disabled={okButtonProps?.disabled} type="button" onClick={onOk}>
          {okText}
        </button>
      </div>
    ) : null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import ModulePublishersPage from './ModulePublishersPage';

describe('ModulePublishersPage', () => {
  it('lets finance readers list publishers but hides every governance control', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/settings/admin/modules/publishers?status=verified&userId=user-1&cursor=cursor-1',
        ]}
      >
        <ModulePublishersPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(moduleApps.listPublishers).toHaveBeenCalledWith({
        cursor: 'cursor-1',
        limit: 25,
        status: 'verified',
        userId: 'user-1',
      }),
    );
    expect(screen.getByTestId('module-publishers-page')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'moduleApps.admin.publishers.create' })).toBeNull();
    expect(screen.queryByText('moduleApps.admin.publishers.assign')).toBeNull();
    expect(moduleApps.createPublisher).not.toHaveBeenCalled();
    expect(moduleApps.verifyPublisher).not.toHaveBeenCalled();
    expect(moduleApps.suspendPublisher).not.toHaveBeenCalled();
    expect(moduleApps.assignPublisher).not.toHaveBeenCalled();
  });

  it('runs the publisher lifecycle and invalidates only publisher and assigned app data', async () => {
    state.role = 'admin';
    state.data = {
      items: [
        {
          appCount: 0,
          displayName: 'Studio',
          id: 'publisher-1',
          status: 'pending',
          userId: 'user-1',
        },
      ],
      nextCursor: null,
    };

    render(
      <MemoryRouter initialEntries={['/settings/admin/modules/publishers']}>
        <ModulePublishersPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.admin.publishers.create' }));
    fireEvent.change(screen.getByLabelText('moduleApps.admin.publishers.displayName'), {
      target: { value: 'New Studio' },
    });
    fireEvent.change(screen.getByLabelText('moduleApps.admin.publishers.ownerUserId'), {
      target: { value: 'owner-2' },
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'moduleApps.admin.publishers.create' })[1],
    );
    await waitFor(() =>
      expect(moduleApps.createPublisher).toHaveBeenCalledWith({
        displayName: 'New Studio',
        recipientMask: undefined,
        userId: 'owner-2',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.admin.publishers.verify' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'moduleApps.admin.publishers.verify' })[1],
    );
    await waitFor(() =>
      expect(moduleApps.verifyPublisher).toHaveBeenCalledWith({
        publisherId: 'publisher-1',
        verificationMetadata: {},
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.admin.publishers.suspend' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'moduleApps.admin.publishers.suspend' })[1],
    );
    await waitFor(() =>
      expect(moduleApps.suspendPublisher).toHaveBeenCalledWith({ publisherId: 'publisher-1' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.admin.publishers.assign' }));
    fireEvent.change(screen.getByLabelText('moduleApps.admin.publishers.appId'), {
      target: { value: 'app-1' },
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'moduleApps.admin.publishers.assign' })[1],
    );
    await waitFor(() =>
      expect(moduleApps.assignPublisher).toHaveBeenCalledWith({
        appId: 'app-1',
        publisherId: 'publisher-1',
      }),
    );
  });
});
