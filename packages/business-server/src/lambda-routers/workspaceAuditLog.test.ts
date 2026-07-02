import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { WorkspaceAuditLogModel } from '@/database/models/workspaceAuditLog';
import { WorkspaceMemberModel } from '@/database/models/workspaceMember';

import { workspaceAuditLogRouter } from './workspaceAuditLog';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/database/models/workspaceAuditLog', () => ({
  WorkspaceAuditLogModel: vi.fn(),
}));

vi.mock('@/database/models/workspaceMember', () => ({
  WorkspaceMemberModel: vi.fn(),
}));

describe('workspaceAuditLogRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists workspace audit logs through WorkspaceAuditLogModel', async () => {
    vi.mocked(getServerDB).mockResolvedValue('db' as any);
    vi.mocked(WorkspaceMemberModel).mockImplementation(
      () =>
        ({
          getMember: vi.fn().mockResolvedValue({ role: 'owner' }),
        }) as any,
    );
    const list = vi.fn().mockResolvedValue({
      items: [{ action: 'workspace.created', id: 'log-1', workspaceId: 'workspace-1' }],
      nextCursor: null,
    });
    vi.mocked(WorkspaceAuditLogModel).mockImplementation(() => ({ list }) as any);

    const result = await workspaceAuditLogRouter
      .createCaller({ userId: 'owner-1' } as any)
      .list({
        action: 'workspace.created',
        cursor: '2026-01-02T00:00:00.000Z',
        limit: 250,
        workspaceId: 'workspace-1',
      } as any);

    expect(WorkspaceAuditLogModel).toHaveBeenCalledWith('db');
    expect(list).toHaveBeenCalledWith({
      action: 'workspace.created',
      cursor: new Date('2026-01-02T00:00:00.000Z'),
      limit: 100,
      workspaceId: 'workspace-1',
    });
    expect(result).toEqual({
      items: [{ action: 'workspace.created', id: 'log-1', workspaceId: 'workspace-1' }],
      nextCursor: null,
    });
  });

  it('rejects non-owner workspace members', async () => {
    vi.mocked(getServerDB).mockResolvedValue('db' as any);
    vi.mocked(WorkspaceMemberModel).mockImplementation(
      () =>
        ({
          getMember: vi.fn().mockResolvedValue({ role: 'member' }),
        }) as any,
    );

    await expect(
      workspaceAuditLogRouter
        .createCaller({ userId: 'member-1' } as any)
        .list({ workspaceId: 'workspace-1' }),
    ).rejects.toThrow('Only workspace owners can view audit logs');

    expect(WorkspaceAuditLogModel).not.toHaveBeenCalled();
  });
});
