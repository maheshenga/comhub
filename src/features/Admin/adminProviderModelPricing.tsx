import { DEFAULT_PRICING_CREDIT_MULTIPLIER } from '@lobechat/const/currency';
import { Flexbox } from '@lobehub/ui';
import { InputNumber } from 'antd';
import { useEffect, useState } from 'react';

export type AiProviderModelType =
  | 'chat'
  | 'embedding'
  | 'tts'
  | 'stt'
  | 'image'
  | 'video'
  | 'text2music'
  | 'realtime';

export const DEFAULT_PRICING_MARGIN_MULTIPLIER = DEFAULT_PRICING_CREDIT_MULTIPLIER;

const TOKEN_PRICING_MODEL_TYPES = new Set<AiProviderModelType>(['chat', 'embedding']);

const toOptionalPositiveNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

const getModelManualPricing = (metadata?: Record<string, unknown> | null) =>
  metadata?.manualPricing && typeof metadata.manualPricing === 'object'
    ? (metadata.manualPricing as Record<string, unknown>)
    : {};

const formatRate = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(6).replace(/\.?0+$/, '')
    : '-';

export const buildManualTokenPricingMetadata = ({
  inputCostRate,
  metadata,
  outputCostRate,
}: {
  inputCostRate?: number;
  metadata?: Record<string, unknown> | null;
  outputCostRate?: number;
}) => {
  const manualPricing: Record<string, unknown> = {
    ...getModelManualPricing(metadata),
    marginMultiplier: DEFAULT_PRICING_MARGIN_MULTIPLIER,
    source: 'admin-manual',
  };

  if (inputCostRate) {
    manualPricing.inputCostRate = inputCostRate;
    manualPricing.inputRate = inputCostRate;
  } else {
    delete manualPricing.inputCostRate;
    delete manualPricing.inputRate;
  }

  if (outputCostRate) {
    manualPricing.outputCostRate = outputCostRate;
    manualPricing.outputRate = outputCostRate;
  } else {
    delete manualPricing.outputCostRate;
    delete manualPricing.outputRate;
  }

  return {
    ...(metadata ?? {}),
    manualPricing,
  };
};

export const AiProviderModelPricingCell = ({
  metadata,
  modelType,
  onSave,
  t,
}: {
  metadata?: Record<string, unknown> | null;
  modelType: AiProviderModelType;
  onSave: (inputCostRate?: number, outputCostRate?: number) => void;
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string;
}) => {
  const manualPricing = getModelManualPricing(metadata);
  const inputCostRate =
    toOptionalPositiveNumber(manualPricing.inputCostRate) ??
    toOptionalPositiveNumber(manualPricing.inputRate);
  const outputCostRate =
    toOptionalPositiveNumber(manualPricing.outputCostRate) ??
    toOptionalPositiveNumber(manualPricing.outputRate);
  const [draftInputCostRate, setDraftInputCostRate] = useState<number | null>(
    inputCostRate ?? null,
  );
  const [draftOutputCostRate, setDraftOutputCostRate] = useState<number | null>(
    outputCostRate ?? null,
  );

  useEffect(() => {
    setDraftInputCostRate(inputCostRate ?? null);
    setDraftOutputCostRate(outputCostRate ?? null);
  }, [inputCostRate, outputCostRate]);

  if (!TOKEN_PRICING_MODEL_TYPES.has(modelType)) {
    return (
      <span style={{ fontSize: 12, opacity: 0.55 }}>
        {t('admin.providers.models.pricing.unsupported', '暂不支持此类型')}
      </span>
    );
  }

  const savePricing = (nextInput: unknown, nextOutput: unknown) => {
    const normalizedInput = toOptionalPositiveNumber(nextInput);
    const normalizedOutput = toOptionalPositiveNumber(nextOutput);
    if (normalizedInput === inputCostRate && normalizedOutput === outputCostRate) return;
    onSave(normalizedInput, normalizedOutput);
  };

  return (
    <Flexbox gap={6}>
      <Flexbox horizontal gap={6}>
        <InputNumber
          min={0}
          placeholder={t('admin.providers.models.pricing.input', '输入')}
          precision={6}
          size="small"
          style={{ width: 112 }}
          value={draftInputCostRate}
          onBlur={() => savePricing(draftInputCostRate, draftOutputCostRate)}
          onChange={setDraftInputCostRate}
          onPressEnter={() => savePricing(draftInputCostRate, draftOutputCostRate)}
        />
        <InputNumber
          min={0}
          placeholder={t('admin.providers.models.pricing.output', '输出')}
          precision={6}
          size="small"
          style={{ width: 112 }}
          value={draftOutputCostRate}
          onBlur={() => savePricing(draftInputCostRate, draftOutputCostRate)}
          onChange={setDraftOutputCostRate}
          onPressEnter={() => savePricing(draftInputCostRate, draftOutputCostRate)}
        />
      </Flexbox>
      <span style={{ fontSize: 12, opacity: 0.65 }}>
        {t('admin.providers.models.pricing.estimate', '计费价：输入 {{input}} / 输出 {{output}}', {
          input: formatRate(
            draftInputCostRate ? draftInputCostRate * DEFAULT_PRICING_MARGIN_MULTIPLIER : undefined,
          ),
          output: formatRate(
            draftOutputCostRate
              ? draftOutputCostRate * DEFAULT_PRICING_MARGIN_MULTIPLIER
              : undefined,
          ),
        })}
      </span>
    </Flexbox>
  );
};
