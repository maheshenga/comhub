import { recordModuleAppSandboxReplayRejection } from '@lobechat/observability-otel/modules/module-app';

import { redisService } from '@/server/services/redis';
import {
  acquireLeaseWithClient,
  type ModuleAppRawRedisClient,
  releaseLeaseWithClient,
} from '@/server/services/redis/moduleApp';

import type { ModuleAppInvocationLeaseStore } from './contracts';

const assertLeaseInput = (input: { invocationId: string; ownerId: string }) => {
  if (!input.invocationId.trim() || !input.ownerId.trim()) {
    throw new Error('MODULE_APP_INVOCATION_LEASE_INPUT_INVALID');
  }
};

export class RedisModuleAppInvocationLeaseStore implements ModuleAppInvocationLeaseStore {
  /**
   * `undefined` resolves the shared Redis service client; `null` explicitly
   * means no shared state (and fails closed). A client is only passed by tests
   * that need to control the connection.
   */
  constructor(
    private readonly redis: ModuleAppRawRedisClient | null | undefined = undefined,
    private readonly metrics: { recordReplayRejection: () => void } = {
      recordReplayRejection: recordModuleAppSandboxReplayRejection,
    },
  ) {}

  acquire = async (input: { invocationId: string; ownerId: string; ttlMs: number }) => {
    assertLeaseInput(input);
    if (!Number.isInteger(input.ttlMs) || input.ttlMs < 1) {
      throw new Error('MODULE_APP_INVOCATION_LEASE_TTL_INVALID');
    }

    let acquired: boolean | undefined;
    if (this.redis === null) {
      acquired = undefined;
    } else if (this.redis === undefined) {
      acquired = await redisService.moduleApp.acquireLease(
        input.invocationId,
        input.ownerId,
        input.ttlMs,
      );
    } else {
      acquired = await acquireLeaseWithClient(
        this.redis,
        input.invocationId,
        input.ownerId,
        input.ttlMs,
      );
    }

    if (acquired === undefined) throw new Error('MODULE_APP_SHARED_STATE_REQUIRED');
    if (!acquired) this.metrics.recordReplayRejection();
    return acquired;
  };

  release = async (input: { invocationId: string; ownerId: string }) => {
    assertLeaseInput(input);

    if (this.redis === null) throw new Error('MODULE_APP_SHARED_STATE_REQUIRED');
    if (this.redis === undefined) {
      const released = await redisService.moduleApp.releaseLease(
        input.invocationId,
        input.ownerId,
      );
      if (released === undefined) throw new Error('MODULE_APP_SHARED_STATE_REQUIRED');
      return;
    }

    await releaseLeaseWithClient(this.redis, input.invocationId, input.ownerId);
  };
}
