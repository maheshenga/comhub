import { normalizeText, SETTING_KEYS } from '@/features/Admin/adminSettingsForm';

export type FileStorageFormValues = {
  storageS3AccessKeyId: string;
  storageS3Bucket: string;
  storageS3EnablePathStyle: boolean;
  storageS3Endpoint: string;
  storageS3FilePath: string;
  storageS3PreviewUrlExpireIn: number;
  storageS3PublicDomain: string;
  storageS3Region: string;
  storageS3SecretAccessKey: string;
  storageS3SetAcl: boolean;
};

export const normalizeS3FilePath = (value: unknown) =>
  normalizeText(value)
    .replaceAll('\\', '/')
    .replaceAll(/^\/+|\/+$/g, '') || 'files';

export const buildInitialValues = (data: any): FileStorageFormValues => ({
  storageS3AccessKeyId: data?.storageS3AccessKeyId ?? '',
  storageS3Bucket: data?.storageS3Bucket ?? '',
  storageS3EnablePathStyle: data?.storageS3EnablePathStyle ?? false,
  storageS3Endpoint: data?.storageS3Endpoint ?? '',
  storageS3FilePath: data?.storageS3FilePath ?? 'files',
  storageS3PreviewUrlExpireIn: data?.storageS3PreviewUrlExpireIn ?? 7200,
  storageS3PublicDomain: data?.storageS3PublicDomain ?? '',
  storageS3Region: data?.storageS3Region ?? '',
  storageS3SecretAccessKey: '',
  storageS3SetAcl: data?.storageS3SetAcl ?? false,
});

export const normalizeValues = (values: FileStorageFormValues): FileStorageFormValues => ({
  storageS3AccessKeyId: normalizeText(values.storageS3AccessKeyId),
  storageS3Bucket: normalizeText(values.storageS3Bucket),
  storageS3EnablePathStyle: Boolean(values.storageS3EnablePathStyle),
  storageS3Endpoint: normalizeText(values.storageS3Endpoint),
  storageS3FilePath: normalizeS3FilePath(values.storageS3FilePath),
  storageS3PreviewUrlExpireIn:
    typeof values.storageS3PreviewUrlExpireIn === 'number'
      ? values.storageS3PreviewUrlExpireIn
      : 7200,
  storageS3PublicDomain: normalizeText(values.storageS3PublicDomain),
  storageS3Region: normalizeText(values.storageS3Region),
  storageS3SecretAccessKey: normalizeText(values.storageS3SecretAccessKey),
  storageS3SetAcl: Boolean(values.storageS3SetAcl),
});

export const buildUpdates = (values: FileStorageFormValues, initial: FileStorageFormValues) => {
  const current = normalizeValues(values);
  const baseline = normalizeValues(initial);
  const updates: { key: string; value: unknown }[] = [];

  const fields: Array<keyof FileStorageFormValues> = [
    'storageS3AccessKeyId',
    'storageS3Endpoint',
    'storageS3FilePath',
    'storageS3Bucket',
    'storageS3Region',
    'storageS3PublicDomain',
    'storageS3EnablePathStyle',
    'storageS3SetAcl',
    'storageS3PreviewUrlExpireIn',
  ];

  const keyMap: Record<keyof FileStorageFormValues, string> = {
    storageS3AccessKeyId: SETTING_KEYS.storageS3AccessKeyId,
    storageS3Bucket: SETTING_KEYS.storageS3Bucket,
    storageS3EnablePathStyle: SETTING_KEYS.storageS3EnablePathStyle,
    storageS3Endpoint: SETTING_KEYS.storageS3Endpoint,
    storageS3FilePath: SETTING_KEYS.storageS3FilePath,
    storageS3PreviewUrlExpireIn: SETTING_KEYS.storageS3PreviewUrlExpireIn,
    storageS3PublicDomain: SETTING_KEYS.storageS3PublicDomain,
    storageS3Region: SETTING_KEYS.storageS3Region,
    storageS3SecretAccessKey: SETTING_KEYS.storageS3SecretAccessKey,
    storageS3SetAcl: SETTING_KEYS.storageS3SetAcl,
  };

  for (const field of fields) {
    if (current[field] !== baseline[field]) {
      updates.push({ key: keyMap[field], value: current[field] });
    }
  }

  if (current.storageS3SecretAccessKey) {
    updates.push({
      key: SETTING_KEYS.storageS3SecretAccessKey,
      value: current.storageS3SecretAccessKey,
    });
  }

  return updates;
};
