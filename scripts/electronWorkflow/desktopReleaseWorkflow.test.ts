import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

const workflowPath = path.resolve(__dirname, '../../.github/workflows/comhub-desktop-release.yml');
const publishActionPath = path.resolve(
  __dirname,
  '../../.github/actions/desktop-publish-s3/action.yml',
);

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
    expect(workflow['run-name']).toBe(
      'ComHub Desktop ${{ inputs.version }} (${{ inputs.channel }}) [${{ inputs.release_id }}]',
    );
    expect(workflow.concurrency.group).toBe('comhub-desktop-${{ inputs.channel }}');

    const releaseCallbackSteps = [
      findStep(buildSteps, 'Reject unpublished server release'),
      findStep(buildSteps, 'Report build started'),
      findStep(buildSteps, 'Report build failure'),
      findStep(publishSteps, 'Report publishing'),
      findStep(publishSteps, 'Report release succeeded'),
      findStep(publishSteps, 'Report publish failure'),
    ];
    for (const step of releaseCallbackSteps) {
      expect(step.env.WORKFLOW_RUN_ATTEMPT).toBe('${{ github.run_attempt }}');
      expect(step.run).toContain('--argjson workflowRunAttempt "$WORKFLOW_RUN_ATTEMPT"');
      expect(step.run).toContain('workflowRunAttempt:$workflowRunAttempt');
    }

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
    expect(rejectUnpublished.run).not.toContain('profileRevisionId');
    expect(rejectUnpublished.env).not.toHaveProperty('PROFILE_REVISION_ID');

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
    expect(buildFailure.env).toMatchObject({
      PROFILE_REVISION_ID: '${{ steps.stage_profile.outputs.profile_revision_id }}',
      WORKFLOW_RUN_ID: '${{ github.run_id }}',
      WORKFLOW_RUN_URL:
        'https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}',
    });
    expect(buildFailure.run).toContain('--arg profileRevisionId "$PROFILE_REVISION_ID"');

    expect(publish.if).toContain("inputs.publish == 'true'");
    const publishing = findStep(publishSteps, 'Report publishing');
    expect(publishing.run).toContain('status publishing');
    expect(publishing.env.PROFILE_REVISION_ID).toBe(
      '${{ needs.build-windows.outputs.profile_revision_id }}',
    );
    const succeeded = findStep(publishSteps, 'Report release succeeded');
    expect(succeeded.if).toContain("inputs.release_id != ''");
    expect(succeeded.run).toContain('status succeeded');
    expect(succeeded.env).toMatchObject({
      VERSION: '${{ inputs.version }}',
      WORKFLOW_RUN_ID: '${{ github.run_id }}',
      WORKFLOW_RUN_URL:
        'https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}',
    });
    expect(publishSteps.indexOf(succeeded)).toBeGreaterThan(
      publishSteps.findIndex((step) => step.name === 'Publish to S3-compatible storage'),
    );
    const publishFailure = findStep(publishSteps, 'Report publish failure');
    expect(publishFailure.if).toContain('failure()');
    expect(publishFailure.run).toContain('Desktop release publish failed.');
    expect(publishFailure.env).toMatchObject({
      PROFILE_REVISION_ID: '${{ needs.build-windows.outputs.profile_revision_id }}',
      WORKFLOW_RUN_ID: '${{ github.run_id }}',
      WORKFLOW_RUN_URL:
        'https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}',
    });
    expect(publishFailure.run).toContain('--arg profileRevisionId "$PROFILE_REVISION_ID"');

    const manualUpdate = findStep(publishSteps, 'Update backend desktop settings');
    expect(manualUpdate.if).toContain("inputs.release_id == ''");
    expect(manualUpdate.if).toContain("inputs.update_backend == 'true'");
  });

  it('omits the profile revision field from an unbound build-failure payload', async () => {
    const workflow = parseDocument(await readFile(workflowPath, 'utf8')).toJS() as any;
    const buildFailure = workflow.jobs['build-windows'].steps.find(
      (step: any) => step.name === 'Report build failure',
    );

    expect(buildFailure.run).toContain(
      '\'{errorSummary:$errorSummary,releaseId:$releaseId,status:$status,version:$version,workflowRunAttempt:$workflowRunAttempt,workflowRunId:$workflowRunId,workflowRunUrl:$workflowRunUrl} + (if $profileRevisionId == "" then {} else {profileRevisionId:$profileRevisionId} end)\'',
    );
  });

  it('fails a server release without S3 publication configuration before success', async () => {
    const workflow = parseDocument(await readFile(workflowPath, 'utf8')).toJS() as any;
    const publishSteps = workflow.jobs.publish.steps as Array<any>;
    const findStep = (name: string) => publishSteps.find((step) => step.name === name);
    const requirePublication = findStep('Require S3 publication configuration for server release');
    const publishing = findStep('Report publishing');
    const succeeded = findStep('Report release succeeded');
    const failed = findStep('Report publish failure');

    expect(requirePublication.if).toBe("${{ inputs.release_id != '' }}");
    expect(requirePublication.env).toEqual({
      S3_BUCKET: '${{ secrets.DESKTOP_RELEASE_S3_BUCKET }}',
    });
    expect(requirePublication.run).toContain('if [ -z "$S3_BUCKET" ]; then');
    expect(requirePublication.run).toContain('exit 1');
    expect(publishSteps.indexOf(requirePublication)).toBeLessThan(publishSteps.indexOf(publishing));
    expect(publishSteps.indexOf(requirePublication)).toBeLessThan(publishSteps.indexOf(succeeded));
    expect(publishSteps.indexOf(requirePublication)).toBeLessThan(publishSteps.indexOf(failed));
    expect(succeeded.if).toBe("${{ inputs.release_id != '' }}");
    expect(failed.if).toContain('failure()');
    expect(failed.if).toContain("inputs.release_id != ''");
    expect(failed.run).toContain('Desktop release publish failed.');
  });

  it('binds every shell-facing S3 publish action input through step env', async () => {
    const document = parseDocument(await readFile(publishActionPath, 'utf8'));
    const action = document.toJS() as any;
    const steps = action.runs.steps as Array<any>;
    const listing = steps.find((step) => step.name === 'List artifacts to upload');

    expect(document.errors).toEqual([]);
    for (const step of steps) {
      if (step.run) expect(step.run).not.toContain('${{ inputs.');
    }
    expect(listing.env).toEqual({
      CHANNEL: '${{ inputs.channel }}',
      VERSION: '${{ inputs.version }}',
    });
    expect(listing.run).toContain('Version: $VERSION, Channel: $CHANNEL');
  });

  it('validates every dispatched desktop version before build setup', async () => {
    const workflow = parseDocument(await readFile(workflowPath, 'utf8')).toJS() as any;
    const buildSteps = workflow.jobs['build-windows'].steps as Array<any>;
    const findStep = (name: string) => buildSteps.find((step) => step.name === name);
    const validation = findStep('Validate desktop release version');
    const setup = findStep('Setup desktop build');

    expect(validation.env).toEqual({ VERSION: '${{ inputs.version }}' });
    expect(validation.run).toContain('SEMVER_PATTERN=');
    expect(validation.run).toContain('if ! [[ "$VERSION" =~ $SEMVER_PATTERN ]]; then');
    expect(buildSteps.indexOf(validation)).toBeGreaterThan(
      buildSteps.findIndex((step) => step.name === 'Checkout'),
    );
    expect(buildSteps.indexOf(validation)).toBeLessThan(buildSteps.indexOf(setup));
  });
});
