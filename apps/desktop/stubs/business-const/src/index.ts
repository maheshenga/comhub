// Desktop isolated-workspace override for `@lobechat/business-const`.
//
// The OSS desktop build must keep `ENABLE_BUSINESS_FEATURES` off: model-bank
// gates the first-party LobeHub provider entry on this flag
// (packages/model-bank/src/modelProviders/index.ts), and every value in this
// package travels into the shipped binary. The fork's server-side tree runs
// the commercial build (packages/business/const has the flag on), so the
// desktop sub-workspace resolves the package to this stub instead.
//
// Upstream removed this stub in #20133 because the upstream package itself
// ships `ENABLE_BUSINESS_FEATURES = false`, so linking the real package was
// safe there. In this fork the real package has the flag ON, so the stub is
// load-bearing again — do not drop it.
//
// SYNC OBLIGATION: this is a hand-mirrored static copy of the real package's
// export surface (the #20133/#14402 MISSING_EXPORT failure mode). When
// packages/business/const gains an export the desktop build consumes, mirror
// it here with the OSS-appropriate value. The mirror below matches upstream
// v2.2.19 + the fork's model defaults.

// branding.ts mirror
export const LOBE_CHAT_CLOUD = 'LobeHub Cloud';
export const BRANDING_NAME = 'LobeHub';
export const BRANDING_LOGO_URL = '';
export const ORG_NAME = 'LobeHub';
export const BRANDING_URL = {
  help: undefined,
  privacy: undefined,
  subscription: 'https://app.lobehub.com/settings/plans',
  support: undefined,
  terms: undefined,
};
export const SOCIAL_URL = {
  discord: 'https://discord.gg/AYFPHvv2jT',
  github: 'https://github.com/lobehub',
  medium: 'https://medium.com/@lobehub',
  x: 'https://x.com/lobehub',
  youtube: 'https://www.youtube.com/@lobehub',
};
export const FILE_URL = {
  importFromNotionGuide: 'https://hub-apac-1.lobeobjects.space/assets/notion.mp4',
};
export const BRANDING_EMAIL = {
  business: 'hello@lobehub.com',
  replyTo: undefined,
  support: 'support@lobehub.com',
};
export const BRANDING_PROVIDER = 'lobehub';
export const APPLE_APP_STORE_ID = '';
export const COPYRIGHT = `© ${new Date().getFullYear()} ${ORG_NAME}`;
export const COPYRIGHT_FULL = `${COPYRIGHT}. All rights reserved.`;

// llm.ts mirror (fork defaults)
export const DEFAULT_EMBEDDING_PROVIDER = 'openai';
export const DEFAULT_MODEL = 'deepseek-v4-flash';
export const DEFAULT_PROVIDER = 'deepseek';
export const DEFAULT_MINI_MODEL = 'gpt-5.6-luna';
export const DEFAULT_MINI_PROVIDER = 'openai';
export const DEFAULT_ASR_MODEL = 'gpt-4o-mini-transcribe';
export const DEFAULT_ASR_PROVIDER = 'openai';
export const DEFAULT_ONBOARDING_MODEL = 'gemini-3-flash-preview';
export const DEFAULT_ONBOARDING_PROVIDER = 'google';
export const DEFAULT_REVIEW_PREDICT_MODEL = 'gemini-3.8-flash';
export const DEFAULT_REVIEW_PREDICT_PROVIDER = 'google';
export const DEFAULT_VERIFY_MODEL = 'glm-5.3-flash';
export const DEFAULT_VERIFY_PROVIDER = 'zhipu';
export const DEFAULT_VERIFY_PLAN_MODEL = 'deepseek-flash';
export const DEFAULT_VERIFY_PLAN_PROVIDER = 'deepseek';

// url.ts mirror
export const UTM_SOURCE = 'chat_preview';

// index.ts mirror — the ONE value the stub exists to flip.
// The OSS desktop build keeps business features off.
export const ENABLE_BUSINESS_FEATURES = false;
export const ENABLE_TOOL_CHANNEL_SETTINGS = true;
export const AGENT_ONBOARDING_ENABLED = false;
export const API_KEY_PREFIX = 'sk-lh-';
export const OFFICIAL_PROVIDER_DISABLE_ERROR = 'The official provider cannot be disabled.';
export const isOfficialProvider = (id: string) =>
  ENABLE_BUSINESS_FEATURES && id === BRANDING_PROVIDER;
