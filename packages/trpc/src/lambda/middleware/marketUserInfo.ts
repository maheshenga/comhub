import { type LobeChatDatabase } from '@lobechat/database';

import { UserModel } from '@/database/models/user';
import { type TrustedClientUserInfo } from '@/libs/trusted-client';

import { trpc } from '../init';

interface ContextWithServerDB {
  marketAccessToken?: string;
  serverDB?: LobeChatDatabase;
  userId?: string | null;
  workspaceId?: string | null;
}

const createMarketUserInfoMiddleware = (options: { includePersistedMarketToken: boolean }) =>
  trpc.middleware(async (opts) => {
    const ctx = opts.ctx as ContextWithServerDB;

    // If userId or serverDB is not available, skip fetching user info
    if (!ctx.userId || !ctx.serverDB) {
      return opts.next({
        ctx: { marketUserInfo: undefined },
      });
    }

    try {
      const user = await UserModel.findById(ctx.serverDB, ctx.userId);

      if (!user || !user.email) {
        return opts.next({
          ctx: { marketUserInfo: undefined },
        });
      }

      const marketUserInfo: TrustedClientUserInfo = {
        email: user.email,
        name: user.fullName || user.username || undefined,
        userId: ctx.userId,
        // In a workspace context, the token acts as the workspace's mirrored
        // organization; absent for personal requests.
        ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
      };

      if (!options.includePersistedMarketToken) {
        return opts.next({
          ctx: {
            marketAccessToken: ctx.marketAccessToken,
            marketUserInfo,
          },
        });
      }

      // Fetch market access token from user_settings.market
      const userModel = new UserModel(ctx.serverDB, ctx.userId);
      const userSettings = await userModel.getUserSettings();
      const marketTokenFromDB = (userSettings?.market as any)?.accessToken;

      // Prioritize database token over cookie token for user-scoped Market operations.
      const marketAccessToken = marketTokenFromDB || ctx.marketAccessToken;

      return opts.next({
        ctx: {
          marketAccessToken,
          marketUserInfo,
        },
      });
    } catch {
      // If fetching user info fails, continue without it
      return opts.next({ ctx: { marketUserInfo: undefined } });
    }
  });

/**
 * Middleware that fetches user info for Market trusted client authentication
 * This requires serverDatabase middleware to be applied first
 */
export const marketUserInfo = createMarketUserInfoMiddleware({
  includePersistedMarketToken: true,
});

/**
 * Public Market discovery requests should keep the request-scoped token
 * (usually the M2M cookie) instead of a persisted user OIDC token, which may
 * expire independently and should not block public community data.
 */
export const marketPublicUserInfo = createMarketUserInfoMiddleware({
  includePersistedMarketToken: false,
});
