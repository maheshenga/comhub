'use client';

import { Modal } from '@lobehub/ui/base-ui';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AdminModuleAppDetail } from '../types';

import { createDefaultModuleAppIdentity, type ModuleAppIdentityFormValues } from './identityForm';

export type AppIdentityModalProps = {
  currentApp?: AdminModuleAppDetail | null;
  draft?: ModuleAppIdentityFormValues | null;
  onCancel: () => void;
  onDraftChange?: (draft: ModuleAppIdentityFormValues) => void;
  onSubmit: (identity: ModuleAppIdentityFormValues) => Promise<void>;
  open: boolean;
  submitting?: boolean;
};

const AppIdentityModal = memo<AppIdentityModalProps>(
  ({ currentApp, draft, onCancel, onDraftChange, onSubmit, open, submitting }) => {
    const { t } = useTranslation('common');
    const [identity, setIdentity] = useState<ModuleAppIdentityFormValues>(
      createDefaultModuleAppIdentity(),
    );

    useEffect(() => {
      if (!open) return;
      setIdentity({
        ...createDefaultModuleAppIdentity(),
        ...(currentApp ?? draft ?? {}),
      });
    }, [currentApp, draft, open]);

    const update = <Key extends keyof ModuleAppIdentityFormValues>(
      key: Key,
      value: ModuleAppIdentityFormValues[Key],
    ) => {
      setIdentity((current) => {
        const next = { ...current, [key]: value };
        if (!currentApp) onDraftChange?.(next);
        return next;
      });
    };

    return (
      <Modal
        cancelText={t('cancel')}
        confirmLoading={submitting}
        destroyOnHidden
        okButtonProps={{ disabled: !identity.displayName?.trim() || !identity.slug?.trim() }}
        okText={t('ok')}
        open={open}
        title={t(
          currentApp
            ? 'moduleApps.admin.apps.identity.editTitle'
            : 'moduleApps.admin.apps.identity.createTitle',
        )}
        onCancel={onCancel}
        onOk={() => onSubmit(identity)}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            {t('moduleApps.admin.apps.identity.displayName')}
            <input
              autoFocus
              required
              value={identity.displayName ?? ''}
              onChange={(event) => update('displayName', event.target.value)}
            />
          </label>
          <label>
            {t('moduleApps.admin.apps.identity.slug')}
            <input
              required
              value={identity.slug ?? ''}
              onChange={(event) => update('slug', event.target.value)}
            />
          </label>
          <label>
            {t('moduleApps.admin.apps.identity.category')}
            <input
              value={identity.category ?? ''}
              onChange={(event) => update('category', event.target.value)}
            />
          </label>
          <label>
            {t('moduleApps.admin.apps.identity.status')}
            <select
              value={identity.status ?? 'draft'}
              onChange={(event) => update('status', event.target.value as never)}
            >
              <option value="draft">{t('moduleApps.admin.apps.status.draft')}</option>
              <option value="published">{t('moduleApps.admin.apps.status.published')}</option>
              <option value="unpublished">{t('moduleApps.admin.apps.status.unpublished')}</option>
            </select>
          </label>
          <label>
            {t('moduleApps.admin.apps.identity.source')}
            <select
              value={identity.source ?? 'admin'}
              onChange={(event) => update('source', event.target.value as never)}
            >
              <option value="admin">{t('moduleApps.admin.apps.source.admin')}</option>
              <option value="developer">{t('moduleApps.admin.apps.source.developer')}</option>
              <option value="system">{t('moduleApps.admin.apps.source.system')}</option>
              <option value="user">{t('moduleApps.admin.apps.source.user')}</option>
            </select>
          </label>
          <label>
            {t('moduleApps.admin.apps.identity.description')}
            <textarea
              rows={3}
              value={identity.description ?? ''}
              onChange={(event) => update('description', event.target.value)}
            />
          </label>
          <label>
            {t('moduleApps.admin.apps.identity.tags')}
            <input
              value={(identity.tags ?? []).join(', ')}
              onChange={(event) =>
                update(
                  'tags',
                  event.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
        </div>
      </Modal>
    );
  },
);

AppIdentityModal.displayName = 'AppIdentityModal';

export default AppIdentityModal;
