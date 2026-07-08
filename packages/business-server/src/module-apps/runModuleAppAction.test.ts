import { describe, expect, it, vi } from 'vitest';

import { runModuleAppAction } from './runModuleAppAction';

const APP_ID = '00000000-0000-4000-8000-000000000001';

describe('runModuleAppAction record actions', () => {
  it('does not charge credits for record_create', async () => {
    const model = {
      createRecord: vi.fn().mockResolvedValue({ id: 'record-1' }),
      createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      updateRun: vi.fn().mockResolvedValue({ ok: true }),
    };

    const result = await runModuleAppAction({
      action: {
        id: 'create_record',
        inputSchema: { fields: [] },
        moduleMultiplier: 1,
        name: 'Create',
        outputSchema: {},
        runtimeConfig: {},
        runtimeType: 'record_create',
      },
      appId: APP_ID,
      input: { title: 'A' },
      model: model as never,
      scopeType: 'personal',
      userId: 'u1',
    });

    expect(result).toMatchObject({
      artifactIds: [],
      billing: { chargedCredits: 0, fixedServiceFeeCharged: false },
      preview: 'A',
      runId: 'run-1',
      status: 'succeeded',
    });
    expect(model.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: APP_ID,
        collectionKey: 'records',
        data: { title: 'A' },
        scopeType: 'personal',
        title: 'A',
        userId: 'u1',
      }),
    );
    expect(model.updateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        billing: { chargedCredits: 0, fixedServiceFeeCharged: false },
        output: { preview: 'A', recordId: 'record-1' },
        runId: 'run-1',
        status: 'succeeded',
      }),
    );
  });

  it('does not charge credits for record_update', async () => {
    const model = {
      createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      updateRecord: vi.fn().mockResolvedValue({ id: 'record-1' }),
      updateRun: vi.fn().mockResolvedValue({ ok: true }),
    };

    const result = await runModuleAppAction({
      action: {
        id: 'update_record',
        inputSchema: { fields: [] },
        moduleMultiplier: 1,
        name: 'Update',
        outputSchema: {},
        runtimeConfig: { collectionKey: 'items' },
        runtimeType: 'record_update',
      },
      appId: APP_ID,
      input: { title: 'Updated' },
      model: model as never,
      recordId: 'record-1',
      scopeType: 'personal',
      userId: 'u1',
    });

    expect(result.billing.chargedCredits).toBe(0);
    expect(model.updateRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionKey: 'items',
        recordId: 'record-1',
        title: 'Updated',
      }),
    );
  });

  it('does not charge credits for record_archive', async () => {
    const model = {
      archiveRecord: vi.fn().mockResolvedValue({ ok: true }),
      createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      updateRun: vi.fn().mockResolvedValue({ ok: true }),
    };

    const result = await runModuleAppAction({
      action: {
        id: 'archive_record',
        inputSchema: { fields: [] },
        moduleMultiplier: 1,
        name: 'Archive',
        outputSchema: {},
        runtimeConfig: {},
        runtimeType: 'record_archive',
      },
      appId: APP_ID,
      input: {},
      model: model as never,
      recordId: 'record-1',
      scopeType: 'personal',
      userId: 'u1',
    });

    expect(result).toMatchObject({
      billing: { chargedCredits: 0, fixedServiceFeeCharged: false },
      preview: 'Archived',
      status: 'succeeded',
    });
    expect(model.archiveRecord).toHaveBeenCalledWith({
      appId: APP_ID,
      recordId: 'record-1',
      userId: 'u1',
    });
  });
});
