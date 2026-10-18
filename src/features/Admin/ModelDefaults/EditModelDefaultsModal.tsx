'use client';

import { Flexbox } from '@lobehub/ui';
import { Modal, Select, Switch, Text, toast } from '@lobehub/ui/base-ui';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import MaxTokenSlider from '@/components/MaxTokenSlider';
import { AdminSettingsRevisionConflictError } from '@/services/adminCommercial';

import AdminSettingsConflictAlert from '../shared/AdminSettingsConflictAlert';
import {
  fromReasoningDraft,
  getModelReasoningParams,
  getReasoningLevelOptions,
  type ReasoningParamKey,
  toReasoningDraft,
  UNSET_REASONING_LEVEL,
} from './reasoningOptions';
import { type ModelDefaultsConfig, type ModelDefaultsRow } from './shared';
import { setContextWindowDefault, setReasoningDefaults } from './updates';

interface EditModelDefaultsModalProps {
  config: ModelDefaultsConfig;
  model: ModelDefaultsRow | null;
  onClose: () => void;
  onReload: () => Promise<unknown> | unknown;
  onSave: (config: ModelDefaultsConfig) => Promise<unknown>;
  open: boolean;
}

export const EditModelDefaultsModal = memo<EditModelDefaultsModalProps>(
  ({ config, model, onClose, onReload, onSave, open }) => {
    const { t } = useTranslation('subscription');
    const [contextEnabled, setContextEnabled] = useState(false);
    const [tokens, setTokens] = useState(0);
    const [reasoning, setReasoning] = useState<Record<string, string>>({});
    const [saveError, setSaveError] = useState<unknown>();
    const [submitting, setSubmitting] = useState(false);
    const reasoningKeys = useMemo(() => getModelReasoningParams(model?.extendParams), [model]);

    useEffect(() => {
      if (!open || !model) return;

      const context = config.contextWindow.find(
        (entry) => entry.providerId === model.providerId && entry.modelId === model.modelId,
      );
      const reasoningConfig = config.reasoning.find(
        (entry) => entry.providerId === model.providerId && entry.modelId === model.modelId,
      )?.config;

      setContextEnabled(Boolean(context));
      setTokens(context?.tokens ?? 0);
      setReasoning(toReasoningDraft(reasoningConfig, reasoningKeys));
      setSaveError(undefined);
    }, [config, model, open, reasoningKeys]);

    if (!model) return null;

    const updateReasoning = (key: ReasoningParamKey, value: string) => {
      setReasoning((current) => {
        const next = { ...current };
        if (!value || value === UNSET_REASONING_LEVEL) {
          delete next[key];
        } else {
          next[key] = value;
        }

        return next;
      });
    };

    const handleOk = async () => {
      const identity = { modelId: model.modelId, providerId: model.providerId };
      let next = setContextWindowDefault(config, identity, contextEnabled ? tokens : null);
      // Only write reasoning when the editor rendered reasoning keys: with no
      // keys the draft is always empty, and setReasoningDefaults would delete
      // a stored default (including keys the card does not declare) even
      // though the admin only changed the context window.
      if (reasoningKeys.length > 0) {
        next = setReasoningDefaults(next, identity, fromReasoningDraft(reasoning, reasoningKeys));
      }

      setSubmitting(true);
      setSaveError(undefined);

      try {
        await onSave(next);
        toast.success(t('admin.modelDefaults.saveSuccess', '模型默认参数已保存'));
        onClose();
      } catch (error) {
        if (error instanceof AdminSettingsRevisionConflictError) {
          setSaveError(error);
        } else {
          toast.error(t('admin.modelDefaults.saveFailed', '保存失败'));
        }
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <Modal
        destroyOnHidden
        aria-label={t('admin.modelDefaults.editTitle', '编辑模型默认参数')}
        confirmLoading={submitting}
        okText={t('admin.modelDefaults.save', '保存')}
        open={open}
        title={`${t('admin.modelDefaults.editTitle', '编辑模型默认参数')}：${model.displayName}`}
        onCancel={submitting ? undefined : onClose}
        onOk={() => void handleOk()}
      >
        <Flexbox gap={20}>
          <AdminSettingsConflictAlert
            error={saveError}
            onReload={async () => {
              await onReload();
              setSaveError(undefined);
            }}
          />

          <Flexbox gap={8}>
            <Flexbox horizontal align="center" justify="space-between">
              <Text strong>{t('admin.modelDefaults.context.title', '上下文窗口默认')}</Text>
              <Switch
                aria-label={t('admin.modelDefaults.context.toggle', '设置平台默认')}
                checked={contextEnabled}
                onChange={setContextEnabled}
              />
            </Flexbox>
            {contextEnabled ? (
              <MaxTokenSlider value={tokens} onChange={setTokens} />
            ) : (
              <Text type="secondary">
                {t(
                  'admin.modelDefaults.context.disabledHint',
                  '未设置平台默认，用户与模型卡自带值保持不变。',
                )}
              </Text>
            )}
          </Flexbox>

          <Flexbox gap={8}>
            <Text strong>{t('admin.modelDefaults.reasoning.title', '思考强度默认')}</Text>
            {reasoningKeys.length === 0 ? (
              <Text type="secondary">
                {t(
                  'admin.modelDefaults.reasoning.unsupported',
                  '当前模型未声明思考强度参数，无需设置。',
                )}
              </Text>
            ) : (
              reasoningKeys.map((key) => (
                <Flexbox gap={4} key={key}>
                  <Text type="secondary">{key}</Text>
                  <Select
                    aria-label={`${t('admin.modelDefaults.reasoning.title', '思考强度默认')} ${key}`}
                    options={getReasoningLevelOptions(key)}
                    style={{ width: '100%' }}
                    value={reasoning[key] ?? UNSET_REASONING_LEVEL}
                    onChange={(value) => updateReasoning(key, value as string)}
                  />
                </Flexbox>
              ))
            )}
          </Flexbox>
        </Flexbox>
      </Modal>
    );
  },
);

EditModelDefaultsModal.displayName = 'EditModelDefaultsModal';

export default EditModelDefaultsModal;
