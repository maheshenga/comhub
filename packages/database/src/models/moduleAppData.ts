import { type ModuleAppTableInput,moduleAppTableSchema } from '@lobechat/types';
import { and, eq } from 'drizzle-orm';

import { moduleAppDataRows, moduleAppDataSchemas } from '../schemas';
import type { LobeChatDatabase } from '../type';

export class ModuleAppDataModel {
  constructor(private readonly db: LobeChatDatabase) {}

  createSchema = async (input: {
    createdBy?: string;
    installationId: string;
    schema: ModuleAppTableInput;
    tableKey: string;
    version: number;
  }) => {
    const schema = moduleAppTableSchema.parse(input.schema);
    if (schema.key !== input.tableKey) throw new Error('MODULE_APP_DATA_SCHEMA_KEY_MISMATCH');

    const [created] = await this.db
      .insert(moduleAppDataSchemas)
      .values({
        createdBy: input.createdBy,
        installationId: input.installationId,
        schemaSnapshot: schema,
        tableKey: input.tableKey,
        version: input.version,
      })
      .returning();
    if (!created) throw new Error('MODULE_APP_DATA_SCHEMA_CREATE_FAILED');
    return created;
  };

  getSchema = (input: { installationId: string; tableKey: string; version: number }) =>
    this.db.query.moduleAppDataSchemas.findFirst({
      where: and(
        eq(moduleAppDataSchemas.installationId, input.installationId),
        eq(moduleAppDataSchemas.tableKey, input.tableKey),
        eq(moduleAppDataSchemas.version, input.version),
      ),
    });

  insertRow = async (input: {
    actorUserId?: string;
    installationId: string;
    rowKey: string;
    schemaVersion: number;
    tableKey: string;
    values: Record<string, unknown>;
  }) =>
    this.db.transaction(async (tx) => {
      const schema = await tx.query.moduleAppDataSchemas.findFirst({
        columns: { id: true },
        where: and(
          eq(moduleAppDataSchemas.installationId, input.installationId),
          eq(moduleAppDataSchemas.tableKey, input.tableKey),
          eq(moduleAppDataSchemas.version, input.schemaVersion),
          eq(moduleAppDataSchemas.status, 'active'),
        ),
      });
      if (!schema) throw new Error('MODULE_APP_DATA_SCHEMA_NOT_FOUND');

      const [created] = await tx
        .insert(moduleAppDataRows)
        .values({
          createdBy: input.actorUserId,
          installationId: input.installationId,
          rowKey: input.rowKey,
          schemaVersion: input.schemaVersion,
          tableKey: input.tableKey,
          updatedBy: input.actorUserId,
          values: input.values,
        })
        .returning();
      if (!created) throw new Error('MODULE_APP_DATA_ROW_CREATE_FAILED');
      return created;
    });

  getRow = async (input: { installationId: string; rowKey: string; tableKey: string }) => {
    const row = await this.db.query.moduleAppDataRows.findFirst({
      where: and(
        eq(moduleAppDataRows.installationId, input.installationId),
        eq(moduleAppDataRows.tableKey, input.tableKey),
        eq(moduleAppDataRows.rowKey, input.rowKey),
      ),
    });
    return row ?? null;
  };
}
