'use client';

import { type BinaryStatus } from '@lobechat/electron-client-ipc';
import { Button, CopyButton, Flexbox, Form, Icon, Tag, Text, toast, Tooltip } from '@lobehub/ui';
import { CheckCircle2, Download, Loader2Icon, RefreshCw, XCircle } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';
import { binaryService } from '@/services/electron/binary';

/**
 * Predefined tool configurations by category
 * This allows us to always show all tools even if not detected
 */
const TOOL_CATEGORIES = {
  'runtime-environment': {
    descKey: 'settingSystemTools.category.runtimeEnvironment.desc',
    titleKey: 'settingSystemTools.category.runtimeEnvironment',
    tools: [
      { descKey: 'settingSystemTools.tools.lobehub.desc', name: 'lobehub' },
      { descKey: 'settingSystemTools.tools.node.desc', name: 'node' },
      { descKey: 'settingSystemTools.tools.python.desc', name: 'python' },
      { descKey: 'settingSystemTools.tools.npm.desc', name: 'npm' },
      { descKey: 'settingSystemTools.tools.bun.desc', name: 'bun' },
      { descKey: 'settingSystemTools.tools.bunx.desc', name: 'bunx' },
      { descKey: 'settingSystemTools.tools.pnpm.desc', name: 'pnpm' },
      { descKey: 'settingSystemTools.tools.uv.desc', name: 'uv' },
    ],
  },

  'cli-agents': {
    descKey: 'settingSystemTools.category.cliAgents.desc',
    titleKey: 'settingSystemTools.category.cliAgents',
    tools: [
      { descKey: 'settingSystemTools.tools.claude.desc', name: 'claude' },
      { descKey: 'settingSystemTools.tools.codex.desc', name: 'codex' },
      { descKey: 'settingSystemTools.tools.gemini.desc', name: 'gemini' },
      { descKey: 'settingSystemTools.tools.qwen.desc', name: 'qwen' },
      { descKey: 'settingSystemTools.tools.kimi.desc', name: 'kimi' },
      { descKey: 'settingSystemTools.tools.aider.desc', name: 'aider' },
    ],
  },

  'content-search': {
    descKey: 'settingSystemTools.category.contentSearch.desc',
    titleKey: 'settingSystemTools.category.contentSearch',
    tools: [
      { descKey: 'settingSystemTools.tools.rg.desc', name: 'rg' },
      { descKey: 'settingSystemTools.tools.ag.desc', name: 'ag' },
      { descKey: 'settingSystemTools.tools.grep.desc', name: 'grep' },
    ],
  },
  'file-search': {
    descKey: 'settingSystemTools.category.fileSearch.desc',
    titleKey: 'settingSystemTools.category.fileSearch',
    tools: [
      { descKey: 'settingSystemTools.tools.mdfind.desc', name: 'mdfind' },
      { descKey: 'settingSystemTools.tools.fd.desc', name: 'fd' },
      { descKey: 'settingSystemTools.tools.find.desc', name: 'find' },
    ],
  },
  'browser-automation': {
    descKey: 'settingSystemTools.category.browserAutomation.desc',
    titleKey: 'settingSystemTools.category.browserAutomation',
    tools: [{ descKey: 'settingSystemTools.tools.agentBrowser.desc', name: 'agent-browser' }],
  },
} as const;

const LooseForm = Form as any;

interface ToolStatusDisplayProps {
  isDetecting?: boolean;
  isInstalling?: boolean;
  onInstall?: () => void;
  status?: BinaryStatus;
}

