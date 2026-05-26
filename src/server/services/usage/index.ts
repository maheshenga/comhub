import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';
import dayjs from 'dayjs';
import debug from 'debug';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { creditLedgerEntries, messages } from '@/database/schemas';
import { type LobeChatDatabase } from '@/database/type';
import { genRangeWhere, genWhere } from '@/database/utils/genWhere';
import { type MessageMetadata } from '@/types/message';
import { type UsageLog, type UsageRecordItem } from '@/types/usage/usageRecord';
import { formatDate } from '@/utils/format';

const log = debug('lobe-usage:service');

const BILLABLE_LEDGER_REFERENCE_TYPES = [
  'image_generation',
  'model_runtime_embeddings',
  'model_runtime_generate_object',
  'ppt_generation',
  'video_generation',
] as const;

type BillableLedgerReferenceType = (typeof BILLABLE_LEDGER_REFERENCE_TYPES)[number];
type BillableLedgerUsageType = 'embedding' | 'image' | 'ppt' | 'structured_output' | 'video';
type UnknownRecord = Record<string, unknown>;

export class UsageRecordService {
  private userId: string;
  private db: LobeChatDatabase;
  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  /**
   * @description Find usage records by date range.
   */
  findByDateRange = async (startAt: string, endAt: string): Promise<UsageRecordItem[]> => {
    const spends = await this.db
      .select({
        createdAt: messages.createdAt,
        id: messages.id,
        metadata: messages.metadata,
        model: messages.model,
        provider: messages.provider,
        role: messages.role,
        updatedAt: messages.createdAt,
        userId: messages.userId,
      })
      .from(messages)
      .where(
        genWhere([
          eq(messages.userId, this.userId),
          eq(messages.role, 'assistant'),
          genRangeWhere([startAt, endAt], messages.createdAt, (date) => date.toDate()),
        ]),
      )
      .orderBy(desc(messages.createdAt));

    const messageIdsWithoutCost = spends
      .filter((spend) => {
        const metadata = spend.metadata as MessageMetadata | null;
        return typeof metadata?.cost !== 'number' || metadata.cost <= 0;
      })
      .map((spend) => spend.id);
    const ledgerSpendMap = await this.findAssistantMessageLedgerSpend(messageIdsWithoutCost);

    const chatSpends = spends.map((spend) => {
      const metadata = spend.metadata as MessageMetadata;
      const metadataCost =
        typeof metadata?.cost === 'number' && metadata.cost > 0 ? metadata.cost : undefined;
      const ledgerCost = ledgerSpendMap.get(spend.id);

      return {
        createdAt: spend.createdAt,
        id: spend.id,
        metadata: spend.metadata,
        model: spend.model,
        provider: spend.provider,
        spend: metadataCost ?? ledgerCost ?? metadata?.cost ?? 0,
        totalInputTokens: metadata?.totalInputTokens || 0,
        totalOutputTokens: metadata?.totalOutputTokens || 0,
        totalTokens: (metadata?.totalInputTokens || 0) + (metadata?.totalOutputTokens || 0),
        tps: metadata?.tps || 0,
        ttft: metadata?.ttft || 0,
        type: 'chat',
        updatedAt: spend.createdAt,
        userId: spend.userId,
      } as UsageRecordItem;
    });

    const generationSpends = await this.findBillableLedgerUsage(startAt, endAt);

    return [...chatSpends, ...generationSpends].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  };

  private findAssistantMessageLedgerSpend = async (messageIds: string[]) => {
    if (messageIds.length === 0) return new Map<string, number>();

    const ledgerRows = await this.db
      .select({
        amount: creditLedgerEntries.amount,
        metadata: creditLedgerEntries.metadata,
        referenceId: creditLedgerEntries.referenceId,
      })
      .from(creditLedgerEntries)
      .where(
        and(
          eq(creditLedgerEntries.userId, this.userId),
          eq(creditLedgerEntries.type, 'consume'),
          eq(creditLedgerEntries.referenceType, 'assistant_message'),
          inArray(creditLedgerEntries.referenceId, messageIds),
        ),
      );

    const ledgerSpendMap = new Map<string, number>();
    for (const row of ledgerRows) {
      if (!row.referenceId) continue;

      const metadata = row.metadata ?? {};
      const usdCost = Number(metadata.usdCost);
      const fallbackCost = Math.abs(Number(row.amount) || 0) / CREDITS_PER_DOLLAR;
      const spend = Number.isFinite(usdCost) && usdCost > 0 ? usdCost : fallbackCost;

      if (spend > 0) {
        ledgerSpendMap.set(row.referenceId, spend);
      }
    }

    return ledgerSpendMap;
  };

