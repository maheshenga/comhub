import type { LobeChatDatabase } from '@lobechat/database';
import { ModuleAppBuildModel } from '@lobechat/database/models/moduleAppBuild';
import * as schema from '@lobechat/database/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type { ModuleAppWorkerConfig } from './config';
import { ModuleAppWorkerError } from './errors';

type Query = (
  text: string,
  values?: unknown[],
) => Promise<{ rows: Record<string, unknown>[] }>;

const boundedDatabaseNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const createModuleAppWorkerReadModel = (query: Query) => ({
  getQueueStats: async () => {
    const result = await query(`
      WITH eligible AS (
        SELECT CASE
          WHEN status = 'queued' THEN next_attempt_at
          ELSE claim_expires_at
        END AS eligible_at
        FROM module_app_builds
        WHERE attempt_count < 4
          AND (
            (status = 'queued' AND next_attempt_at <= NOW())
            OR (
              status = 'building'
              AND (
                claim_token IS NULL
                OR claim_expires_at IS NULL
                OR claim_expires_at <= NOW()
              )
            )
          )
      )
      SELECT
        COUNT(*)::text AS depth,
        COALESCE(
          EXTRACT(EPOCH FROM (NOW() - MIN(eligible_at))) * 1000,
          0
        )::text AS oldest_eligible_age_ms
      FROM eligible
    `);
    const row = result.rows[0];
    return {
      depth: Math.floor(boundedDatabaseNumber(row?.depth)),
      oldestEligibleAgeMs: boundedDatabaseNumber(
        row?.oldest_eligible_age_ms,
      ),
    };
  },
  isClaimActive: async (input: { buildId: string; claimToken: string }) => {
    const result = await query(
      `
        SELECT 1 AS active
        FROM module_app_builds
        WHERE id = $1
          AND claim_token = $2
          AND status = 'building'
          AND claim_expires_at > NOW()
        LIMIT 1
      `,
      [input.buildId, input.claimToken],
    );
    return result.rows.length > 0;
  },
});

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
  const readModel = createModuleAppWorkerReadModel((text, values) =>
    pool.query(text, values),
  );

  return {
    buildModel: Object.assign(new ModuleAppBuildModel(database), readModel),
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
