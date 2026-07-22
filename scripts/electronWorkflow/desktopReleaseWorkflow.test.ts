import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

const workflowPath = path.resolve(__dirname, '../../.github/workflows/comhub-desktop-release.yml');

describe('desktop release workflow contract', () => {
  it('keeps manual dispatch compatibility while binding server releases to staged profiles and callbacks', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    const document = parseDocument(workflow);

    expect(document.errors).toEqual([]);
    expect(workflow).toContain('release_id:');
    expect(workflow).toContain('RUNNER_TEMP/desktop-build-profile');
    expect(workflow).toContain('DESKTOP_BUILD_PROFILE_PATH');
    expect(workflow).toContain('status building');
    expect(workflow).toContain('status publishing');
    expect(workflow).toContain('status succeeded');
    expect(workflow).toContain('status failed');
    expect(workflow).toContain('workflowRunId');
    expect(workflow).toContain('workflowRunUrl');
    expect(workflow).toContain("inputs.release_id == ''");
    expect(workflow).toContain('comhub-desktop-${{ inputs.channel }}');
    expect(workflow).not.toContain('echo "$RELEASE_TOKEN"');
    expect(workflow).not.toContain('echo "$DESKTOP_RELEASE_TOKEN"');
  });
});
