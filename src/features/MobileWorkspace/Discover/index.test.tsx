import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MobileDiscoverPage from './index';

const navigate = vi.fn();
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
  mutate: vi.fn(),
}));

vi.mock('../useMobileConfig', () => ({ useMobileConfig: () => mobileState }));
vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => navigate,
}));
vi.mock('@lobehub/ui/mobile', () => ({
  ChatHeader: ({ left }: any) => <header>{left}</header>,
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
  });

  it('renders only configured assistants in a two-column grid with recommended models', () => {
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
    expect(screen.getByTestId('discover-loading')).toBeInTheDocument();

    mobileState.isLoading = false;
    mobileState.config.discover.featuredAssistants = [];
    rerender(<MobileDiscoverPage key="empty" />);
    expect(screen.getByText('No recommended assistants')).toBeInTheDocument();

    mobileState.error = new Error('offline');
    rerender(<MobileDiscoverPage key="error" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mobileState.mutate).toHaveBeenCalled();
  });
});
