import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  readMobileSlotState,
  useMobileSlotState,
  writeMobileSlotState,
} from './mobileSlotState';

const Probe = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { query, rememberFocus, setQuery } = useMobileSlotState({
    scopeId: 'workspace-1',
    scrollRef,
    slotId: 'slot-1',
  });

  return (
    <div data-testid="scroll-container" ref={scrollRef}>
      <input
        aria-label="query"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <button
        data-mobile-focus-key="agent-1"
        type="button"
        onClick={() => rememberFocus('agent-1')}
      >
        Agent
      </button>
    </div>
  );
};

describe('mobile slot state', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  it('keeps slot state isolated by workspace', () => {
    writeMobileSlotState('workspace-1', 'slot-1', { query: 'alpha', scrollTop: 120 });
    writeMobileSlotState('workspace-2', 'slot-1', { query: 'beta', scrollTop: 40 });

    expect(readMobileSlotState('workspace-1', 'slot-1')).toMatchObject({
      query: 'alpha',
      scrollTop: 120,
    });
    expect(readMobileSlotState('workspace-2', 'slot-1')).toMatchObject({
      query: 'beta',
      scrollTop: 40,
    });
  });

  it('restores and persists query, scroll, and focused item', async () => {
    writeMobileSlotState('workspace-1', 'slot-1', {
      focusKey: 'agent-1',
      query: 'roadmap',
      scrollTop: 120,
    });

    const { unmount } = render(<Probe />);
    const scrollContainer = screen.getByTestId('scroll-container');

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'query' })).toHaveValue('roadmap'));
    expect(scrollContainer.scrollTop).toBe(120);
    expect(screen.getByRole('button', { name: 'Agent' })).toHaveFocus();

    fireEvent.change(screen.getByRole('textbox', { name: 'query' }), {
      target: { value: 'updated' },
    });
    act(() => {
      scrollContainer.scrollTop = 240;
      fireEvent.scroll(scrollContainer);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agent' }));
    unmount();

    expect(readMobileSlotState('workspace-1', 'slot-1')).toMatchObject({
      focusKey: 'agent-1',
      query: 'updated',
      scrollTop: 240,
    });
  });
});
