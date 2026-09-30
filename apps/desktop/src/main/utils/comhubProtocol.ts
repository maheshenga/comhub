import { app } from 'electron';

/**
 * ComHub deep-link scheme support.
 *
 * The branded installer registers the `comhub://` scheme via the desktop
 * build profile (protocolScheme), while upstream registers `lobehub://`
 * (plus channel variants). Both must be accepted for MCP/skill install deep
 * links to work, and `getProtocolScheme()` must return `comhub` when running
 * as the branded build so ProtocolManager registers the right scheme.
 *
 * This module owns the ComHub-specific half; utils/protocol.ts delegates here
 * so an upstream rewrite of protocol.ts only has to re-thread two calls.
 */

const COMHUB_SCHEME = 'comhub';

/** Prefixes of deep-link schemes this build accepts (upstream + branded). */
export const VALID_PROTOCOL_PREFIXES = ['lobehub', COMHUB_SCHEME];

export const isAcceptedProtocolScheme = (scheme: string): boolean =>
  VALID_PROTOCOL_PREFIXES.some((prefix) =>
    scheme === prefix ? true : scheme.startsWith(`${prefix}-`) && scheme.length > prefix.length + 1,
  );

const isBrandedBundleId = (value?: string | null) => !!value?.toLowerCase().includes('comhub');

export const isComHubBrandedRuntime = (): boolean =>
  isBrandedBundleId(app.name) || isBrandedBundleId(app.getPath('exe'));

/**
 * The branded scheme override: `comhub` when the running executable/bundle is
 * the ComHub build, otherwise undefined so upstream channel detection runs.
 */
export const getComHubProtocolScheme = (): string | undefined =>
  isComHubBrandedRuntime() ? COMHUB_SCHEME : undefined;
