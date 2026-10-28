import { createHash, randomUUID } from 'node:crypto';

import type { ModuleAppReplayGuardBackend } from '@/business/server/module-apps/sdk/gateway';
import type { ModuleAppNotificationRateLimitBackend } from '@/business/server/module-apps/sdk/notifications';
import { redisService } from '@/server/services/redis';
import {
  consumeNotificationRateLimitWithClient,
  consumeReplayWithClient,
  type ModuleAppRawRedisClient,
} from '@/server/services/redis/moduleApp';

type GuardBackendMode = 'distributed-required' | 'memory-allowed';

const hashKey = (value: string) => createHash('sha256').update(value).digest('hex');

export const createModuleAppReplayGuardBackend = (
  options: {
    getRedisClient?: () => ModuleAppRawRedisClient | null;
    mode?: GuardBackendMode;
  } = {},
): ModuleAppReplayGuardBackend => {
  const consumed = new Map<string, number>();
  const getRedisClient = options.getRedisClient;

  return {
    async consume(rawKey, ttlSeconds) {
      const redis = getRedisClient?.();
      const distributed = getRedisClient
        ? redis
          ? await consumeReplayWithClient(redis, rawKey, ttlSeconds)
          : undefined
        : await redisService.moduleApp.consumeReplay(rawKey, ttlSeconds);

      if (distributed !== undefined) return distributed;
      if (options.mode !== 'memory-allowed') {
        throw new Error('MODULE_APP_DISTRIBUTED_GUARD_UNAVAILABLE');
      }

      const key = `module-app:replay:${hashKey(rawKey)}`;
      const now = Date.now();
      for (const [entryKey, expiresAt] of consumed) {
        if (expiresAt <= now) consumed.delete(entryKey);
      }
      if (consumed.has(key)) return false;
      consumed.set(key, now + ttlSeconds * 1000);
      return true;
    },
  };
};

export const createModuleAppNotificationRateLimitBackend = (
  options: {
    getRedisClient?: () => ModuleAppRawRedisClient | null;
    mode?: GuardBackendMode;
    now?: () => number;
    randomId?: () => string;
  } = {},
): ModuleAppNotificationRateLimitBackend => {
  const recent = new Map<string, number[]>();
  const getRedisClient = options.getRedisClient;
  const now = options.now ?? Date.now;
  const randomId = options.randomId ?? randomUUID;

  return {
    async consume(installationId, limit, windowMs) {
      const timestamp = now();
      const redis = getRedisClient?.();
      const distributed = getRedisClient
        ? redis
          ? await consumeNotificationRateLimitWithClient(redis, installationId, {
              eventId: randomId(),
              limit,
              now: timestamp,
              windowMs,
            })
          : undefined
        : await redisService.moduleApp.consumeNotificationRateLimit(installationId, {
            eventId: randomId(),
            limit,
            now: timestamp,
            windowMs,
          });

      if (distributed !== undefined) return distributed;
      if (options.mode !== 'memory-allowed') {
        throw new Error('MODULE_APP_DISTRIBUTED_GUARD_UNAVAILABLE');
      }

      const key = `module-app:notification-rate:${hashKey(installationId)}`;
      const entries = (recent.get(key) ?? []).filter(
        (entryTimestamp) => entryTimestamp > timestamp - windowMs,
      );
      if (entries.length >= limit) return false;
      entries.push(timestamp);
      recent.set(key, entries);
      return true;
    },
  };
};
