'use client';

import { Modal } from '@lobehub/ui/base-ui';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type PublisherFormValues = {
  displayName: string;
  recipientMask?: string;
  userId: string;
};

export type PublisherFormModalProps = {
  onCancel: () => void;
  onSubmit: (values: PublisherFormValues) => Promise<void>;
  open: boolean;
  submitting?: boolean;
};

const PublisherFormModal = memo<PublisherFormModalProps>(
  ({ onCancel, onSubmit, open, submitting }) => {
    const { t } = useTranslation('common');
    const [values, setValues] = useState<PublisherFormValues>({
      displayName: '',
      recipientMask: '',
      userId: '',
    });
    const [error, setError] = useState<string>();

    useEffect(() => {
      if (open) {
        setError(undefined);
        setValues({ displayName: '', recipientMask: '', userId: '' });
      }
    }, [open]);

    const submit = async () => {
      setError(undefined);
      try {
        await onSubmit({
          ...values,
          displayName: values.displayName.trim(),
          recipientMask: values.recipientMask?.trim() || undefined,
          userId: values.userId.trim(),
        });
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : t('moduleApps.admin.publishers.createError'),
        );
      }
    };
    const recipientIsValid = !values.recipientMask || values.recipientMask.includes('*');
    const valid = Boolean(values.displayName.trim() && values.userId.trim() && recipientIsValid);

    return (
      <Modal
        cancelText={t('cancel')}
        confirmLoading={submitting}
        destroyOnHidden
        okButtonProps={{ disabled: submitting || !valid }}
        okText={t('moduleApps.admin.publishers.create')}
        open={open}
        title={t('moduleApps.admin.publishers.create')}
        onCancel={onCancel}
        onOk={submit}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            {t('moduleApps.admin.publishers.displayName')}
            <input
              autoFocus
              required
              value={values.displayName}
              onChange={(event) =>
                setValues((current) => ({ ...current, displayName: event.target.value }))
              }
            />
          </label>
          <label>
            {t('moduleApps.admin.publishers.ownerUserId')}
            <input
              required
              value={values.userId}
              onChange={(event) =>
                setValues((current) => ({ ...current, userId: event.target.value }))
              }
            />
          </label>
          <label>
            {t('moduleApps.admin.publishers.recipientMask')}
            <input
              value={values.recipientMask}
              onChange={(event) =>
                setValues((current) => ({ ...current, recipientMask: event.target.value }))
              }
            />
          </label>
          {values.recipientMask && !recipientIsValid ? (
            <p role="alert">{t('moduleApps.admin.publishers.recipientMaskError')}</p>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
        </div>
      </Modal>
    );
  },
);

PublisherFormModal.displayName = 'PublisherFormModal';

export default PublisherFormModal;
