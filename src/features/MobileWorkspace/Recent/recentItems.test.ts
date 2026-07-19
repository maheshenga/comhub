import { describe, expect, it } from 'vitest';

import type { RecentItem } from '@/server/routers/lambda/recent';
import { type LobeSession, LobeSessionType } from '@/types/session';

import { buildMobileRecentItems } from './recentItems';

const session = (
  id: string,
  type: LobeSessionType,
  options: { pinned?: boolean; title: string; updatedAt: string },
): LobeSession =>
  ({
    ...(type === LobeSessionType.Agent ? { config: {}, model: 'gpt-4.1' } : {}),
    createdAt: new Date(options.updatedAt),
    id,
    meta: { title: options.title },
    pinned: options.pinned,
    type,
    updatedAt: new Date(options.updatedAt),
  }) as LobeSession;

const recentTopic = (
  id: string,
  routePath: string,
  updatedAt: string,
  agentId?: string | null,
): RecentItem => ({
  agentId,
  icon: 'topic',
  id,
  routePath,
  status: null,
  title: id,
  type: 'topic',
  updatedAt: new Date(updatedAt),
});

describe('buildMobileRecentItems', () => {
  it('places pinned agents before pinned groups and keeps remaining topics newest first', () => {
    const pinnedAgent = session('agent-pinned', LobeSessionType.Agent, {
      pinned: true,
      title: 'Pinned Agent',
      updatedAt: '2026-07-18T08:00:00.000Z',
    });
    const pinnedGroup = session('group-pinned', LobeSessionType.Group, {
      pinned: true,
      title: 'Pinned Group',
      updatedAt: '2026-07-19T08:00:00.000Z',
    });
    const freeAgent = session('agent-free', LobeSessionType.Agent, {
      title: 'Free Agent',
      updatedAt: '2026-07-17T08:00:00.000Z',
    });
    const freeGroup = session('group-free', LobeSessionType.Group, {
      title: 'Free Group',
      updatedAt: '2026-07-17T07:00:00.000Z',
    });

    const result = buildMobileRecentItems({
      pinnedSessions: [pinnedGroup, pinnedAgent],
      recents: [
        recentTopic(
          'pinned-agent-topic',
          '/agent/agent-pinned/pinned-agent-topic',
          '2026-07-19T12:00:00.000Z',
          'agent-pinned',
        ),
        recentTopic(
          'pinned-group-topic',
          '/group/group-pinned?topic=pinned-group-topic',
          '2026-07-19T11:00:00.000Z',
        ),
        recentTopic(
          'newer-topic',
          '/agent/agent-free/newer-topic',
          '2026-07-19T10:00:00.000Z',
          'agent-free',
        ),
        recentTopic(
          'older-group-topic',
          '/group/group-free?topic=older-group-topic',
          '2026-07-19T09:00:00.000Z',
        ),
      ],
      sessions: [pinnedAgent, pinnedGroup, freeAgent, freeGroup],
    });

    expect(result.pinned.map((item) => `${item.kind}:${item.sessionId}`)).toEqual([
      'agent:agent-pinned',
      'group:group-pinned',
    ]);
    expect(result.recent.map((item) => `${item.kind}:${item.id}`)).toEqual([
      'topic:newer-topic',
      'group-topic:older-group-topic',
    ]);
    expect(result.recent[1].routePath).toBe('/group/group-free?topic=older-group-topic');
  });

  it('removes duplicate and orphan topic records', () => {
    const agent = session('agent-free', LobeSessionType.Agent, {
      title: 'Free Agent',
      updatedAt: '2026-07-17T08:00:00.000Z',
    });
    const valid = recentTopic(
      'valid-topic',
      '/agent/agent-free/valid-topic',
      '2026-07-19T10:00:00.000Z',
      'agent-free',
    );

    const result = buildMobileRecentItems({
      pinnedSessions: [],
      recents: [
        valid,
        { ...valid, updatedAt: new Date('2026-07-18T10:00:00.000Z') },
        recentTopic(
          'missing-parent',
          '/agent/missing/missing-parent',
          '2026-07-19T09:00:00.000Z',
          'missing',
        ),
        recentTopic('orphan', '/', '2026-07-19T08:00:00.000Z'),
      ],
      sessions: [agent],
    });

    expect(result.recent.map((item) => item.id)).toEqual(['valid-topic']);
  });
});
