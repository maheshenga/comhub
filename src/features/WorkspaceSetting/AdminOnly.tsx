'use client';

import { Flexbox, FluentEmoji } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsWorkspaceLoading } from '@/business/client/hooks/useIsWorkspaceLoading';
import { RouteLoading } from '@/components/Skeleton/RouteSegment';
import { MAX_WIDTH } from '@/const/layoutTokens';
import { usePermission } from '@/hooks/usePermission';

const Forbidden = memo(() => {
  const { t } = useTranslation('error');
  return (
    <Flexbox align={'center'} justify={'center'} style={{ minHeight: '100%', width: '100%' }}>
      <h1
        style={{
          filter: 'blur(8px)',
          fontSize: `min(${MAX_WIDTH / 3}px, 50vw)`,
          fontWeight: 'bolder',
          margin: 0,
          opacity: 0.12,
          position: 'absolute',
          zIndex: 0,
        }}
      >
        403
      </h1>
      <FluentEmoji emoji={'🚫'} size={64} />
      <h2 style={{ fontWeight: 'bold', marginTop: '1em', textAlign: 'center' }}>
        {t('forbidden.title')}
      </h2>
      <div style={{ lineHeight: '1.8', marginBottom: '2em', textAlign: 'center' }}>
        {t('forbidden.desc')}
      </div>
      <Button
        type={'primary'}
        onClick={() => {
          // 403 组件在 workspace 工作台内被多宿主（主应用/electron）复用，无统一
          // router 实例可拿；回首页整页跳转同时清掉受限会话的残留状态。
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- multi-host shared component; hard nav resets restricted session state
          window.location.href = '/';
        }}
      >
        {t('forbidden.backHome')}
      </Button>
    </Flexbox>
  );
});

Forbidden.displayName = 'WorkspaceAdminOnlyForbidden';

const AdminOnly = memo<{ children: ReactNode }>(({ children }) => {
  const isLoading = useIsWorkspaceLoading();
  const { allowed: canManageWorkspace } = usePermission('manage_settings');

  // Don't paint the 403 before workspace context resolves — `myRole` is `null`
  // during bootstrap, which would briefly flash the forbidden screen for admins
  // landing directly on the URL.
  if (isLoading) return <RouteLoading />;
  if (!canManageWorkspace) return <Forbidden />;
  return <>{children}</>;
});

AdminOnly.displayName = 'WorkspaceAdminOnly';

export default AdminOnly;
