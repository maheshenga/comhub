'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button, confirmModal } from '@lobehub/ui/base-ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';

import { mutate } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { buildModuleAppPublishWarningCodes } from '../formSchema';
import type { ModuleAppDetailOutletContext } from '../layouts/ModuleAppDetailLayout';
import { moduleAppCacheKeys } from '../shared/cacheKeys';
import AppIdentityModal from './AppIdentityModal';
import { buildIdentityUpsertInput, type ModuleAppIdentityFormValues } from './identityForm';

const refreshApplicationCaches = async (appId: string, refresh: () => Promise<unknown>) => {
  await Promise.all([
    refresh(),
    mutate(moduleAppCacheKeys.detail(appId)),
    mutate(
      (key) => Array.isArray(key) && key[0] === 'admin-module-apps' && key[1] === 'apps',
      undefined,
      { revalidate: true },
    ),
  ]);
};

const ModuleAppOverviewPage = memo(() => {
  const { t } = useTranslation('common');
  const { app, refresh } = useOutletContext<ModuleAppDetailOutletContext>();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canWrite = hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppWrite);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const saveIdentity = async (identity: ModuleAppIdentityFormValues) => {
    setSubmitting(true);
    try {
      await adminCommercialService.moduleApps.upsert(buildIdentityUpsertInput(identity, app));
      setEditing(false);
      await refreshApplicationCaches(app.id, refresh);
    } finally {
      setSubmitting(false);
    }
  };
  const changePublication = (nextStatus: 'published' | 'unpublished') => {
    const warningCodes = nextStatus === 'published' ? buildModuleAppPublishWarningCodes(app) : [];
    confirmModal({
      content: warningCodes.length
        ? warningCodes
            .map((code) => t(`moduleApps.admin.overview.publishWarnings.${code}`))
            .join('\n')
        : t('moduleApps.admin.overview.publishConfirm'),
      okButtonProps: { danger: nextStatus === 'unpublished' },
      okText:
        nextStatus === 'published'
          ? t('moduleApps.admin.overview.publish')
          : t('moduleApps.admin.overview.unpublish'),
      title:
        nextStatus === 'published'
          ? t('moduleApps.admin.overview.publish')
          : t('moduleApps.admin.overview.unpublish'),
      onOk: async () => {
        if (nextStatus === 'published')
          await adminCommercialService.moduleApps.publish({ appId: app.id });
        else await adminCommercialService.moduleApps.unpublish({ appId: app.id });
        await refreshApplicationCaches(app.id, refresh);
      },
    });
  };

  return (
    <section data-testid="module-app-overview">
      <header>
        <h2>{t('moduleApps.admin.overview.title')}</h2>
        {canWrite ? (
          <div>
            <Button onClick={() => setEditing(true)}>{t('moduleApps.admin.overview.edit')}</Button>
            <Button
              danger={app.status === 'published'}
              type="primary"
              onClick={() =>
                changePublication(app.status === 'published' ? 'unpublished' : 'published')
              }
            >
              {app.status === 'published'
                ? t('moduleApps.admin.overview.unpublish')
                : t('moduleApps.admin.overview.publish')}
            </Button>
          </div>
        ) : null}
      </header>
      <dl>
        <dt>{t('moduleApps.admin.apps.identity.displayName')}</dt>
        <dd>{app.displayName}</dd>
        <dt>{t('moduleApps.admin.apps.version')}</dt>
        <dd>{app.version ?? '-'}</dd>
        <dt>{t('moduleApps.admin.apps.identity.status')}</dt>
        <dd>{t(`moduleApps.admin.apps.status.${app.status}`)}</dd>
        <dt>{t('moduleApps.admin.apps.identity.source')}</dt>
        <dd>{t(`moduleApps.admin.apps.source.${app.source ?? 'admin'}`)}</dd>
        <dt>{t('moduleApps.admin.apps.category')}</dt>
        <dd>{app.category}</dd>
        <dt>{t('moduleApps.admin.apps.identity.tags')}</dt>
        <dd>{app.tags?.join(', ') || '-'}</dd>
        <dt>{t('moduleApps.admin.overview.publishState')}</dt>
        <dd>
          {app.status === 'published'
            ? t('moduleApps.admin.overview.published')
            : t('moduleApps.admin.overview.notPublished')}
        </dd>
      </dl>
      <AppIdentityModal
        currentApp={app}
        open={editing}
        submitting={submitting}
        onCancel={() => setEditing(false)}
        onSubmit={saveIdentity}
      />
    </section>
  );
});

ModuleAppOverviewPage.displayName = 'ModuleAppOverviewPage';

export default ModuleAppOverviewPage;
