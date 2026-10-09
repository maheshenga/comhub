import { randomUUID } from 'node:crypto';

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { DesktopBuildModel, isDesktopBuildProfileCursor } from '@/database/models/desktopBuild';
import type { DesktopBuildProfileItem, DesktopReleaseItem } from '@/database/schemas/desktopBuild';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';
import { FileS3 } from '@/server/modules/S3';
import { invalidateServerAppSettings } from '@/server/services/appSettings';
import {
  completeDesktopBuildAsset,
  createDesktopBuildAssetUpload,
  validateDesktopBuildAssetManifest,
} from '@/server/services/desktopBuild/assets';
import { getDesktopReleaseDiagnostics } from '@/server/services/desktopRelease';
import {
  DesktopReleaseDispatchError,
  dispatchDesktopReleaseWorkflow,
  getDesktopReleaseAutomationHealth,
  reconcileDesktopReleaseWorkflow,
  retryDesktopReleaseWorkflow,
} from '@/server/services/desktopRelease/github';
import {
  normalizeDesktopReleasePublication,
  writeDesktopReleasePublicationSettings,
} from '@/server/services/desktopRelease/publication';

import { buildDesktopSettings } from '../../appSettings/adminReadModel';
import { loadAppSettingsSectionSnapshot } from '../../appSettings/loader';
import {
  desktopReleaseInputSchema,
  parseDesktopBuildProfilePayload,
} from '../../desktopBuild/contract';
import { createAdminCommand } from './adminCommand';
import { runRequiredAdminAuditExternalEffect, runRequiredAdminAuditMutation } from './audit';

const systemReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemRead);
const systemWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemWrite);
const DESKTOP_RELEASE_RERUN_RECONCILE_GRACE_MS = 5 * 60_000;

const assetKindSchema = z.enum(['appPreview', 'windowsIcon', 'nsisHeader', 'nsisSidebar']);
const assetSchema = z
  .object({
    contentType: z.string().max(128),
    height: z.number().int().positive().optional(),
    key: z.string().min(1).max(1024),
    kind: assetKindSchema,
    sha256: z.string().min(1).max(128),
    size: z.number().int().nonnegative(),
    width: z.number().int().positive().optional(),
  })
  .strict();
const assetManifestSchema = z
  .object({
    appPreview: assetSchema,
    nsisHeader: assetSchema,
    nsisSidebar: assetSchema,
    windowsIcon: assetSchema,
  })
  .strict();

const completeBuildAssetCommand = createAdminCommand('desktop.buildAsset.complete');
const archiveBuildProfileCommand = createAdminCommand('desktop.buildProfile.archive');
const saveBuildProfileDraftCommand = createAdminCommand('desktop.buildProfile.saveDraft');
const activateDesktopReleaseCommand = createAdminCommand('desktop.release.activate');
const createDesktopReleaseCreationCommand = createAdminCommand('desktop.release.create');
const createDesktopReleaseCommand = createAdminCommand('desktop.release.dispatch');
const reconcileDesktopReleaseCommand = createAdminCommand('desktop.release.reconcile');
const retryDesktopReleaseCommand = createAdminCommand('desktop.release.retry');

const serializeRevision = (revision: any) => {
  if (!revision) return null;

  return {
    assetManifest: revision.assetManifest,
    createdAt: revision.createdAt,
    id: revision.id,
    payload: revision.payload,
    profileId: revision.profileId,
    revision: revision.revision,
    state: revision.state,
  };
};

const serializeProfile = (profile: any, currentDraftRevision?: any) => {
  return {
    createdAt: profile.createdAt,
    currentDraft: serializeRevision(currentDraftRevision),
    currentDraftRevisionId: profile.currentDraftRevisionId,
    currentRevision: profile.currentRevision,
    firstStableReleaseAt: profile.firstStableReleaseAt,
    id: profile.id,
    identityLocked: Boolean(profile.firstStableReleaseAt),
    name: profile.name,
    status: profile.status,
    updatedAt: profile.updatedAt,
  };
};

const assetAuditPayload = (
  assets: Record<string, { key: string; kind: string; sha256: string; size: number }>,
) => Object.values(assets).map(({ key, kind, sha256, size }) => ({ key, kind, sha256, size }));

type SavedDraft = { profileId: string; revision: number; revisionId: string };

const dispatchFailureSummary = (error: unknown) =>
  error instanceof DesktopReleaseDispatchError ? error.summary : 'Desktop release dispatch failed.';

