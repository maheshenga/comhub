import { lambdaClient } from '@/libs/trpc/client';
import { type RecentItem } from '@/server/routers/lambda/recent';

export interface RecentQueryOptions {
  limit?: number;
  types?: RecentItem['type'][];
}

class RecentService {
  getAll = (input?: number | RecentQueryOptions): Promise<RecentItem[]> => {
    const query = typeof input === 'number' || input === undefined ? { limit: input } : input;
    return lambdaClient.recent.getAll.query(query);
  };
}

export const recentService = new RecentService();
