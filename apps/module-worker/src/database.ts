import type { LobeChatDatabase } from '@lobechat/database';
import { ModuleAppBuildModel } from '@lobechat/database/models/moduleAppBuild';
import * as schema from '@lobechat/database/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type { ModuleAppWorkerConfig } from './config';
import { ModuleAppWorkerError } from './errors';

export const createModuleAppWorkerDatabase = (
  config: ModuleAppWorkerConfig,
) => {
  const pool = new Pool({
    application_name: 'comhub-module-worker',
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    max: 4,
    statement_timeout: 120_000,
  });
  pool.on('error', () => undefined);

  const database = drizzle(pool, { schema }) as unknown as LobeChatDatabase;

  return {
    buildModel: new ModuleAppBuildModel(database),
    close: () => pool.end(),
    ping: async () => {
      try {
        await pool.query('select 1');
      } catch (error) {
        throw new ModuleAppWorkerError(
          'MODULE_APP_BUILD_POSTGRESQL_UNAVAILABLE',
          'retryable',
          error,
        );
      }
    },
  };
};
