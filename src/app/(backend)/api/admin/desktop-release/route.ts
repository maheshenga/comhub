import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  normalizeDesktopDownloadUrl,
  normalizeDesktopUpdateServerUrl,
} from '@/const/desktopUpdate';
import { appSettings } from '@/database/schemas';
import { getServerDB } from '@/database/server';
import { APP_SETTING_KEYS, invalidateServerAppSettings } from '@/server/services/appSettings';
import { decryptAppSettingSecret } from '@/server/services/appSettings/secrets';

const bodySchema = z.object({
  channel: z.enum(['stable', 'canary']).default('stable'),
  downloadLabel: z.string().optional(),
  downloadUrl: z.string().optional(),
  releaseNotes: z.string().optional(),
  serverUrl: z.string().optional(),
  version: z.string().trim().min(1),
});

const readStringSetting = async (db: Awaited<ReturnType<typeof getServerDB>>, key: string) => {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  return typeof row?.value === 'string' ? row.value : null;
};

const upsertSetting = async (db: any, key: string, value: unknown) =>
  db
    .insert(appSettings)
    .values({ key, value: value as any })
    .onConflictDoUpdate({
      set: { updatedAt: new Date(), value: value as any },
      target: appSettings.key,
    });

/**
 * Desktop release authentication precedence:
 * 1. DESKTOP_RELEASE_TOKEN, when configured.
 * 2. Only when the dedicated token is absent and
 *    ALLOW_LEGACY_CRON_SECRET_FOR_DESKTOP_RELEASE=1, decrypted database cron.secret.
 * 3. In that same opt-in legacy mode, CRON_SECRET only when cron.secret is not a string.
 * Invalid encrypted cron.secret values fail closed without using CRON_SECRET.
 */
export const resolveDesktopReleaseToken = async (
  db: Awaited<ReturnType<typeof getServerDB>>,
): Promise<null | string> => {
  if (process.env.DESKTOP_RELEASE_TOKEN) return process.env.DESKTOP_RELEASE_TOKEN;
  if (process.env.ALLOW_LEGACY_CRON_SECRET_FOR_DESKTOP_RELEASE !== '1') return null;

  const encryptedOrLegacySecret = await readStringSetting(db, APP_SETTING_KEYS.cronSecret);
  const decryptedSecret = await decryptAppSettingSecret(
    APP_SETTING_KEYS.cronSecret,
    encryptedOrLegacySecret,
  );

  return typeof decryptedSecret === 'string' ? decryptedSecret : (process.env.CRON_SECRET ?? null);
};

export const POST = async (req: NextRequest) => {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const db = await getServerDB();
  let expected: null | string;
  try {
    expected = await resolveDesktopReleaseToken(db);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!expected || token !== expected) {
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

  let serverUrl: string | undefined;
  let downloadUrl: string | undefined;
  try {
    const normalizedServerUrl = normalizeDesktopUpdateServerUrl(input.serverUrl);
    if ('reason' in normalizedServerUrl) {
      throw new Error(`serverUrl is not allowed: ${normalizedServerUrl.reason}`);
    }
    const normalizedDownloadUrl = normalizeDesktopDownloadUrl(input.downloadUrl);
    if ('reason' in normalizedDownloadUrl) {
      throw new Error(`downloadUrl is not allowed: ${normalizedDownloadUrl.reason}`);
    }
    serverUrl = normalizedServerUrl.url || undefined;
    downloadUrl = normalizedDownloadUrl.url || undefined;
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

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

  await db.transaction(async (tx) => {
    for (const update of updates) {
      await upsertSetting(tx, update.key, update.value);
    }
  });

  invalidateServerAppSettings();

  return NextResponse.json({ count: updates.length, ok: true });
};
