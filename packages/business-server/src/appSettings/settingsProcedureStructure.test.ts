import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(path.resolve(__dirname, relativePath), 'utf8');

const procedureKeys = (source: string, procedureObjectName: string) => {
  const procedureObjectStart = source.indexOf(`export const ${procedureObjectName} = {`);

  return Array.from(
    source.slice(procedureObjectStart).matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]+):/gm),
    ([, key]) => key,
  );
};

describe('admin settings procedure ownership', () => {
  it('keeps the legacy router as procedure composition only', () => {
    const router = readSource('../lambda-routers/admin/settings.ts');

    expect(router.split(/\r?\n/)).toHaveLength(20);
    expect(router).toContain('...publicSettingsProcedures');
    expect(router).toContain('...adminSettingsReadProcedures');
    expect(router).toContain('...adminSettingsWriteProcedures');
    expect(router).toContain('...runtimeSettingsWriteProcedures');
    expect(router).not.toContain('ctx.serverDB');
    expect(router).not.toContain('runMaintenanceCommand');
    expect(router).not.toContain('new S3');
    expect(router).toContain('validateDefaultAgentModelUsability');
    expect(router).toContain('buildUserGlobalSettingsSyncValues');
    expect(router).toContain('syncUserGlobalSettingsDefaultsToUserSettings');
    expect(router).toContain("from '../../appSettings/procedureShared'");
    expect(router).toContain("from '../../appSettings/writers/adminProcedures'");
  });

  it('places reads, setting writes, and runtime operations in owned modules', () => {
    const publicReads = readSource('readers/publicProcedures.ts');
    const adminReads = readSource('readers/adminProcedures.ts');
    const adminWrites = readSource('writers/adminProcedures.ts');
    const runtimeWrites = readSource('writers/runtimeProcedures.ts');

    expect(publicReads).toContain('getPublicBrand: publicDbProcedure');
    expect(adminReads).toContain('getSection: systemReadProcedure');
    expect(adminWrites).toContain('setAppSettingsBatch: systemWriteProcedure');
    expect(runtimeWrites).toContain('testS3Storage: systemWriteProcedure');
    expect(runtimeWrites).toContain('runMaintenance: systemWriteProcedure');

    const keys = [
      procedureKeys(publicReads, 'publicSettingsProcedures'),
      procedureKeys(adminReads, 'adminSettingsReadProcedures'),
      procedureKeys(adminWrites, 'adminSettingsWriteProcedures'),
      procedureKeys(runtimeWrites, 'runtimeSettingsWriteProcedures'),
    ].flat();

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.toSorted()).toEqual(
      [
        'deleteUnknownSetting',
        'getAll',
        'getGovernance',
        'getPublicAboutLinks',
        'getPublicAboutPage',
        'getPublicBrand',
        'getPublicDesktopUpdate',
        'getPublicExpertPlaza',
        'getPublicGrowth',
        'getPublicHelpMenu',
        'getPublicNotificationConfig',
        'getPublicOperations',
        'getPublicProfileOptions',
        'getPublicRecommendations',
        'getSection',
        'refreshRuntimeCaches',
        'runMaintenance',
        'setAppSetting',
        'setAppSettingsBatch',
        'syncUserGlobalSettingsDefaultsToUsers',
        'testS3Storage',
        'validateDefaultAgentSettings',
      ].toSorted(),
    );
  });
});
