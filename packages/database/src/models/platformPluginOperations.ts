import type {
  PlatformPluginAdminStats,
  PlatformPluginBillingConfig,
  PlatformPluginOperationsMetadata,
  PlatformPluginRunStatus,
} from '@lobechat/types';
import { platformPluginOperationsMetadataSchema } from '@lobechat/types';

type MetadataRecord = Record<string, unknown> | null | undefined;
type RunStatsRow = { billingSnapshot?: Record<string, unknown> | null; status: PlatformPluginRunStatus };

const toRecord = (value: MetadataRecord): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const toCredits = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
};

export const readPlatformPluginOperationsMetadata = (
  metadata: MetadataRecord,
  sortOrder = 0,
): PlatformPluginOperationsMetadata => {
  const record = toRecord(metadata);
  const rawOperations = toRecord(record.operations as MetadataRecord);
  const parsed = platformPluginOperationsMetadataSchema.parse(rawOperations);

  return {
    ...parsed,
    sortWeight: rawOperations.sortWeight === undefined ? sortOrder : parsed.sortWeight,
  };
};

export const writePlatformPluginOperationsMetadata = (
  metadata: MetadataRecord,
  operations: PlatformPluginOperationsMetadata,
): Record<string, unknown> => ({
  ...toRecord(metadata),
  operations: platformPluginOperationsMetadataSchema.parse(operations),
});

export const summarizePlatformPluginAdminStats = (input: {
  billing: PlatformPluginBillingConfig;
  installationCount: number;
  runs: RunStatsRow[];
}): PlatformPluginAdminStats => {
  const succeededRuns = input.runs.filter((run) => run.status === 'succeeded').length;
  const failedRuns = input.runs.length - succeededRuns;
  const totalChargedCredits = input.runs.reduce(
    (sum, run) => sum + toCredits(run.billingSnapshot?.chargedCredits),
    0,
  );

  return {
    failedRuns,
    fixedServiceFeeCredits: toCredits(input.billing.fixedServiceFeeCredits),
    installations: input.installationCount,
    runs: input.runs.length,
    successRate: input.runs.length === 0 ? 0 : Number(((succeededRuns / input.runs.length) * 100).toFixed(1)),
    succeededRuns,
    totalChargedCredits,
  };
};
