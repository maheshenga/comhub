import { describe, expect, it, vi } from 'vitest';

import { ModuleAppRuntimeClient } from './client';

const invocation = {
  artifactSha256: 'a'.repeat(64),
  capability: 'signed-runtime-capability',
  entry: 'server/search.ts',
  input: { query: 'jobs' },
  invocationId: '00000000-0000-4000-8000-000000000001',
  runtime: 'node22' as const,
  timeoutMs: 1000,
};

describe('ModuleAppRuntimeClient', () => {
  it('refuses invocation while module app execution is disabled', async () => {
    const fetch = vi.fn();
    const client = new ModuleAppRuntimeClient({
      baseUrl: 'http://module-runtime:3210',
      enabled: false,
      fetch,
      internalToken: 'internal-token',
    });

    await expect(client.invoke(invocation)).rejects.toThrow('MODULE_APP_EXECUTION_DISABLED');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses invocation while the runtime invocation rollout is disabled', async () => {
    const fetch = vi.fn();
    const client = new ModuleAppRuntimeClient({
      baseUrl: 'http://module-runtime:3210',
      enabled: true,
      fetch,
      internalToken: 'internal-token',
      invocationEnabled: false,
    });

    await expect(client.invoke(invocation)).rejects.toThrow(
      'MODULE_APP_RUNTIME_INVOCATION_DISABLED',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends an enabled invocation only to the configured internal endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ invocationId: invocation.invocationId, output: {}, status: 'succeeded' }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      ),
    );
    const client = new ModuleAppRuntimeClient({
      baseUrl: 'http://module-runtime:3210',
      enabled: true,
      fetch,
      internalToken: 'internal-token',
      invocationEnabled: true,
    });

    await expect(client.invoke(invocation)).resolves.toMatchObject({ status: 'succeeded' });
    expect(fetch).toHaveBeenCalledWith(
      'http://module-runtime:3210/v1/invocations',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer internal-token' }),
        method: 'POST',
      }),
    );
  });

  it('aborts a stalled runtime request at the invocation timeout', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn((_input: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    const client = new ModuleAppRuntimeClient({
      baseUrl: 'http://module-runtime:3210',
      enabled: true,
      fetch,
      internalToken: 'internal-token',
      invocationEnabled: true,
    });

    try {
      const request = expect(client.invoke(invocation)).rejects.toThrow(
        'MODULE_APP_RUNTIME_TIMEOUT',
      );
      await vi.advanceTimersByTimeAsync(invocation.timeoutMs);

      await request;
      expect(fetch).toHaveBeenCalledWith(
        'http://module-runtime:3210/v1/invocations',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
