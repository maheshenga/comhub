'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button, confirmModal, createStaticStyles,toast } from '@lobehub/ui';
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
import { detailSubPageStyles as shell } from './detailSubPageStyles';
import { buildIdentityUpsertInput, type ModuleAppIdentityFormValues } from './identityForm';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  `,
  metadata: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 32px;

    @media (width < 640px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  metadataItem: css`
    display: grid;
    grid-template-columns: minmax(108px, 0.4fr) minmax(0, 1fr);
    gap: 16px;
    align-items: baseline;

    min-width: 0;
    padding-block: 14px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    @media (width < 640px) {
      grid-template-columns: minmax(96px, 0.35fr) minmax(0, 1fr);
      gap: 12px;
    }
  `,
  metadataLabel: css`
    margin: 0;
    font-size: 12px;
    line-height: 20px;
    color: ${cssVar.colorTextSecondary};
  `,
  metadataValue: css`
    min-width: 0;
    margin: 0;

    line-height: 22px;
    color: ${cssVar.colorText};
    overflow-wrap: anywhere;
  `,
  valueBadge: css`
    display: inline-flex;
    align-items: center;

    min-height: 24px;
    padding-inline: 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 12px;
    line-height: 18px;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillTertiary};
  `,
}));

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
      // 多条警告逐行分段渲染：HTML 文本节点会把 join('\n') 折叠成一行。
      content: warningCodes.length ? (
        <div>
          {warningCodes.map((code) => (
            <p key={code} style={{ margin: 0 }}>
              {t(`moduleApps.admin.overview.publishWarnings.${code}`)}
            </p>
          ))}
        </div>
      ) : (
        t('moduleApps.admin.overview.publishConfirm')
      ),
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
        try {
          if (nextStatus === 'published')
            await adminCommercialService.moduleApps.publish({ appId: app.id });
          else await adminCommercialService.moduleApps.unpublish({ appId: app.id });
        } catch {
          // 失败必须可见：confirmModal 会静默吞掉 onOk 的 rejection。
          toast.error(
            nextStatus === 'published'
              ? t('moduleApps.admin.overview.publishFailed')
              : t('moduleApps.admin.overview.unpublishFailed'),
          );
          throw new Error('MODULE_APP_PUBLICATION_FAILED');
        }
        await refreshApplicationCaches(app.id, refresh);
      },
    });
  };

  return (
    <section className={shell.page} data-testid="module-app-overview">
      <header className={shell.header} data-testid="module-app-overview-header">
        <div>
          <h2 className={shell.title}>{t('moduleApps.admin.overview.title')}</h2>
          <p className={shell.description}>{app.description}</p>
        </div>
        {canWrite ? (
          <div className={styles.actions} data-testid="module-app-overview-actions">
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
      <dl className={styles.metadata} data-testid="module-app-overview-metadata">
        <div className={styles.metadataItem}>
          <dt className={styles.metadataLabel}>
            {t('moduleApps.admin.apps.identity.displayName')}
          </dt>
          <dd className={styles.metadataValue}>{app.displayName}</dd>
        </div>
        <div className={styles.metadataItem}>
          <dt className={styles.metadataLabel}>{t('moduleApps.admin.apps.version')}</dt>
          <dd className={styles.metadataValue}>{app.version ?? '-'}</dd>
        </div>
        <div className={styles.metadataItem}>
          <dt className={styles.metadataLabel}>{t('moduleApps.admin.apps.identity.status')}</dt>
          <dd className={styles.metadataValue}>
            <span className={styles.valueBadge}>
              {t(`moduleApps.admin.apps.status.${app.status}`)}
            </span>
          </dd>
        </div>
        <div className={styles.metadataItem}>
          <dt className={styles.metadataLabel}>{t('moduleApps.admin.apps.identity.source')}</dt>
          <dd className={styles.metadataValue}>
            {t(`moduleApps.admin.apps.source.${app.source ?? 'admin'}`)}
          </dd>
        </div>
        <div className={styles.metadataItem}>
          <dt className={styles.metadataLabel}>{t('moduleApps.admin.apps.category')}</dt>
          <dd className={styles.metadataValue}>{app.category}</dd>
        </div>
        <div className={styles.metadataItem}>
          <dt className={styles.metadataLabel}>{t('moduleApps.admin.apps.identity.tags')}</dt>
          <dd className={styles.metadataValue}>{app.tags?.join(', ') || '-'}</dd>
        </div>
        <div className={styles.metadataItem}>
          <dt className={styles.metadataLabel}>{t('moduleApps.admin.overview.publishState')}</dt>
          <dd className={styles.metadataValue}>
            <span className={styles.valueBadge}>
              {app.status === 'published'
                ? t('moduleApps.admin.overview.published')
                : t('moduleApps.admin.overview.notPublished')}
            </span>
          </dd>
        </div>
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
