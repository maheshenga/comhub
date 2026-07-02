import { TooltipGroup } from '@lobehub/ui';
import { Select, type SelectProps } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { type ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { ModelItemRender, ProviderItemRender, TAG_CLASSNAME } from '@/components/ModelSelect';
import { useEnabledChatModels } from '@/hooks/useEnabledChatModels';
import { type EnabledProviderWithModels } from '@/types/aiProvider';

const prefixCls = 'ant';

const styles = createStaticStyles(({ css }) => ({
  popup: css`
    width: max(360px, var(--anchor-width));

    &.${prefixCls}-select-dropdown .${prefixCls}-select-item-option-grouped {
      padding-inline-start: 12px;
    }
  `,
  select: css`
    .${prefixCls}-select-selection-item {
      .${TAG_CLASSNAME} {
        display: none;
      }
    }
  `,
}));

interface ModelOption {
  abilities?: EnabledProviderWithModels['children'][number]['abilities'];
  id: string;
  label: ReactNode;
  provider: string;
  value: string;
}

const hasOptionValue = (options: SelectProps['options'] | undefined, value: string): boolean => {
  return Boolean(
    options?.some((option) => {
      const item = option as ModelOption & { options?: SelectProps['options'] };

      if (Array.isArray(item.options)) return hasOptionValue(item.options, value);

      return item.value === value;
    }),
  );
};

const createSelectedModelFallbackOption = (
  enabledList: EnabledProviderWithModels[],
  value: ModelSelectProps['value'],
  selectedValue: string | undefined,
): ModelOption | undefined => {
  if (!value?.provider || !value.model || !selectedValue) return;

  const provider =
    enabledList.find((item) => item.id === value.provider) ||
    enabledList.find((item) => item.children.some((model) => model.id === value.model));
  const model = provider?.children.find((item) => item.id === value.model);
  const displayModel = model || {
    abilities: {},
    displayName: value.model,
    id: value.model,
  };

  return {
    ...displayModel,
    label: (
      <ModelItemRender {...displayModel} {...displayModel.abilities} showInfoTag={false} />
    ),
    provider: value.provider,
    value: selectedValue,
  };
};

interface ModelSelectProps extends Pick<
  SelectProps,
  'disabled' | 'loading' | 'size' | 'style' | 'variant'
> {
  defaultValue?: { model: string; provider?: string };
  initialWidth?: boolean;
  onChange?: (props: { model: string; provider: string }) => void;
  popupWidth?: number;
  requiredAbilities?: (keyof EnabledProviderWithModels['children'][number]['abilities'])[];
  showAbility?: boolean;
  value?: { model: string; provider?: string };
}

const ModelSelect = memo<ModelSelectProps>(
  ({
    value,
    onChange,
    showAbility = true,
    requiredAbilities,
    loading,
    disabled,
    size,
    style,
    variant,
    initialWidth = false,
    popupWidth,
  }) => {
    const enabledList = useEnabledChatModels();
    const selectedValue =
      value?.provider && value?.model ? `${value.provider}/${value.model}` : undefined;

    const options = useMemo<SelectProps['options']>(() => {
      const getChatModels = (provider: EnabledProviderWithModels) => {
        const models =
          requiredAbilities && requiredAbilities.length > 0
            ? provider.children.filter((model) =>
                requiredAbilities.every((ability) => Boolean(model.abilities?.[ability])),
              )
            : provider.children;

        return models.map((model) => ({
          ...model,
          label: <ModelItemRender {...model} {...model.abilities} showInfoTag={false} />,
          provider: provider.id,
          value: `${provider.id}/${model.id}`,
        }));
      };

      const baseOptions = (() => {
        if (enabledList.length === 1) {
          const provider = enabledList[0];

          return getChatModels(provider);
        }

        return enabledList
          .map((provider) => {
            const opts = getChatModels(provider);
            if (opts.length === 0) return undefined;

            return {
              label: (
                <ProviderItemRender
                  logo={provider.logo}
                  name={provider.name}
                  provider={provider.id}
                  source={provider.source}
                />
              ),
              options: opts,
            };
          })
          .filter(Boolean) as SelectProps['options'];
      })();

      const fallbackOption = createSelectedModelFallbackOption(enabledList, value, selectedValue);

      if (!fallbackOption || hasOptionValue(baseOptions, fallbackOption.value)) return baseOptions;

      return [fallbackOption, ...(baseOptions || [])];
    }, [enabledList, requiredAbilities, selectedValue, showAbility, value]);

    return (
      <TooltipGroup>
        <Select
          className={styles.select}
          defaultValue={selectedValue}
          disabled={disabled}
          loading={loading}
          options={options}
          popupClassName={styles.popup}
          popupMatchSelectWidth={popupWidth === undefined ? false : popupWidth}
          size={size}
          value={selectedValue}
          variant={variant}
          optionRender={(option) => (
            <ModelItemRender
              {...(option as ModelOption)}
              {...(option as ModelOption).abilities}
              showInfoTag={false}
            />
          )}
          style={{
            minWidth: 200,
            width: initialWidth ? 'initial' : undefined,
            ...style,
          }}
          onChange={(value, option) => {
            const model = value.split('/').slice(1).join('/');
            onChange?.({ model, provider: (option as unknown as ModelOption).provider });
          }}
        />
      </TooltipGroup>
    );
  },
);

export default ModelSelect;
