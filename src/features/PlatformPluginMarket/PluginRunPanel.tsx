'use client';

import type { PlatformPluginActionConfig, PlatformPluginRunResult } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, Form, Input, InputNumber, message, Switch, Typography } from 'antd';
import { memo, useMemo, useState } from 'react';

import { platformPluginService } from '@/services/platformPlugin';

import { formatPlatformPluginCredits } from './helpers';

const { Paragraph, Text } = Typography;

type PluginRunPanelProps = {
  action?: PlatformPluginActionConfig;
  agentId: string;
  disabled?: boolean;
  pluginId: string;
};

const PluginRunPanel = memo<PluginRunPanelProps>(({ action, agentId, disabled, pluginId }) => {
  const [form] = Form.useForm();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlatformPluginRunResult | null>(null);

  const fields = useMemo(() => action?.inputSchema?.fields ?? [], [action]);

  const handleRun = async () => {
    if (!action) return;
    if (!agentId.trim()) {
      message.warning('请先填写 Agent ID');
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
      message.success('插件运行完成');
    } catch (error) {
      const reason =
        error instanceof Error && error.message ? error.message : 'platform_plugin_runtime_not_ready';
      message.warning(reason);
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  if (!action) {
    return <Text type="secondary">暂无可运行动作</Text>;
  }

  return (
    <Flexbox gap={12}>
      <Form form={form} layout="vertical">
        {fields.length === 0 ? <Text type="secondary">该插件无需额外输入。</Text> : null}
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
          运行插件
        </Button>
      </Form>

      {result ? (
        <Flexbox gap={8}>
          <Text strong>运行结果</Text>
          <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{result.preview || '-'}</Paragraph>
          <Text type="secondary">
            状态：{result.status} · 计费：
            {formatPlatformPluginCredits(result.billing?.chargedCredits)} 积分
          </Text>
          {result.artifactIds.length > 0 ? (
            <Text type="secondary">产物：{result.artifactIds.join(', ')}</Text>
          ) : null}
        </Flexbox>
      ) : null}
    </Flexbox>
  );
});

PluginRunPanel.displayName = 'PluginRunPanel';

export default PluginRunPanel;
