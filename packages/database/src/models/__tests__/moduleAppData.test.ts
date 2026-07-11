// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  moduleAppDataRows,
  moduleAppDataSchemas,
  moduleAppInstallations,
  moduleApps,
  moduleAppVersions,
  users,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { ModuleAppDataModel } from '../moduleAppData';

const USER_ID = 'module-app-data-user';
const serverDB: LobeChatDatabase = await getTestDB();

const createInstallation = async () => {
  const [app] = await serverDB
    .insert(moduleApps)
    .values({
      appType: 'standard_app',
      category: 'business',
      description: 'Managed data test.',
      displayName: 'Managed Data',
      icon: 'Database',
      slug: `managed-data-${crypto.randomUUID()}`,
    })
    .returning();
  const [version] = await serverDB
    .insert(moduleAppVersions)
    .values({ appId: app.id, version: '1.0.0' })
    .returning();
  const [installation] = await serverDB
    .insert(moduleAppInstallations)
    .values({ appId: app.id, scopeType: 'personal', userId: USER_ID, versionId: version.id })
    .returning();
  return installation;
};

beforeEach(async () => {
  await serverDB.delete(moduleAppDataRows);
  await serverDB.delete(moduleAppDataSchemas);
  await serverDB.delete(moduleAppInstallations);
  await serverDB.delete(moduleAppVersions);
  await serverDB.delete(moduleApps);
  await serverDB.delete(users);
  await serverDB.insert(users).values({ id: USER_ID });
});

describe('ModuleAppDataModel', () => {
  it('isolates schemas and rows by installation', async () => {
    const installationA = await createInstallation();
    const installationB = await createInstallation();
    const model = new ModuleAppDataModel(serverDB);
    const schema = {
      fields: [{ key: 'email', required: true, type: 'string' as const }],
      indexes: [{ fields: ['email'], unique: true }],
      key: 'candidates',
    };

    await model.createSchema({
      installationId: installationA.id,
      schema,
      tableKey: 'candidates',
      version: 1,
    });
    await model.insertRow({
      installationId: installationA.id,
      rowKey: 'candidate-1',
      schemaVersion: 1,
      tableKey: 'candidates',
      values: { email: 'one@example.com' },
    });

    await expect(
      model.getRow({
        installationId: installationB.id,
        rowKey: 'candidate-1',
        tableKey: 'candidates',
      }),
    ).resolves.toBeNull();
    await expect(
      model.getRow({
        installationId: installationA.id,
        rowKey: 'candidate-1',
        tableKey: 'candidates',
      }),
    ).resolves.toMatchObject({ values: { email: 'one@example.com' } });
    await expect(
      serverDB.insert(moduleAppDataRows).values({
        installationId: installationB.id,
        rowKey: 'undeclared-schema',
        schemaVersion: 1,
        tableKey: 'candidates',
        values: {},
      }),
    ).rejects.toThrow();
  });

  it('enforces immutable schema versions and installation-local row keys', async () => {
    const installationA = await createInstallation();
    const installationB = await createInstallation();
    const model = new ModuleAppDataModel(serverDB);
    const schema = {
      fields: [{ key: 'email', type: 'string' as const }],
      indexes: [],
      key: 'candidates',
    };

    await model.createSchema({ installationId: installationA.id, schema, tableKey: 'candidates', version: 1 });
    await model.createSchema({ installationId: installationB.id, schema, tableKey: 'candidates', version: 1 });
    await expect(
      model.createSchema({ installationId: installationA.id, schema, tableKey: 'candidates', version: 1 }),
    ).rejects.toThrow();
    await model.insertRow({
      installationId: installationA.id,
      rowKey: 'same-key',
      schemaVersion: 1,
      tableKey: 'candidates',
      values: {},
    });
    await expect(
      model.insertRow({
        installationId: installationA.id,
        rowKey: 'same-key',
        schemaVersion: 1,
        tableKey: 'candidates',
        values: {},
      }),
    ).rejects.toThrow();
    await expect(
      model.insertRow({
        installationId: installationB.id,
        rowKey: 'same-key',
        schemaVersion: 1,
        tableKey: 'candidates',
        values: {},
      }),
    ).resolves.toMatchObject({ rowKey: 'same-key' });
  });
});
