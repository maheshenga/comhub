import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { normalizeAboutLinksConfig, normalizeAboutPageConfig } from '@/const/aboutLinks';
import { APP_SETTING_KEYS, type AppSettingKey } from '@/const/appSettingsRegistry';
import { normalizeAvatarPresets } from '@/const/avatarPresets';
import { normalizePlanFaqSettings } from '@/const/billingPresentation';
import { normalizeExpertPlazaCards } from '@/const/expertPlaza';
import { normalizeHelpMenuItems } from '@/const/helpMenu';
import { normalizeNotificationEventDefaults } from '@/const/notificationPreferences';

import type { AppSettingNormalizer, AppSettingValueDefinition } from '../types';

const stringSchema = z.string();
const booleanSchema = z.boolean();
const numberSchema = z.number().finite();
const stringListSchema = z.array(z.string());
const recordSchema = z.record(z.string(), z.unknown());
const recordListSchema = z.array(recordSchema);
const unknownListSchema = z.array(z.unknown());

type JsonValue = boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };
const jsonSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);

const defineValue = <T>(
  normalizer: AppSettingNormalizer,
  valueSchema: z.ZodType<T>,
  normalize: (value: unknown) => T,
  options: { clearValue?: null } = {},
): AppSettingValueDefinition => ({
  ...(options.clearValue === null ? { clearValue: null } : {}),
  normalizer,
  normalizeValue: (value) => valueSchema.parse(normalize(value)),
  valueSchema: valueSchema as z.ZodType<unknown>,
});

const toString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const toBoolean = (value: unknown) => Boolean(value);
const toStringList = (value: unknown): string[] => {
  const raw = Array.isArray(value)
    ? value.flatMap((item) => (typeof item === 'string' ? item.split(/[\r\n,;\uFF0C\uFF1B]+/) : []))
    : typeof value === 'string'
      ? value.split(/[\r\n,;\uFF0C\uFF1B]+/)
      : [];

  return Array.from(new Set(raw.map((item) => item.trim()).filter(Boolean)));
};
const toBoundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
};
const normalizeS3FilePath = (value: unknown) =>
  toString(value)
    .replaceAll('\\', '/')
    .replaceAll(/^\/+|\/+$/g, '');
const toOptionalUrlString = (value: unknown, key: string) => {
  const text = toString(value);
  if (!text) return '';

  try {
    new URL(text);
    return text;
  } catch {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `${key} must be a valid URL` });
  }
};
const normalizeMemoryTriggerMode = (value: unknown) =>
  value === 'direct' || value === 'workflow' || value === 'auto' ? value : 'auto';
const normalizeProfileInterestAreas = (value: unknown) => {
  const items = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const normalized: Array<{ key: string; label: string }> = [];

  for (const item of items) {
    const label =
      typeof item === 'string'
        ? item.trim()
        : item && typeof item === 'object'
          ? toString((item as Record<string, unknown>).label)
          : '';
    const key =
      item && typeof item === 'object'
        ? toString((item as Record<string, unknown>).key) || label
        : label;

    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ key, label });
  }

  return normalized;
};

const stringValue = (normalizer: AppSettingNormalizer) =>
  defineValue(normalizer, stringSchema, toString);
const booleanValue = (normalizer: AppSettingNormalizer) =>
  defineValue(normalizer, booleanSchema, toBoolean);
const numberValue = (normalizer: AppSettingNormalizer, normalize: (value: unknown) => number) =>
  defineValue(normalizer, numberSchema, normalize);

