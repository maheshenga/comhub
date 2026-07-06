import {
  getAppSettingRegistryItem,
  type AppSettingDomain,
  type AppSettingRegistryItem,
  listAppSettingRegistryItems,
} from '@/const/appSettingsRegistry';

type AppSettingsGovernanceInputRow = {
  key: string;
  updatedAt?: Date | null;
  value?: unknown;
};

type AppSettingsGovernanceRegisteredRow = Pick<
  AppSettingRegistryItem,
  'cacheScopes' | 'domain' | 'key' | 'publicRuntime' | 'sensitive'
> & {
  configured: boolean;
  hasValue: boolean;
};

export type AppSettingsGovernance = {
  cacheScopeGroups: Array<{
    cacheScope: string;
    configuredCount: number;
    registeredCount: number;
  }>;
  domainGroups: Array<{
    configuredCount: number;
    domain: AppSettingDomain;
    registeredCount: number;
    sensitiveConfiguredCount: number;
  }>;
  registeredSettings: AppSettingsGovernanceRegisteredRow[];
  sensitiveConfiguredKeys: AppSettingsGovernanceRegisteredRow[];
  summary: {
    configuredRegisteredCount: number;
    persistedCount: number;
    publicRuntimeConfiguredCount: number;
    registeredCount: number;
    sensitiveConfiguredCount: number;
    unknownCount: number;
  };
  unknownKeys: Array<{ key: string }>;
};

const hasPersistedValue = (value: unknown) =>
  value !== null && value !== undefined && value !== '';

export const buildAppSettingsGovernance = (
  rows: AppSettingsGovernanceInputRow[],
): AppSettingsGovernance => {
  const persistedByKey = new Map(rows.map((row) => [row.key, row]));
  const registeredSettings = listAppSettingRegistryItems().map((item) => {
    const row = persistedByKey.get(item.key);

    return {
      cacheScopes: item.cacheScopes,
      configured: Boolean(row),
      domain: item.domain,
      hasValue: row ? hasPersistedValue(row.value) : false,
      key: item.key,
      publicRuntime: item.publicRuntime,
      sensitive: item.sensitive,
    };
  });
  const unknownKeys = rows
    .filter((row) => !getAppSettingRegistryItem(row.key))
    .map((row) => ({ key: row.key }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const sensitiveConfiguredKeys = registeredSettings.filter(
    (item) => item.configured && item.sensitive,
  );
  const domainGroups = Array.from(
    registeredSettings
      .reduce(
        (groups, item) => {
          const current = groups.get(item.domain) ?? {
            configuredCount: 0,
            domain: item.domain,
            registeredCount: 0,
            sensitiveConfiguredCount: 0,
          };

          current.registeredCount += 1;
          if (item.configured) current.configuredCount += 1;
          if (item.configured && item.sensitive) current.sensitiveConfiguredCount += 1;
          groups.set(item.domain, current);

          return groups;
        },
        new Map<AppSettingDomain, AppSettingsGovernance['domainGroups'][number]>(),
      )
      .values(),
  ).sort((a, b) => a.domain.localeCompare(b.domain));
  const cacheScopeGroups = Array.from(
    registeredSettings
      .reduce(
        (groups, item) => {
          for (const cacheScope of item.cacheScopes) {
            const current = groups.get(cacheScope) ?? {
              cacheScope,
              configuredCount: 0,
              registeredCount: 0,
            };

            current.registeredCount += 1;
            if (item.configured) current.configuredCount += 1;
            groups.set(cacheScope, current);
          }

          return groups;
        },
        new Map<string, AppSettingsGovernance['cacheScopeGroups'][number]>(),
      )
      .values(),
  ).sort((a, b) => a.cacheScope.localeCompare(b.cacheScope));

  return {
    cacheScopeGroups,
    domainGroups,
    registeredSettings,
    sensitiveConfiguredKeys,
    summary: {
      configuredRegisteredCount: registeredSettings.filter((item) => item.configured).length,
      persistedCount: rows.length,
      publicRuntimeConfiguredCount: registeredSettings.filter(
        (item) => item.configured && item.publicRuntime,
      ).length,
      registeredCount: registeredSettings.length,
      sensitiveConfiguredCount: sensitiveConfiguredKeys.length,
      unknownCount: unknownKeys.length,
    },
    unknownKeys,
  };
};
