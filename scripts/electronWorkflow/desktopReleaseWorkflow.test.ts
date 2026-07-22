import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

const workflowPath = path.resolve(__dirname, '../../.github/workflows/comhub-desktop-release.yml');

describe('desktop release workflow contract', () => {
  it('binds all shell data through env and keeps the immutable server-release lifecycle structural', async () => {
    const document = parseDocument(await readFile(workflowPath, 'utf8'));
    const workflow = document.toJS() as any;
    const jobs = workflow.jobs as Record<string, any>;
    const build = jobs['build-windows'];
    const publish = jobs.publish;
    const buildSteps = build.steps as Array<any>;
    const publishSteps = publish.steps as Array<any>;
    const findStep = (steps: Array<any>, name: string) => steps.find((step) => step.name === name);

    expect(document.errors).toEqual([]);
    expect(workflow.on.workflow_dispatch.inputs.release_id).toBeDefined();
    expect(workflow.concurrency.group).toBe('comhub-desktop-${{ inputs.channel }}');

    for (const step of [...buildSteps, ...publishSteps]) {
      if (!step.run) continue;
      expect(step.run).not.toContain('${{');
      expect(step.run).not.toContain('echo "$RELEASE_TOKEN"');
      expect(step.run).not.toContain('echo "$DESKTOP_RELEASE_TOKEN"');
    }

    const stage = findStep(buildSteps, 'Stage immutable desktop build profile');
    expect(stage.if).toContain("inputs.release_id != ''");
    expect(stage.env).toMatchObject({
      PROFILE_STAGE_DIR: '${{ runner.temp }}/desktop-build-profile',
      RELEASE_ID: '${{ inputs.release_id }}',
    });
    expect(stage.run).toContain('"$PROFILE_STAGE_DIR"');
    expect(stage.run).toContain('DESKTOP_BUILD_PROFILE_PATH');
    expect(build.outputs.profile_revision_id).toBe(
      '${{ steps.stage_profile.outputs.profile_revision_id }}',
    );

    const rejectUnpublished = findStep(buildSteps, 'Reject unpublished server release');
    expect(rejectUnpublished.if).toContain("inputs.release_id != ''");
    expect(rejectUnpublished.if).toContain("inputs.publish != 'true'");
    expect(rejectUnpublished.env).toMatchObject({
      RELEASE_ID: '${{ inputs.release_id }}',
      VERSION: '${{ inputs.version }}',
      WORKFLOW_RUN_ID: '${{ github.run_id }}',
      WORKFLOW_RUN_URL:
        'https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}',
    });
    expect(rejectUnpublished.run).toContain('Desktop release publish was disabled.');
    expect(rejectUnpublished.run).toContain('status failed');

    const started = findStep(buildSteps, 'Report build started');
    expect(started.env).toMatchObject({
      PROFILE_REVISION_ID: '${{ steps.stage_profile.outputs.profile_revision_id }}',
      VERSION: '${{ inputs.version }}',
      WORKFLOW_RUN_URL:
        'https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}',
    });
    expect(started.run).toContain('status building');
    expect(started.run).toContain('workflowRunId');
    expect(started.run).toContain('workflowRunUrl');

    const buildFailure = findStep(buildSteps, 'Report build failure');
    expect(buildFailure.if).toContain('failure()');
    expect(buildFailure.if).toContain("inputs.release_id != ''");
    expect(buildFailure.if).toContain("steps.reject_unpublished.outputs.reported != 'true'");
    expect(buildFailure.run).toContain('Desktop release build failed.');
    expect(buildFailure.run).toContain('status failed');
    expect(buildFailure.run).not.toContain('profileRevisionId');
    expect(buildFailure.env).toMatchObject({
      WORKFLOW_RUN_ID: '${{ github.run_id }}',
      WORKFLOW_RUN_URL:
        'https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}',
    });

    expect(publish.if).toContain("inputs.publish == 'true'");
    const publishing = findStep(publishSteps, 'Report publishing');
    expect(publishing.run).toContain('status publishing');
    expect(publishing.env.PROFILE_REVISION_ID).toBe(
      '${{ needs.build-windows.outputs.profile_revision_id }}',
    );
    const succeeded = findStep(publishSteps, 'Report release succeeded');
    expect(succeeded.if).toContain("inputs.release_id != ''");
    expect(succeeded.run).toContain('status succeeded');
    expect(succeeded.env.VERSION).toBe('${{ inputs.version }}');
    expect(publishSteps.indexOf(succeeded)).toBeGreaterThan(
      publishSteps.findIndex((step) => step.name === 'Publish to S3-compatible storage'),
    );
    const publishFailure = findStep(publishSteps, 'Report publish failure');
    expect(publishFailure.if).toContain('failure()');
    expect(publishFailure.run).toContain('Desktop release publish failed.');
    expect(publishFailure.run).not.toContain('profileRevisionId');
    expect(publishFailure.env).toMatchObject({
      WORKFLOW_RUN_ID: '${{ github.run_id }}',
      WORKFLOW_RUN_URL:
        'https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}',
    });

    const manualUpdate = findStep(publishSteps, 'Update backend desktop settings');
    expect(manualUpdate.if).toContain("inputs.release_id == ''");
    expect(manualUpdate.if).toContain("inputs.update_backend == 'true'");
  });
});
