import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  normalizeDesktopDownloadUrl,
  normalizeDesktopUpdateServerUrl,
} from '@/const/desktopUpdate';
import { DesktopBuildModel } from '@/database/models/desktopBuild';
import { appSettings } from '@/database/schemas';
import { getServerDB } from '@/database/server';
import { APP_SETTING_KEYS, invalidateServerAppSettings } from '@/server/services/appSettings';

import { isDesktopReleaseAuthorized, resolveDesktopReleaseToken } from './auth';

const DEFAULT_GITHUB_REPOSITORY = 'maheshenga/comhub';
const GITHUB_REPOSITORY_PATTERN = /^[\w.-]+\/[\w.-]+$/;

const bodySchema = z
  .object({
    channel: z.enum(['stable', 'canary']).default('stable'),
    downloadLabel: z.string().optional(),
    downloadUrl: z.string().optional(),
    errorSummary: z.string().max(1024).optional(),
    profileRevisionId: z.string().uuid().optional(),
    releaseId: z.string().uuid().optional(),
    releaseNotes: z.string().optional(),
    serverUrl: z.string().optional(),
    status: z.enum(['building', 'failed', 'publishing', 'queued', 'succeeded']).optional(),
    version: z.string().trim().min(1),
    workflowRunId: z.string().trim().min(1).max(64).regex(/^\d+$/).optional(),
    workflowRunUrl: z.string().trim().max(2048).optional(),
  })
  .superRefine((input, ctx) => {
    const releaseCallback = input.releaseId !== undefined;
    if (
      releaseCallback &&
      (!input.status || (input.status !== 'failed' && !input.profileRevisionId))
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'release callback is incomplete' });
    }
    if (releaseCallback && (!input.workflowRunId || !input.workflowRunUrl)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'workflow run metadata is incomplete' });
    }
    if (releaseCallback && input.workflowRunUrl && input.workflowRunId) {
      const repository = process.env.DESKTOP_RELEASE_GITHUB_REPOSITORY ?? DEFAULT_GITHUB_REPOSITORY;
      if (!GITHUB_REPOSITORY_PATTERN.test(repository)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'GitHub repository is invalid' });
        return;
      }
      try {
        const url = new URL(input.workflowRunUrl);
        if (
          url.protocol !== 'https:' ||
          url.hostname !== 'github.com' ||
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          url.pathname !== `/${repository}/actions/runs/${input.workflowRunId}`
        ) {
          throw new Error('invalid');
        }
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'workflowRunUrl is not allowed' });
      }
    }
  });

const upsertSetting = async (db: any, key: string, value: unknown) =>
  db
    .insert(appSettings)
    .values({ key, value: value as any })
    .onConflictDoUpdate({
      set: { updatedAt: new Date(), value: value as any },
      target: appSettings.key,
    });

const getBearerToken = (request: NextRequest) =>
  (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();

const getPublicSettingUpdates = (input: z.infer<typeof bodySchema>) => {
  const normalizedServerUrl = normalizeDesktopUpdateServerUrl(input.serverUrl);
  if ('reason' in normalizedServerUrl) {
    throw new Error(`serverUrl is not allowed: ${normalizedServerUrl.reason}`);
  }
  const normalizedDownloadUrl = normalizeDesktopDownloadUrl(input.downloadUrl);
  if ('reason' in normalizedDownloadUrl) {
    throw new Error(`downloadUrl is not allowed: ${normalizedDownloadUrl.reason}`);
  }
  const serverUrl = normalizedServerUrl.url || undefined;
  const downloadUrl = normalizedDownloadUrl.url || undefined;

  const updates: Array<{ key: string; value: unknown }> = [
    { key: APP_SETTING_KEYS.desktopUpdateChannel, value: input.channel },
    { key: APP_SETTING_KEYS.desktopUpdateCurrentVersion, value: input.version },
  ];
  if (serverUrl) updates.push({ key: APP_SETTING_KEYS.desktopUpdateServerUrl, value: serverUrl });
  if (input.releaseNotes !== undefined) {
    updates.push({
      key: APP_SETTING_KEYS.desktopUpdateReleaseNotes,
      value: input.releaseNotes.trim(),
    });
  }
  if (downloadUrl) updates.push({ key: APP_SETTING_KEYS.desktopDownloadUrl, value: downloadUrl });
  if (input.downloadLabel !== undefined) {
    updates.push({ key: APP_SETTING_KEYS.desktopDownloadLabel, value: input.downloadLabel.trim() });
  }
  return updates;
};

const writePublicSettings = async (db: any, input: z.infer<typeof bodySchema>): Promise<number> => {
  const updates = getPublicSettingUpdates(input);
  for (const update of updates) await upsertSetting(db, update.key, update.value);
  return updates.length;
};

const releaseTransitionError = (error: unknown) =>
  error instanceof Error &&
  [
    'DESKTOP_RELEASE_INVALID_TRANSITION',
    'DESKTOP_RELEASE_TERMINAL',
    'DESKTOP_RELEASE_WORKFLOW_RUN_MISMATCH',
  ].includes(error.message);

export const POST = async (req: NextRequest) => {
  const token = getBearerToken(req);
  const db = await getServerDB();
  let expected: null | string;
  try {
    expected = await resolveDesktopReleaseToken(db);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!expected || !isDesktopReleaseAuthorized(token, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'invalid_request' },
      { status: 400 },
    );
  }

  if (!input.releaseId) {
    try {
      const count = await db.transaction((tx: any) => writePublicSettings(tx, input));
      invalidateServerAppSettings();
      return NextResponse.json({ count, ok: true });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
  }

  const model = new DesktopBuildModel(db);
  const release = await model.getRelease(input.releaseId);
  if (!release) return NextResponse.json({ error: 'release_not_found' }, { status: 404 });
  if (
    input.status === 'failed' &&
    !input.profileRevisionId &&
    (release.workflowRunId || release.workflowRunUrl)
  ) {
    return NextResponse.json({ error: 'release callback is incomplete' }, { status: 400 });
  }
  if (input.profileRevisionId && release.frozenRevisionId !== input.profileRevisionId) {
    return NextResponse.json({ error: 'release_revision_mismatch' }, { status: 409 });
  }

  try {
    if (input.status === 'succeeded') {
      const count = await db.transaction(async (tx: any) => {
        await model.markReleaseResult(
          {
            errorSummary: input.errorSummary,
            releaseId: input.releaseId!,
            status: input.status!,
            workflowRunId: input.workflowRunId,
            workflowRunUrl: input.workflowRunUrl,
          },
          tx,
        );
        return writePublicSettings(tx, input);
      });
      invalidateServerAppSettings();
      return NextResponse.json({ count, ok: true });
    }

    await db.transaction((tx: any) =>
      model.markReleaseResult(
        {
          errorSummary: input.errorSummary,
          releaseId: input.releaseId!,
          status: input.status!,
          workflowRunId: input.workflowRunId,
          workflowRunUrl: input.workflowRunUrl,
        },
        tx,
      ),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (releaseTransitionError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 409 });
    }
    throw error;
  }
};