const isDefinitiveDispatchFailure = (error: unknown) =>
  error instanceof DesktopReleaseDispatchError && error.delivery === 'definitive';

const throwDesktopReleaseRetryError = (error: unknown): never => {
  if (error instanceof Error && error.message === 'DESKTOP_RELEASE_NOT_FOUND') {
    throw new TRPCError({ cause: error, code: 'NOT_FOUND', message: error.message });
  }
  if (
    error instanceof Error &&
    ['DESKTOP_RELEASE_RETRY_NOT_ALLOWED', 'DESKTOP_RELEASE_WORKFLOW_RUN_METADATA_INVALID'].includes(
      error.message,
    )
  ) {
    throw new TRPCError({ cause: error, code: 'CONFLICT', message: error.message });
  }
  throw error;
};

const throwDesktopReleaseReconcileError = (error: unknown): never => {
  if (error instanceof Error && error.message === 'DESKTOP_RELEASE_NOT_FOUND') {
    throw new TRPCError({ cause: error, code: 'NOT_FOUND', message: error.message });
  }
  if (
    error instanceof Error &&
    [
      'DESKTOP_RELEASE_WORKFLOW_RUN_BIND_NOT_ALLOWED',
      'DESKTOP_RELEASE_WORKFLOW_RUN_ATTEMPT_MISMATCH',
      'DESKTOP_RELEASE_WORKFLOW_RUN_METADATA_INVALID',
      'DESKTOP_RELEASE_WORKFLOW_RUN_MISMATCH',
    ].includes(error.message)
  ) {
    throw new TRPCError({
      cause: error,
      code: 'CONFLICT',
      message: 'DESKTOP_RELEASE_RECONCILE_CONFLICT',
    });
  }
  throw error;
};

