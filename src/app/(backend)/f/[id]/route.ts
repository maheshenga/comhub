// SECURITY: P0 fix 2026-04-27 - file proxy now requires auth + ownership check
import debug from 'debug';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { FileModel } from '@/database/models/file';
import { getRedisConfig } from '@/envs/redis';
import { initializeRedis, isRedisEnabled } from '@/libs/redis';
import { FileService } from '@/server/services/file';

const log = debug('lobe-file:proxy');

type Params = Promise<{ id: string }>;

const FILE_PROXY_KEY_PREFIX = 'file-proxy:';
// Cache presigned URL for 4 minutes (URL expires in 5 minutes)
const PRESIGNED_URL_CACHE_TTL = 240;

const buildCacheKey = (id: string) => `${FILE_PROXY_KEY_PREFIX}${id}`;

interface CachedFileData {
  redirectUrl: string;
}

/**
 * File proxy service
 * GET /f/:id
 *
 * Features:
 * - Requires authenticated session; returns 401 if not logged in
 * - Query database to get file record and verify ownership; returns 403 if not owner
 * - Generate access URL based on platform (desktop → local file, web → S3 presigned URL)
 * - Cache presigned URL in Redis to reduce S3 API calls
 * - Return 302 redirect
 */
const handler = checkAuth(async (req: Request, { userId, serverDB }) => {
  // Re-parse params from the original URL since checkAuth passes a spoofed provider param
  const url = new URL(req.url);
  // Path is /f/<id> — extract the last segment
  const id = url.pathname.split('/').at(-1);

  if (!id) {
    return new Response('Bad request', { status: 400 });
  }

  log('File proxy request: %s (user: %s)', id, userId);

  try {
    // Try to get cached presigned URL from Redis
    const redisConfig = getRedisConfig();
    const redisClient = isRedisEnabled(redisConfig) ? await initializeRedis(redisConfig) : null;

    const cacheKey = buildCacheKey(`${userId}:${id}`);
    if (redisClient) {
      const cachedStr = await redisClient.get(cacheKey);
      const cached = cachedStr ? (JSON.parse(cachedStr) as CachedFileData) : null;
      if (cached?.redirectUrl) {
        log('Cache hit for file: %s', id);
        return Response.redirect(cached.redirectUrl, 302);
      }
      log('Cache miss for file: %s', id);
    }

    // Query file record
    const file = await FileModel.getFileById(serverDB, id);

    if (!file) {
      log('File not found: %s', id);
      return new Response('File not found', { status: 404 });
    }

    // Ownership check: only the file owner may access via this proxy
    if (file.userId !== userId) {
      log('Access denied for file: %s (owner: %s, requester: %s)', id, file.userId, userId);
      return new Response('Forbidden', { status: 403 });
    }

    // Create file service with authenticated owner's userId
    const fileService = new FileService(serverDB, userId);

    // Web: Generate S3 presigned URL (5 minutes expiry)
    const redirectUrl = await fileService.createPreSignedUrlForPreview(file.url, 300);
    log('Web S3 presigned URL generated (expires in 5 min)');

    // Cache the presigned URL in Redis (keyed by userId + fileId to prevent cross-user cache hits)
    if (redisClient) {
      await redisClient.set(cacheKey, JSON.stringify({ redirectUrl }), {
        ex: PRESIGNED_URL_CACHE_TTL,
      });
      log('Cached presigned URL for file: %s (TTL: %ds)', id, PRESIGNED_URL_CACHE_TTL);
    }

    // Return 302 redirect
    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('File proxy error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});

export const GET = (req: Request, segmentData: { params: Params }) =>
  handler(req, { params: Promise.resolve({ provider: 'file-proxy' }) });
