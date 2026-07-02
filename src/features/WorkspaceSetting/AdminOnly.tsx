'use client';

import { Button, Flexbox, Icon } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { LockKeyhole } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsWorkspaceLoading } from '@/business/client/hooks/useIsWorkspaceLoading';
import { useIsWorkspaceOwner } from '@/business/client/hooks/useIsWorkspaceOwner';

const Forbidden = memo(() => {
  const { t } = useTranslation('error');

  return (
    <Flexbox align={'center'} gap={16} height={'100%'} justify={'center'} width={'100%'}>
      <Icon icon={LockKeyhole} size={56} style={{ color: cssVar.colorTextQuaternary }} />
      <Flexbox align={'center'} gap={8}>
        <h2 style={{ fontWeight: 700, margin: 0 }}>{t('forbidden.title')}</h2>
        <div style={{ color: cssVar.colorTextSecondary, lineHeight: 1.8, textAlign: 'center' }}>
          {t('forbidden.desc')}
        </div>
      </Flexbox>
      <Button onClick={() => (window.location.href = '/')} type={'primary'}>
        {t('forbidden.backHome')}
      </Button>
    </Flexbox>
  );
});

Forbidden.displayName = 'WorkspaceAdminOnlyForbidden';

const WorkspaceAdminOnly = memo<{ children: ReactNode }>(({ children }) => {
  const isLoading = useIsWorkspaceLoading();
  const isOwner = useIsWorkspaceOwner();

  if (isLoading) return null;
  if (!isOwner) return <Forbidden />;

  return <>{children}</>;
});

WorkspaceAdminOnly.displayName = 'WorkspaceAdminOnly';

export default WorkspaceAdminOnly;
