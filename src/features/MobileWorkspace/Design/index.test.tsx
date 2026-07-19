import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MobilePublicConfigV1 } from '@/const/mobileConfig';
import type { MobileRecentDesignItem } from '@/server/routers/lambda/mobileDesign';

import MobileDesignPage from './index';

const navigate = vi.fn();
const createNewPage = vi.fn();
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) => {
      const labels: Record<string, string> = {
        'mobile.design.create': 'Create',
        'mobile.design.createError': 'Unable to create document',
        'mobile.design.createTool': `Create ${values?.name ?? ''}`,
        'mobile.design.empty': 'No recent design work',
        'mobile.design.error': 'Unable to load recent design work',
        'mobile.design.kind.document': 'Document',
        'mobile.design.kind.image': 'Image',
        'mobile.design.kind.ppt': 'PPT',
        'mobile.design.open': `Open ${values?.name ?? ''}`,
        'mobile.design.recent': 'Recent work',
        'mobile.design.retry': 'Retry',
        'mobile.design.untitled': 'Untitled',
      };
      return labels[key] ?? key;
    },
  }),
}));
const swrState = vi.hoisted(() => ({
  data: [] as MobileRecentDesignItem[],
  error: undefined as Error | undefined,
  isLoading: false,
  mutate: vi.fn(),
}));
const mobileConfig = vi.hoisted(
  () =>
    ({
      applications: { builtins: [], featuredModuleAppIds: [] },
      brand: { displayName: 'ComHub', logoUrl: null },
      design: {
        tools: [
          { enabled: true, icon: 'image', id: 'image', label: 'Images', order: 2 },
          { enabled: true, icon: 'file-text', id: 'document', label: 'Write', order: 1 },
          { enabled: true, icon: 'presentation', id: 'ppt', label: 'Slides', order: 3 },
        ],
      },
      discover: { assistants: [], title: 'Discover' },
      navigation: {
        items: [
          {
            icon: 'palette',
            id: 'slot-2',
            label: 'Design Lab',
            order: 2,
            path: '/design',
            visible: true,
          },
        ],
      },
      version: 1,
    }) as MobilePublicConfigV1,
);

vi.mock('swr', () => ({ default: () => swrState }));
vi.mock('../useMobileConfig', () => ({ useMobileConfig: () => ({ config: mobileConfig }) }));
vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => navigate,
}));
vi.mock('@/store/page', () => ({ usePageStore: (selector: any) => selector({ createNewPage }) }));
vi.mock('@lobehub/ui/mobile', () => ({
  ChatHeader: ({ left }: any) => <header>{left}</header>,
}));
vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button type="button" {...props} onClick={onClick}>
      {children}
    </button>
  ),
  Empty: ({ description }: any) => <div>{description}</div>,
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Icon: () => <span data-testid="design-icon" />,
  Skeleton: { Paragraph: () => <div data-testid="design-loading" /> },
}));
vi.mock('../MobilePageLayout', () => ({
  default: ({ children, header }: any) => (
    <div>
      {header}
      {children}
    </div>
  ),
}));

const recentItem = (overrides: Partial<MobileRecentDesignItem> = {}): MobileRecentDesignItem => ({
  id: 'doc-1',
  kind: 'document',
  routePath: '/page/doc-1',
  title: 'Quarterly report',
  updatedAt: new Date('2026-07-19T08:00:00.000Z'),
  ...overrides,
});

describe('MobileDesignPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createNewPage.mockResolvedValue('new-doc');
    swrState.data = [recentItem()];
    swrState.error = undefined;
    swrState.isLoading = false;
  });

  it('renders configured quick-create tools before recent work and opens existing routes', async () => {
    render(<MobileDesignPage />);

    expect(screen.getByText('Design Lab')).toBeInTheDocument();
    expect(screen.getAllByTestId('mobile-design-tool').map((tool) => tool.textContent)).toEqual([
      expect.stringContaining('Write'),
      expect.stringContaining('Images'),
      expect.stringContaining('Slides'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Create Write' }));
    await waitFor(() => expect(createNewPage).toHaveBeenCalledWith('Untitled'));
    expect(navigate).toHaveBeenCalledWith('/page/new-doc', { escape: true });

    fireEvent.click(screen.getByRole('button', { name: 'Create Images' }));
    expect(navigate).toHaveBeenCalledWith('/image', { escape: true });

    fireEvent.click(screen.getByRole('button', { name: 'Open Quarterly report' }));
    expect(navigate).toHaveBeenCalledWith('/page/doc-1', { escape: true });
  });

  it('keeps create tools available across recent loading, empty, and retry states', () => {
    swrState.isLoading = true;
    const { rerender } = render(<MobileDesignPage />);
    expect(screen.getByRole('button', { name: 'Create Write' })).toBeInTheDocument();
    expect(screen.getByTestId('design-loading')).toBeInTheDocument();

    swrState.isLoading = false;
    swrState.data = [];
    rerender(<MobileDesignPage key="empty" />);
    expect(screen.getByText('No recent design work')).toBeInTheDocument();

    swrState.error = new Error('offline');
    rerender(<MobileDesignPage key="error" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(swrState.mutate).toHaveBeenCalled();
  });
});
