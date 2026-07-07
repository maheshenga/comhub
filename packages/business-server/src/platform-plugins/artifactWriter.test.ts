import { platformPluginArtifacts } from '@/database/schemas';
import { describe, expect, it, vi } from 'vitest';

import { writePlatformPluginArtifact } from './artifactWriter';

describe('writePlatformPluginArtifact', () => {
  it('uploads artifact bytes and writes platform plugin artifact metadata', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'artifact-1' }]);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const storage = {
      uploadBuffer: vi.fn().mockResolvedValue({ key: 'platform-plugins/plugin-1/run-1/result.md' }),
    };

    const result = await writePlatformPluginArtifact({
      artifact: {
        content: '# Result',
        fileName: 'result.md',
        mimeType: 'text/markdown',
      },
      db: { insert } as any,
      pluginId: 'plugin-1',
      runId: 'run-1',
      storage,
      userId: 'user-a',
    });

    expect(storage.uploadBuffer).toHaveBeenCalledWith(
      expect.stringContaining('platform-plugins/plugin-1/run-1/'),
      Buffer.from('# Result'),
      'text/markdown',
    );
    expect(insert).toHaveBeenCalledWith(platformPluginArtifacts);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'result.md',
        mimeType: 'text/markdown',
        pluginId: 'plugin-1',
        runId: 'run-1',
        sizeBytes: 8,
        storageKey: 'platform-plugins/plugin-1/run-1/result.md',
        userId: 'user-a',
      }),
    );
    expect(result.id).toBe('artifact-1');
  });
});
