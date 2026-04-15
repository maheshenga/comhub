import { eq } from 'drizzle-orm';

import { type NewSiteConfigItem, type SiteConfigItem, siteConfig } from '../schemas';
import type { LobeChatDatabase } from '../type';

/**
 * SiteConfig model — global (not user-scoped).
 * Each row is a key-value pair in the `site_config` table.
 */
export class SiteConfigModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  getAll = async (): Promise<SiteConfigItem[]> => {
    return this.db.query.siteConfig.findMany();
  };

  get = async (key: string): Promise<SiteConfigItem | undefined> => {
    return this.db.query.siteConfig.findFirst({
      where: eq(siteConfig.key, key),
    });
  };

  getValue = async (key: string): Promise<string | null> => {
    const row = await this.get(key);
    return row?.value ?? null;
  };

  set = async (key: string, value: string | null, updatedBy?: string): Promise<SiteConfigItem> => {
    const [result] = await this.db
      .insert(siteConfig)
      .values({ key, updatedAt: new Date(), updatedBy, value })
      .onConflictDoUpdate({
        set: { updatedAt: new Date(), updatedBy, value },
        target: siteConfig.key,
      })
      .returning();

    return result;
  };

  bulkSet = async (
    entries: Array<{ key: string; value: string | null }>,
    updatedBy?: string,
  ): Promise<void> => {
    await this.db.transaction(async (tx) => {
      for (const { key, value } of entries) {
        await tx
          .insert(siteConfig)
          .values({ key, updatedAt: new Date(), updatedBy, value })
          .onConflictDoUpdate({
            set: { updatedAt: new Date(), updatedBy, value },
            target: siteConfig.key,
          });
      }
    });
  };

  delete = async (key: string) => {
    return this.db.delete(siteConfig).where(eq(siteConfig.key, key));
  };

  /**
   * Get all non-encrypted configs as a flat key-value map.
   */
  getPublicMap = async (): Promise<Record<string, string | null>> => {
    const rows = await this.db.query.siteConfig.findMany({
      where: eq(siteConfig.encrypted, false),
    });

    const map: Record<string, string | null> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  };
}
