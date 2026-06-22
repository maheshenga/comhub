// @vitest-environment node
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { devices, users, workspaces } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { DeviceModel } from '../device';

const serverDB: LobeChatDatabase = await getTestDB();

const userId = 'device-model-test-user-id';
const otherUserId = 'device-model-other-user';
const wsId = 'device-model-ws-1';
const deviceModel = new DeviceModel(serverDB, userId);

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }, { id: otherUserId }]);
});

afterEach(async () => {
  await serverDB.delete(users).where(eq(users.id, userId));
  await serverDB.delete(devices).where(eq(devices.userId, userId));
});

describe('DeviceModel', () => {
  describe('register', () => {
    it('should insert a new device', async () => {
      const result = await deviceModel.register({
        deviceId: 'dev-1',
        hostname: 'My-Mac.local',
        identitySource: 'machine-id',
        platform: 'darwin',
      });

      expect(result.id).toBeDefined();
      expect(result).toMatchObject({
        deviceId: 'dev-1',
        hostname: 'My-Mac.local',
        identitySource: 'machine-id',
        platform: 'darwin',
        userId,
      });
    });

    it('should upsert on (userId, deviceId) and refresh machine fields', async () => {
      await deviceModel.register({
        deviceId: 'dev-1',
        hostname: 'old-host',
        identitySource: 'fallback',
        platform: 'linux',
      });

      await deviceModel.register({
        deviceId: 'dev-1',
        hostname: 'new-host',
        identitySource: 'machine-id',
        platform: 'darwin',
      });

      const rows = await serverDB.query.devices.findMany({
        where: and(eq(devices.userId, userId), eq(devices.deviceId, 'dev-1')),
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        hostname: 'new-host',
        identitySource: 'machine-id',
        platform: 'darwin',
      });
    });

    it('should NOT overwrite user-owned fields on re-register', async () => {
      await deviceModel.register({
        deviceId: 'dev-1',
        hostname: 'host',
        identitySource: 'machine-id',
        platform: 'darwin',
      });
      await deviceModel.update('dev-1', {
        defaultCwd: '/Users/me/work',
        friendlyName: 'My Work Mac',
        workingDirs: [{ path: '/Users/me/work' }, { path: '/Users/me/tmp', repoType: 'github' }],
      });

      // Re-register (e.g. user logs in again / reconnects)
      await deviceModel.register({
        deviceId: 'dev-1',
        hostname: 'host',
        identitySource: 'machine-id',
        platform: 'darwin',
      });

      const row = await deviceModel.findByDeviceId('dev-1');
      expect(row).toMatchObject({
        defaultCwd: '/Users/me/work',
        friendlyName: 'My Work Mac',
        workingDirs: [{ path: '/Users/me/work' }, { path: '/Users/me/tmp', repoType: 'github' }],
      });
    });
  });

  describe('query', () => {
    it('should return only the current user devices, newest lastSeen first', async () => {
      await deviceModel.register({ deviceId: 'dev-old', identitySource: 'machine-id' });
      await deviceModel.register({ deviceId: 'dev-new', identitySource: 'machine-id' });
      // a device owned by another user must not leak
      await new DeviceModel(serverDB, otherUserId).register({
        deviceId: 'other-dev',
        identitySource: 'machine-id',
      });

      const list = await deviceModel.query();
      expect(list.map((d) => d.deviceId)).toEqual(['dev-new', 'dev-old']);
    });
  });

  describe('workspace devices', () => {
    beforeEach(async () => {
      await serverDB
        .insert(workspaces)
        .values({ id: wsId, name: 'WS 1', primaryOwnerId: userId, slug: 'device-model-ws-1-slug' });
    });

    it('queryPersonal excludes workspace-enrolled rows', async () => {
      await deviceModel.register({ deviceId: 'p1', identitySource: 'machine-id' });
      await serverDB
        .insert(devices)
        .values({ deviceId: 'w1', identitySource: 'machine-id', userId, workspaceId: wsId });

      const personal = await deviceModel.queryPersonal();

      expect(personal.map((d) => d.deviceId)).toEqual(['p1']);
    });

    it('query preserves the existing user-level device list behavior', async () => {
      await deviceModel.register({ deviceId: 'p1', identitySource: 'machine-id' });
      await serverDB
        .insert(devices)
        .values({ deviceId: 'w1', identitySource: 'machine-id', userId, workspaceId: wsId });

      const userDevices = (await deviceModel.query()).map((d) => d.deviceId).sort();

      expect(userDevices).toEqual(['p1', 'w1']);
    });

    it('queryWorkspaceDevices returns enrolled devices for the current workspace across admins', async () => {
      await serverDB.insert(devices).values([
        { deviceId: 'w1', identitySource: 'machine-id', userId, workspaceId: wsId },
        { deviceId: 'w2', identitySource: 'machine-id', userId: otherUserId, workspaceId: wsId },
      ]);
      await deviceModel.register({ deviceId: 'p1', identitySource: 'machine-id' });

      const ids = (await new DeviceModel(serverDB, userId, wsId).queryWorkspaceDevices())
        .map((d) => d.deviceId)
        .sort();

      expect(ids).toEqual(['w1', 'w2']);
    });

    it('queryWorkspaceDevices returns [] without workspace context', async () => {
      await serverDB
        .insert(devices)
        .values({ deviceId: 'w1', identitySource: 'machine-id', userId, workspaceId: wsId });

      expect(await deviceModel.queryWorkspaceDevices()).toEqual([]);
    });

    it('dedupes a machine enrolled into one workspace by different admins', async () => {
      await new DeviceModel(serverDB, userId, wsId).registerWorkspaceDevice({
        deviceId: 'wdev',
        hostname: 'A-host',
        identitySource: 'machine-id',
        workspaceId: wsId,
      });

      await new DeviceModel(serverDB, otherUserId, wsId).registerWorkspaceDevice({
        deviceId: 'wdev',
        hostname: 'B-host',
        identitySource: 'machine-id',
        workspaceId: wsId,
      });

      const rows = (await new DeviceModel(serverDB, userId, wsId).queryWorkspaceDevices()).filter(
        (d) => d.deviceId === 'wdev',
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(userId);
      expect(rows[0].hostname).toBe('B-host');
    });

    it('findWorkspaceDeviceById is scoped to workspace context', async () => {
      await serverDB
        .insert(devices)
        .values({ deviceId: 'w1', identitySource: 'machine-id', userId, workspaceId: wsId });

      expect(
        (await new DeviceModel(serverDB, userId, wsId).findWorkspaceDeviceById('w1'))?.deviceId,
      ).toBe('w1');
      expect(await deviceModel.findWorkspaceDeviceById('w1')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update user-editable fields', async () => {
      await deviceModel.register({ deviceId: 'dev-1', identitySource: 'machine-id' });

      await deviceModel.update('dev-1', { friendlyName: 'Renamed' });

      const row = await deviceModel.findByDeviceId('dev-1');
      expect(row?.friendlyName).toBe('Renamed');
    });

    it('should not affect another user device with the same deviceId', async () => {
      await deviceModel.register({ deviceId: 'shared-id', identitySource: 'machine-id' });
      const other = new DeviceModel(serverDB, 'device-model-other-user');
      await other.register({ deviceId: 'shared-id', identitySource: 'machine-id' });

      await deviceModel.update('shared-id', { friendlyName: 'Mine' });

      const otherRow = await other.findByDeviceId('shared-id');
      expect(otherRow?.friendlyName).toBeNull();
    });
  });

  describe('delete', () => {
    it('should remove the row', async () => {
      await deviceModel.register({ deviceId: 'dev-1', identitySource: 'machine-id' });

      await deviceModel.delete('dev-1');

      const row = await deviceModel.findByDeviceId('dev-1');
      expect(row).toBeUndefined();
    });
  });
});
