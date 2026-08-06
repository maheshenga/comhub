import { lambdaClient } from '@/libs/trpc/client';
import {
  type MobileWorkspaceRecentResponse,
  type RecentItem,
} from '@/server/routers/lambda/recent';

export interface RecentQueryOptions {
  limit?: number;
  types?: RecentItem['type'][];
  withTopicPreview?: boolean;
}

export interface MobileWorkspaceRecentQuery {
  cursor?: string;
  limit?: number;
  query?: string;
}

class RecentService {
  getAll = (
    input?: number | RecentQueryOptions,
    types?: RecentItem['type'][],
    withTopicPreview?: boolean,
  ): Promise<RecentItem[]> => {
    const query =
      typeof input === 'number' || input === undefined
        ? { limit: input, types, withTopicPreview }
        : input;
    return lambdaClient.recent.getAll.query(query);
  };

  getMobileWorkspace = (
    input: MobileWorkspaceRecentQuery = {},
  ): Promise<MobileWorkspaceRecentResponse> =>
    lambdaClient.recent.getMobileWorkspace.query(input);
}

export const recentService = new RecentService();
