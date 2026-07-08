'use client';

import type { PlatformPluginActionConfig, PlatformPluginRunResult } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, Form, Input, InputNumber, message, Switch, Tag, Typography } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { platformPluginService } from '@/services/platformPlugin';

import {
  formatPlatformPluginCredits,
  getPlatformPluginRunErrorCopyKey,
  getPlatformPluginRunNoticeKey,
  getPlatformPluginRunPreviewCopyKey,
  getPlatformPluginRunStatusMeta,
} from './helpers';

const { Paragraph, Text } = Typography;

type PluginRunPanelProps = {
  action?: PlatformPluginActionConfig;
  agentId: string;
  disabled?: boolean;
  onRunComplete?: () => Promise<void> | void;
  pluginId: string;
};

const PluginRunPanel = memo<PluginRunPanelProps>(
  ({ action, agentId, disabled, onRunComplete, pluginId }) => {
    const { t } = useTranslation('subscription');
    const [form] = Form.useForm();
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<PlatformPluginRunResult | null>(null);

    const fields = useMemo(() => action?.inputSchema?.fields ?? [], [action]);
    const statusMeta = result ? getPlatformPluginRunStatusMeta(result.status) : null;
    const previewCopyKey = result ? getPlatformPluginRunPreviewCopyKey(result) : null;

    const handleRun = async () => {
      if (!action) return;
      if (!agentId.trim()) {
        message.warning(t('platformPlugins.run.agentRequired'));
        return;
      }

      const values = await form.validateFields();
      setRunning(true);
      try {
        const runResult = await platformPluginService.run({
          actionId: action.id,
          agentId: agentId.trim(),
          input: values,
          pluginId,
        });
        setResult(runResult);
        await onRunComplete?.();
        const noticeKey = getPlatformPluginRunNoticeKey(runResult.status);
        if (runResult.status === 'succeeded') {
          message.success(t(noticeKey));
        } else {
          message.warning(t(noticeKey));
        }
      } catch (error) {
        message.warning(t(getPlatformPluginRunErrorCopyKey(error)));
        setResult(null);
      } finally {
        setRunning(false);
      }
    };

    if (!action) {
      return <Text type="secondary">{t('platformPlugins.run.noAction')}</Text>;
    }

    return (
      <Flexbox gap={12}>
        <Form form={form} layout="vertical">
          {fields.length === 0 ? (
            <Text type="secondary">{t('platformPlugins.run.emptyInput')}</Text>
          ) : null}
          {fields.map((field) => (
            <Form.Item
              extra={field.helpText}
              key={field.key}
              label={field.label}
              name={field.key}
              rules={[{ required: field.required }]}
              valuePropName={field.type === 'boolean' ? 'checked' : 'value'}
            >
              {field.type === 'textarea' ? (
                <Input.TextArea autoSize={{ maxRows: 6, minRows: 3 }} />
              ) : field.type === 'number' ? (
                <InputNumber style={{ width: '100%' }} />
              ) : field.type === 'boolean' ? (
                <Switch />
              ) : (
                <Input />
              )}
            </Form.Item>
          ))}
          <Button disabled={disabled} loading={running} type="primary" onClick={handleRun}>
            {t('platformPlugins.run.action')}
          </Button>
        </Form>

        {result && statusMeta ? (
          <Flexbox gap={8}>
            <Text strong>{t('platformPlugins.run.result')}</Text>
            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {previewCopyKey ? t(previewCopyKey) : result.preview}
            </Paragraph>
            <Flexbox horizontal gap={6} wrap="wrap">
              <Tag color={statusMeta.color}>{t(statusMeta.labelKey)}</Tag>
              <Text type="secondary">
                {t('platformPlugins.run.billing', {
                  credits: formatPlatformPluginCredits(result.billing?.chargedCredits),
                })}
              </Text>
            </Flexbox>
            {result.artifactIds.length > 0 ? (
              <Text type="secondary">
                {t('platformPlugins.run.artifacts', { ids: result.artifactIds.join(', ') })}
              </Text>
            ) : null}
          </Flexbox>
        ) : null}
      </Flexbox>
    );
  },
);

PluginRunPanel.displayName = 'PluginRunPanel';

export default PluginRunPanel;
