import { describe, expect, it } from 'vitest';

import {
  readPlatformPluginOperationsMetadata,
  summarizePlatformPluginAdminStats,
  writePlatformPluginOperationsMetadata,
} from './platformPluginOperations';

describe('platformPluginOperations model helpers', () => {
  it('reads operations metadata and falls back to sortOrder', () => {
    expect(readPlatformPluginOperationsMetadata({}, 7)).toEqual({ featured: false, sortWeight: 7 });
    expect(
      readPlatformPluginOperationsMetadata(
        { operations: { featured: true, promoLabel: 'Hot', sortWeight: 12 } },
        7,
      ),
    ).toEqual({ featured: true, promoLabel: 'Hot', sortWeight: 12 });
  });

  it('writes operations metadata without dropping unrelated metadata', () => {
    expect(
      writePlatformPluginOperationsMetadata(
        { importedBy: 'seed' },
        { featured: true, planBenefitSummary: 'Pro benefit', sortWeight: 5 },
      ),
    ).toEqual({
      importedBy: 'seed',
      operations: { featured: true, planBenefitSummary: 'Pro benefit', sortWeight: 5 },
    });
  });

  it('summarizes admin stats from installation count and run snapshots', () => {
    expect(
      summarizePlatformPluginAdminStats({
        billing: { defaultMultiplier: 1.35, externalApiCostCredits: 20, fixedServiceFeeCredits: 10 },
        installationCount: 2,
        runs: [
          { billingSnapshot: { chargedCredits: 32 }, status: 'succeeded' },
          { billingSnapshot: { chargedCredits: 0 }, status: 'failed' },
          { billingSnapshot: { chargedCredits: 10 }, status: 'denied' },
        ],
      }),
    ).toEqual({
      failedRuns: 2,
      fixedServiceFeeCredits: 10,
      installations: 2,
      runs: 3,
      successRate: 33.3,
      succeededRuns: 1,
      totalChargedCredits: 42,
    });
  });
});
