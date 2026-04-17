import { BRANDING_LOGO_URL } from '@lobechat/business-const';
import type { MetaData } from '@lobechat/types';

import { DEFAULT_BRAND_ASSET_VERSION } from './branding';

export const DEFAULT_AVATAR = '/avatars/agent-default.png';
export const DEFAULT_USER_AVATAR = '😀';
export const DEFAULT_SUPERVISOR_AVATAR = '🎙️';
export const DEFAULT_SUPERVISOR_ID = 'supervisor';
export const DEFAULT_BACKGROUND_COLOR = undefined;
export const DEFAULT_AGENT_META: MetaData = {};
const DEFAULT_BRAND_ICON_URL = `/icons/icon-192x192.png?v=${DEFAULT_BRAND_ASSET_VERSION}`;
export const DEFAULT_INBOX_AVATAR = BRANDING_LOGO_URL || DEFAULT_BRAND_ICON_URL;
export const DEFAULT_USER_AVATAR_URL = BRANDING_LOGO_URL || DEFAULT_BRAND_ICON_URL;