const OPERATION_BOOLEAN_KEYS = new Set<AppSettingKey>([
  APP_SETTING_KEYS.communityCreatorRewardBannerEnabled,
  APP_SETTING_KEYS.communityFeaturedAssistantsEnabled,
  APP_SETTING_KEYS.communityFeaturedMcpsEnabled,
  APP_SETTING_KEYS.communityFeaturedSkillsEnabled,
  APP_SETTING_KEYS.communityHomeAnnouncementEnabled,
]);
const OPERATION_PAGE_SIZE_KEYS = new Set<AppSettingKey>([
  APP_SETTING_KEYS.communityFeaturedAssistantPageSize,
  APP_SETTING_KEYS.communityFeaturedMcpPageSize,
  APP_SETTING_KEYS.communityFeaturedSkillPageSize,
]);
const GROWTH_BOOLEAN_KEYS = new Set<AppSettingKey>([
  APP_SETTING_KEYS.authSignupEnabled,
  APP_SETTING_KEYS.authSignupPhoneEnabled,
  APP_SETTING_KEYS.onboardingInitialCreditsEnabled,
]);
const GROWTH_NUMBER_KEYS = new Set<AppSettingKey>([
  APP_SETTING_KEYS.onboardingInitialCredits,
  APP_SETTING_KEYS.uploadMaxActualSizeMb,
  APP_SETTING_KEYS.uploadMaxInputSizeMb,
]);
const NOTIFICATION_BOOLEAN_KEYS = new Set<AppSettingKey>([
  APP_SETTING_KEYS.notificationDesktopEnabled,
  APP_SETTING_KEYS.notificationEmailEnabled,
  APP_SETTING_KEYS.notificationInboxEnabled,
  APP_SETTING_KEYS.notificationPushEnabled,
  APP_SETTING_KEYS.notificationSystemEnabled,
]);
const MODEL_POLICY_BOOLEAN_KEYS = new Set<AppSettingKey>([
  APP_SETTING_KEYS.modelPolicyApplyToEmbeddings,
  APP_SETTING_KEYS.modelPolicyApplyToGenerateObject,
  APP_SETTING_KEYS.modelPolicyEnabled,
]);
const MODEL_POLICY_LIST_KEYS = new Set<AppSettingKey>([
  APP_SETTING_KEYS.modelPolicyAllowlist,
  APP_SETTING_KEYS.modelPolicyBlocklist,
]);
const RECOMMENDATION_BOOLEAN_KEYS = new Set<AppSettingKey>([
  APP_SETTING_KEYS.recommendationAssistantsEnabled,
  APP_SETTING_KEYS.recommendationGeneralSkillsEnabled,
  APP_SETTING_KEYS.recommendationHotSkillsEnabled,
  APP_SETTING_KEYS.recommendationMcpsEnabled,
  APP_SETTING_KEYS.recommendationSectionEnabled,
  APP_SETTING_KEYS.recommendationSkillsEnabled,
]);
const RECOMMENDATION_TITLE_KEYS = new Set<AppSettingKey>([
  APP_SETTING_KEYS.recommendationAssistantTitle,
  APP_SETTING_KEYS.recommendationGeneralSkillTitle,
  APP_SETTING_KEYS.recommendationHotSkillTitle,
  APP_SETTING_KEYS.recommendationMcpTitle,
  APP_SETTING_KEYS.recommendationSkillTitle,
]);
const DOCMEE_BOOLEAN_KEYS = new Set<AppSettingKey>([
  APP_SETTING_KEYS.docmeePptAllowPdfExport,
  APP_SETTING_KEYS.docmeePptAllowPptxDownload,
  APP_SETTING_KEYS.docmeePptAuditEnabled,
  APP_SETTING_KEYS.docmeePptEnabled,
]);
export const getAppSettingValueDefinition = (key: AppSettingKey): AppSettingValueDefinition => {
  if (key === APP_SETTING_KEYS.cronAuditRetentionDays) {
    return numberValue('cron-audit-retention-integer', (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error('cronAuditRetentionDays must be a number');
      return Math.max(7, Math.min(3650, Math.round(n)));
    });
  }
  if (key === APP_SETTING_KEYS.cronPendingOrderExpiryDays) {
    return numberValue('cron-pending-order-expiry-integer', (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error('cronPendingOrderExpiryDays must be a number');
      return Math.max(1, Math.min(365, Math.round(n)));
    });
  }
  if (key === APP_SETTING_KEYS.referralRewardCredits) {
    return numberValue('referral-reward-integer', (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error('referralRewardCredits must be a number');
      return Math.max(0, Math.round(n));
    });
  }
  if (key === APP_SETTING_KEYS.cronSecret) {
    return defineValue('cron-secret-json', jsonSchema, (value) => value as JsonValue);
  }

  if (key === APP_SETTING_KEYS.composioEnabled) return booleanValue('composio-boolean');
  if (key === APP_SETTING_KEYS.composioAuthConfigIds) {
    return defineValue('composio-auth-config-json-string', stringSchema, (value) => {
      const normalized = toString(value);
      if (!normalized) return '';

      try {
        const parsed = JSON.parse(normalized);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('COMPOSIO_AUTH_CONFIG_IDS_MUST_BE_OBJECT');
        }
      } catch {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'composioAuthConfigIds must be a JSON object',
        });
      }
      return normalized;
    });
  }
  if (key.startsWith('composio.')) return stringValue('composio-string');

  if (key === APP_SETTING_KEYS.pricingCreditMultiplier) {
    return numberValue('pricing-positive-number', (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'pricingCreditMultiplier must be a number',
        });
      }
      if (n <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'pricingCreditMultiplier must be greater than 0',
        });
      }
      return Math.min(100, n);
    });
  }
  if (key === APP_SETTING_KEYS.pricingModelRules) {
    return defineValue('pricing-model-rules-array', unknownListSchema, (value) =>
      Array.isArray(value) ? value : [],
    );
  }
  if (key === APP_SETTING_KEYS.ordersManagementEnabled) return booleanValue('orders-boolean');
  if (key === APP_SETTING_KEYS.plansFaqItems) {
    return defineValue('plans-faq-record-list', recordListSchema, normalizePlanFaqSettings);
  }

  if (OPERATION_BOOLEAN_KEYS.has(key)) return booleanValue('operations-boolean');
  if (OPERATION_PAGE_SIZE_KEYS.has(key)) {
    return numberValue('operations-page-size-integer', (value) =>
      toBoundedInt(value, 12, 1, 24),
    );
  }
  if (key.startsWith('community.')) return stringValue('operations-string');

  if (GROWTH_BOOLEAN_KEYS.has(key)) return booleanValue('growth-boolean');
  if (GROWTH_NUMBER_KEYS.has(key)) {
    return numberValue('growth-nonnegative-integer', (value) =>
      toBoundedInt(value, 0, 0, 10_000_000_000),
    );
  }
  if (key.startsWith('auth.') || key.startsWith('onboarding.') || key.startsWith('upload.')) {
    return stringValue('growth-string');
  }

  if (key === APP_SETTING_KEYS.profileInterestAreas) {
    return defineValue('profile-interest-areas', recordListSchema, normalizeProfileInterestAreas);
  }
  if (key === APP_SETTING_KEYS.profileAvatarPresets) {
    return defineValue('profile-avatar-presets', recordListSchema, normalizeAvatarPresets);
  }
  if (key === APP_SETTING_KEYS.memoryUserMemoryTriggerMode) {
    return defineValue('memory-trigger-mode', stringSchema, normalizeMemoryTriggerMode);
  }
  if (key.startsWith('memory.') || key.startsWith('vector.') || key.startsWith('default')) {
    return stringValue('runtime-model-string');
  }
  if (key === APP_SETTING_KEYS.userGlobalSettingsDefaults) {
    return defineValue('user-global-settings-object', recordSchema, (value) =>
      value && typeof value === 'object' && !Array.isArray(value) ? value : {},
    );
  }

  if (key === APP_SETTING_KEYS.expertPlazaEnabled) return booleanValue('expert-plaza-boolean');
  if (key === APP_SETTING_KEYS.expertPlazaCards) {
    return defineValue('expert-plaza-cards', recordListSchema, normalizeExpertPlazaCards);
  }
  if (key === APP_SETTING_KEYS.expertPlazaCategories) {
    return defineValue('expert-plaza-categories', stringListSchema, toStringList);
  }
  if (key.startsWith('expertPlaza.')) return stringValue('expert-plaza-string');

  if (NOTIFICATION_BOOLEAN_KEYS.has(key)) return booleanValue('notification-boolean');
  if (key === APP_SETTING_KEYS.notificationEventDefaults) {
    return defineValue(
      'notification-event-defaults-record',
      recordSchema,
      normalizeNotificationEventDefaults,
    );
  }
  if (key === APP_SETTING_KEYS.notificationRetentionDays) {
    return numberValue('notification-retention-integer', (value) =>
      toBoundedInt(value, 90, 1, 3650),
    );
  }
  if (key === APP_SETTING_KEYS.notificationSystemType) {
    return defineValue('notification-type-enum', stringSchema, (value) => {
      const type = toString(value);
      return ['success', 'info', 'warning', 'error'].includes(type) ? type : 'warning';
    });
  }
  if (key.startsWith('notification.')) return stringValue('notification-string');

  if (
    key === APP_SETTING_KEYS.storageS3EnablePathStyle ||
    key === APP_SETTING_KEYS.storageS3SetAcl
  ) {
    return booleanValue('storage-boolean');
  }
  if (key === APP_SETTING_KEYS.storageS3PreviewUrlExpireIn) {
    return numberValue('storage-preview-expiry-integer', (value) =>
      toBoundedInt(value, 7200, 60, 604_800),
    );
  }
  if (key === APP_SETTING_KEYS.storageS3FilePath) {
    return defineValue('storage-file-path', stringSchema, normalizeS3FilePath);
  }
  if (
    key === APP_SETTING_KEYS.storageS3Endpoint ||
    key === APP_SETTING_KEYS.storageS3PublicDomain
  ) {
    return defineValue('storage-optional-url', stringSchema, (value) =>
      toOptionalUrlString(value, key),
    );
  }
  if (key.startsWith('storage.')) return stringValue('storage-string');

  if (MODEL_POLICY_BOOLEAN_KEYS.has(key)) return booleanValue('model-policy-boolean');
  if (MODEL_POLICY_LIST_KEYS.has(key)) {
    return defineValue('model-policy-string-list', stringListSchema, toStringList);
  }
  if (key === APP_SETTING_KEYS.modelPolicyMode) {
    return defineValue('model-policy-mode-enum', stringSchema, (value) =>
      value === 'allowlist' || value === 'blocklist' ? value : 'blocklist',
    );
  }
  if (key.startsWith('model.policy.')) return stringValue('model-policy-string');

  if (RECOMMENDATION_BOOLEAN_KEYS.has(key)) return booleanValue('recommendation-boolean');
  if (key === APP_SETTING_KEYS.recommendationHotSkillSort) {
    return defineValue(
      'recommendation-hot-sort',
      stringSchema,
      (value) => toString(value) || 'installCount',
    );
  }
  if (RECOMMENDATION_TITLE_KEYS.has(key)) return stringValue('recommendation-title-string');
  if (key.startsWith('recommendation.')) {
    return defineValue('recommendation-string-list', stringListSchema, toStringList);
  }

  if (key === APP_SETTING_KEYS.homeMessengerEnabled) {
    return booleanValue('brand-home-messenger-boolean');
  }
  if (key === APP_SETTING_KEYS.helpMenuItems) {
    return defineValue('help-menu', recordListSchema, normalizeHelpMenuItems);
  }
  if (key === APP_SETTING_KEYS.aboutLinks) {
    return defineValue('about-links', recordSchema, normalizeAboutLinksConfig);
  }
  if (key === APP_SETTING_KEYS.aboutPage) {
    return defineValue('about-page', recordSchema, normalizeAboutPageConfig);
  }
  if (
    key.startsWith('about.') ||
    key.startsWith('brand.') ||
    key.startsWith('home.') ||
    key.startsWith('sidebar.')
  ) {
    return stringValue('brand-string');
  }

  if (key === APP_SETTING_KEYS.desktopUpdateAutoCheck) {
    return booleanValue('desktop-update-boolean');
  }
  if (key === APP_SETTING_KEYS.desktopUpdateCheckInterval) {
    return numberValue('desktop-update-interval-integer', (value) =>
      toBoundedInt(value, 60, 1, 1440),
    );
  }
  if (key === APP_SETTING_KEYS.desktopUpdateChannel) {
    return defineValue('desktop-update-channel-enum', stringSchema, (value) =>
      value === 'canary' ? 'canary' : 'stable',
    );
  }
  if (key.startsWith('desktop.login.')) return stringValue('desktop-login-string');
  if (key.startsWith('desktop.')) return stringValue('desktop-update-string');

  if (DOCMEE_BOOLEAN_KEYS.has(key)) return booleanValue('ppt-boolean');
  if (key === APP_SETTING_KEYS.docmeePptApiKey) {
    return defineValue(
      'ppt-api-key',
      stringSchema,
      (value) => (typeof value === 'string' ? value.trim() : ''),
      { clearValue: null },
    );
  }
  if (key === APP_SETTING_KEYS.docmeePptBaseUrl) {
    return defineValue('ppt-base-url', z.string().trim().min(1).max(512), toString);
  }
  if (key === APP_SETTING_KEYS.docmeePptCreatorVersion) {
    return defineValue('ppt-creator-version-enum', z.enum(['v1', 'v2']), (value) =>
      value as 'v1' | 'v2',
    );
  }
  if (key === APP_SETTING_KEYS.docmeePptDailyLimit) {
    return defineValue('ppt-daily-limit', z.number().int().min(0).nullable(), (value) =>
      typeof value === 'number' && value > 0 ? value : null,
    );
  }
  if (key === APP_SETTING_KEYS.docmeePptDefaultLang) {
    return defineValue('ppt-default-language', z.string().trim().min(1).max(16), toString);
  }
  if (key === APP_SETTING_KEYS.docmeePptThemeColor) {
    return defineValue('ppt-theme-color', z.string().trim().max(32).nullable(), (value) => {
      if (value === null) return null;
      return toString(value) || null;
    });
  }
  if (key === APP_SETTING_KEYS.docmeePptTokenTtlMinutes) {
    return defineValue(
      'ppt-token-ttl-integer',
      z.number().int().min(1).max(1440),
      (value) => value as number,
    );
  }
  if (key.startsWith('docmee.')) return stringValue('ppt-string');

  return stringValue('fallback-string');
};
