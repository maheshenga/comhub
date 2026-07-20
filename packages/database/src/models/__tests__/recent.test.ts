// @vitest-environment node
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  agents,
  chatGroups,
  documents,
  knowledgeBases,
  messages,
  tasks,
  topics,
  users,
  workspaces,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { RecentModel } from '../recent';

const serverDB: LobeChatDatabase = await getTestDB();

const userId = 'recent-model-test-user';
const otherUserId = 'recent-model-test-other-user';

const recentModel = new RecentModel(serverDB, userId);

const now = () => new Date();
const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000);

const baseDocFields = {
  fileType: 'markdown',
  source: 'document',
  totalCharCount: 100,
  totalLineCount: 5,
} as const;

const baseTaskFields = {
  instruction: 'do the thing',
  seq: 1,
} as const;

describe('RecentModel', () => {
  beforeEach(async () => {
    await serverDB.delete(users);
    await serverDB.insert(users).values([{ id: userId }, { id: otherUserId }]);
  });

  afterEach(async () => {
    await serverDB.delete(users);
  });

  describe('queryRecent', () => {
    it('returns empty array when user has no recent items', async () => {
      const result = await recentModel.queryRecent();
      expect(result).toEqual([]);
    });

    it('only returns rows for the calling user', async () => {
      await serverDB.insert(agents).values({ id: 'agent-mine', userId, slug: 'inbox' });
      await serverDB
        .insert(agents)
        .values({ id: 'agent-other', userId: otherUserId, slug: 'inbox' });

      await serverDB.insert(topics).values([
        { id: 'topic-mine', userId, agentId: 'agent-mine', title: 'mine', updatedAt: now() },
        {
          id: 'topic-other',
          userId: otherUserId,
          agentId: 'agent-other',
          title: 'other',
          updatedAt: now(),
        },
      ]);

      const result = await recentModel.queryRecent();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'topic-mine', type: 'topic', status: null });
    });

    describe('topics arm', () => {
      it('includes inbox-agent topics and group topics', async () => {
        await serverDB.insert(agents).values({ id: 'agent-inbox', userId, slug: 'inbox' });
        await serverDB.insert(chatGroups).values({ id: 'group-1', userId });

        await serverDB.insert(topics).values([
          {
            id: 'topic-inbox',
            userId,
            agentId: 'agent-inbox',
            title: 'inbox topic',
            updatedAt: minutesAgo(5),
          },
          {
            id: 'topic-group',
            userId,
            groupId: 'group-1',
            title: 'group topic',
            updatedAt: minutesAgo(2),
          },
        ]);

        const result = await recentModel.queryRecent();
        expect(result.map((r) => r.id)).toEqual(['topic-group', 'topic-inbox']);
        expect(result[0]).toMatchObject({
          id: 'topic-group',
          type: 'topic',
          routeId: null,
          routeGroupId: 'group-1',
        });
        expect(result[1]).toMatchObject({
          id: 'topic-inbox',
          type: 'topic',
          routeId: 'agent-inbox',
          routeGroupId: null,
        });
      });

      it('orders topic rows by latest message activity', async () => {
        await serverDB.insert(agents).values({ id: 'agent-activity', userId, virtual: false });
        await serverDB.insert(topics).values([
          {
            agentId: 'agent-activity',
            id: 'topic-old-row-latest-message',
            title: 'latest message wins',
            updatedAt: minutesAgo(30),
            userId,
          },
          {
            agentId: 'agent-activity',
            id: 'topic-new-row-old-message',
            title: 'newer topic row',
            updatedAt: minutesAgo(5),
            userId,
          },
        ]);
        await serverDB.insert(messages).values({
          id: 'recent-topic-latest-message',
          role: 'user',
          topicId: 'topic-old-row-latest-message',
          updatedAt: now(),
          userId,
        });

        const result = await recentModel.queryRecent();

        expect(result.map((row) => row.id)).toEqual([
          'topic-old-row-latest-message',
          'topic-new-row-old-message',
        ]);
        expect(result[0].updatedAt.getTime()).toBeGreaterThan(result[1].updatedAt.getTime());
      });

      it('returns the latest topic for every requested agent and group without a global limit gap', async () => {
        await serverDB.insert(agents).values([
          { id: 'agent-dense', userId, virtual: false },
          { id: 'agent-quiet', userId, virtual: false },
        ]);
        await serverDB.insert(chatGroups).values({ id: 'group-latest', userId });
        await serverDB.insert(topics).values([
          ...Array.from({ length: 55 }, (_, index) => ({
            agentId: 'agent-dense',
            id: `dense-topic-${index}`,
            title: `Dense ${index}`,
            updatedAt: minutesAgo(index),
            userId,
          })),
          {
            agentId: 'agent-quiet',
            id: 'quiet-topic',
            title: 'Quiet latest',
            updatedAt: minutesAgo(100),
            userId,
          },
          {
            groupId: 'group-latest',
            id: 'group-topic-old',
            title: 'Group old',
            updatedAt: minutesAgo(20),
            userId,
          },
          {
            groupId: 'group-latest',
            id: 'group-topic-new',
            title: 'Group latest',
            updatedAt: minutesAgo(10),
            userId,
          },
        ]);

        const result = await recentModel.queryLatestTopicsByParents({
          agentIds: ['agent-dense', 'agent-quiet'],
          groupIds: ['group-latest'],
        });

        expect(result).toHaveLength(3);
        expect(result.map((row) => row.id)).toEqual(
          expect.arrayContaining(['dense-topic-0', 'quiet-topic', 'group-topic-new']),
        );
      });

      it('includes topics on non-virtual non-group agents', async () => {
        await serverDB.insert(agents).values({ id: 'agent-real', userId, virtual: false });

        await serverDB.insert(topics).values({
          id: 'topic-real',
          userId,
          agentId: 'agent-real',
          title: 'real',
          updatedAt: now(),
        });

        const result = await recentModel.queryRecent();
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('topic-real');
      });

      it('excludes topics on virtual agents that are not in a group', async () => {
        await serverDB.insert(agents).values({ id: 'agent-virtual', userId, virtual: true });

        await serverDB.insert(topics).values({
          id: 'topic-virtual',
          userId,
          agentId: 'agent-virtual',
          title: 'virtual',
          updatedAt: now(),
        });

        const result = await recentModel.queryRecent();
        expect(result).toEqual([]);
      });

      it('excludes topics with system triggers', async () => {
        await serverDB.insert(agents).values({ id: 'agent-inbox', userId, slug: 'inbox' });

        await serverDB.insert(topics).values([
          { id: 'topic-cron', userId, agentId: 'agent-inbox', trigger: 'cron', updatedAt: now() },
          { id: 'topic-eval', userId, agentId: 'agent-inbox', trigger: 'eval', updatedAt: now() },
          {
            id: 'topic-task',
            userId,
            agentId: 'agent-inbox',
            trigger: 'task_manager',
            updatedAt: now(),
          },
          {
            id: 'topic-task2',
            userId,
            agentId: 'agent-inbox',
            trigger: 'task',
            updatedAt: now(),
          },
          {
            id: 'topic-chat',
            userId,
            agentId: 'agent-inbox',
            trigger: 'chat',
            updatedAt: now(),
          },
        ]);

        const result = await recentModel.queryRecent();
        expect(result.map((r) => r.id)).toEqual(['topic-chat']);
      });

      it('falls back to "Untitled Topic" when title is null', async () => {
        await serverDB.insert(agents).values({ id: 'agent-inbox', userId, slug: 'inbox' });
        await serverDB.insert(topics).values({
          id: 'topic-untitled',
          userId,
          agentId: 'agent-inbox',
          title: null,
          updatedAt: now(),
        });

        const result = await recentModel.queryRecent();
        expect(result[0].title).toBe('Untitled Topic');
      });

      it('returns topic metadata when present', async () => {
        await serverDB.insert(agents).values({ id: 'agent-inbox', userId, slug: 'inbox' });
        await serverDB.insert(topics).values({
          id: 'topic-with-meta',
          userId,
          agentId: 'agent-inbox',
          metadata: { bot: { platform: 'slack' } } as any,
          updatedAt: now(),
        });

        const result = await recentModel.queryRecent();
        expect(result[0].metadata).toEqual({ bot: { platform: 'slack' } });
      });
    });

    describe('documents arm', () => {
      it('includes user-authored "api" pages', async () => {
        await serverDB.insert(documents).values({
          id: 'doc-api',
          userId,
          title: 'My Page',
          sourceType: 'api',
          updatedAt: now(),
          ...baseDocFields,
        });

        const result = await recentModel.queryRecent();
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'doc-api',
          type: 'document',
          title: 'My Page',
          routeId: null,
          routeGroupId: null,
          metadata: undefined,
        });
      });

      it('excludes web-browsing scraped pages (sourceType "web")', async () => {
        await serverDB.insert(documents).values([
          {
            id: 'doc-api',
            userId,
            title: 'Real Page',
            sourceType: 'api',
            updatedAt: minutesAgo(1),
            ...baseDocFields,
          },
          {
            id: 'doc-web',
            userId,
            title: 'XAU USD | Gold Spot US Dollar',
            sourceType: 'web',
            updatedAt: now(),
            ...baseDocFields,
          },
        ]);

        const result = await recentModel.queryRecent();
        expect(result.map((r) => r.id)).toEqual(['doc-api']);
        expect(result[0].status).toBeNull();
      });

      it('excludes file uploads (sourceType "file")', async () => {
        await serverDB.insert(documents).values({
          id: 'doc-file',
          userId,
          sourceType: 'file',
          updatedAt: now(),
          ...baseDocFields,
        });

        const result = await recentModel.queryRecent();
        expect(result).toEqual([]);
      });

      it('excludes agent-owned document rows', async () => {
        await serverDB.insert(documents).values([
          {
            id: 'doc-agent',
            userId,
            sourceType: 'agent',
            updatedAt: minutesAgo(1),
            ...baseDocFields,
          },
          {
            id: 'doc-agent-signal',
            userId,
            sourceType: 'agent-signal',
            updatedAt: now(),
            ...baseDocFields,
          },
        ]);

        const result = await recentModel.queryRecent();
        expect(result).toEqual([]);
      });

      it('excludes documents inside a knowledge base', async () => {
        await serverDB.insert(knowledgeBases).values({ id: 'kb-1', userId, name: 'kb' });
        await serverDB.insert(documents).values({
          id: 'doc-kb',
          userId,
          title: 'kb doc',
          sourceType: 'api',
          knowledgeBaseId: 'kb-1',
          updatedAt: now(),
          ...baseDocFields,
        });

        const result = await recentModel.queryRecent();
        expect(result).toEqual([]);
      });

      it('excludes folder documents', async () => {
        await serverDB.insert(documents).values({
          id: 'doc-folder',
          userId,
          title: 'Folder',
          sourceType: 'api',
          updatedAt: now(),
          ...baseDocFields,
          fileType: 'custom/folder',
        });

        const result = await recentModel.queryRecent();
        expect(result).toEqual([]);
      });

      it('falls back to filename then "Untitled Document" when title is null', async () => {
        await serverDB.insert(documents).values([
          {
            id: 'doc-fallback-filename',
            userId,
            title: null,
            filename: 'notes.md',
            sourceType: 'api',
            updatedAt: minutesAgo(1),
            ...baseDocFields,
          },
          {
            id: 'doc-untitled',
            userId,
            title: null,
            filename: null,
            sourceType: 'api',
            updatedAt: now(),
            ...baseDocFields,
          },
        ]);

        const result = await recentModel.queryRecent();
        const byId = Object.fromEntries(result.map((r) => [r.id, r.title]));
        expect(byId['doc-fallback-filename']).toBe('notes.md');
        expect(byId['doc-untitled']).toBe('Untitled Document');
      });
    });

    describe('tasks arm', () => {
      it('includes active tasks and surfaces assigneeAgentId as routeId', async () => {
        await serverDB.insert(agents).values({ id: 'agent-assignee', userId });

        await serverDB.insert(tasks).values({
          id: 'task-active',
          createdByUserId: userId,
          assigneeAgentId: 'agent-assignee',
          identifier: 'T-1',
          name: 'Active Task',
          status: 'running',
          updatedAt: now(),
          ...baseTaskFields,
        });

        const result = await recentModel.queryRecent();
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'task-active',
          type: 'task',
          title: 'Active Task',
          routeId: 'agent-assignee',
          routeGroupId: null,
          status: 'running',
        });
      });

      it('surfaces task status so home can render the icon without a second task.detail call', async () => {
        await serverDB.insert(tasks).values([
          {
            id: 'task-paused',
            createdByUserId: userId,
            identifier: 'T-P',
            status: 'paused',
            updatedAt: minutesAgo(2),
            ...baseTaskFields,
          },
          {
            id: 'task-pending',
            createdByUserId: userId,
            identifier: 'T-Q',
            status: 'pending',
            updatedAt: minutesAgo(1),
            ...baseTaskFields,
          },
        ]);

        const result = await recentModel.queryRecent();
        const byId = Object.fromEntries(result.map((r) => [r.id, r.status]));
        expect(byId['task-paused']).toBe('paused');
        expect(byId['task-pending']).toBe('pending');
      });

      it('excludes completed and canceled tasks', async () => {
        await serverDB.insert(tasks).values([
          {
            id: 'task-done',
            createdByUserId: userId,
            identifier: 'T-2',
            status: 'completed',
            updatedAt: now(),
            ...baseTaskFields,
          },
          {
            id: 'task-canceled',
            createdByUserId: userId,
            identifier: 'T-3',
            status: 'canceled',
            updatedAt: now(),
            ...baseTaskFields,
          },
          {
            id: 'task-running',
            createdByUserId: userId,
            identifier: 'T-4',
            status: 'running',
            updatedAt: now(),
            ...baseTaskFields,
          },
        ]);

        const result = await recentModel.queryRecent();
        expect(result.map((r) => r.id)).toEqual(['task-running']);
      });

      it('falls back from name → instruction → "Untitled Task"', async () => {
        await serverDB.insert(tasks).values([
          {
            id: 'task-named',
            createdByUserId: userId,
            identifier: 'T-A',
            name: 'Named',
            instruction: 'do A',
            seq: 1,
            status: 'running',
            updatedAt: minutesAgo(2),
          },
          {
            id: 'task-instruction',
            createdByUserId: userId,
            identifier: 'T-B',
            name: null,
            instruction: 'fallback to instruction',
            seq: 2,
            status: 'running',
            updatedAt: minutesAgo(1),
          },
        ]);

        const result = await recentModel.queryRecent();
        const byId = Object.fromEntries(result.map((r) => [r.id, r.title]));
        expect(byId['task-named']).toBe('Named');
        expect(byId['task-instruction']).toBe('fallback to instruction');
      });
    });

    describe('combined results', () => {
      it('filters by type before applying the limit', async () => {
        await serverDB.insert(agents).values({ id: 'agent-filter', userId, slug: 'inbox' });
        await serverDB.insert(topics).values({
          id: 'topic-filter',
          userId,
          agentId: 'agent-filter',
          title: 'topic',
          updatedAt: minutesAgo(2),
        });
        await serverDB.insert(documents).values({
          id: 'doc-filter',
          userId,
          title: 'doc',
          sourceType: 'api',
          updatedAt: minutesAgo(1),
          ...baseDocFields,
        });

        const result = await recentModel.queryRecent(1, ['topic']);
        expect(result.map((row) => `${row.type}:${row.id}`)).toEqual(['topic:topic-filter']);
      });

      it('orders all three types by updatedAt desc and applies the limit', async () => {
        await serverDB.insert(agents).values({ id: 'agent-inbox', userId, slug: 'inbox' });

        await serverDB.insert(topics).values({
          id: 'topic-1',
          userId,
          agentId: 'agent-inbox',
          title: 'topic',
          updatedAt: minutesAgo(10),
        });
        await serverDB.insert(documents).values({
          id: 'doc-1',
          userId,
          title: 'doc',
          sourceType: 'api',
          updatedAt: minutesAgo(5),
          ...baseDocFields,
        });
        await serverDB.insert(tasks).values({
          id: 'task-1',
          createdByUserId: userId,
          identifier: 'T-1',
          name: 'task',
          status: 'running',
          updatedAt: minutesAgo(1),
          ...baseTaskFields,
        });

        const result = await recentModel.queryRecent(10);
        expect(result.map((r) => `${r.type}:${r.id}`)).toEqual([
          'task:task-1',
          'document:doc-1',
          'topic:topic-1',
        ]);
      });

      it('respects the limit parameter', async () => {
        await serverDB.insert(agents).values({ id: 'agent-inbox', userId, slug: 'inbox' });
        await serverDB.insert(topics).values(
          Array.from({ length: 5 }, (_, i) => ({
            id: `topic-${i}`,
            userId,
            agentId: 'agent-inbox',
            title: `t${i}`,
            updatedAt: minutesAgo(i),
          })),
        );

        const result = await recentModel.queryRecent(2);
        expect(result).toHaveLength(2);
        expect(result.map((r) => r.id)).toEqual(['topic-0', 'topic-1']);
      });

      it('returns Date objects for updatedAt', async () => {
        await serverDB.insert(agents).values({ id: 'agent-inbox', userId, slug: 'inbox' });
        await serverDB.insert(topics).values({
          id: 'topic-date',
          userId,
          agentId: 'agent-inbox',
          updatedAt: now(),
        });

        const [row] = await recentModel.queryRecent();
        expect(row.updatedAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('queryMobileWorkspace', () => {
    it('includes the virtual inbox assistant and its latest topic', async () => {
      await serverDB.insert(agents).values({
        id: 'mobile-inbox',
        slug: 'inbox',
        title: 'Inbox',
        userId,
        virtual: true,
      });
      await serverDB.insert(topics).values({
        agentId: 'mobile-inbox',
        id: 'mobile-inbox-topic',
        title: 'Inbox topic',
        userId,
      });

      const result = await recentModel.queryMobileWorkspace({ limit: 20 });

      expect(result.items).toEqual([
        expect.objectContaining({
          id: 'mobile-inbox',
          topic: expect.objectContaining({ id: 'mobile-inbox-topic' }),
        }),
      ]);
    });

    it('discovers assistant and group parents without client-supplied ids', async () => {
      await serverDB.insert(agents).values({
        id: 'mobile-agent',
        pinned: true,
        title: 'Mobile Agent',
        userId,
        virtual: false,
      });
      await serverDB.insert(chatGroups).values({
        id: 'mobile-group',
        title: 'Mobile Group',
        userId,
      });
      await serverDB.insert(topics).values([
        {
          agentId: 'mobile-agent',
          id: 'mobile-agent-topic',
          title: 'Agent topic',
          updatedAt: minutesAgo(2),
          userId,
        },
        {
          groupId: 'mobile-group',
          id: 'mobile-group-topic',
          title: 'Group topic',
          updatedAt: minutesAgo(1),
          userId,
        },
      ]);

      const result = await recentModel.queryMobileWorkspace({ limit: 20 });

      expect(result.nextCursor).toBeUndefined();
      expect(result.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'mobile-agent',
            kind: 'agent',
            pinned: true,
            topic: expect.objectContaining({ id: 'mobile-agent-topic' }),
          }),
          expect.objectContaining({
            id: 'mobile-group',
            kind: 'group',
            topic: expect.objectContaining({ id: 'mobile-group-topic' }),
          }),
        ]),
      );
    });

    it('excludes system-triggered unread topics from assistant and group badges', async () => {
      await serverDB.insert(agents).values({
        id: 'mobile-unread-agent',
        title: 'Unread Agent',
        userId,
        virtual: false,
      });
      await serverDB.insert(chatGroups).values({
        id: 'mobile-unread-group',
        title: 'Unread Group',
        userId,
      });
      await serverDB.insert(topics).values([
        {
          agentId: 'mobile-unread-agent',
          id: 'mobile-unread-agent-visible',
          status: 'unread',
          title: 'Visible assistant topic',
          trigger: 'chat',
          userId,
        },
        {
          agentId: 'mobile-unread-agent',
          id: 'mobile-unread-agent-system',
          status: 'unread',
          title: 'System assistant topic',
          trigger: 'task',
          userId,
        },
        {
          groupId: 'mobile-unread-group',
          id: 'mobile-unread-group-visible',
          status: 'unread',
          title: 'Visible group topic',
          trigger: 'chat',
          userId,
        },
        {
          groupId: 'mobile-unread-group',
          id: 'mobile-unread-group-system',
          status: 'unread',
          title: 'System group topic',
          trigger: 'cron',
          userId,
        },
      ]);

      const result = await recentModel.queryMobileWorkspace({ limit: 20 });
      const unreadByParent = Object.fromEntries(
        result.items.map((item) => [`${item.kind}:${item.id}`, item.unreadCount]),
      );

      expect(unreadByParent).toMatchObject({
        'agent:mobile-unread-agent': 1,
        'group:mobile-unread-group': 1,
      });
    });

    it('uses an opaque cursor to paginate without duplicates', async () => {
      await serverDB.insert(agents).values(
        Array.from({ length: 3 }, (_, index) => ({
          id: `mobile-page-agent-${index}`,
          title: `Agent ${index}`,
          updatedAt: minutesAgo(index),
          userId,
          virtual: false,
        })),
      );

      const first = await recentModel.queryMobileWorkspace({ limit: 2 });
      const second = await recentModel.queryMobileWorkspace({ cursor: first.nextCursor, limit: 2 });

      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).toEqual(expect.any(String));
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeUndefined();
      expect(new Set([...first.items, ...second.items].map((item) => item.id))).toHaveProperty(
        'size',
        3,
      );
    });

    it('preserves database microseconds at cursor boundaries', async () => {
      await serverDB.insert(agents).values([
        { id: 'micro-z', title: 'First', userId, virtual: false },
        { id: 'micro-a', title: 'Second', userId, virtual: false },
        { id: 'micro-b', title: 'Third', userId, virtual: false },
      ]);
      await serverDB.execute(sql`
        UPDATE agents
        SET updated_at = CASE id
          WHEN 'micro-z' THEN '2026-07-20T08:00:00.123456Z'::timestamptz
          WHEN 'micro-a' THEN '2026-07-20T08:00:00.123455Z'::timestamptz
          ELSE '2026-07-20T08:00:00.123454Z'::timestamptz
        END
        WHERE id IN ('micro-z', 'micro-a', 'micro-b')
      `);

      const first = await recentModel.queryMobileWorkspace({ limit: 1 });
      const second = await recentModel.queryMobileWorkspace({ cursor: first.nextCursor, limit: 1 });
      const third = await recentModel.queryMobileWorkspace({ cursor: second.nextCursor, limit: 1 });

      expect([...first.items, ...second.items, ...third.items].map((item) => item.id)).toEqual([
        'micro-z',
        'micro-a',
        'micro-b',
      ]);
    });

    it('searches topic titles as well as parent titles', async () => {
      await serverDB.insert(agents).values({
        id: 'mobile-search-agent',
        title: 'General assistant',
        userId,
        virtual: false,
      });
      await serverDB.insert(topics).values({
        agentId: 'mobile-search-agent',
        id: 'mobile-search-topic',
        title: 'Quarterly strategy',
        userId,
      });

      const result = await recentModel.queryMobileWorkspace({ limit: 20, query: 'strategy' });

      expect(result.items).toEqual([
        expect.objectContaining({
          id: 'mobile-search-agent',
          topic: expect.objectContaining({ id: 'mobile-search-topic' }),
        }),
      ]);
    });

    it('uses the same activity timestamp to rank and select the latest topic', async () => {
      await serverDB.insert(agents).values({
        id: 'mobile-activity-agent',
        title: 'Activity assistant',
        userId,
        virtual: false,
      });
      await serverDB.insert(topics).values([
        {
          agentId: 'mobile-activity-agent',
          id: 'topic-newer-edit',
          title: 'Edited later',
          updatedAt: minutesAgo(1),
          userId,
        },
        {
          agentId: 'mobile-activity-agent',
          id: 'topic-newer-message',
          title: 'Message later',
          updatedAt: minutesAgo(20),
          userId,
        },
      ]);
      await serverDB.insert(messages).values([
        {
          id: 'message-old',
          role: 'user',
          topicId: 'topic-newer-edit',
          updatedAt: minutesAgo(30),
          userId,
        },
        {
          id: 'message-new',
          role: 'user',
          topicId: 'topic-newer-message',
          updatedAt: minutesAgo(2),
          userId,
        },
      ]);

      const result = await recentModel.queryMobileWorkspace({ limit: 20 });

      expect(result.items[0].topic?.id).toBe('topic-newer-edit');
    });

    it('isolates personal and active-workspace parents', async () => {
      const workspaceId = 'recent-mobile-workspace';
      await serverDB.insert(workspaces).values({
        id: workspaceId,
        name: 'Recent Mobile Workspace',
        primaryOwnerId: userId,
        slug: workspaceId,
      });
      await serverDB.insert(agents).values([
        { id: 'mobile-personal-agent', title: 'Personal', userId, virtual: false },
        {
          id: 'mobile-workspace-agent',
          title: 'Workspace',
          userId,
          virtual: false,
          workspaceId,
        },
      ]);

      const personal = await recentModel.queryMobileWorkspace({ limit: 20 });
      const workspace = await new RecentModel(serverDB, userId, workspaceId).queryMobileWorkspace({
        limit: 20,
      });

      expect(personal.items.map((item) => item.id)).toEqual(['mobile-personal-agent']);
      expect(workspace.items.map((item) => item.id)).toEqual(['mobile-workspace-agent']);
    });
  });
});
