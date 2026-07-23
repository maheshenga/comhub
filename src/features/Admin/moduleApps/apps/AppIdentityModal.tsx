'use client';

import type { ModuleAppSource, ModuleAppStatus } from '@lobechat/types';
import { Modal } from '@lobehub/ui/base-ui';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AdminModuleAppDetail } from '../types';
import { createDefaultModuleAppIdentity, type ModuleAppIdentityFormValues } from './identityForm';

const isModuleAppStatus = (value: string): value is ModuleAppStatus =>
  value === 'draft' || value === 'published' || value === 'unpublished';

const isModuleAppSource = (value: string): value is ModuleAppSource =>
  value === 'admin' || value === 'developer' || value === 'system' || value === 'user';

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
    const [submitError, setSubmitError] = useState<string>();

    useEffect(() => {
      if (!open) return;
      setIdentity({
        ...createDefaultModuleAppIdentity(),
        ...(currentApp ?? draft),
      });
      setSubmitError(undefined);
    }, [currentApp, draft, open]);

    const update = <Key extends keyof ModuleAppIdentityFormValues>(
      key: Key,
      value: ModuleAppIdentityFormValues[Key],
    ) => {
      setSubmitError(undefined);
      setIdentity((current) => {
        const next = { ...current, [key]: value };
        if (!currentApp) onDraftChange?.(next);
        return next;
      });
    };

    const valid = Boolean(
      identity.displayName?.trim() &&
      identity.slug?.trim() &&
      identity.category?.trim() &&
      identity.description?.trim(),
    );

    const handleSubmit = async () => {
      setSubmitError(undefined);
      try {
        await onSubmit(identity);
      } catch (error) {
        setSubmitError(
          error instanceof Error && error.message.trim()
            ? error.message
            : t('moduleApps.admin.apps.identity.submitError'),
        );
      }
    };

    return (
      <Modal
        destroyOnHidden
        cancelText={t('cancel')}
        confirmLoading={submitting}
        okButtonProps={{ disabled: submitting || !valid }}
        okText={t('ok')}
        open={open}
        title={t(
          currentApp
            ? 'moduleApps.admin.apps.identity.editTitle'
            : 'moduleApps.admin.apps.identity.createTitle',
        )}
        onCancel={onCancel}
        onOk={handleSubmit}
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
              required
              value={identity.category ?? ''}
              onChange={(event) => update('category', event.target.value)}
            />
          </label>
          <label>
            {t('moduleApps.admin.apps.identity.status')}
            <select
              value={identity.status ?? 'draft'}
              onChange={(event) => {
                if (isModuleAppStatus(event.target.value)) update('status', event.target.value);
              }}
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
              onChange={(event) => {
                if (isModuleAppSource(event.target.value)) update('source', event.target.value);
              }}
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
              required
              rows={3}
              value={identity.description ?? ''}
              onChange={(event) => update('description', event.target.value)}
            />
          </label>
          <label>
            {t('moduleApps.admin.apps.identity.tags')}
            <input
              value={
                Array.isArray(identity.tags) ? identity.tags.join(', ') : (identity.tags ?? '')
              }
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
          {submitError ? <div role="alert">{submitError}</div> : null}
        </div>
      </Modal>
    );
  },
);

AppIdentityModal.displayName = 'AppIdentityModal';

export default AppIdentityModal;
