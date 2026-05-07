import type { LobeChatDatabase } from '@lobechat/database';
import type { Plans, type ReferralStatusString } from '@lobechat/types';
import { and, eq, sql } from 'drizzle-orm';

import { CommercialModel } from '@/database/models/commercial';
import { creditAccounts, creditLedgerEntries } from '@/database/schemas';
import type { Transaction } from '@/database/type';
import { APP_SETTING_KEYS, getAppSettingValue } from '@/server/services/appSettings';

export async function getReferralStatus(
  db: LobeChatDatabase,
  userId: string,
): Promise<ReferralStatusString | undefined> {
  const model = new CommercialModel(db, userId);
  return model.getReferralStatus();
}

export async function getSubscriptionPlan(db: LobeChatDatabase, userId: string): Promise<Plans> {
  const model = new CommercialModel(db, userId);
  return model.getCurrentPlan();
}

export async function initNewUserForBusiness(
  db: LobeChatDatabase,
  userId: string,
  createdAt: Date | null | undefined,
): Promise<void> {
  const model = new CommercialModel(db, userId);
  await model.ensureCreditAccount();

  const [enabled, amountValue] = await Promise.all([
    getAppSettingValue(APP_SETTING_KEYS.onboardingInitialCreditsEnabled, db),
    getAppSettingValue(APP_SETTING_KEYS.onboardingInitialCredits, db),
  ]);
  const amount = typeof amountValue === 'number' && amountValue > 0 ? Math.round(amountValue) : 0;

  if (enabled !== true || amount <= 0) return;

  await db.transaction(async (tx: Transaction) => {
    const existed = await tx.query.creditLedgerEntries.findFirst({
      where: and(
        eq(creditLedgerEntries.userId, userId),
        eq(creditLedgerEntries.referenceType, 'onboarding_initial_credits'),
        eq(creditLedgerEntries.referenceId, userId),
      ),
    });

    if (existed) return;

    await tx
      .insert(creditAccounts)
      .values({ balance: 0, totalCredited: 0, totalDebited: 0, userId })
      .onConflictDoNothing({ target: creditAccounts.userId });

    const grantedAt = createdAt ?? new Date();
    const [account] = await tx
      .update(creditAccounts)
      .set({
        balance: sql`${creditAccounts.balance} + ${amount}`,
        totalCredited: sql`${creditAccounts.totalCredited} + ${amount}`,
        updatedAt: grantedAt,
      })
      .where(eq(creditAccounts.userId, userId))
      .returning({ balance: creditAccounts.balance });

    await tx.insert(creditLedgerEntries).values({
      amount,
      balanceAfter: account?.balance ?? amount,
      description: 'Initial credits granted to new user',
      metadata: { source: 'app_settings' },
      referenceId: userId,
      referenceType: 'onboarding_initial_credits',
      title: 'Initial Credits',
      type: 'bonus',
      userId,
    });
  });
}
