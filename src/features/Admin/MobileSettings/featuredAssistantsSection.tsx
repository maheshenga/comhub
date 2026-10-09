import { Button, Flexbox } from '@lobehub/ui';
import { Input } from 'antd';

import type { MobileFeaturedAssistantV1 } from '@/const/mobileConfig';

import {
  LabeledField,
  OrderButtons,
  RemoveButton,
  SelectField,
  SelectorAlert,
} from '../MobileSettingsControls';
import {
  type ModelOption,
  moveOrderedItem,
  removeOrderedItem,
  type SelectOption,
  type SelectorStatus,
  sortByOrder,
} from '../mobileSettingsHelpers';
import { mobileSettingsStyles as styles } from './styles';
import type { MobileSettingsSectionProps } from './types';

export interface FeaturedAssistantsSectionProps extends MobileSettingsSectionProps {
  assistantOptions: SelectOption[];
  assistantStatus: SelectorStatus;
  modelOptions: ModelOption[];
  modelStatus: SelectorStatus;
  onLoadAssistants: () => void;
  onLoadModels: () => void;
  onRetryAssistants: () => void;
  onRetryModels: () => void;
  selectedAssistantId: string;
  selectedModelValue: string;
  setSelectedAssistantId: (value: string) => void;
  setSelectedModelValue: (value: string) => void;
}

const patchAssistants = (
  formValues: MobileSettingsSectionProps['formValues'],
  assistants: MobileFeaturedAssistantV1[],
) => ({
  ...formValues,
  discover: { ...formValues.discover, assistants },
});

/** 精选助手条目行（M5 拆页：从 DesignAssistantsSections 抽出）。 */
const AssistantEntry = ({
  assistant,
  formValues,
  index,
  total,
  tr,
  updateForm,
}: {
  assistant: MobileFeaturedAssistantV1;
  formValues: MobileSettingsSectionProps['formValues'];
  index: number;
  total: number;
  tr: any;
  updateForm: (values: any) => void;
}) => {
  const titleKey = ['admin.mobile.assistantTitle', 'Assistant {{id}} title', { id: assistant.assistantId }] as const;
  const descriptionKey = [
    'admin.mobile.assistantDescription',
    'Assistant {{id}} description',
    { id: assistant.assistantId },
  ] as const;
  const modelLabelKey = [
    'admin.mobile.assistantModelLabel',
    'Assistant {{id}} model label',
    { id: assistant.assistantId },
  ] as const;
  const targetKey = ['admin.mobile.target.assistant', 'assistant {{id}}', { id: assistant.assistantId }] as const;

  return (
    <div className={styles.orderedEntry}>
      <div className={styles.grid}>
        <LabeledField label={tr(...titleKey)}>
          <Input
            value={assistant.titleOverride ?? ''}
            aria-label={tr(...titleKey)}
            onChange={(event) =>
              updateForm(
                patchAssistants(
                  formValues,
                  formValues.discover.assistants.map((item) =>
                    item.assistantId === assistant.assistantId
                      ? { ...item, titleOverride: event.target.value || undefined }
                      : item,
                  ),
                ),
              )
            }
          />
        </LabeledField>
        <LabeledField label={tr(...descriptionKey)}>
          <Input
            value={assistant.descriptionOverride ?? ''}
            aria-label={tr(...descriptionKey)}
            onChange={(event) =>
              updateForm(
                patchAssistants(
                  formValues,
                  formValues.discover.assistants.map((item) =>
                    item.assistantId === assistant.assistantId
                      ? { ...item, descriptionOverride: event.target.value || undefined }
                      : item,
                  ),
                ),
              )
            }
          />
        </LabeledField>
        <LabeledField label={tr(...modelLabelKey)}>
          <Input
            placeholder="推荐"
            value={assistant.modelLabelOverride ?? ''}
            aria-label={tr(...modelLabelKey)}
            onChange={(event) =>
              updateForm(
                patchAssistants(
                  formValues,
                  formValues.discover.assistants.map((item) =>
                    item.assistantId === assistant.assistantId
                      ? { ...item, modelLabelOverride: event.target.value || undefined }
                      : item,
                  ),
                ),
              )
            }
          />
        </LabeledField>
      </div>
      <Flexbox horizontal gap={4}>
        <OrderButtons
          position={index}
          total={total}
          label={tr(...targetKey)}
          onMove={(direction) =>
            updateForm(
              patchAssistants(
                formValues,
                moveOrderedItem(
                  formValues.discover.assistants,
                  (item) => item.assistantId === assistant.assistantId,
                  direction,
                ),
              ),
            )
          }
        />
        <RemoveButton
          label={tr(...targetKey)}
          onClick={() =>
            updateForm(
              patchAssistants(
                formValues,
                removeOrderedItem(
                  formValues.discover.assistants,
                  (item) => item.assistantId === assistant.assistantId,
                ),
              ),
            )
          }
        />
      </Flexbox>
    </div>
  );
};

