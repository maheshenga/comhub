import { router } from '@/libs/trpc/lambda';

import { adminAuditRouter } from './audit-router';
import { adminCreditsRouter } from './credits';
import { adminPlansRouter } from './plans';
import { adminRedemptionRouter } from './redemption';
import { adminSettingsRouter } from './settings';
import { adminStatsRouter } from './stats';
import { adminSubscriptionsRouter } from './subscriptions';
import { adminTopUpPackagesRouter } from './topupPackages';
import { adminUsersRouter } from './users';

export const adminRouter = router({
  audit: adminAuditRouter,
  credits: adminCreditsRouter,
  plans: adminPlansRouter,
  redemption: adminRedemptionRouter,
  settings: adminSettingsRouter,
  stats: adminStatsRouter,
  subscriptions: adminSubscriptionsRouter,
  topupPackages: adminTopUpPackagesRouter,
  users: adminUsersRouter,
});
