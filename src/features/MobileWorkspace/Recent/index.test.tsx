import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RecentItem } from '@/server/routers/lambda/recent';
import { LobeSessionType } from '@/types/session';

import MobileRecentPage from './index';

const navigate = vi.fn();
const storeState = vi.hoisted(() => ({
  home: {
    pinAgentGroup: vi.fn(),
  },
  session: {
    isSessionsFirstFetchFinished: true,
    pinSession: vi.fn(),
    pinnedSessions: [] as any[],
    refreshSessions: vi.fn(),
    sessions: [] as any[],
  },
}));
const swrState = vi.hoisted(() => ({
  data: [] as RecentItem[],
  error: undefined as Error | undefined,
  isLoading: false,
  mutate: vi.fn(),
}));

vi.mock('swr', () => ({ default: () => swrState }));
vi.mock('@/hooks/useFetchSessions', () => ({ useFetchSessions: vi.fn() }));
vi.mock('@/store/home', () => ({ useHomeStore: (selector: any) => selector(storeState.home) }));
vi.mock('@/store/session', () => ({
  useSessionStore: (selector: any) => selector(storeState.session),
}));
vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => navigate,
}));
vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ 'aria-label': ariaLabel, onClick }: any) => (
    <button aria-label={ariaLabel} type="button" onClick={onClick} />
  ),
  Button: ({ children, icon, onClick, ...props }: any) => (
    <button type="button" {...props} onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      {items.map((item: any) => (
        <button
          key={item.key}
          type="button"
          onClick={() => item.onClick?.({ domEvent: new Event('click') })}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
  Empty: ({ description }: any) => <div>{description}</div>,
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Icon: () => null,
  SearchBar: ({ 'aria-label': ariaLabel, onChange, value }: any) => (
    <input aria-label={ariaLabel} value={value} onChange={onChange} />
  ),
  Skeleton: {
    Paragraph: () => <div data-testid="recent-skeleton" />,
  },
}));

const session = (id: string, type: LobeSessionType, title: string, pinned = false) => ({
  ...(type === LobeSessionType.Agent ? { config: {}, model: 'gpt-4.1' } : {}),
  createdAt: new Date('2026-07-18T08:00:00.000Z'),
  id,
  meta: { title },
  pinned,
  type,
  updatedAt: new Date('2026-07-19T08:00:00.000Z'),
});

const topic = (id: string, routePath: string, agentId?: string): RecentItem => ({
  agentId,
  icon: 'topic',
  id,
  routePath,
  status: null,
  title: id,
  type: 'topic',
  updatedAt: new Date('2026-07-19T10:00:00.000Z'),
});

describe('MobileRecentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.session.isSessionsFirstFetchFinished = true;
    const pinnedAgent = session('agent-pinned', LobeSessionType.Agent, 'Pinned Agent', true);
    const pinnedGroup = session('group-pinned', LobeSessionType.Group, 'Pinned Group', true);
    const freeAgent = session('agent-free', LobeSessionType.Agent, 'Free Agent');
    const freeGroup = session('group-free', LobeSessionType.Group, 'Free Group');
    storeState.session.pinnedSessions = [pinnedGroup, pinnedAgent];
    storeState.session.sessions = [pinnedAgent, pinnedGroup, freeAgent, freeGroup];
    swrState.data = [
      topic('New Topic', '/agent/agent-free/topic-new', 'agent-free'),
      topic('Group Topic', '/group/group-free?topic=topic-group'),
    ];
    swrState.error = undefined;
    swrState.isLoading = false;
  });

  it('renders pinned conversations before recent topics and navigates to a topic', () => {
    render(<MobileRecentPage />);

    expect(screen.getAllByTestId('recent-conversation-row').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Pinned Agent'),
      expect.stringContaining('Pinned Group'),
      expect.stringContaining('New Topic'),
      expect.stringContaining('Group Topic'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Open New Topic' }));
    expect(navigate).toHaveBeenCalledWith('/agent/agent-free/topic-new');
  });

  it('filters both pinned and recent sections using the mobile session search query', () => {
    render(<MobileRecentPage />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search conversations' }), {
      target: { value: 'group' },
    });

    expect(screen.queryByText('Pinned Agent')).not.toBeInTheDocument();
    expect(screen.getByText('Pinned Group')).toBeInTheDocument();
    expect(screen.getByText('Group Topic')).toBeInTheDocument();
  });

  it('renders loading, empty, and error retry states', () => {
    swrState.isLoading = true;
    const { rerender } = render(<MobileRecentPage />);
    expect(screen.getByTestId('mobile-recent-loading')).toBeInTheDocument();

    swrState.isLoading = false;
    swrState.data = [];
    storeState.session.pinnedSessions = [];
    rerender(<MobileRecentPage key="empty" />);
    expect(screen.getByText('No recent conversations')).toBeInTheDocument();

    swrState.error = new Error('offline');
    rerender(<MobileRecentPage key="error" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(swrState.mutate).toHaveBeenCalled();
  });

  it('refreshes and reuses the existing agent and group pin actions', async () => {
    render(<MobileRecentPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh recent conversations' }));
    expect(swrState.mutate).toHaveBeenCalled();

    const topicRow = screen
      .getAllByTestId('recent-conversation-row')
      .find((row) => row.textContent?.includes('New Topic'))!;
    fireEvent.click(within(topicRow).getByRole('button', { name: 'Pin' }));
    expect(storeState.session.pinSession).toHaveBeenCalledWith('agent-free', true);

    const groupRow = screen
      .getAllByTestId('recent-conversation-row')
      .find((row) => row.textContent?.includes('Pinned Group'))!;
    fireEvent.click(within(groupRow).getByRole('button', { name: 'Unpin' }));
    expect(storeState.home.pinAgentGroup).toHaveBeenCalledWith('group-pinned', false);
    await waitFor(() => expect(storeState.session.refreshSessions).toHaveBeenCalled());
  });
});
