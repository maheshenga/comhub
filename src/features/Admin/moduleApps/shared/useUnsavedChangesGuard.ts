'use client';

import { confirmModal } from '@lobehub/ui/base-ui';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';

export const useUnsavedChangesGuard = (isDirty: boolean, message: string) => {
  const { t } = useTranslation('common');
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    confirmModal({
      cancelText: t('moduleApps.admin.center.unsavedCancel'),
      content: message,
      okText: t('moduleApps.admin.center.unsavedDiscard'),
      onCancel: () => blocker.reset(),
      onOk: () => blocker.proceed(),
      title: t('moduleApps.admin.center.unsavedTitle'),
    });
  }, [blocker, message, t]);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, message]);

  return blocker;
};