  private findBillableLedgerUsage = async (
    startAt: string,
    endAt: string,
  ): Promise<UsageRecordItem[]> => {
    const ledgerRows = await this.db
      .select({
        amount: creditLedgerEntries.amount,
        createdAt: creditLedgerEntries.createdAt,
        description: creditLedgerEntries.description,
        id: creditLedgerEntries.id,
        metadata: creditLedgerEntries.metadata,
        referenceId: creditLedgerEntries.referenceId,
        referenceType: creditLedgerEntries.referenceType,
        title: creditLedgerEntries.title,
        updatedAt: creditLedgerEntries.updatedAt,
        userId: creditLedgerEntries.userId,
      })
      .from(creditLedgerEntries)
      .where(
        genWhere([
          eq(creditLedgerEntries.userId, this.userId),
          eq(creditLedgerEntries.type, 'consume'),
          inArray(creditLedgerEntries.referenceType, [...BILLABLE_LEDGER_REFERENCE_TYPES]),
          genRangeWhere([startAt, endAt], creditLedgerEntries.createdAt, (date) => date.toDate()),
        ]),
      );

    return ledgerRows.map((row) =>
      this.mapBillableLedgerUsage({
        ...row,
        referenceType: row.referenceType as BillableLedgerReferenceType,
      }),
    );
  };

  private mapBillableLedgerUsage = (row: {
    amount: number;
    createdAt: Date;
    description: string | null;
    id: string;
    metadata: UnknownRecord | null;
    referenceId: string | null;
    referenceType: BillableLedgerReferenceType;
    title: string | null;
    updatedAt: Date;
    userId: string;
  }): UsageRecordItem => {
    const metadata = row.metadata ?? {};
    const type = this.resolveBillableLedgerUsageType(row.referenceType);
    const tokenUsage = this.resolveGenerationTokenUsage(type, metadata);

    return {
      createdAt: row.createdAt,
      id: row.id || row.referenceId || `${row.referenceType}-${row.createdAt.getTime()}`,
      metadata: row.metadata as MessageMetadata | null,
      model: this.resolveGenerationModel(type, metadata, row.description, row.title),
      provider: this.resolveGenerationProvider(type, metadata),
      spend: Math.abs(Number(row.amount) || 0) / CREDITS_PER_DOLLAR,
      totalInputTokens: tokenUsage.totalInputTokens,
      totalOutputTokens: tokenUsage.totalOutputTokens,
      totalTokens: tokenUsage.totalTokens,
      tps: 0,
      ttft: 0,
      type,
      updatedAt: row.updatedAt,
      userId: row.userId,
    };
  };

  private resolveBillableLedgerUsageType = (
    referenceType: BillableLedgerReferenceType,
  ): BillableLedgerUsageType => {
    switch (referenceType) {
      case 'image_generation': {
        return 'image';
      }
      case 'model_runtime_embeddings': {
        return 'embedding';
      }
      case 'model_runtime_generate_object': {
        return 'structured_output';
      }
      case 'video_generation': {
        return 'video';
      }
      case 'ppt_generation': {
        return 'ppt';
      }
    }
  };

  private resolveGenerationProvider = (
    type: BillableLedgerUsageType,
    metadata: UnknownRecord,
  ): string => {
    if (type === 'ppt') return 'docmee';

    const routeMetadata = this.asRecord(metadata.routeMetadata);

    return (
      this.firstString(metadata, ['provider', 'providerId']) ??
      this.firstString(routeMetadata, ['providerType', 'instanceName', 'instanceId']) ??
      'generation'
    );
  };

  private resolveGenerationModel = (
    type: BillableLedgerUsageType,
    metadata: UnknownRecord,
    description: string | null,
    title: string | null,
  ): string => {
    if (type === 'ppt') return 'ppt';

    return (
      this.firstString(metadata, ['model', 'modelId']) ??
      this.parseModelFromDescription(description) ??
      title ??
      type
    );
  };

  private resolveGenerationTokenUsage = (
    type: BillableLedgerUsageType,
    metadata: UnknownRecord,
  ): Pick<UsageRecordItem, 'totalInputTokens' | 'totalOutputTokens' | 'totalTokens'> => {
    if (type === 'ppt') {
      return { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0 };
    }

    const usage = this.asRecord(metadata.modelUsage) ?? this.asRecord(metadata.usage) ?? metadata;
    const totalOutputTokens =
      this.firstNumber(usage, ['totalOutputTokens', 'outputTokens', 'completionTokens']) ?? 0;
    const explicitInputTokens =
      this.firstNumber(usage, ['totalInputTokens', 'inputTokens', 'promptTokens']) ?? undefined;
    const explicitTotalTokens = this.firstNumber(usage, ['totalTokens']) ?? undefined;
    const totalInputTokens =
      explicitInputTokens ??
      (explicitTotalTokens === undefined
        ? 0
        : Math.max(explicitTotalTokens - totalOutputTokens, 0));
    const totalTokens = explicitTotalTokens ?? totalInputTokens + totalOutputTokens;

    return { totalInputTokens, totalOutputTokens, totalTokens };
  };

