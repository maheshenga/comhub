import dayjs from 'dayjs';
import { type Pricing } from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type LobeChatDatabase } from '@/database/type';
import { type MessageMetadata } from '@/types/message';

import { UsageRecordService } from './index';

const { getServerModelPricingMock } = vi.hoisted(() => ({
  getServerModelPricingMock: vi.fn(),
}));

vi.mock('@/business/server/serverModelPricing', () => ({
  getServerModelPricing: getServerModelPricingMock,
}));

describe('UsageRecordService', () => {
  let service: UsageRecordService;
  let mockDb: LobeChatDatabase;
  const userId = 'test-user-id';

  // Helper function to setup query chain mock
  const setupQueryChainMock = (mockMessages: any[]) => {
    const mockOrderBy = vi.fn().mockResolvedValue(mockMessages);
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockLedgerWhere = vi.fn().mockResolvedValue([]);
    const mockLedgerFrom = vi.fn().mockReturnValue({ where: mockLedgerWhere });
    mockDb.select = vi.fn().mockReturnValueOnce({ from: mockFrom }).mockReturnValue({
      from: mockLedgerFrom,
    });
  };

  beforeEach(() => {
    getServerModelPricingMock.mockReset();
    getServerModelPricingMock.mockResolvedValue(undefined);

    // Create a fresh mock for each test
    const mockOrderBy = vi.fn();
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    mockDb = {
      select: mockSelect,
    } as unknown as LobeChatDatabase;

    service = new UsageRecordService(mockDb, userId);
  });

  describe('findByMonth', () => {
    it('should return usage records for the current month when no month is provided', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          userId,
          role: 'assistant',
          provider: 'openai',
          model: 'gpt-4',
          createdAt: new Date(),
          metadata: {
            cost: 0.05,
            totalInputTokens: 100,
            totalOutputTokens: 50,
            tps: 10,
            ttft: 500,
          } as MessageMetadata,
        },
      ];

      setupQueryChainMock(mockMessages);

      const result = await service.findByMonth();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        model: 'gpt-4',
        provider: 'openai',
        spend: 0.05,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalTokens: 150,
        tps: 10,
        ttft: 500,
        type: 'chat',
        userId,
      });
    });

    it('should return usage records for a specific month', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          userId,
          role: 'assistant',
          provider: 'anthropic',
          model: 'claude-3',
          createdAt: new Date('2024-01-15'),
          metadata: {
            cost: 0.03,
            totalInputTokens: 80,
            totalOutputTokens: 40,
          } as MessageMetadata,
        },
      ];

      setupQueryChainMock(mockMessages);

      const result = await service.findByMonth('2024-01');

      expect(result[0].model).toBe('claude-3');
      expect(result[0].spend).toBe(0.03);
    });

    it('prefers the top-level usage column over metadata.usage', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          userId,
          role: 'assistant',
          provider: 'openai',
          model: 'gpt-4',
          createdAt: new Date(),
          // dedicated column must win over the legacy metadata.usage
          usage: { cost: 0.05, totalInputTokens: 100, totalOutputTokens: 50 },
          metadata: {
            usage: { cost: 9.9, totalInputTokens: 999, totalOutputTokens: 999 },
          } as MessageMetadata,
        },
      ];

      setupQueryChainMock(mockMessages);

      const result = await service.findByMonth();

      expect(result[0]).toMatchObject({
        spend: 0.05,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalTokens: 150,
      });
    });

    it('should handle messages with missing metadata fields', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          userId,
          role: 'assistant',
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          createdAt: new Date(),
          metadata: {} as MessageMetadata,
        },
      ];

      setupQueryChainMock(mockMessages);

      const result = await service.findByMonth();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        spend: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        tps: 0,
        ttft: 0,
      });
    });

    it('should return empty array when no messages found', async () => {
      setupQueryChainMock([]);

      const result = await service.findByMonth();

      expect(result).toHaveLength(0);
    });

    it('forwards agentId to findByDateRange', async () => {
      const spy = vi.spyOn(service, 'findByDateRange').mockResolvedValue([]);

      await service.findByMonth('2024-01', 'agent-42');

      expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'agent-42');
    });

    it('should use commercial ledger cost when assistant message metadata has no cost', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          userId,
          role: 'assistant',
          provider: 'newapi',
          model: 'gpt-4o',
          createdAt: new Date('2024-01-15'),
          metadata: {
            totalInputTokens: 1000,
            totalOutputTokens: 500,
          } as MessageMetadata,
        },
      ];
      const mockLedgerRows = [
        {
          metadata: { chargedCredits: 120_000, usdCost: 0.12 },
          referenceId: 'msg-1',
        },
      ];
      const messagesOrderBy = vi.fn().mockResolvedValue(mockMessages);
      const messagesWhere = vi.fn().mockReturnValue({ orderBy: messagesOrderBy });
      const messagesFrom = vi.fn().mockReturnValue({ where: messagesWhere });
      const ledgerWhere = vi.fn().mockResolvedValue(mockLedgerRows);
      const ledgerFrom = vi.fn().mockReturnValue({ where: ledgerWhere });
      const generationLedgerWhere = vi.fn().mockResolvedValue([]);
      const generationLedgerFrom = vi.fn().mockReturnValue({ where: generationLedgerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: messagesFrom })
        .mockReturnValueOnce({ from: ledgerFrom })
        .mockReturnValueOnce({ from: generationLedgerFrom });

      const result = await service.findByMonth('2024-01');

      expect(result[0].spend).toBe(0.12);
    });

    it('should include billable ledger usage records', async () => {
      const messagesOrderBy = vi.fn().mockResolvedValue([]);
      const messagesWhere = vi.fn().mockReturnValue({ orderBy: messagesOrderBy });
      const messagesFrom = vi.fn().mockReturnValue({ where: messagesWhere });
      const generationLedgerRows = [
        {
          amount: -250_000,
          createdAt: new Date('2024-01-15T10:00:00Z'),
          description: 'image usage: gpt-image-2',
          id: 'ledger-image',
          metadata: {
            modelUsage: {
              totalInputTokens: 11,
              totalOutputTokens: 0,
              totalTokens: 11,
            },
            routeMetadata: {
              providerType: 'openai',
            },
          },
          referenceId: 'image-task',
          referenceType: 'image_generation',
          title: 'Image Generation',
          updatedAt: new Date('2024-01-15T10:00:00Z'),
          userId,
        },
        {
          amount: -1_000_000,
          createdAt: new Date('2024-01-16T10:00:00Z'),
          description: 'video usage: veo-3',
          id: 'ledger-video',
          metadata: {
            routeMetadata: {
              providerType: 'google',
            },
            usage: {
              completionTokens: 88,
              totalTokens: 120,
            },
          },
          referenceId: 'video-task',
          referenceType: 'video_generation',
          title: 'Video Generation',
          updatedAt: new Date('2024-01-16T10:00:00Z'),
          userId,
        },
        {
          amount: -500_000,
          createdAt: new Date('2024-01-17T10:00:00Z'),
          description: 'Docmee PPT generation',
          id: 'ledger-ppt',
          metadata: {
            upstreamTaskId: 'ppt-upstream',
          },
          referenceId: 'ppt-session',
          referenceType: 'ppt_generation',
          title: 'PPT Generation',
          updatedAt: new Date('2024-01-17T10:00:00Z'),
          userId,
        },
        {
          amount: -1,
          createdAt: new Date('2024-01-18T10:00:00Z'),
          description: 'AI Embeddings Usage',
          id: 'ledger-embedding',
          metadata: {
            model: 'text-embedding-3-small',
            provider: 'newapi',
            totalInputTokens: 12,
            totalOutputTokens: 0,
            totalTokens: 12,
          },
          referenceId: 'embeddings:1',
          referenceType: 'model_runtime_embeddings',
          title: 'AI Embeddings Usage',
          updatedAt: new Date('2024-01-18T10:00:00Z'),
          userId,
        },
        {
          amount: -10_000,
          createdAt: new Date('2024-01-19T10:00:00Z'),
          description: 'AI Structured Output Usage',
          id: 'ledger-structured',
          metadata: {
            model: 'gpt-4o-mini',
            provider: 'newapi',
            totalInputTokens: 20,
            totalOutputTokens: 10,
            totalTokens: 30,
          },
          referenceId: 'generate_object:1',
          referenceType: 'model_runtime_generate_object',
          title: 'AI Structured Output Usage',
          updatedAt: new Date('2024-01-19T10:00:00Z'),
          userId,
        },
      ];
      const generationLedgerWhere = vi.fn().mockResolvedValue(generationLedgerRows);
      const generationLedgerFrom = vi.fn().mockReturnValue({ where: generationLedgerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: messagesFrom })
        .mockReturnValueOnce({ from: generationLedgerFrom });

      const result = await service.findByMonth('2024-01');

      expect(result.map((record) => record.type)).toEqual([
        'structured_output',
        'embedding',
        'ppt',
        'video',
        'image',
      ]);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ledger-image',
            model: 'gpt-image-2',
            provider: 'openai',
            spend: 0.25,
            totalInputTokens: 11,
            totalOutputTokens: 0,
            totalTokens: 11,
            type: 'image',
          }),
          expect.objectContaining({
            id: 'ledger-video',
            model: 'veo-3',
            provider: 'google',
            spend: 1,
            totalInputTokens: 32,
            totalOutputTokens: 88,
            totalTokens: 120,
            type: 'video',
          }),
          expect.objectContaining({
            id: 'ledger-ppt',
            model: 'ppt',
            provider: 'docmee',
            spend: 0.5,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalTokens: 0,
            type: 'ppt',
          }),
          expect.objectContaining({
            id: 'ledger-embedding',
            model: 'text-embedding-3-small',
            provider: 'newapi',
            spend: 0.000_001,
            totalInputTokens: 12,
            totalOutputTokens: 0,
            totalTokens: 12,
            type: 'embedding',
          }),
          expect.objectContaining({
            id: 'ledger-structured',
            model: 'gpt-4o-mini',
            provider: 'newapi',
            spend: 0.01,
            totalInputTokens: 20,
            totalOutputTokens: 10,
            totalTokens: 30,
            type: 'structured_output',
          }),
        ]),
      );
    });
  });

  describe('findAndGroupByDay', () => {
    it('should group usage records by day for current month', async () => {
      const date1 = dayjs().startOf('month').toDate();
      const date2 = dayjs().startOf('month').add(1, 'day').toDate();

      const mockMessages = [
        {
          id: 'msg-1',
          userId,
          role: 'assistant',
          provider: 'openai',
          model: 'gpt-4',
          createdAt: date1,
          metadata: {
            cost: 0.05,
            totalInputTokens: 100,
            totalOutputTokens: 50,
          } as MessageMetadata,
        },
        {
          id: 'msg-2',
          userId,
          role: 'assistant',
          provider: 'openai',
          model: 'gpt-4',
          createdAt: date1,
          metadata: {
            cost: 0.03,
            totalInputTokens: 60,
            totalOutputTokens: 30,
          } as MessageMetadata,
        },
        {
          id: 'msg-3',
          userId,
          role: 'assistant',
          provider: 'anthropic',
          model: 'claude-3',
          createdAt: date2,
          metadata: {
            cost: 0.02,
            totalInputTokens: 40,
            totalOutputTokens: 20,
          } as MessageMetadata,
        },
      ];

      setupQueryChainMock(mockMessages);

      const result = await service.findAndGroupByDay();

      expect(result.length).toBeGreaterThan(0);

      // Check that days with records have correct aggregations
      const dayWithRecords = result.find((log) => log.totalRequests > 0);
      if (dayWithRecords) {
        expect(dayWithRecords.totalSpend).toBeGreaterThan(0);
        expect(dayWithRecords.totalTokens).toBeGreaterThan(0);
        expect(dayWithRecords.records.length).toBeGreaterThan(0);
      }
    });

    it('should pad missing days with zero values', async () => {
      const firstDay = dayjs().startOf('month');

      const mockMessages = [
        {
          id: 'msg-1',
          userId,
          role: 'assistant',
          provider: 'openai',
          model: 'gpt-4',
          createdAt: firstDay.toDate(),
          metadata: {
            cost: 0.05,
            totalInputTokens: 100,
            totalOutputTokens: 50,
          } as MessageMetadata,
        },
      ];

      setupQueryChainMock(mockMessages);

      const result = await service.findAndGroupByDay();

      // Should have entries for every day in the month
      const daysInMonth = dayjs().endOf('month').date();
      expect(result.length).toBeGreaterThanOrEqual(daysInMonth - 1);

      // Check that padded days have zero values
      const paddedDay = result.find((log) => log.totalRequests === 0);
      if (paddedDay) {
        expect(paddedDay.totalSpend).toBe(0);
        expect(paddedDay.totalTokens).toBe(0);
        expect(paddedDay.records).toHaveLength(0);
      }
    });

    it('should calculate correct totals for days with multiple records', async () => {
      const testDate = dayjs().startOf('month').toDate();

      const mockMessages = [
        {
          id: 'msg-1',
          userId,
          role: 'assistant',
          provider: 'openai',
          model: 'gpt-4',
          createdAt: testDate,
          metadata: {
            cost: 0.05,
            totalInputTokens: 100,
            totalOutputTokens: 50,
          } as MessageMetadata,
        },
        {
          id: 'msg-2',
          userId,
          role: 'assistant',
          provider: 'openai',
          model: 'gpt-4',
          createdAt: testDate,
          metadata: {
            cost: 0.03,
            totalInputTokens: 60,
            totalOutputTokens: 30,
          } as MessageMetadata,
        },
      ];

      setupQueryChainMock(mockMessages);

      const result = await service.findAndGroupByDay();

      const dayLog = result.find((log) => log.totalRequests === 2);

      if (dayLog) {
        expect(dayLog.totalSpend).toBe(0.08);
        expect(dayLog.totalTokens).toBe(240); // (100+50) + (60+30)
        expect(dayLog.totalRequests).toBe(2);
        expect(dayLog.records).toHaveLength(2);
      }
    });

    it('should handle specific month parameter', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          userId,
          role: 'assistant',
          provider: 'openai',
          model: 'gpt-4',
          createdAt: new Date('2024-01-15'),
          metadata: {
            cost: 0.05,
            totalInputTokens: 100,
            totalOutputTokens: 50,
          } as MessageMetadata,
        },
      ];

      setupQueryChainMock(mockMessages);

      const result = await service.findAndGroupByDay('2024-01');

      expect(result.length).toBeGreaterThan(0);
      // All days should be from January 2024
      result.forEach((log) => {
        expect(log.day).toMatch(/^2024-01/);
      });
    });

    it('forwards agentId to findByDateRange', async () => {
      const spy = vi.spyOn(service, 'findByDateRange').mockResolvedValue([]);

      await service.findAndGroupByDay('2024-01', 'agent-99');

      expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'agent-99');
    });

    it('should include generation ledger usage in daily totals', async () => {
      const messagesOrderBy = vi.fn().mockResolvedValue([]);
      const messagesWhere = vi.fn().mockReturnValue({ orderBy: messagesOrderBy });
      const messagesFrom = vi.fn().mockReturnValue({ where: messagesWhere });
      const generationLedgerRows = [
        {
          amount: -250_000,
          createdAt: new Date('2024-01-15T10:00:00Z'),
          description: 'image usage: gpt-image-2',
          id: 'ledger-image',
          metadata: {
            modelUsage: {
              totalInputTokens: 11,
              totalOutputTokens: 0,
              totalTokens: 11,
            },
          },
          referenceId: 'image-task',
          referenceType: 'image_generation',
          title: 'Image Generation',
          updatedAt: new Date('2024-01-15T10:00:00Z'),
          userId,
        },
      ];
      const generationLedgerWhere = vi.fn().mockResolvedValue(generationLedgerRows);
      const generationLedgerFrom = vi.fn().mockReturnValue({ where: generationLedgerWhere });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: messagesFrom })
        .mockReturnValueOnce({ from: generationLedgerFrom });

      const result = await service.findAndGroupByDay('2024-01');
      const dayLog = result.find((log) => log.day === '2024-01-15');

      expect(dayLog).toMatchObject({
        totalRequests: 1,
        totalSpend: 0.25,
        totalTokens: 11,
      });
      expect(dayLog?.records[0]).toMatchObject({
        id: 'ledger-image',
        type: 'image',
      });
    });
  });

  describe('getAgentUsageStats', () => {
    it('aggregates token, cost, bucket, and model stats for one agent', async () => {
      const rows = [
        {
          createdAt: new Date('2024-01-01T10:00:00Z'),
          id: 'msg-1',
          metadata: {},
          model: 'unknown-model',
          provider: 'custom',
          usage: {
            cost: 0.3,
            inputCachedTokens: 40,
            inputCacheMissTokens: 60,
            totalInputTokens: 100,
            totalOutputTokens: 50,
            totalTokens: 150,
          },
        },
        {
          createdAt: new Date('2024-01-02T10:00:00Z'),
          id: 'msg-2',
          metadata: {},
          model: 'unknown-model',
          provider: 'custom',
          usage: {
            cost: 0.2,
            totalInputTokens: 20,
            totalOutputTokens: 30,
            totalTokens: 50,
          },
        },
      ];
      const orderBy = vi.fn().mockResolvedValue(rows);
      const where = vi.fn().mockReturnValue({ orderBy });
      const from = vi.fn().mockReturnValue({ where });
      mockDb.select = vi.fn().mockReturnValue({ from });

      const result = await service.getAgentUsageStats('agent-1', '2024-01-01', '2024-01-02');

      expect(result.summary).toMatchObject({
        cacheReadTokens: 40,
        inputTokens: 120,
        outputTokens: 80,
        totalCost: 0.5,
        totalRequests: 2,
        totalTokens: 200,
      });
      expect(result.summary.cacheHitRate).toBeCloseTo(40 / 120, 6);
      expect(result.buckets).toHaveLength(2);
      expect(result.buckets.map((bucket) => bucket.totalCost)).toEqual([0.3, 0.2]);
      expect(result.byModel).toEqual([
        expect.objectContaining({
          cost: 0.5,
          id: 'custom/unknown-model',
          requests: 2,
          totalTokens: 200,
        }),
      ]);
    });

    it('uses server model pricing when agent message usage has no stored cost', async () => {
      const pricing: Pricing = {
        currency: 'USD',
        units: [
          { name: 'textInput', rate: 2, strategy: 'fixed', unit: 'millionTokens' },
          { name: 'textOutput', rate: 4, strategy: 'fixed', unit: 'millionTokens' },
        ],
      };
      getServerModelPricingMock.mockResolvedValue(pricing);
      const rows = [
        {
          createdAt: new Date('2024-01-01T10:00:00Z'),
          id: 'msg-priced',
          metadata: {},
          model: 'custom-profitable-model',
          provider: 'custom-provider',
          usage: {
            totalInputTokens: 1_000_000,
            totalOutputTokens: 500_000,
            totalTokens: 1_500_000,
          },
        },
      ];
      setupQueryChainMock(rows);

      const result = await service.getAgentUsageStats('agent-1', '2024-01-01', '2024-01-01');

      expect(getServerModelPricingMock).toHaveBeenCalledWith(
        expect.objectContaining({
          db: mockDb,
          model: 'custom-profitable-model',
          provider: 'custom-provider',
          userId,
        }),
      );
      expect(result.summary.totalCost).toBe(4);
      expect(result.byModel[0]).toMatchObject({
        cost: 4,
        id: 'custom-provider/custom-profitable-model',
      });
    });

    it('uses commercial assistant-message ledger cost when usage has no cost', async () => {
      const rows = [
        {
          createdAt: new Date('2024-01-01T10:00:00Z'),
          id: 'msg-ledger',
          metadata: { totalInputTokens: 10, totalOutputTokens: 5 } as MessageMetadata,
          model: 'unknown-model',
          provider: 'custom',
          usage: undefined,
        },
      ];
      const ledgerRows = [
        {
          amount: -420_000,
          metadata: { usdCost: 0.42 },
          referenceId: 'msg-ledger',
        },
      ];
      const messagesOrderBy = vi.fn().mockResolvedValue(rows);
      const messagesWhere = vi.fn().mockReturnValue({ orderBy: messagesOrderBy });
      const messagesFrom = vi.fn().mockReturnValue({ where: messagesWhere });
      const ledgerWhere = vi.fn().mockResolvedValue(ledgerRows);
      const ledgerFrom = vi.fn().mockReturnValue({ where: ledgerWhere });
      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: messagesFrom })
        .mockReturnValueOnce({ from: ledgerFrom });

      const result = await service.getAgentUsageStats('agent-1', '2024-01-01', '2024-01-01');

      expect(result.summary.totalCost).toBe(0.42);
      expect(result.byModel[0]).toMatchObject({
        cost: 0.42,
        id: 'custom/unknown-model',
        requests: 1,
      });
    });
  });
});
