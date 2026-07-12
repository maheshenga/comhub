import type { ModuleAppLaunchContext } from '@lobechat/types';
import { Button, Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { Clock3, RefreshCw, ServerOff, ShieldAlert, TriangleAlert } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import useSWR from 'swr';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { moduleAppService } from '@/services/moduleApp';

import PageRenderer from './PageRenderer';
import RecentRunResult from './RecentRunResult';
import WorkflowProgress from './WorkflowProgress';

const styles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 480px;
    background: ${cssVar.colorBgLayout};
  `,
  state: css`
    width: min(480px, calc(100% - 32px));
    margin: auto;
    text-align: center;
  `,
}));

type RuntimeState = 'buildNotReady' | 'denied' | 'failure' | 'unavailable';

const runtimeStateMeta = {
  buildNotReady: { icon: Clock3, key: 'buildNotReady' },
  denied: { icon: ShieldAlert, key: 'denied' },
  failure: { icon: TriangleAlert, key: 'failure' },
  unavailable: { icon: ServerOff, key: 'unavailable' },
} as const;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return '';
};

export const resolveModuleAppRuntimeState = (error: unknown): RuntimeState => {
  const message = getErrorMessage(error);
  if (message.includes('module_app_build_not_ready')) return 'buildNotReady';
  if (message.includes('module_app_runtime_unavailable')) return 'unavailable';
  if (
    message.includes('module_app_installation_required') ||
    message.includes('module_app_workspace_denied') ||
    message.includes('plan_run_denied')
  ) {
    return 'denied';
  }
  return 'failure';
};

interface ModuleAppRuntimeViewProps {
  context?: ModuleAppLaunchContext;
  error?: unknown;
  loading: boolean;
  onRetry: () => void;
  runId?: string;
  workspaceId?: string;
}

export const ModuleAppRuntimeView = memo<ModuleAppRuntimeViewProps>(
  ({ context, error, loading, onRetry, runId, workspaceId }) => {
    const { t } = useTranslation('common');

    if (loading) {
      return (
        <Flexbox
          align={'center'}
          aria-busy={'true'}
          className={styles.root}
          justify={'center'}
          role={'status'}
        >
          <NeuralNetworkLoading size={48} />
        </Flexbox>
      );
    }

    if (error || !context) {
      const state = resolveModuleAppRuntimeState(error);
      const meta = runtimeStateMeta[state];
      return (
        <Flexbox align={'center'} className={styles.root} justify={'center'}>
          <Flexbox align={'center'} className={styles.state} gap={12}>
            <Icon icon={meta.icon} size={32} />
            <Text as={'h2'} style={{ fontSize: 18, margin: 0 }} weight={600}>
              {t(`moduleApps.runtime.${meta.key}.title`)}
            </Text>
            <Text type={'secondary'}>{t(`moduleApps.runtime.${meta.key}.description`)}</Text>
            <Button icon={<RefreshCw size={16} />} onClick={onRetry}>
              {t('moduleApps.runtime.retry')}
            </Button>
          </Flexbox>
        </Flexbox>
      );
    }

    return (
      <div className={styles.root} data-testid="module-app-runtime">
        <PageRenderer context={context} />
        <RecentRunResult installationId={context.installationId} workspaceId={workspaceId} />
        {runId && (
          <WorkflowProgress
            installationId={context.installationId}
            runId={runId}
            workspaceId={workspaceId}
          />
        )}
      </div>
    );
  },
);

ModuleAppRuntimeView.displayName = 'ModuleAppRuntimeView';

const ModuleAppRuntime = memo(() => {
  const { appId } = useParams();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspaceId') || undefined;
  const runId = searchParams.get('runId') || undefined;
  const launch = useSWR<ModuleAppLaunchContext>(
    appId ? ['moduleApp.getLaunchContext', appId, workspaceId] : null,
    () => moduleAppService.getLaunchContext({ appId: appId!, workspaceId }),
    { refreshInterval: 240_000, revalidateOnFocus: true },
  );

  return (
    <ModuleAppRuntimeView
      context={launch.data}
      error={appId ? launch.error : new Error('module_app_installation_required')}
      loading={Boolean(appId && launch.isLoading)}
      runId={runId}
      workspaceId={workspaceId}
      onRetry={() => void launch.mutate()}
    />
  );
});

ModuleAppRuntime.displayName = 'ModuleAppRuntime';

export default ModuleAppRuntime;
