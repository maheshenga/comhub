import { createHash } from 'node:crypto';

import type Redis from 'ioredis';

import { RedisKeyNamespace, RedisKeys } from '@/server/modules/Redis';

import { getRedisServiceClient } from './client';

// Module App runtime coordination: replay guards, notification sliding windows
// and invocation leases. Redis only holds the distributed copy — the caller
// decides whether an unavailable Redis fails closed or may fall back to
// process-local state, so every method returns `undefined` without a client.

const hashKey = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * KEYS[1] = installation window; ARGV[1] = now (ms); ARGV[2] = window (ms);
 * ARGV[3] = limit; ARGV[4] = member id.
 */
const NOTIFICATION_RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  return 0
end
redis.call('ZADD', key, now, ARGV[4])
redis.call('PEXPIRE', key, window)
return 1
`;

const RELEASE_LEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

export interface ModuleAppNotificationWindow {
  eventId: string;
  limit: number;
  now: number;
  windowMs: number;
}

/** Raw transport shape accepted by callers that inject their own client. */
export type ModuleAppRawRedisClient = Pick<Redis, 'eval' | 'set'>;

const replayKey = (rawKey: string) => RedisKeys.moduleApp.replay(hashKey(rawKey));
const notificationRateKey = (installationId: string) =>
  RedisKeys.moduleApp.notificationRate(hashKey(installationId));
const invocationLeaseKey = (invocationId: string) =>
  RedisKeys.moduleApp.invocationLease(invocationId);

// The service client prefixes keys with the scope namespace. Injected raw
// clients are not prefixed, so the raw variants compose the namespace
// themselves and write the same keys as the service.
const withNamespace = (key: string) => `${RedisKeyNamespace.MODULE_APP}:${key}`;

export const consumeReplayWithClient = async (
  redis: ModuleAppRawRedisClient,
  rawKey: string,
  ttlSeconds: number,
): Promise<boolean> =>
  (await redis.set(withNamespace(replayKey(rawKey)), '1', 'EX', ttlSeconds, 'NX')) === 'OK';

export const consumeNotificationRateLimitWithClient = async (
  redis: ModuleAppRawRedisClient,
  installationId: string,
  window: ModuleAppNotificationWindow,
): Promise<boolean> => {
  const result = await redis.eval(
    NOTIFICATION_RATE_LIMIT_SCRIPT,
    1,
    withNamespace(notificationRateKey(installationId)),
    window.now,
    window.windowMs,
    window.limit,
    window.eventId,
  );

  return Number(result) === 1;
};

export const acquireLeaseWithClient = async (
  redis: ModuleAppRawRedisClient,
  invocationId: string,
  ownerId: string,
  ttlMs: number,
): Promise<boolean> =>
  (await redis.set(
    withNamespace(invocationLeaseKey(invocationId)),
    ownerId,
    'PX',
    ttlMs,
    'NX',
  )) === 'OK';

export const releaseLeaseWithClient = async (
  redis: ModuleAppRawRedisClient,
  invocationId: string,
  ownerId: string,
): Promise<void> => {
  await redis.eval(
    RELEASE_LEASE_SCRIPT,
    1,
    withNamespace(invocationLeaseKey(invocationId)),
    ownerId,
  );
};

const getClient = () => getRedisServiceClient('moduleApp');

export const moduleApp = {
  /** Consumes a replay nonce; `undefined` means Redis is unavailable. */
  async consumeReplay(rawKey: string, ttlSeconds: number) {
    const redis = await getClient();
    if (!redis) return;

    return (
      (await redis.set(replayKey(rawKey), '1', { ex: ttlSeconds, nx: true })) === 'OK'
    );
  },

  /** Applies one notification to the installation window. */
  async consumeNotificationRateLimit(
    installationId: string,
    window: ModuleAppNotificationWindow,
  ) {
    const redis = await getClient();
    if (!redis) return;

    const result = await redis.eval(
      NOTIFICATION_RATE_LIMIT_SCRIPT,
      1,
      notificationRateKey(installationId),
      window.now,
      window.windowMs,
      window.limit,
      window.eventId,
    );

    return Number(result) === 1;
  },

  /** Acquires one invocation lease; `undefined` means Redis is unavailable. */
  async acquireLease(invocationId: string, ownerId: string, ttlMs: number) {
    const redis = await getClient();
    if (!redis) return;

    return (
      (await redis.set(invocationLeaseKey(invocationId), ownerId, {
        nx: true,
        px: ttlMs,
      })) === 'OK'
    );
  },

  /** Releases a lease only when the caller still owns it. */
  async releaseLease(invocationId: string, ownerId: string) {
    const redis = await getClient();
    if (!redis) return;

    await redis.eval(RELEASE_LEASE_SCRIPT, 1, invocationLeaseKey(invocationId), ownerId);
    return true;
  },
};
