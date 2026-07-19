import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MobileAppsPage from './index';

const navigate = vi.fn();
const moduleState = vi.hoisted(() => ({
  data: [] as any[],
  error: undefined as Error | undefined,
  isLoading: false,
  mutate: vi.fn(),
}));
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

vi.mock('swr', () => ({ default: () => moduleState }));
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
      installedApp({ displayName: 'Featured app', id: 'featured-app' }),
      installedApp({ displayName: 'Draft app', id: 'draft-app', status: 'draft' }),
      installedApp({
        displayName: 'Blocked app',
        id: 'blocked-app',
        planState: { runnable: false },
      }),
    ];
    moduleState.error = undefined;
    moduleState.isLoading = false;
  });

  it('opens configured built-ins, runnable module apps, and the app market', () => {
    render(<MobileAppsPage />);

    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Work' })).toBeInTheDocument();
    expect(screen.getAllByTestId('mobile-module-app').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Featured app'),
      expect.stringContaining('General app'),
    ]);
    expect(screen.queryByText('Draft app')).not.toBeInTheDocument();
    expect(screen.queryByText('Blocked app')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Work' }));
    expect(navigate).toHaveBeenCalledWith('/tasks', { escape: true });

    fireEvent.click(screen.getByRole('button', { name: 'Open Featured app' }));
    expect(navigate).toHaveBeenCalledWith('/apps/featured-app/app', { escape: true });

    fireEvent.click(screen.getByRole('button', { name: 'Browse app market' }));
    expect(navigate).toHaveBeenCalledWith('/apps/market', { escape: true });
  });

  it('keeps built-ins usable when module apps fail and retries only the module section', () => {
    moduleState.error = new Error('offline');
    render(<MobileAppsPage />);

    expect(screen.getByRole('button', { name: 'Open Work' })).toBeInTheDocument();
    expect(screen.getByText('Unable to load module apps')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry module apps' }));
    expect(moduleState.mutate).toHaveBeenCalled();
  });
});
