import { fireEvent, render, screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import {
  MobileContentFrame,
  MobileIconGrid,
  MobileListSkeleton,
  MobileSection,
  MobileStateView,
  MobileWorkspaceHeader,
} from './index';

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ 'aria-label': ariaLabel, onClick, size, title }: any) => (
    <button
      aria-label={ariaLabel ?? title}
      data-block-size={size?.blockSize}
      type="button"
      onClick={onClick}
    />
  ),
}));

vi.mock('@lobehub/ui/mobile', () => {
  const ChatHeader = (({ center, left, right }: any) => (
    <header>
      {left}
      {center}
      {right}
    </header>
  )) as any;

  ChatHeader.Title = ({ title }: any) => <div>{title}</div>;

  return { ChatHeader };
});

describe('mobile workspace shared components', () => {
  it('renders semantic section headings and trailing content', () => {
    render(
      <MobileSection action={<button type="button">Manage</button>} title="Shortcuts">
        <div>Content</div>
      </MobileSection>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Shortcuts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage' })).toBeInTheDocument();
  });

  it('uses 44px header actions and calls their handlers', () => {
    const onSearch = vi.fn();

    render(
      <MobileWorkspaceHeader
        actions={[{ icon: Search, label: 'Search', onClick: onSearch }]}
        title="Workspace"
      />,
    );

    const action = screen.getByRole('button', { name: 'Search' });
    expect(action).toHaveAttribute('data-block-size', '44');
    fireEvent.click(action);
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('calls state actions and renders only one primary action', () => {
    const onClick = vi.fn();

    render(
      <MobileStateView
        action={{ label: 'Retry', onClick, primary: true }}
        actions={[{ label: 'Dismiss', onClick: vi.fn(), primary: true }]}
        description="Connection failed"
        title="Unable to load"
        variant="error"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { level: 2, name: 'Unable to load' })).toBeInTheDocument();
    expect(screen.getAllByTestId('mobile-state-primary-action')).toHaveLength(1);
  });

  it('exposes responsive frame and grid contract attributes', () => {
    render(
      <MobileContentFrame>
        <MobileIconGrid minCellSize={112}>
          <div>One</div>
        </MobileIconGrid>
      </MobileContentFrame>,
    );

    expect(screen.getByTestId('mobile-content-frame')).toHaveAttribute(
      'data-mobile-content-max-width',
      '640',
    );
    expect(screen.getByTestId('mobile-icon-grid')).toHaveAttribute(
      'data-mobile-grid-min-cell',
      '112',
    );
  });

  it('renders the requested number of final-row-shaped skeletons', () => {
    render(<MobileListSkeleton rows={3} />);

    expect(screen.getAllByTestId('mobile-list-skeleton-row')).toHaveLength(3);
  });
});
