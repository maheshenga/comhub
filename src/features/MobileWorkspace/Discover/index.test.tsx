import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MobileDiscoverPage from './index';

const navigate = vi.fn();
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) => {
      const labels: Record<string, string> = {
        'mobile.discover.empty': 'No recommended assistants',
        'mobile.discover.error': 'Unable to load recommended assistants',
        'mobile.discover.open': `Open ${values?.name ?? ''}`,
        'mobile.discover.retry': 'Retry',
        'mobile.refresh': 'Refresh',
      };
      return labels[key] ?? key;
    },
  }),
}));
const mobileState = vi.hoisted(() => ({
  config: {
    discover: {
      assistants: [],
      featuredAssistants: [] as any[],
      title: 'Recommended assistants',
    },
    navigation: { items: [] },
  } as any,
  error: undefined as Error | undefined,
  isLoading: false,
  isValidating: false,
  mutate: vi.fn(),
}));

vi.mock('../useMobileConfig', () => ({ useMobileConfig: () => mobileState }));
vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => navigate,
}));
vi.mock('@lobehub/ui/mobile', () => ({
  ChatHeader: ({ left, right }: any) => <header>{left}{right}</header>,
}));
vi.mock('@lobehub/ui', () => ({
  Avatar: ({ avatar, title }: any) => <span>{avatar || title}</span>,
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Empty: ({ description }: any) => <div>{description}</div>,
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Icon: () => <span aria-hidden="true" />,
  Skeleton: { Paragraph: () => <div data-testid="discover-loading" /> },
}));
vi.mock('../MobilePageLayout', () => ({
  default: ({ children, header }: any) => (
    <div>
      {header}
      {children}
    </div>
  ),
}));

const assistant = (identifier: string, title: string) => ({
  description: `${title} description`,
  identifier,
  model: { displayName: 'GPT 4.1', id: 'gpt-4.1', provider: 'openai' },
  title,
});

describe('MobileDiscoverPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mobileState.config.discover.featuredAssistants = [
      assistant('alpha', 'Alpha'),
      assistant('beta', 'Beta'),
      assistant('gamma', 'Gamma'),
    ];
    mobileState.error = undefined;
    mobileState.isLoading = false;
    mobileState.isValidating = false;
  });

  it('renders only configured assistants in a two-column grid with display models', () => {
    render(<MobileDiscoverPage />);

    expect(screen.getAllByTestId('featured-assistant-card')).toHaveLength(3);
    expect(screen.getAllByText('GPT 4.1')).toHaveLength(3);
    expect(screen.queryByTestId('featured-assistant-filler')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Alpha' }));
    expect(navigate).toHaveBeenCalledWith('/community/agent/alpha', { escape: true });
  });

  it('renders loading, empty, and retry states', () => {
    mobileState.isLoading = true;
    const { rerender } = render(<MobileDiscoverPage />);
    expect(screen.getByTestId('mobile-discover-loading')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('mobile-discover-loading')).toHaveAttribute('role', 'status');

    mobileState.isLoading = false;
    mobileState.config.discover.featuredAssistants = [];
    rerender(<MobileDiscoverPage key="empty" />);
    expect(screen.getByText('No recommended assistants')).toBeInTheDocument();

    mobileState.error = new Error('offline');
    rerender(<MobileDiscoverPage key="error" />);
    expect(screen.getByText('Unable to load recommended assistants')).toHaveAttribute(
      'role',
      'alert',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mobileState.mutate).toHaveBeenCalled();
  });

  it('manually refreshes recommendations', () => {
    render(<MobileDiscoverPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(mobileState.mutate).toHaveBeenCalled();
  });
});
