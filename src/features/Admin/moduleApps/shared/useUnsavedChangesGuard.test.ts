import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

const blocker = vi.hoisted(() => ({ proceed: vi.fn(), reset: vi.fn(), state: 'unblocked' }));

vi.mock('react-router', () => ({ useBlocker: () => blocker }));

describe('useUnsavedChangesGuard', () => {
  beforeEach(() => {
    blocker.proceed.mockReset();
    blocker.reset.mockReset();
    blocker.state = 'unblocked';
    vi.restoreAllMocks();
  });

  it('keeps the user on the form when navigation is cancelled', () => {
    blocker.state = 'blocked';
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderHook(() => useUnsavedChangesGuard(true, 'Discard changes?'));

    expect(blocker.reset).toHaveBeenCalledOnce();
    expect(blocker.proceed).not.toHaveBeenCalled();
  });

  it('proceeds after confirmation and protects beforeunload', () => {
    blocker.state = 'blocked';
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderHook(() => useUnsavedChangesGuard(true, 'Discard changes?'));
    expect(blocker.proceed).toHaveBeenCalledOnce();

    const event = new Event('beforeunload', { cancelable: true });
    act(() => window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
  });
});
