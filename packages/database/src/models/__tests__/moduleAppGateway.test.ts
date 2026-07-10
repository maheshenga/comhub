// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  moduleAppInstallations,
  moduleAppInstallationSecrets,
  moduleApps,
  moduleAppVersions,
  users,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { ModuleAppModel } from '../moduleApp';

const USER_ID = 'module-app-gateway-user';
const OTHER_USER_ID = 'module-app-gateway-other';
const serverDB: LobeChatDatabase = await getTestDB();

beforeEach(async () => {
  await serverDB.delete(moduleAppInstallationSecrets);
  await serverDB.delete(moduleAppInstallations);
  await serverDB.delete(moduleAppVersions);
  await serverDB.delete(moduleApps);
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: USER_ID }, { id: OTHER_USER_ID }]);
});

describe('ModuleAppModel capability gateway isolation', () => {
  it('resolves only the matching active installation and encrypted installation secret', async () => {
    const [app] = await serverDB
      .insert(moduleApps)
      .values({
        appType: 'hybrid_app',
        category: 'business',
        description: 'Gateway test app.',
        displayName: 'Gateway App',
        icon: 'Package',
        slug: `gateway-${crypto.randomUUID()}`,
        status: 'published',
      })
      .returning();
    const [version] = await serverDB
      .insert(moduleAppVersions)
      .values({
        appId: app.id,
        runtimeManifest: {
          manifestVersion: 2,
          runtime: { outboundHosts: ['api.example.com'] },
        },
        version: '1.0.0',
      })
      .returning();
    const [installation] = await serverDB
      .insert(moduleAppInstallations)
      .values({
        appId: app.id,
        scopeType: 'personal',
        status: 'installed',
        userId: USER_ID,
        versionId: version.id,
      })
      .returning();
    await serverDB.insert(moduleAppInstallationSecrets).values({
      encryptedValue: 'encrypted-value',
      installationId: installation.id,
      secretKey: 'CRM_TOKEN',
    });
    const model = new ModuleAppModel(serverDB);

    await expect(
      model.getRuntimeInstallationContext({
        appId: app.id,
        installationId: installation.id,
        userId: USER_ID,
        versionId: version.id,
      }),
    ).resolves.toMatchObject({
      displayName: 'Gateway App',
      installationId: installation.id,
      runtimeManifest: expect.objectContaining({ manifestVersion: 2 }),
      scopeType: 'personal',
    });
    await expect(
      model.getRuntimeInstallationContext({
        appId: app.id,
        installationId: installation.id,
        userId: OTHER_USER_ID,
        versionId: version.id,
      }),
    ).resolves.toBeNull();
    await expect(
      model.getInstallationSecret({ installationId: installation.id, key: 'CRM_TOKEN' }),
    ).resolves.toBe('encrypted-value');
  });
});
