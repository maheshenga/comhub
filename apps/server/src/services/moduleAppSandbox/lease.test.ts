import { describe, expect, it, vi } from 'vitest';

import { RedisModuleAppInvocationLeaseStore } from './lease';

describe('RedisModuleAppInvocationLeaseStore', () => {
  it('acquires an invocation lease with SET NX PX', async () => {
    const redis = {
      eval: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
    };
    const store = new RedisModuleAppInvocationLeaseStore(redis);

    await expect(
      store.acquire({ invocationId: 'invocation-1', ownerId: 'worker-1', ttlMs: 30_000 }),
    ).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      'module-app:invocation-lease:invocation-1',
      'worker-1',
      'PX',
      30_000,
      'NX',
    );
  });

  it('reports an existing invocation lease without replacing its owner', async () => {
    const redis = {
      eval: vi.fn(),
      set: vi.fn().mockResolvedValue(null),
    };
    const store = new RedisModuleAppInvocationLeaseStore(redis);

    await expect(
      store.acquire({ invocationId: 'invocation-1', ownerId: 'worker-2', ttlMs: 30_000 }),
    ).resolves.toBe(false);
  });

  it('records a replay rejection without adding invocation identifiers', async () => {
    const redis = { eval: vi.fn(), set: vi.fn().mockResolvedValue(null) };
    const recordReplayRejection = vi.fn();
    const store = new RedisModuleAppInvocationLeaseStore(redis, { recordReplayRejection });

    await expect(
      store.acquire({ invocationId: 'invocation-1', ownerId: 'worker-2', ttlMs: 30_000 }),
    ).resolves.toBe(false);
    expect(recordReplayRejection).toHaveBeenCalledWith();
  });

  it('releases only the lease owned by the caller', async () => {
    const redis = {
      eval: vi.fn().mockResolvedValue(1),
      set: vi.fn(),
    };
    const store = new RedisModuleAppInvocationLeaseStore(redis);

    await expect(
      store.release({ invocationId: 'invocation-1', ownerId: 'worker-1' }),
    ).resolves.toBeUndefined();
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get', KEYS[1])"),
      1,
      'module-app:invocation-lease:invocation-1',
      'worker-1',
    );
  });

  it('fails closed when shared Redis state is unavailable', async () => {
    const store = new RedisModuleAppInvocationLeaseStore(null);

    await expect(
      store.acquire({ invocationId: 'invocation-1', ownerId: 'worker-1', ttlMs: 30_000 }),
    ).rejects.toThrow('MODULE_APP_SHARED_STATE_REQUIRED');
    await expect(
      store.release({ invocationId: 'invocation-1', ownerId: 'worker-1' }),
    ).rejects.toThrow('MODULE_APP_SHARED_STATE_REQUIRED');
  });
});