export const adminDesktopRouter = router({
  activateDesktopRelease: systemWriteProcedure
    .input(
      z
        .object({
          command: activateDesktopReleaseCommand.schema,
          reason: z.string().min(1).max(500).optional(),
          releaseId: z.string().uuid(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const command = activateDesktopReleaseCommand.validate(input.command, input.reason);
      const model = new DesktopBuildModel(ctx.serverDB);
      const release = await model.getRelease(input.releaseId);
      if (!release) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'DESKTOP_RELEASE_NOT_FOUND' });
      }
      if (
        release.status !== 'succeeded' ||
        !release.publishedDownloadUrl ||
        !release.publishedServerUrl
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'DESKTOP_RELEASE_ACTIVATION_NOT_ALLOWED',
        });
      }

      let publication;
      try {
        publication = normalizeDesktopReleasePublication({
          channel: release.channel,
          downloadUrl: release.publishedDownloadUrl,
          releaseNotes: release.releaseNotes,
          serverUrl: release.publishedServerUrl,
          version: release.version,
        });
        if (!publication.downloadUrl || !publication.serverUrl) {
          throw new Error('DESKTOP_RELEASE_PUBLICATION_INCOMPLETE');
        }
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: 'BAD_REQUEST',
          message: 'DESKTOP_RELEASE_PUBLICATION_INVALID',
        });
      }

      const activated = await runRequiredAdminAuditMutation<DesktopReleaseItem>(ctx, {
        audit: (result) => ({
          action: command.auditAction,
          payload: {
            ...(command.reason ? { reason: command.reason } : {}),
            channel: result.channel,
            releaseId: result.id,
            version: result.version,
          },
          resourceId: result.id,
          resourceType: 'desktopRelease',
        }),
        mutation: async (tx) => {
          await writeDesktopReleasePublicationSettings(tx, publication);
          return release;
        },
      });
      await invalidateServerAppSettings();
      return activated;
    }),
  archiveBuildProfile: systemWriteProcedure
    .input(
      z
        .object({
          command: archiveBuildProfileCommand.schema,
          profileId: z.string().uuid(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const command = archiveBuildProfileCommand.validate(input.command);
      const model = new DesktopBuildModel(ctx.serverDB);

      return runRequiredAdminAuditMutation<DesktopBuildProfileItem>(ctx, {
        audit: (profile) => ({
          action: command.auditAction,
          payload: { profileId: profile.id },
          resourceId: profile.id,
          resourceType: 'desktopBuildProfile',
        }),
        mutation: (tx) =>
          model.archiveProfile({ actorUserId: ctx.userId, profileId: input.profileId }, tx),
      });
    }),
  completeBuildAssetUpload: systemWriteProcedure
    .input(
      z
        .object({
          command: completeBuildAssetCommand.schema,
          key: z.string().min(1).max(1024),
          kind: assetKindSchema,
          profileId: z.string().uuid(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const command = completeBuildAssetCommand.validate(input.command);
      const storage = new FileS3();

      return runRequiredAdminAuditExternalEffect(ctx, {
        audit: (_status, asset) => ({
          action: command.auditAction,
          payload: {
            kind: input.kind,
            profileId: input.profileId,
            ...(asset ? { key: asset.key, sha256: asset.sha256, size: asset.size } : {}),
          },
          resourceId: input.profileId,
          resourceType: 'desktopBuildProfile',
        }),
        effect: () =>
          completeDesktopBuildAsset({
            key: input.key,
            kind: input.kind,
            profileId: input.profileId,
            storage,
          }),
      });
    }),
  createBuildAssetUpload: systemWriteProcedure
    .input(z.object({ kind: assetKindSchema, profileId: z.string().uuid().optional() }).strict())
    .mutation(({ input }) => createDesktopBuildAssetUpload({ input, storage: new FileS3() })),
  createDesktopRelease: systemWriteProcedure
    .input(
      desktopReleaseInputSchema.extend({
        command: createDesktopReleaseCreationCommand.schema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Dual-command reuse point (catalog §6.3): one mutation dispatches both
      // the `desktop.release.create` freeze audit and the
      // `desktop.release.dispatch` workflow audit. The envelope actionId may
      // match either sibling command; the validated sibling supplies the
      // confirmation/semantics, and the other audit action derives from its
      // catalog definition so both stay catalog-true.
      const parsedActionId = (input.command as { actionId?: string } | null | undefined)?.actionId;
      const envelopeMatchesDispatch = parsedActionId === 'desktop.release.dispatch';
      const validated = envelopeMatchesDispatch
        ? createDesktopReleaseCommand.validate(input.command)
        : createDesktopReleaseCreationCommand.validate(input.command);
      const creationCommand = {
        ...validated,
        auditAction: createDesktopReleaseCreationCommand.definition.auditAction,
      };
      const dispatchCommand = {
        ...validated,
        auditAction: createDesktopReleaseCommand.definition.auditAction,
      };
      const model = new DesktopBuildModel(ctx.serverDB);
      const profile = await model.getProfile(input.profileId);
      if (!profile)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'DESKTOP_BUILD_PROFILE_NOT_FOUND' });
      if (!profile.currentDraftRevisionId)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'DESKTOP_BUILD_DRAFT_NOT_FOUND' });

      const draft = await model.getRevision(profile.currentDraftRevisionId);
      if (!draft)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'DESKTOP_BUILD_DRAFT_NOT_FOUND' });

      await validateDesktopBuildAssetManifest({
        manifest: draft.assetManifest,
        profileId: input.profileId,
        storage: new FileS3(),
      });
      parseDesktopBuildProfilePayload(draft.payload);

      const frozenRevisionId = randomUUID();
      const releaseId = randomUUID();
      const auditPayload = {
        channel: input.channel,
        profileId: input.profileId,
        releaseId,
        revisionId: frozenRevisionId,
        version: input.version,
      };

      return runRequiredAdminAuditExternalEffect(ctx, {
        audit: () => ({
          action: dispatchCommand.auditAction,
          payload: { ...auditPayload, ...(dispatchCommand.reason ? { reason: dispatchCommand.reason } : {}) },
          resourceId: releaseId,
          resourceType: 'desktopRelease',
        }),
        effect: async () => {
          await runRequiredAdminAuditMutation(ctx, {
            audit: () => ({
              action: creationCommand.auditAction,
              payload: auditPayload,
              resourceId: releaseId,
              resourceType: 'desktopRelease',
            }),
            mutation: (tx) =>
              model.freezeDraftForRelease(
                {
                  actorUserId: ctx.userId,
                  channel: input.channel,
                  expectedDraftRevisionId: draft.id,
                  frozenRevisionId,
                  profileId: input.profileId,
                  releaseId,
                  releaseNotes: input.releaseNotes,
                  version: input.version,
                },
                tx,
              ),
          });
          const building = await model.markReleaseDispatched({
            actorUserId: ctx.userId,
            releaseId,
          });

          try {
            await dispatchDesktopReleaseWorkflow({
              channel: input.channel,
              releaseId,
              releaseNotes: input.releaseNotes,
              version: input.version,
            });
          } catch (error) {
            if (isDefinitiveDispatchFailure(error)) {
              await model.markReleaseResult({
                errorSummary: dispatchFailureSummary(error),
                releaseId,
                status: 'failed',
              });
            }
            throw error;
          }

          return building;
        },
      });
    }),
  getBuildProfile: systemReadProcedure
    .input(z.object({ profileId: z.string().uuid() }).strict())
    .query(async ({ ctx, input }) => {
      const model = new DesktopBuildModel(ctx.serverDB);
      const profile = await model.getProfile(input.profileId);
      if (!profile)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'DESKTOP_BUILD_PROFILE_NOT_FOUND' });
      const revision = profile.currentDraftRevisionId
        ? await model.getRevision(profile.currentDraftRevisionId)
        : null;
      return serializeProfile(profile, revision);
    }),
  getOverview: systemReadProcedure.query(async ({ ctx }) => {
    const settings = buildDesktopSettings(
      await loadAppSettingsSectionSnapshot(ctx.serverDB, 'desktop-update'),
    );
    const diagnostics = await getDesktopReleaseDiagnostics({
      baseUrl: settings.desktopUpdateConfig.serverUrl,
    });

    return {
      automation: getDesktopReleaseAutomationHealth(),
      configuredChannel: settings.desktopUpdateConfig.channel,
      configuredVersion: settings.desktopUpdateConfig.currentVersion || null,
      diagnostics,
      runtimePolicy: {
        autoCheck: settings.desktopUpdateConfig.autoCheck,
        channel: settings.desktopUpdateConfig.channel,
        checkInterval: settings.desktopUpdateConfig.checkInterval,
      },
    };
  }),
  listBuildProfiles: systemReadProcedure
    .input(
      z
        .object({
          cursor: z
            .string()
            .min(1)
            .max(512)
            .refine(isDesktopBuildProfileCursor, {
              message: 'DESKTOP_BUILD_PROFILE_CURSOR_INVALID',
            })
            .optional(),
          limit: z.number().int().min(1).max(100).optional().default(50),
        })
        .strict()
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const model = new DesktopBuildModel(ctx.serverDB);
      let page: Awaited<ReturnType<DesktopBuildModel['listProfiles']>>;
      try {
        page = await model.listProfiles(input);
      } catch (error) {
        if (error instanceof Error && error.message === 'DESKTOP_BUILD_PROFILE_CURSOR_INVALID') {
          throw new TRPCError({ cause: error, code: 'BAD_REQUEST', message: error.message });
        }
        throw error;
      }
      const revisionIds = page.items.flatMap((profile) =>
        profile.currentDraftRevisionId ? [profile.currentDraftRevisionId] : [],
      );
      const revisions = await model.getRevisionsByIds(revisionIds);
      const revisionsById = new Map(revisions.map((revision) => [revision.id, revision]));

      return {
        items: page.items.map((profile) =>
          serializeProfile(
            profile,
            profile.currentDraftRevisionId
              ? revisionsById.get(profile.currentDraftRevisionId)
              : null,
          ),
        ),
        nextCursor: page.nextCursor,
      };
    }),
  listDesktopReleases: systemReadProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).optional(),
          profileId: z.string().uuid().optional(),
        })
        .strict()
        .optional(),
    )
    .query(({ ctx, input }) => new DesktopBuildModel(ctx.serverDB).listReleases(input)),
  reconcileDesktopRelease: systemWriteProcedure
    .input(
      z
        .object({
          command: reconcileDesktopReleaseCommand.schema,
          releaseId: z.string().uuid(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const command = reconcileDesktopReleaseCommand.validate(input.command);
      const model = new DesktopBuildModel(ctx.serverDB);
      const release = await model.getRelease(input.releaseId);
      if (!release) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'DESKTOP_RELEASE_NOT_FOUND' });
      }
      if (release.status !== 'building' || !release.dispatchedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'DESKTOP_RELEASE_RECONCILE_NOT_ALLOWED',
        });
      }

      return runRequiredAdminAuditExternalEffect(ctx, {
        audit: (status, result) => ({
          action: command.auditAction,
          payload: {
            lifecycleStatus: status,
            releaseId: release.id,
            ...(result
              ? {
                  reconciliationState: result.state,
                  ...(result.state === 'matched'
                    ? {
                        githubConclusion: result.conclusion,
                        githubStatus: result.status,
                        workflowRunAttempt: result.workflowRunAttempt,
                        workflowRunId: result.workflowRunId,
                      }
                    : { candidateCount: result.candidateCount, reason: result.reason }),
                }
              : {}),
          },
          resourceId: release.id,
          resourceType: 'desktopRelease',
        }),
        effect: async () => {
          const result = await reconcileDesktopReleaseWorkflow({
            channel: release.channel,
            dispatchedAt: release.dispatchedAt!,
            releaseId: release.id,
            version: release.version,
            workflowRunId: release.workflowRunId,
          });
          if (result.state === 'matched') {
            if (
              release.workflowRunAttemptPending &&
              release.workflowRunAttempt !== null &&
              result.workflowRunAttempt === release.workflowRunAttempt
            ) {
              const expired = await model.expirePendingReleaseRetry({
                releaseId: release.id,
                requestedBefore: new Date(Date.now() - DESKTOP_RELEASE_RERUN_RECONCILE_GRACE_MS),
                workflowRunAttempt: result.workflowRunAttempt,
              });

              return {
                candidateCount: 1,
                reason: expired ? ('rerun-not-delivered' as const) : ('rerun-pending' as const),
                state: 'unresolved' as const,
              };
            }

            try {
              await model.bindReleaseWorkflowRun({
                releaseId: release.id,
                workflowRunAttempt: result.workflowRunAttempt,
                workflowRunId: result.workflowRunId,
                workflowRunUrl: result.workflowRunUrl,
              });
            } catch (error) {
              throwDesktopReleaseReconcileError(error);
            }
          }
          return result;
        },
      });
    }),
  retryDesktopRelease: systemWriteProcedure
    .input(
      z
        .object({
          command: retryDesktopReleaseCommand.schema,
          releaseId: z.string().uuid(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const command = retryDesktopReleaseCommand.validate(input.command);
      const model = new DesktopBuildModel(ctx.serverDB);

      return runRequiredAdminAuditExternalEffect(ctx, {
        audit: (status, result) => ({
          action: command.auditAction,
          payload: {
            lifecycleStatus: status,
            releaseId: input.releaseId,
            ...(result
              ? { retryMode: result.workflowRunId ? 'workflow-rerun' : 'workflow-dispatch' }
              : {}),
          },
          resourceId: input.releaseId,
          resourceType: 'desktopRelease',
        }),
        effect: async () => {
          const building = await model
            .prepareReleaseRetry({
              actorUserId: ctx.userId,
              releaseId: input.releaseId,
            })
            .catch(throwDesktopReleaseRetryError);

          try {
            await retryDesktopReleaseWorkflow({
              channel: building.channel,
              releaseId: building.id,
              releaseNotes: building.releaseNotes,
              version: building.version,
              workflowRunId: building.workflowRunId,
            });
          } catch (error) {
            if (isDefinitiveDispatchFailure(error)) {
              await model.markReleaseResult({
                errorSummary: dispatchFailureSummary(error),
                releaseId: building.id,
                status: 'failed',
              });
            }
            throw error;
          }

          return building;
        },
      });
    }),
  saveBuildProfileDraft: systemWriteProcedure
    .input(
      z
        .object({
          assets: assetManifestSchema,
          command: saveBuildProfileDraftCommand.schema,
          createIfMissing: z.boolean().optional(),
          expectedRevision: z.number().int().nonnegative(),
          name: z.string().trim().min(1).max(255),
          payload: z.unknown(),
          profileId: z.string().uuid(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const command = saveBuildProfileDraftCommand.validate(input.command);
      const storage = new FileS3();
      const assets = await validateDesktopBuildAssetManifest({
        manifest: input.assets,
        profileId: input.profileId,
        storage,
      });
      const payload = parseDesktopBuildProfilePayload(input.payload);
      const model = new DesktopBuildModel(ctx.serverDB);

      try {
        return await runRequiredAdminAuditMutation<SavedDraft>(ctx, {
          audit: (result) => ({
            action: command.auditAction,
            payload: {
              assets: assetAuditPayload(assets),
              profileId: result.profileId,
              revisionId: result.revisionId,
            },
            resourceId: result.profileId,
            resourceType: 'desktopBuildProfile',
          }),
          mutation: (tx) =>
            model.saveDraft(
              {
                actorUserId: ctx.userId,
                assets,
                createIfMissing: input.createIfMissing,
                expectedRevision: input.expectedRevision,
                name: input.name,
                payload,
                profileId: input.profileId,
              },
              tx,
            ),
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'DESKTOP_BUILD_PROFILE_REVISION_CONFLICT') {
          throw new TRPCError({ code: 'CONFLICT', message: error.message });
        }
        throw error;
      }
    }),
});
