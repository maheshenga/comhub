import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { appSettings } from '@/database/schemas';
import { getServerDB } from '@/database/server';
import { APP_SETTING_KEYS, invalidateServerAppSettings } from '@/server/services/appSettings';

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

const normalizeUrl = (value: string | undefined, field: string) => {
  const text = value?.trim();
  if (!text) return undefined;

  try {
    return new URL(text).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
};

const upsertSetting = async (db: any, key: string, value: unknown) =>
  db
    .insert(appSettings)
    .values({ key, value: value as any })
    .onConflictDoUpdate({
      set: { updatedAt: new Date(), value: value as any },
      target: appSettings.key,
    });

export const POST = async (req: NextRequest) => {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const db = await getServerDB();
  const expected =
    (await readStringSetting(db, APP_SETTING_KEYS.cronSecret)) ?? process.env.CRON_SECRET;

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
    serverUrl = normalizeUrl(input.serverUrl, 'serverUrl');
    downloadUrl = normalizeUrl(input.downloadUrl, 'downloadUrl');
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
