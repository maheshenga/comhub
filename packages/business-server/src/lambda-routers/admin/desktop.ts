import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { DesktopBuildModel, isDesktopBuildProfileCursor } from '@/database/models/desktopBuild';
import type { DesktopBuildProfileItem } from '@/database/schemas/desktopBuild';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';
import { FileS3 } from '@/server/modules/S3';
import {
  completeDesktopBuildAsset,
  createDesktopBuildAssetUpload,
  validateDesktopBuildAssetManifest,
} from '@/server/services/desktopBuild/assets';
import { getDesktopReleaseDiagnostics } from '@/server/services/desktopRelease';
import {
  DesktopReleaseDispatchError,
  dispatchDesktopReleaseWorkflow,
} from '@/server/services/desktopRelease/github';

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
const createDesktopReleaseCommand = createAdminCommand('desktop.release.dispatch');

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

export const adminDesktopRouter = router({
  archiveBuildProfile: systemWriteProcedure
    .input(z.object({ profileId: z.string().uuid() }).strict())
    .mutation(async ({ ctx, input }) => {
      const model = new DesktopBuildModel(ctx.serverDB);

      return runRequiredAdminAuditMutation<DesktopBuildProfileItem>(ctx, {
        audit: (profile) => ({
          action: archiveBuildProfileCommand.definition.auditAction,
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
          key: z.string().min(1).max(1024),
          kind: assetKindSchema,
          profileId: z.string().uuid(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const storage = new FileS3();

      return runRequiredAdminAuditExternalEffect(ctx, {
        audit: (_status, asset) => ({
          action: completeBuildAssetCommand.definition.auditAction,
          payload: {
            kind: input.kind,
            profileId: input.profileId,
            ...(asset ? { key: asset.key, sha256: asset.sha256, size: asset.size } : {}),
          },
          resourceId: input.profileId,
          resourceType: 'desktopBuildProfile',
        }),
        effect: () => completeDesktopBuildAsset({ ...input, storage }),
      });
    }),
  createBuildAssetUpload: systemWriteProcedure
    .input(z.object({ kind: assetKindSchema, profileId: z.string().uuid().optional() }).strict())
    .mutation(({ input }) => createDesktopBuildAssetUpload({ input, storage: new FileS3() })),
  createDesktopRelease: systemWriteProcedure
    .input(desktopReleaseInputSchema)
    .mutation(async ({ ctx, input }) => {
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

      const frozen = await model.freezeDraftForRelease({
        actorUserId: ctx.userId,
        ...input,
      });
      const auditPayload = {
        channel: input.channel,
        profileId: input.profileId,
        releaseId: frozen.release.id,
        revisionId: frozen.revision.id,
        version: input.version,
      };

      return runRequiredAdminAuditExternalEffect(ctx, {
        audit: () => ({
          action: createDesktopReleaseCommand.definition.auditAction,
          payload: auditPayload,
          resourceId: frozen.release.id,
          resourceType: 'desktopRelease',
        }),
        effect: async () => {
          try {
            await dispatchDesktopReleaseWorkflow({
              channel: input.channel,
              releaseId: frozen.release.id,
              releaseNotes: input.releaseNotes,
              version: input.version,
            });
          } catch (error) {
            await model.markReleaseResult({
              errorSummary: dispatchFailureSummary(error),
              releaseId: frozen.release.id,
              status: 'failed',
            });
            throw error;
          }

          return model.markReleaseDispatched({
            actorUserId: ctx.userId,
            releaseId: frozen.release.id,
          });
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
      configuredChannel: settings.desktopUpdateConfig.channel,
      configuredVersion: settings.desktopUpdateConfig.currentVersion || null,
      diagnostics,
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
  saveBuildProfileDraft: systemWriteProcedure
    .input(
      z
        .object({
          assets: assetManifestSchema,
          createIfMissing: z.boolean().optional(),
          name: z.string().trim().min(1).max(255),
          payload: z.unknown(),
          profileId: z.string().uuid(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const storage = new FileS3();
      const assets = await validateDesktopBuildAssetManifest({
        manifest: input.assets,
        profileId: input.profileId,
        storage,
      });
      const payload = parseDesktopBuildProfilePayload(input.payload);
      const model = new DesktopBuildModel(ctx.serverDB);

      return runRequiredAdminAuditMutation<SavedDraft>(ctx, {
        audit: (result) => ({
          action: saveBuildProfileDraftCommand.definition.auditAction,
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
              name: input.name,
              payload,
              profileId: input.profileId,
            },
            tx,
          ),
      });
    }),
});