  private parseModelFromDescription = (description: string | null) => {
    if (!description) return;

    const marker = 'usage:';
    const markerIndex = description.toLowerCase().lastIndexOf(marker);

    if (markerIndex < 0) return;

    return description.slice(markerIndex + marker.length).trim() || undefined;
  };

  private asRecord = (value: unknown): UnknownRecord | undefined => {
    return typeof value === 'object' && value !== null ? (value as UnknownRecord) : undefined;
  };

  private firstNumber = (record: UnknownRecord | undefined, keys: string[]) => {
    for (const key of keys) {
      const value = record?.[key];
      const numberValue = Number(value);

      if (Number.isFinite(numberValue)) return numberValue;
    }
  };

  private firstString = (record: UnknownRecord | undefined, keys: string[]) => {
    for (const key of keys) {
      const value = record?.[key];

      if (typeof value === 'string' && value.trim()) return value;
    }
  };

  /**
   * @description Find usage records by month.
   * @param mo Month
   * @returns UsageRecordItem[]
   */
  findByMonth = async (mo?: string): Promise<UsageRecordItem[]> => {
    let startAt: string;
    let endAt: string;
    if (mo && dayjs(mo, 'YYYY-MM', true).isValid()) {
      startAt = dayjs(mo, 'YYYY-MM').startOf('month').format('YYYY-MM-DD');
      endAt = dayjs(mo, 'YYYY-MM').endOf('month').format('YYYY-MM-DD');
    } else {
      startAt = dayjs().startOf('month').format('YYYY-MM-DD');
      endAt = dayjs().endOf('month').format('YYYY-MM-DD');
    }
    return this.findByDateRange(startAt, endAt);
  };

  /**
   * @description Group usage records by day for a given date range.
   */
  private groupByDay = (
    spends: UsageRecordItem[],
    startAt: string,
    endAt: string,
    pad = true,
  ): UsageLog[] => {
    // Clustering by time
    const usages = new Map<string, { date: Date; logs: UsageRecordItem[] }>();
    spends.forEach((spend) => {
      if (!usages.has(formatDate(spend.createdAt))) {
        usages.set(formatDate(spend.createdAt), { date: spend.createdAt, logs: [spend] });
        return;
      }
      usages.get(formatDate(spend.createdAt))?.logs.push(spend);
    });
    // Calculate usage
    const usageLogs: UsageLog[] = [];
    usages.forEach((spends, date) => {
      const totalSpend = spends.logs.reduce((acc, spend) => acc + spend.spend, 0);
      const totalTokens = spends.logs.reduce((acc, spend) => (spend.totalTokens || 0) + acc, 0);
      const totalRequests = spends.logs?.length ?? 0;
      log(
        'date',
        date,
        'totalSpend',
        totalSpend,
        'totalTokens',
        totalTokens,
        'totalRequests',
        totalRequests,
      );
      usageLogs.push({
        date: spends.date.getTime(),
        day: date,
        records: spends.logs,
        totalRequests,
        totalSpend,
        totalTokens,
      });
    });

    if (!pad) return usageLogs;

    // Padding to ensure the date range is complete
    const startDate = dayjs(startAt);
    const endDate = dayjs(endAt);
    const paddedUsageLogs: UsageLog[] = [];
    log(
      'Padding usage logs from',
      startDate.format('YYYY-MM-DD'),
      'to',
      endDate.format('YYYY-MM-DD'),
    );
    for (let date = startDate; date.isBefore(endDate); date = date.add(1, 'day')) {
      const found = usageLogs.find((l) => l.day === date.format('YYYY-MM-DD'));
      if (found) {
        paddedUsageLogs.push(found);
      } else {
        paddedUsageLogs.push({
          date: date.toDate().getTime(),
          day: date.format('YYYY-MM-DD'),
          records: [],
          totalRequests: 0,
          totalSpend: 0,
          totalTokens: 0,
        });
      }
    }
    return paddedUsageLogs;
  };

  findAndGroupByDay = async (mo?: string): Promise<UsageLog[]> => {
    let startAt: string;
    let endAt: string;
    if (mo && dayjs(mo, 'YYYY-MM', true).isValid()) {
      startAt = dayjs(mo, 'YYYY-MM').startOf('month').format('YYYY-MM-DD');
      endAt = dayjs(mo, 'YYYY-MM').endOf('month').format('YYYY-MM-DD');
    } else {
      startAt = dayjs().startOf('month').format('YYYY-MM-DD');
      endAt = dayjs().endOf('month').format('YYYY-MM-DD');
    }
    const spends = await this.findByDateRange(startAt, endAt);
    return this.groupByDay(spends, startAt, endAt);
  };

  /**
   * @description Find usage grouped by day for a custom date range (e.g. past 12 months).
   * Does not pad missing days for large ranges.
   */
  findAndGroupByDateRange = async (startAt: string, endAt: string): Promise<UsageLog[]> => {
    const spends = await this.findByDateRange(startAt, endAt);
    return this.groupByDay(spends, startAt, endAt, false);
  };
}