const ToolStatusDisplay = memo<ToolStatusDisplayProps>(
  ({ status, isDetecting, isInstalling, onInstall }) => {
    const { t } = useTranslation('setting');

    if (isDetecting) {
      return (
        <Flexbox horizontal align="center" gap={8}>
          <Icon spin icon={Loader2Icon} size={16} style={{ opacity: 0.5 }} />
          <Text type="secondary">{t('settingSystemTools.detecting')}</Text>
        </Flexbox>
      );
    }

    if (!status) {
      return (
        <Flexbox horizontal align="center" gap={8}>
          <Icon color="var(--ant-color-text-quaternary)" icon={XCircle} size={16} />
          <Text type="secondary">{t('settingSystemTools.status.notDetected')}</Text>
        </Flexbox>
      );
    }

    if (!status.available) {
      return (
        <Flexbox horizontal align="center" gap={8} justify="center">
          <Icon color="var(--ant-color-error)" icon={XCircle} size={16} />
          <Text type="secondary">{t('settingSystemTools.status.unavailable')}</Text>
          {status.manageable && onInstall && (
            <Button
              icon={<Icon icon={Download} />}
              loading={isInstalling}
              onClick={onInstall}
              size="small"
              type="primary"
            >
              {t(
                isInstalling
                  ? 'settingSystemTools.installing'
                  : 'settingSystemTools.installOrRetry',
              )}
            </Button>
          )}
        </Flexbox>
      );
    }

    return (
      <Flexbox align="flex-end" gap={4}>
        <Flexbox horizontal align="center" gap={8} justify="flex-end">
          <Icon color="var(--ant-color-success)" icon={CheckCircle2} size={16} />
          <Text type="success">{t('settingSystemTools.status.available')}</Text>
        </Flexbox>
        {status.path && (
          <Tooltip title={status.path}>
            <Flexbox horizontal align="center" gap={4} justify="flex-end" style={{ maxWidth: 280 }}>
              <Text ellipsis style={{ fontSize: 12 }} type="secondary">
                {status.path}
              </Text>
              <CopyButton content={status.path} size="small" />
            </Flexbox>
          </Tooltip>
        )}
      </Flexbox>
    );
  },
);

const ToolDetectorSection = memo(() => {
  const { t } = useTranslation('setting');
  const [toolStatuses, setToolStatuses] = useState<Record<string, BinaryStatus>>({});
  const [detecting, setDetecting] = useState(true);
  const [installingTool, setInstallingTool] = useState<string | null>(null);

  const detectTools = useCallback(async (force = false) => {
    try {
      setDetecting(true);
      const statuses = await binaryService.detectAll(force);
      setToolStatuses(statuses);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t('settingSystemTools.detectFailed', { error: message }));
    } finally {
      setDetecting(false);
    }
  }, [t]);

  // Auto-detect on mount
  useEffect(() => {
    void detectTools(true);
  }, [detectTools]);

  const handleRedetect = useCallback(() => {
    detectTools(true);
  }, [detectTools]);

  const handleInstall = useCallback(
    async (name: string) => {
      try {
        setInstallingTool(name);
        await binaryService.install(name);
        toast.success(t('settingSystemTools.installSuccess', { name }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(t('settingSystemTools.installFailed', { error: message, name }));
      } finally {
        setInstallingTool(null);
        await detectTools(true);
      }
    },
    [detectTools, t],
  );

  const formItems = Object.entries(TOOL_CATEGORIES).map(
    ([, categoryConfig]) => ({
      children: categoryConfig.tools.map((tool) => {
        const status = toolStatuses[tool.name];
        const label = (
          <Flexbox horizontal align="center" gap={8}>
            <Text>{tool.name}</Text>
            {status?.version && (
              <Tag color="processing" style={{ marginInlineStart: 0 }}>
                {status.version}
              </Tag>
            )}
          </Flexbox>
        );
        return {
          children: (
            <ToolStatusDisplay
              isDetecting={detecting}
              isInstalling={installingTool === tool.name}
              onInstall={() => handleInstall(tool.name)}
              status={status}
            />
          ),
          desc: t(tool.descKey),
          label,
          minWidth: undefined,
        };
      }),
      desc: t(categoryConfig.descKey),
      title: t(categoryConfig.titleKey),
    }),
  );

  return (
    <LooseForm
      collapsible={false}
      items={formItems as any}
      itemsType={'group'}
      variant={'filled'}
      footer={
        <Flexbox
          horizontal
          align="center"
          gap={16}
          justify="flex-end"
          style={{ marginBlockStart: 8 }}
        >
          <Button
            icon={<Icon icon={RefreshCw} spin={detecting} />}
            loading={detecting}
            onClick={handleRedetect}
          >
            {t('settingSystemTools.redetect')}
          </Button>
        </Flexbox>
      }
      {...FORM_STYLE}
    />
  );
});

export default ToolDetectorSection;
