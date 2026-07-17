import { afterEach, describe, expect, it, vi } from 'vitest';

import { recordAdminAudit, recordAdminAuditStrict } from './audit';

const createDb = (insertResult: () => Promise<unknown>) => {
  const values = vi.fn(insertResult);
  const db = { insert: vi.fn(() => ({ values })) } as any;

  return { db, values };
};

const context = (db: any) => ({
  clientIp: '203.0.113.9',
  serverDB: db,
  userId: 'admin-user',
});

const entry = {
  action: 'user.impersonate.attempt',
  resourceType: 'user',
  targetUserId: 'target-user',
};

describe('admin audit write modes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('strictly stores actor, target, and forensic client IP', async () => {
    const { db, values } = createDb(() => Promise.resolve());

    await recordAdminAuditStrict(context(db), entry);

    expect(values).toHaveBeenCalledWith({
      action: 'user.impersonate.attempt',
      actorUserId: 'admin-user',
      ipAddress: '203.0.113.9',
      payload: null,
      resourceId: null,
      resourceType: 'user',
      targetUserId: 'target-user',
    });
  });

  it('propagates strict audit insert failures', async () => {
    const failure = new Error('audit insert failed');
    const { db } = createDb(() => Promise.reject(failure));

    await expect(recordAdminAuditStrict(context(db), entry)).rejects.toBe(failure);
  });

  it('keeps the existing best-effort helper non-blocking', async () => {
    const failure = new Error('audit insert failed');
    const { db } = createDb(() => Promise.reject(failure));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(recordAdminAudit(context(db), entry)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith('[admin-audit] failed to record audit log', failure);
  });
});
