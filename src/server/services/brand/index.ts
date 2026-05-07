import { eq } from 'drizzle-orm';

import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';
import { appSettings } from '@/database/schemas';
import { getServerDB } from '@/database/server';

export interface ServerBrandConfig {
  faviconUrl: string | null;
  logoUrl: string | null;
  name: string | null;
  primaryColor: string | null;
  slogan: string | null;
}

const KEYS = {
  favicon: 'brand.faviconUrl',
  logo: 'brand.logoUrl',
  name: 'brand.name',
  primary: 'brand.primaryColor',
  slogan: 'brand.slogan',
} as const;

let cached: { at: number; data: ServerBrandConfig } | null = null;
const TTL_MS = 30_000;

const readString = async (db: Awaited<ReturnType<typeof getServerDB>>, key: string) => {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  const v = row?.value;
  return typeof v === 'string' && v.trim() ? v : null;
};

/**
 * Server-side brand fetch with a tiny in-memory TTL cache. Used by Next.js
 * SSR routes (manifest / metadata / SignIn) to render admin-configured brand
 * before any client-side React executes. Failures are swallowed and return
 * a fully-null config so callers can fall back to build-time `BRANDING_NAME`.
 */
export const getServerBrand = async (): Promise<ServerBrandConfig> => {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
  try {
    const db = await getServerDB();
    const [name, logoUrl, faviconUrl, primaryColor, slogan] = await Promise.all([
      readString(db, KEYS.name),
      readString(db, KEYS.logo),
      readString(db, KEYS.favicon),
      readString(db, KEYS.primary),
      readString(db, KEYS.slogan),
    ]);
    const data: ServerBrandConfig = {
      faviconUrl,
      logoUrl: logoUrl ?? DEFAULT_RUNTIME_BRAND.logoUrl,
      name: name ?? DEFAULT_RUNTIME_BRAND.name,
      primaryColor: primaryColor ?? DEFAULT_RUNTIME_BRAND.primaryColor,
      slogan,
    };
    cached = { at: Date.now(), data };
    return data;
  } catch {
    const data: ServerBrandConfig = {
      faviconUrl: null,
      logoUrl: DEFAULT_RUNTIME_BRAND.logoUrl,
      name: DEFAULT_RUNTIME_BRAND.name,
      primaryColor: DEFAULT_RUNTIME_BRAND.primaryColor,
      slogan: null,
    };
    cached = { at: Date.now(), data };
    return data;
  }
};

/** Force a refresh on the next call (e.g. after admin saves brand settings). */
export const invalidateServerBrand = (): void => {
  cached = null;
};
