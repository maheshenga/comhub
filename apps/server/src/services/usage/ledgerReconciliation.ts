import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';
import { and, eq, inArray } from 'drizzle-orm';

import { creditLedgerEntries } from '@/database/schemas';
import { type LobeChatDatabase } from '@/database/type';
import { genRangeWhere, genWhere } from '@/database/utils/genWhere';
import { type UsageRecordItem } from '@/types/usage/usageRecord';

/**
 * ComHub usage ledger reconciliation.
 *
 * Upstream's UsageRecordService only knows chat messages. ComHub bills
 * non-chat generation (image/video/PPT/embedding/structured-output) through
 * credit_ledger_entries, so the usage service merges both sources. This
 * module owns the ledger half: the billable reference types, the ledger
 * query, and ledger-row → UsageRecordItem mapping. The upstream service
 * (apps/server/src/services/usage/index.ts) delegates here.
 *
 * Invariants:
 * - Chat records that already carry message usage cost are never
 *   double-counted; the ledger is only the fallback/supplement.
 * - New billable non-chat reference types must be added to
 *   BILLABLE_LEDGER_REFERENCE_TYPES (not inferred from assistant messages).
 */

export const BILLABLE_LEDGER_REFERENCE_TYPES = [
  'image_generation',
  'model_runtime_embeddings',
  'model_runtime_generate_object',
  'ppt_generation',
  'video_generation',
] as const;

export type BillableLedgerReferenceType = (typeof BILLABLE_LEDGER_REFERENCE_TYPES)[number];

export type BillableLedgerUsageType = 'embedding' | 'image' | 'ppt' | 'structured_output' | 'video';

type UnknownRecord = Record<string, unknown>;

export interface LedgerUsageTotals {
  credits: number;
  spend: number;
}

/** Per-assistant-message ledger consumption keyed by message id. */
export const findAssistantMessageLedgerUsage = async (
  db: LobeChatDatabase,
  userId: string,
  messageIds: string[],
): Promise<Map<string, LedgerUsageTotals>> => {
  if (messageIds.length === 0) return new Map();

  const ledgerRows = await db
    .select({
      amount: creditLedgerEntries.amount,
      metadata: creditLedgerEntries.metadata,
      referenceId: creditLedgerEntries.referenceId,
    })
    .from(creditLedgerEntries)
    .where(
      and(
        eq(creditLedgerEntries.userId, userId),
        eq(creditLedgerEntries.type, 'consume'),
        eq(creditLedgerEntries.referenceType, 'assistant_message'),
        inArray(creditLedgerEntries.referenceId, messageIds),
      ),
    );

  const ledgerUsageMap = new Map<string, LedgerUsageTotals>();
  for (const row of ledgerRows) {
    if (!row.referenceId) continue;

    const metadata = row.metadata ?? {};
    const credits = Math.abs(Number(row.amount) || 0);
    const usdCost = Number(metadata.usdCost);
    const fallbackCost = credits / CREDITS_PER_DOLLAR;
    const spend = Number.isFinite(usdCost) && usdCost > 0 ? usdCost : fallbackCost;
    const current = ledgerUsageMap.get(row.referenceId) ?? { credits: 0, spend: 0 };

    if (credits > 0 || spend > 0) {
      ledgerUsageMap.set(row.referenceId, {
        credits: current.credits + credits,
        spend: current.spend + spend,
      });
    }
  }

  return ledgerUsageMap;
};

/** Non-chat billable ledger rows in the range, mapped to usage records. */
export const findBillableLedgerUsage = async (
  db: LobeChatDatabase,
  userId: string,
  startAt: string,
  endAt: string,
): Promise<UsageRecordItem[]> => {
  const ledgerRows = await db
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
        eq(creditLedgerEntries.userId, userId),
        eq(creditLedgerEntries.type, 'consume'),
        inArray(creditLedgerEntries.referenceType, [...BILLABLE_LEDGER_REFERENCE_TYPES]),
        genRangeWhere([startAt, endAt], creditLedgerEntries.createdAt, (date) => date.toDate()),
      ]),
    );

  return ledgerRows.map((row) =>
    mapBillableLedgerUsage({
      ...row,
      referenceType: row.referenceType as BillableLedgerReferenceType,
    }),
  );
};

const mapBillableLedgerUsage = (row: {
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
  const type = resolveBillableLedgerUsageType(row.referenceType);
  const tokenUsage = resolveGenerationTokenUsage(type, metadata);

  return {
    createdAt: row.createdAt,
    credits: Math.abs(Number(row.amount) || 0),
    id: row.id || row.referenceId || `${row.referenceType}-${row.createdAt.getTime()}`,
    metadata: row.metadata as UsageRecordItem['metadata'],
    model: resolveGenerationModel(type, metadata, row.description, row.title),
    provider: resolveGenerationProvider(type, metadata),
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

const resolveBillableLedgerUsageType = (
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

const resolveGenerationProvider = (
  type: BillableLedgerUsageType,
  metadata: UnknownRecord,
): string => {
  if (type === 'ppt') return 'docmee';

  const routeMetadata = asRecord(metadata.routeMetadata);

  return (
    firstString(metadata, ['provider', 'providerId']) ??
    firstString(routeMetadata, ['providerType', 'instanceName', 'instanceId']) ??
    'generation'
  );
};

const resolveGenerationModel = (
  type: BillableLedgerUsageType,
  metadata: UnknownRecord,
  description: string | null,
  title: string | null,
): string => {
  if (type === 'ppt') return 'ppt';

  return (
    firstString(metadata, ['model', 'modelId']) ??
    parseModelFromDescription(description) ??
    title ??
    type
  );
};

const resolveGenerationTokenUsage = (
  type: BillableLedgerUsageType,
  metadata: UnknownRecord,
): Pick<UsageRecordItem, 'totalInputTokens' | 'totalOutputTokens' | 'totalTokens'> => {
  if (type === 'ppt') {
    return { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0 };
  }

  const usage = asRecord(metadata.modelUsage) ?? asRecord(metadata.usage) ?? metadata;
  const totalOutputTokens =
    firstNumber(usage, ['totalOutputTokens', 'outputTokens', 'completionTokens']) ?? 0;
  const explicitInputTokens =
    firstNumber(usage, ['totalInputTokens', 'inputTokens', 'promptTokens']) ?? undefined;
  const explicitTotalTokens = firstNumber(usage, ['totalTokens']) ?? undefined;
  const totalInputTokens =
    explicitInputTokens ??
    (explicitTotalTokens === undefined ? 0 : Math.max(explicitTotalTokens - totalOutputTokens, 0));
  const totalTokens = explicitTotalTokens ?? totalInputTokens + totalOutputTokens;

  return { totalInputTokens, totalOutputTokens, totalTokens };
};

const parseModelFromDescription = (description: string | null) => {
  if (!description) return;

  const marker = 'usage:';
  const markerIndex = description.toLowerCase().lastIndexOf(marker);

  if (markerIndex < 0) return;

  return description.slice(markerIndex + marker.length).trim() || undefined;
};

const asRecord = (value: unknown): UnknownRecord | undefined => {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : undefined;
};

const firstNumber = (record: UnknownRecord | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = record?.[key];
    const numberValue = Number(value);

    if (Number.isFinite(numberValue)) return numberValue;
  }
};

const firstString = (record: UnknownRecord | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === 'string' && value.trim()) return value;
  }
};
