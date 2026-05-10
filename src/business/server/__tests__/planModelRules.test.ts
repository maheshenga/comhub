// @vitest-environment node
import { Plans } from '@lobechat/types';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import { planCatalog, userPlanSnapshots, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { isModelAllowedByPlanRules, resolvePlanModelRules } from '../planModelRules';

const serverDB: LobeChatDatabase = await getTestDB();
const expiryUserId = 'plan-model-rules-expired-user';

afterEach(async () => {
  await serverDB.delete(userPlanSnapshots).where(eq(userPlanSnapshots.userId, expiryUserId));
  await serverDB.delete(planCatalog).where(eq(planCatalog.plan, Plans.Free));
  await serverDB.delete(planCatalog).where(eq(planCatalog.plan, Plans.Starter));
  await serverDB.delete(users).where(eq(users.id, expiryUserId));
});

describe('plan model rules', () => {
  it('allows exact group-qualified model entries', () => {
    const rules = {
      chat: {
        allowlist: ['pro:gpt-4o'],
        mode: 'allowlist' as const,
      },
    };

    expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'pro')).toBe(true);
    expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'default')).toBe(false);
  });

  it('supports group and model wildcards in qualified entries', () => {
    expect(
      isModelAllowedByPlanRules(
        { chat: { allowlist: ['*:gpt-4o'], mode: 'allowlist' } },
        'gpt-4o',
        'chat',
        'vip',
      ),
    ).toBe(true);

    expect(
      isModelAllowedByPlanRules(
        { chat: { allowlist: ['pro:*'], mode: 'allowlist' } },
        'claude-3-5-sonnet',
        'chat',
        'pro',
      ),
    ).toBe(true);
  });

  it('keeps legacy unqualified model entries working', () => {
    const rules = {
      chat: {
        allowlist: ['gpt-4o'],
        mode: 'allowlist' as const,
      },
    };

    expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'pro')).toBe(true);
  });

  it('allows group-qualified allowlist entries when no group context is available', () => {
    const rules = {
      chat: {
        allowlist: ['basic:gpt-4o-mini'],
        mode: 'allowlist' as const,
      },
    };

    expect(isModelAllowedByPlanRules(rules, 'gpt-4o-mini', 'chat')).toBe(true);
  });

  it('blocks only matching group-qualified entries in blocklist mode', () => {
    const rules = {
      chat: {
        blocklist: ['pro:gpt-4o'],
        mode: 'blocklist' as const,
      },
    };

    expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'pro')).toBe(false);
    expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'vip')).toBe(true);
  });

  it('falls back to free plan rules when the latest active paid snapshot has expired', async () => {
    await serverDB.insert(users).values([{ id: expiryUserId }]);
    await serverDB.insert(planCatalog).values([
      {
        displayName: 'Free',
        modelRules: { chat: { allowlist: ['free-chat'], mode: 'allowlist' } },
        monthlyCredits: 0,
        monthlyPrice: 0,
        plan: Plans.Free,
      },
      {
        displayName: 'Starter',
        modelRules: { chat: { allowlist: ['paid-chat'], mode: 'allowlist' } },
        monthlyCredits: 100,
        monthlyPrice: 68,
        plan: Plans.Starter,
      },
    ]);
    await serverDB.insert(userPlanSnapshots).values({
      cycle: 'monthly',
      endsAt: new Date('2020-01-01T00:00:00.000Z'),
      monthlyCredits: 100,
      monthlyPrice: 68,
      plan: Plans.Starter,
      provider: 'admin_manual',
      startedAt: new Date('2019-12-01T00:00:00.000Z'),
      status: 'active',
      userId: expiryUserId,
    });

    await expect(resolvePlanModelRules({ db: serverDB, userId: expiryUserId })).resolves.toEqual({
      chat: { allowlist: ['free-chat'], mode: 'allowlist' },
    });

    const fallbackSnapshot = await serverDB.query.userPlanSnapshots.findFirst({
      where: eq(userPlanSnapshots.userId, expiryUserId),
      orderBy: (snapshots, { desc }) => [desc(snapshots.startedAt)],
    });
    expect(fallbackSnapshot).toMatchObject({
      currency: 'CNY',
      plan: Plans.Free,
      status: 'active',
    });
  });
});
