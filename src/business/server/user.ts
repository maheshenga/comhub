import type { LobeChatDatabase } from '@lobechat/database';
import { type ReferralStatusString } from '@lobechat/types';
import { Plans } from '@lobechat/types';

import { CommercialModel } from '@/database/models/commercial';

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
  void createdAt;

  const model = new CommercialModel(db, userId);
  await model.ensureCreditAccount();
}