export const FeaturedAssistantsSection = ({
  assistantOptions,
  assistantStatus,
  formValues,
  modelOptions,
  modelStatus,
  onLoadAssistants,
  onLoadModels,
  onRetryAssistants,
  onRetryModels,
  selectedAssistantId,
  selectedModelValue,
  setSelectedAssistantId,
  setSelectedModelValue,
  tr,
  updateForm,
}: FeaturedAssistantsSectionProps) => {
  const selectorUnavailable = Boolean(assistantStatus.error || modelStatus.error);
  const canAdd =
    !selectorUnavailable &&
    formValues.discover.assistants.length < 4 &&
    Boolean(selectedAssistantId && selectedModelValue);

  const addAssistant = () => {
    if (!canAdd) return;
    const assistant = assistantOptions.find((option) => option.value === selectedAssistantId);
    const model = modelOptions.find((option) => option.value === selectedModelValue);
    if (!assistant || !model) return;
    if (formValues.discover.assistants.some((item) => item.assistantId === assistant.value)) return;

    const nextAssistant: MobileFeaturedAssistantV1 = {
      assistantId: assistant.value,
      model: model.model,
      modelLabelOverride: '推荐',
      order: formValues.discover.assistants.length + 1,
      provider: model.provider,
      titleOverride: assistant.label,
    };
    updateForm(patchAssistants(formValues, [...formValues.discover.assistants, nextAssistant]));
  };

  return (
    <section
      aria-label={tr('admin.mobile.featuredAssistants', 'Featured Assistants')}
      className={styles.section}
    >
      <h2 className={styles.sectionTitle}>
        {tr('admin.mobile.featuredAssistants', 'Featured Assistants')}
      </h2>
      <SelectorAlert
        label={tr('admin.mobile.assistantSelectorUnavailable', 'Assistant selector unavailable.')}
        retryLabel={tr('admin.mobile.retryAssistantSelector', 'Retry assistant selector')}
        status={assistantStatus}
        onRetry={onRetryAssistants}
      />
      <SelectorAlert
        label={tr('admin.mobile.modelSelectorUnavailable', 'Model selector unavailable.')}
        retryLabel={tr('admin.mobile.retryModelSelector', 'Retry model selector')}
        status={modelStatus}
        onRetry={onRetryModels}
      />
      <div className={styles.grid}>
        <Button
          disabled={assistantStatus.loading}
          loading={assistantStatus.loading}
          onClick={onLoadAssistants}
        >
          {tr('admin.mobile.loadAssistantOptions', 'Load assistant options')}
        </Button>
        <Button disabled={modelStatus.loading} loading={modelStatus.loading} onClick={onLoadModels}>
          {tr('admin.mobile.loadModelOptions', 'Load model options')}
        </Button>
        <SelectField
          label={tr('admin.mobile.featuredAssistant', 'Featured assistant')}
          options={assistantOptions}
          value={selectedAssistantId}
          disabled={
            assistantStatus.loading || Boolean(assistantStatus.error) || assistantOptions.length === 0
          }
          onChange={setSelectedAssistantId}
        />
        <SelectField
          disabled={modelStatus.loading || Boolean(modelStatus.error) || modelOptions.length === 0}
          label={tr('admin.mobile.displayModel', 'Display model')}
          options={modelOptions}
          value={selectedModelValue}
          onChange={setSelectedModelValue}
        />
        <Button disabled={!canAdd} onClick={addAssistant}>
          {tr('admin.mobile.addFeaturedAssistant', 'Add featured assistant')}
        </Button>
      </div>
      <Flexbox gap={8}>
        {sortByOrder(formValues.discover.assistants).map((assistant, index, assistants) => (
          <AssistantEntry
            assistant={assistant}
            formValues={formValues}
            index={index}
            key={assistant.assistantId}
            total={assistants.length}
            tr={tr}
            updateForm={updateForm}
          />
        ))}
      </Flexbox>
    </section>
  );
};
