import { describe, expect, it } from 'vitest';

import { createSharedRolldownOutput } from './sharedRendererConfig';

describe('createSharedRolldownOutput', () => {
  it('leaves ungrouped app modules unnamed for Rolldown code splitting', () => {
    const output = createSharedRolldownOutput();
    const group = output.codeSplitting.groups[0];

    expect(group.name('/project/src/services/_auth.ts')).toBeUndefined();
  });
});
