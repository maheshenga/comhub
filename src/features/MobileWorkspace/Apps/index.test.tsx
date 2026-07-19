import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MobileAppsPage from './index';

const navigate = vi.fn();
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) => {
      const labels: Record<string, string> = {
        'mobile.apps.browseMarket': 'Browse app market',
        'mobile.apps.builtIn': 'Built-in apps',
        'mobile.apps.empty': 'No available module apps',
        'mobile.apps.error': 'Unable to load module apps',
        'mobile.apps.module': 'Module apps',
        'mobile.apps.open': `Open ${values?.name ?? ''}`,
        'mobile.apps.retry': 'Retry module apps',
        'mobile.apps.title': 'Apps',
        'mobile.refresh': 'Refresh',
      };
      return labels[key] ?? key;
    },
  }),
}));
const moduleState = vi.hoisted(() => ({
  data: [] as any[],
  error: undefined as Error | undefined,
  isLoading: false,
  isValidating: false,
  mutate: vi.fn(),
}));
const workspaceState = vi.hoisted(() => ({ activeWorkspaceId: 'workspace-1' as string | null }));
const swrCapture = vi.hoisted(() => ({ fetcher: undefined as undefined | (() => Promise<unknown>), key: undefined as unknown }));
const listAvailableApps = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mobileState = vi.hoisted(() => ({
  config: {
    applications: {
      builtins: [
        {
          enabled: true,
          icon: 'list-todo',
          id: 'tasks',
          label: 'Work',
          order: 1,
          path: '/tasks',
        },
      ],
      featuredModuleAppIds: ['featured-app'],
    },
    navigation: {
      items: [{ id: 'slot-4', label: 'Tools' }],
    },
  } as any,
}));

vi.mock('swr', () => ({
  default: (key: unknown, fetcher: () => Promise<unknown>) => {
    swrCapture.key = key;
    swrCapture.fetcher = fetcher;
    return moduleState;
  },
}));
vi.mock('@/business/client/hooks/useActiveWorkspaceId', () => ({
  useActiveWorkspaceId: () => workspaceState.activeWorkspaceId,
}));
vi.mock('@/services/moduleApp', () => ({
  moduleAppService: { listAvailableApps },
}));
vi.mock('../useMobileConfig', () => ({ useMobileConfig: () => mobileState }));
vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => navigate,
}));
vi.mock('@lobehub/ui/mobile', () => ({
  ChatHeader: ({ left, right }: any) => (
    <header>
      {left}
      {right}
    </header>
  ),
}));
vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button type="button" {...props} onClick={onClick}>
      {children}
    </button>
  ),
  Empty: ({ description }: any) => <div>{description}</div>,
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Icon: () => <span data-testid="app-icon" />,
  Skeleton: { Paragraph: () => <div data-testid="apps-loading" /> },
}));
vi.mock('../MobilePageLayout', () => ({
  default: ({ children, header }: any) => (
    <div>
      {header}
      {children}
    </div>
  ),
}));

const installedApp = (overrides: Record<string, unknown> = {}) => ({
  displayName: 'General app',
  id: 'general-app',
  installed: true,
  planState: { runnable: true },
  status: 'published',
  ...overrides,
});

describe('MobileAppsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    moduleState.data = [
      installedApp(),
      installedApp({
        displayName: 'Featured app',
        icon: 'https://cdn.example.com/featured.png',
        id: 'featured-app',
        installationScope: 'workspace',
        workspaceId: 'workspace-1',
      }),
      installedApp({ displayName: 'Draft app', id: 'draft-app', status: 'draft' }),
      installedApp({
        displayName: 'Blocked app',
        id: 'blocked-app',
        planState: { runnable: false },
      }),
    ];
    moduleState.error = undefined;
    moduleState.isLoading = false;
    moduleState.isValidating = false;
    workspaceState.activeWorkspaceId = 'workspace-1';
    swrCapture.fetcher = undefined;
    swrCapture.key = undefined;
  });

  it('opens configured built-ins, runnable module apps, and the app market', () => {
    render(<MobileAppsPage />);

    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Work' })).toBeInTheDocument();
    expect(screen.getAllByTestId('mobile-module-app').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Featured app'),
      expect.stringContaining('General app'),
    ]);
    expect(screen.getByRole('img', { name: 'Featured app' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/featured.png',
    );
    expect(screen.queryByText('Draft app')).not.toBeInTheDocument();
    expect(screen.queryByText('Blocked app')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Work' }));
    expect(navigate).toHaveBeenCalledWith('/tasks');

    fireEvent.click(screen.getByRole('button', { name: 'Open Featured app' }));
    expect(navigate).toHaveBeenCalledWith(
      '/apps/featured-app/app?workspaceId=workspace-1&scopeType=workspace',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Browse app market' }));
    expect(navigate).toHaveBeenCalledWith('/apps/market');
  });

  it('scopes the single module-app request to the active workspace', async () => {
    render(<MobileAppsPage />);

    expect(swrCapture.key).toEqual(['mobile-module-apps', 'workspace-1']);
    await swrCapture.fetcher?.();
    expect(listAvailableApps).toHaveBeenCalledTimes(1);
    expect(listAvailableApps).toHaveBeenCalledWith('workspace-1');
  });

  it('keeps built-ins usable when module apps fail and retries only the module section', () => {
    moduleState.error = new Error('offline');
    render(<MobileAppsPage />);

    expect(screen.getByRole('button', { name: 'Open Work' })).toBeInTheDocument();
    expect(screen.getByText('Unable to load module apps')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry module apps' }));
    expect(moduleState.mutate).toHaveBeenCalled();
  });

  it('uses status semantics while module apps are loading', () => {
    moduleState.isLoading = true;
    render(<MobileAppsPage />);

    expect(screen.getByTestId('mobile-apps-loading')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('mobile-apps-loading')).toHaveAttribute('role', 'status');
  });

  it('manually refreshes module apps', () => {
    render(<MobileAppsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(moduleState.mutate).toHaveBeenCalled();
  });
});
