import type { PlatformPluginDetail } from '@lobechat/types';
import { Plans } from '@lobechat/types';
import { describe, expect, it, vi } from 'vitest';

import { runPlatformPlugin } from './runPlatformPlugin';

const pluginId = '00000000-0000-4000-8000-000000000001';

const detail: PlatformPluginDetail = {
  actions: [
    {
      id: 'research_notes',
      inputSchema: { fields: [] },
      moduleMultiplier: 2,
      name: 'Research Notes',
      runtimeType: 'content_generation',
    },
  ],
  billing: {
    defaultMultiplier: 1.5,
    externalApiCostCredits: 0,
    failureFixedFeePolicy: 'do_not_charge',
    fixedServiceFeeCredits: 10,
  },
  category: 'productivity',
  description: 'Generate structured notes.',
  displayName: 'Research Notes',
  entitlements: [
    {
      discountPercent: 0,
      freeQuotaCredits: 0,
      installable: true,
      plan: Plans.Free,
      runnable: true,
      visible: true,
    },
  ],
  icon: 'FileText',
  id: pluginId,
  installed: true,
  operations: { featured: false, sortWeight: 0 },
  planState: { installable: true, runnable: true, visible: true },
  runtimeType: 'content_generation',
  slug: 'research-notes',
  status: 'published',
  tags: [],
  version: '1.0.0',
};

describe('runPlatformPlugin', () => {
  it('records failed runs without charging fixed service fee', async () => {
    const createRun = vi.fn().mockResolvedValue({ id: 'run-1' });
    const updateRun = vi.fn().mockResolvedValue(undefined);
    const writeAuditLog = vi.fn().mockResolvedValue(undefined);
    const preCharge = vi.fn().mockResolvedValue({ creditAccountId: 'user-a' });
    const postCharge = vi.fn().mockResolvedValue({ id: 'ledger-1' });
    const runnerError = Object.assign(new Error('UPSTREAM_TIMEOUT'), { aiActualCredits: 42 });

    const result = await runPlatformPlugin({
      action: detail.actions[0],
      actionDbId: '00000000-0000-4000-8000-000000000011',
      agentBound: true,
      agentId: 'agt_001',
      commercialModel: { postCharge, preCharge },
      currentPlan: Plans.Free,
      detail,
      input: { topic: 'apple' },
      installed: true,
      pluginId,
      repository: { createRun, updateRun, writeAuditLog },
      runner: vi.fn().mockRejectedValue(runnerError),
      userId: 'user-a',
      versionId: '00000000-0000-4000-8000-000000000010',
    });

    expect(result.status).toBe('failed');
    expect(result.billing.fixedServiceFeeCharged).toBe(false);
    expect(result.billing.chargedCredits).toBe(126);
    expect(postCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        credits: 126,
        referenceId: 'run-1',
        referenceType: 'platform_plugin_run',
        source: 'platform_plugin',
      }),
    );
    expect(updateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        billingSnapshot: expect.objectContaining({ fixedServiceFeeCharged: false }),
        errorMessage: 'UPSTREAM_TIMEOUT',
        errorType: 'platform_plugin_runtime_error',
        runId: 'run-1',
        status: 'failed',
      }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'platform_plugin.run_failed',
        resourceId: pluginId,
      }),
    );
  });

  it('does not charge the fixed service fee when artifact writing fails after runner success', async () => {
    const createRun = vi.fn().mockResolvedValue({ id: 'run-1' });
    const updateRun = vi.fn().mockResolvedValue(undefined);
    const writeAuditLog = vi.fn().mockResolvedValue(undefined);
    const preCharge = vi.fn().mockResolvedValue({ creditAccountId: 'user-a' });
    const postCharge = vi.fn().mockResolvedValue({ id: 'ledger-1' });
    const uploadBuffer = vi.fn().mockRejectedValue(new Error('ARTIFACT_UPLOAD_FAILED'));

    const result = await runPlatformPlugin({
      action: detail.actions[0],
      actionDbId: '00000000-0000-4000-8000-000000000011',
      agentBound: true,
      agentId: 'agt_001',
      artifactStorage: { uploadBuffer },
      commercialModel: { postCharge, preCharge },
      currentPlan: Plans.Free,
      db: {} as any,
      detail,
      input: { topic: 'apple' },
      installed: true,
      pluginId,
      repository: { createRun, updateRun, writeAuditLog },
      runner: vi.fn().mockResolvedValue({
        aiActualCredits: 0,
        artifacts: [
          {
            content: '# Apple Notes',
            fileName: 'apple-notes.md',
            mimeType: 'text/markdown',
          },
        ],
        outputSnapshot: { text: '# Apple Notes' },
        preview: '# Apple Notes',
      }),
      userId: 'user-a',
      versionId: '00000000-0000-4000-8000-000000000010',
    });

    expect(result.status).toBe('failed');
    expect(result.billing.fixedServiceFeeCharged).toBe(false);
    expect(result.billing.chargedCredits).toBe(0);
    expect(postCharge).not.toHaveBeenCalled();
    expect(updateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        billingSnapshot: expect.objectContaining({ fixedServiceFeeCharged: false }),
        errorMessage: 'ARTIFACT_UPLOAD_FAILED',
        status: 'failed',
      }),
    );
  });
});
