import { timingSafeEqual } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { appSettings } from '@/database/schemas';
import { type getServerDB } from '@/database/server';
import { APP_SETTING_KEYS } from '@/server/services/appSettings';
import { decryptAppSettingSecret } from '@/server/services/appSettings/secrets';

/**
 * Single shared authentication seam for the machine-facing admin channels
 * (maintenance cron callback, desktop release callback, desktop release
 * profile download). Every bearer-secret comparison goes through
 * `timingSafeBearerEqual` so no endpoint compares secrets with a
 * length/short-circuit leak.
 *
 * Secret resolution precedence for `resolveCronSecret`:
 * 1. decrypted app_settings `cron.secret` when present;
 * 2. `CRON_SECRET` env only when the database value is absent.
 * An encrypted database value that fails to decrypt fails closed (returns
 * null instead of falling back to the environment).
 */
export const timingSafeBearerEqual = (token: string, expected: string) => {
  const actualBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.byteLength !== expectedBuffer.byteLength) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
};

export const resolveCronSecret = async (
  db: Awaited<ReturnType<typeof getServerDB>>,
): Promise<null | string> => {
  const dbSecretRow = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, APP_SETTING_KEYS.cronSecret),
  });
  let decryptedDbSecret: unknown;
  try {
    decryptedDbSecret = await decryptAppSettingSecret(
      APP_SETTING_KEYS.cronSecret,
      dbSecretRow?.value,
    );
  } catch {
    return null;
  }

  return typeof decryptedDbSecret === 'string' && decryptedDbSecret
    ? decryptedDbSecret
    : (process.env.CRON_SECRET ?? null);
};

export const isCronSecretAuthorized = async (
  db: Awaited<ReturnType<typeof getServerDB>>,
  token: string,
) => {
  const expected = await resolveCronSecret(db);

  return Boolean(expected) && timingSafeBearerEqual(token, expected!);
};
