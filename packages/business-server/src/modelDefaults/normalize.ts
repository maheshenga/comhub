import {
  type AiModelReasoningConfig,
  AiModelReasoningConfigSchema,
  MODEL_REASONING_PARAM_LEVELS,
} from 'model-bank';
import { z } from 'zod';

export type ModelContextWindowDefault = {
  modelId: string;
  providerId: string;
  /** 0 means unlimited, matching the MaxTokenSlider ∞ position. */
  tokens: number;
};

export type ModelReasoningDefault = {
  /** Only explicitly configured params; partial object. */
  config: AiModelReasoningConfig;
  modelId: string;
  providerId: string;
};

export type ModelDefaultsConfig = {
  contextWindow: ModelContextWindowDefault[];
  reasoning: ModelReasoningDefault[];
};

/**
 * Upper bound per list. Persisted values are admin-authored, but the cap keeps
 * a malformed/sycned payload from bloating every runtime read.
 */
export const MODEL_DEFAULTS_MAX_ENTRIES = 5000;

export const EMPTY_MODEL_DEFAULTS_CONFIG: ModelDefaultsConfig = {
  contextWindow: [],
  reasoning: [],
};

export const modelDefaultsConfigSchema = z.object({
  contextWindow: z.array(
    z.object({
      modelId: z.string(),
      providerId: z.string(),
      tokens: z.number().int().min(0),
    }),
  ),
  reasoning: z.array(
    z.object({
      config: AiModelReasoningConfigSchema,
      modelId: z.string(),
      providerId: z.string(),
    }),
  ),
});

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readIdentity = (value: unknown) => {
  if (!isRecord(value)) return null;

  const providerId = typeof value.providerId === 'string' ? value.providerId.trim() : '';
  const modelId = typeof value.modelId === 'string' ? value.modelId.trim() : '';

  return providerId && modelId ? { modelId, providerId } : null;
};

const readTokens = (value: unknown): null | number => {
  const tokens =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(tokens) || tokens < 0) return null;

  return Math.round(tokens);
};

const readReasoningConfig = (value: unknown): AiModelReasoningConfig | null => {
  if (!isRecord(value)) return null;

  const config: Record<string, string> = {};

  for (const [param, levels] of Object.entries(MODEL_REASONING_PARAM_LEVELS)) {
    const rawValue = value[param];

    if (typeof rawValue === 'string' && (levels as readonly string[]).includes(rawValue)) {
      config[param] = rawValue;
    }
  }

  if (Object.keys(config).length === 0) return null;

  return config as unknown as AiModelReasoningConfig;
};

const compareEntries = (
  a: Pick<ModelContextWindowDefault, 'modelId' | 'providerId'>,
  b: Pick<ModelContextWindowDefault, 'modelId' | 'providerId'>,
) => {
  if (a.providerId !== b.providerId) return a.providerId < b.providerId ? -1 : 1;
  if (a.modelId !== b.modelId) return a.modelId < b.modelId ? -1 : 1;

  return 0;
};

/**
 * Repairs any persisted/request payload into the canonical form:
 * - drops entries without a non-empty providerId/modelId pair,
 * - drops invalid/negative token values and reasoning levels,
 * - drops empty reasoning configs,
 * - last duplicate wins, then deterministic providerId/modelId sort + cap.
 */
export const normalizeModelDefaultsConfig = (value: unknown): ModelDefaultsConfig => {
  if (!isRecord(value)) return { contextWindow: [], reasoning: [] };

  const contextWindow = new Map<string, ModelContextWindowDefault>();
  const contextWindowInput = Array.isArray(value.contextWindow) ? value.contextWindow : [];

  for (const item of contextWindowInput) {
    const identity = readIdentity(item);
    if (!identity) continue;

    const tokens = readTokens((item as UnknownRecord).tokens);
    if (tokens === null) continue;

    contextWindow.set(`${identity.providerId}/${identity.modelId}`, { ...identity, tokens });
  }

  const reasoning = new Map<string, ModelReasoningDefault>();
  const reasoningInput = Array.isArray(value.reasoning) ? value.reasoning : [];

  for (const item of reasoningInput) {
    const identity = readIdentity(item);
    if (!identity) continue;

    const config = readReasoningConfig((item as UnknownRecord).config);
    if (!config) continue;

    reasoning.set(`${identity.providerId}/${identity.modelId}`, { ...identity, config });
  }

  return {
    contextWindow: Array.from(contextWindow.values())
      .sort(compareEntries)
      .slice(0, MODEL_DEFAULTS_MAX_ENTRIES),
    reasoning: Array.from(reasoning.values())
      .sort(compareEntries)
      .slice(0, MODEL_DEFAULTS_MAX_ENTRIES),
  };
};
