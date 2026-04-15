import { desc, eq } from 'drizzle-orm';

import { type NewPlanItem, type PlanItem, plans } from '../schemas';
import type { LobeChatDatabase } from '../type';

export class PlanModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  getAll = async (): Promise<PlanItem[]> => {
    return this.db.query.plans.findMany({
      orderBy: [desc(plans.sort)],
    });
  };

  getEnabled = async (): Promise<PlanItem[]> => {
    return this.db.query.plans.findMany({
      where: eq(plans.enabled, true),
      orderBy: [desc(plans.sort)],
    });
  };

  getById = async (id: string): Promise<PlanItem | undefined> => {
    return this.db.query.plans.findFirst({
      where: eq(plans.id, id),
    });
  };

  create = async (data: NewPlanItem): Promise<PlanItem> => {
    const [result] = await this.db.insert(plans).values(data).returning();
    return result;
  };

  update = async (id: string, data: Partial<NewPlanItem>): Promise<PlanItem> => {
    const [result] = await this.db
      .update(plans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(plans.id, id))
      .returning();
    return result;
  };

  delete = async (id: string) => {
    return this.db.delete(plans).where(eq(plans.id, id));
  };
}
