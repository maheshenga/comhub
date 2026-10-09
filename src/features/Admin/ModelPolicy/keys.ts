export const SETTING_KEYS = {
  allowlist: 'model.policy.allowlist',
  applyToEmbeddings: 'model.policy.applyToEmbeddings',
  applyToGenerateObject: 'model.policy.applyToGenerateObject',
  blocklist: 'model.policy.blocklist',
  defaultModelFallback: 'model.policy.defaultModelFallback',
  deniedMessage: 'model.policy.deniedMessage',
  enabled: 'model.policy.enabled',
  mode: 'model.policy.mode',
} as const;

export type FormValues = {
  allowlistText: string;
  applyToEmbeddings: boolean;
  applyToGenerateObject: boolean;
  blocklistText: string;
  defaultModelFallback: string;
  deniedMessage: string;
  enabled: boolean;
  mode: 'allowlist' | 'blocklist';
};

const LIST_SPLIT_REGEX = /[\r\n,;；，]+/;

export const normalizeListText = (value: unknown) => {
  const values =
    typeof value === 'string'
      ? value
          .split(LIST_SPLIT_REGEX)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  return Array.from(new Set(values)).join('\n');
};
