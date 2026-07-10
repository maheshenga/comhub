import { describe, expect, it, vi } from 'vitest';

import { MODULE_APP_BRIDGE_CHANNEL } from './bridge';
import { createModuleAppSdk } from './client';

const RUNTIME_ORIGIN = 'https://module-runtime.example.com';
const NONCE = '0123456789abcdef0123456789abcdef';

const createHarness = () => {
  const listeners = new Set<(event: MessageEvent) => void>();
  const eventTarget = {
    addEventListener: vi.fn((_type: 'message', listener: (event: MessageEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: 'message', listener: (event: MessageEvent) => void) => {
      listeners.delete(listener);
    }),
  };
  const parentWindow = { postMessage: vi.fn() };
  const dispatch = (event: Partial<MessageEvent>) => {
    for (const listener of listeners) listener(event as MessageEvent);
  };
  const sdk = createModuleAppSdk({
    eventTarget: eventTarget as never,
    nonce: NONCE,
    parentWindow: parentWindow as never,
    randomId: () => 'request-1',
    runtimeOrigin: RUNTIME_ORIGIN,
  });

  return { dispatch, eventTarget, parentWindow, sdk };
};

describe('createModuleAppSdk', () => {
  it('ignores responses from a wrong origin, source, or nonce', async () => {
    const { dispatch, parentWindow, sdk } = createHarness();
    const request = sdk.context();
    let settled = false;
    void request.finally(() => {
      settled = true;
    });

    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'request-1',
        method: 'context.get',
        nonce: NONCE,
        type: 'request',
      }),
      RUNTIME_ORIGIN,
    );

    dispatch({
      data: { channel: MODULE_APP_BRIDGE_CHANNEL, id: 'request-1', nonce: NONCE, ok: true, result: { userId: 'user-1' }, type: 'response' },
      origin: 'https://attacker.example.com',
      source: parentWindow as never,
    });
    dispatch({
      data: { channel: MODULE_APP_BRIDGE_CHANNEL, id: 'request-1', nonce: 'wrong-nonce-0000', ok: true, result: {}, type: 'response' },
      origin: RUNTIME_ORIGIN,
      source: parentWindow as never,
    });
    dispatch({
      data: { channel: MODULE_APP_BRIDGE_CHANNEL, id: 'request-1', nonce: NONCE, ok: true, result: {}, type: 'response' },
      origin: RUNTIME_ORIGIN,
      source: {} as never,
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    dispatch({
      data: { channel: MODULE_APP_BRIDGE_CHANNEL, id: 'request-1', nonce: NONCE, ok: true, result: { userId: 'user-1' }, type: 'response' },
      origin: RUNTIME_ORIGIN,
      source: parentWindow as never,
    });
    await expect(request).resolves.toEqual({ userId: 'user-1' });
  });

  it('subscribes only to trusted events and removes the bridge listener on dispose', () => {
    const { dispatch, eventTarget, parentWindow, sdk } = createHarness();
    const listener = vi.fn();
    const unsubscribe = sdk.on('progress', listener);

    dispatch({
      data: { channel: MODULE_APP_BRIDGE_CHANNEL, event: 'progress', nonce: NONCE, payload: { percent: 10 }, type: 'event' },
      origin: 'https://attacker.example.com',
      source: parentWindow as never,
    });
    dispatch({
      data: { channel: MODULE_APP_BRIDGE_CHANNEL, event: 'progress', nonce: NONCE, payload: { percent: 20 }, type: 'event' },
      origin: RUNTIME_ORIGIN,
      source: parentWindow as never,
    });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ percent: 20 });
    unsubscribe();
    sdk.dispose();
    expect(eventTarget.removeEventListener).toHaveBeenCalledOnce();
  });
});
