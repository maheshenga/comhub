/**
 * ComHub desktop deployment defaults.
 *
 * The branded build ships with the ComHub production server as the default
 * cloud endpoint (upstream defaults to lobehub.com). Upstream's env.ts only
 * needs to import `DEFAULT_OFFICIAL_CLOUD_SERVER` from here, so a domain
 * change is a one-file fork-owned edit instead of an upstream-file edit.
 *
 * NOTE: releases.qingyouai.com appears in older docs/comments as the update
 * host but has no DNS record; the real update host is the OSS bucket served
 * via the admin-configured `desktop.update.serverUrl` app setting
 * (comhubs.oss-cn-shanghai.aliyuncs.com).
 */

export const DEFAULT_OFFICIAL_CLOUD_SERVER = 'https://chat.qingyouai.com';
