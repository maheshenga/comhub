import { eq } from 'drizzle-orm';

import { creditAccounts } from '@/database/schemas';
import { trpc } from '@/libs/trpc/lambda/init';

export const checkFileStorageUsage = trpc.middleware(async (opts) => {
  const userId = opts.ctx.userId;

  if (!userId) {
    return opts.next();
  }

  const db = (opts.ctx as any).serverDB;
  if (!db) {
    return opts.next();
  }

  const [account] = await db
    .select({ storageQuota: creditAccounts.storageQuota, storageUsed: creditAccounts.storageUsed })
    .from(creditAccounts)
    .where(eq(creditAccounts.userId, userId))
    .limit(1);

  if (!account || account.storageQuota === null) {
    return opts.next();
  }

  if (Number(account.storageUsed) >= Number(account.storageQuota)) {
    throw new Error('StorageQuotaExceeded');
  }

  return opts.next();
});
