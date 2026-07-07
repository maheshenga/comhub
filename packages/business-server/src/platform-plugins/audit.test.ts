import { platformPluginAuditLogs } from '@/database/schemas';
import { describe, expect, it, vi } from 'vitest';

import { writePlatformPluginAuditLog } from './audit';

describe('writePlatformPluginAuditLog', () => {
  it('writes redacted platform plugin metadata to the audit table', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));
    const db = { insert };

    await writePlatformPluginAuditLog({
      actorUserId: 'admin-user',
      db: db as any,
      eventType: 'secret.updated',
      metadata: {
        Authorization: 'Bearer raw-token',
        safe: 'metadata',
      },
      resourceId: 'plugin-1',
      resourceType: 'platformPlugin',
      targetUserId: 'target-user',
    });

    expect(insert).toHaveBeenCalledWith(platformPluginAuditLogs);
    expect(values).toHaveBeenCalledWith({
      actorUserId: 'admin-user',
      eventType: 'secret.updated',
      metadata: {
        Authorization: '[REDACTED]',
        safe: 'metadata',
      },
      resourceId: 'plugin-1',
      resourceType: 'platformPlugin',
      targetUserId: 'target-user',
    });
  });
});
