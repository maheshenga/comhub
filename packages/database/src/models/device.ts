import type { WorkingDirEntry } from '@lobechat/types';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { DeviceItem } from '../schemas';
import { devices } from '../schemas';
import type { LobeChatDatabase } from '../type';

export interface RegisterDeviceParams {
  deviceId: string;
  hostname?: string | null;
  identitySource: string;
  platform?: string | null;
}

/** Columns the user owns - never overwritten by an auto-register upsert. */
export interface UpdateDeviceParams {
  defaultCwd?: string | null;
  friendlyName?: string | null;
  workingDirs?: WorkingDirEntry[];
}

/**
 * Two distinct kinds of device live in this table, separated by `workspace_id`:
 *
 * - Personal devices (`workspace_id IS NULL`) are keyed by `(userId, deviceId)`.
 *   Existing reads and writes remain user-level for compatibility with the
 *   desktop / CLI device list and project-directory cache.
 * - Workspace devices (`workspace_id = <ws>`) are shared infra enrolled into a
 *   workspace, keyed by `(workspaceId, deviceId)`. `userId` records the
 *   enrolling admin.
 */
export class DeviceModel {
  private userId: string;
  private db: LobeChatDatabase;
  private workspaceId?: string;

  constructor(db: LobeChatDatabase, userId: string, workspaceId?: string) {
    this.userId = userId;
    this.db = db;
    this.workspaceId = workspaceId;
  }

  register = async (params: RegisterDeviceParams) => {
    const now = new Date();
    const [result] = await this.db
      .insert(devices)
      .values({
        deviceId: params.deviceId,
        hostname: params.hostname,
        identitySource: params.identitySource,
        lastSeenAt: now,
        platform: params.platform,
        userId: this.userId,
      })
      .onConflictDoUpdate({
        set: {
          hostname: params.hostname,
          identitySource: params.identitySource,
          lastSeenAt: now,
          platform: params.platform,
        },
        target: [devices.userId, devices.deviceId],
        targetWhere: sql`${devices.workspaceId} IS NULL`,
      })
      .returning();

    return result;
  };

  registerWorkspaceDevice = async (params: RegisterDeviceParams & { workspaceId: string }) => {
    const now = new Date();
    const [result] = await this.db
      .insert(devices)
      .values({
        deviceId: params.deviceId,
        hostname: params.hostname,
        identitySource: params.identitySource,
        lastSeenAt: now,
        platform: params.platform,
        userId: this.userId,
        workspaceId: params.workspaceId,
      })
      // Dedupe a workspace device independently of the admin who enrolled it.
      .onConflictDoUpdate({
        set: {
          hostname: params.hostname,
          identitySource: params.identitySource,
          lastSeenAt: now,
          platform: params.platform,
        },
        target: [devices.workspaceId, devices.deviceId],
        targetWhere: sql`${devices.workspaceId} IS NOT NULL`,
      })
      .returning();

    return result;
  };

  query = async (): Promise<DeviceItem[]> => {
    return this.db.query.devices.findMany({
      orderBy: [desc(devices.lastSeenAt), desc(devices.createdAt)],
      where: eq(devices.userId, this.userId),
    });
  };

  queryPersonal = async (): Promise<DeviceItem[]> => {
    return this.db.query.devices.findMany({
      orderBy: [desc(devices.lastSeenAt), desc(devices.createdAt)],
      where: and(eq(devices.userId, this.userId), isNull(devices.workspaceId)),
    });
  };

  queryWorkspaceDevices = async (): Promise<DeviceItem[]> => {
    if (!this.workspaceId) return [];

    return this.db.query.devices.findMany({
      orderBy: [desc(devices.lastSeenAt), desc(devices.createdAt)],
      where: eq(devices.workspaceId, this.workspaceId),
    });
  };

  findWorkspaceDeviceById = async (deviceId: string) => {
    if (!this.workspaceId) return undefined;

    return this.db.query.devices.findFirst({
      where: and(eq(devices.workspaceId, this.workspaceId), eq(devices.deviceId, deviceId)),
    });
  };

  findByDeviceId = async (deviceId: string) => {
    return this.db.query.devices.findFirst({
      where: and(eq(devices.userId, this.userId), eq(devices.deviceId, deviceId)),
    });
  };

  update = async (deviceId: string, value: UpdateDeviceParams) => {
    return this.db
      .update(devices)
      .set({ ...value, updatedAt: new Date() })
      .where(and(eq(devices.userId, this.userId), eq(devices.deviceId, deviceId)));
  };

  delete = async (deviceId: string) => {
    return this.db
      .delete(devices)
      .where(and(eq(devices.userId, this.userId), eq(devices.deviceId, deviceId)));
  };

  updateWorkspaceDevice = async (deviceId: string, value: UpdateDeviceParams) => {
    if (!this.workspaceId) return;

    return this.db
      .update(devices)
      .set({ ...value, updatedAt: new Date() })
      .where(and(eq(devices.workspaceId, this.workspaceId), eq(devices.deviceId, deviceId)));
  };

  deleteWorkspaceDevice = async (deviceId: string) => {
    if (!this.workspaceId) return;

    return this.db
      .delete(devices)
      .where(and(eq(devices.workspaceId, this.workspaceId), eq(devices.deviceId, deviceId)));
  };
}
