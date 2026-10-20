import { CheckboxGroup } from '@lobehub/ui';

const ABILITY_KEYS = [
  'vision',
  'files',
  'imageOutput',
  'video',
  'audio',
  'functionCall',
  'reasoning',
  'search',
] as const;

export type AdminModelAbilityKey = (typeof ABILITY_KEYS)[number];

export type AdminModelAbilities = Partial<Record<AdminModelAbilityKey, boolean>>;

const getManualAbilities = (metadata?: Record<string, unknown> | null): AdminModelAbilities => {
  const value = metadata?.manualAbilities;
  if (!value || typeof value !== 'object') return {};

  return value as AdminModelAbilities;
};

export const buildManualAbilitiesMetadata = ({
  abilities,
  metadata,
}: {
  abilities: AdminModelAbilities;
  metadata?: Record<string, unknown> | null;
}) => ({
  ...metadata,
  manualAbilities: abilities,
});

export const AiProviderModelAbilitiesCell = ({
  metadata,
  onSave,
  t,
}: {
  metadata?: Record<string, unknown> | null;
  onSave: (abilities: AdminModelAbilities) => void;
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string;
}) => {
  const manualAbilities = getManualAbilities(metadata);

  return (
    <CheckboxGroup
      gap={8}
      value={ABILITY_KEYS.filter((key) => manualAbilities[key])}
      options={ABILITY_KEYS.map((key) => ({
        label: t(`admin.providers.models.abilities.${key}`, key),
        value: key,
      }))}
      onChange={(values) => {
        const selected = new Set(values as AdminModelAbilityKey[]);
        onSave(
          ABILITY_KEYS.reduce<AdminModelAbilities>((map, key) => {
            map[key] = selected.has(key);
            return map;
          }, {}),
        );
      }}
    />
  );
};
