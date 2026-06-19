'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Input, Modal, Popconfirm, Typography } from 'antd';
import type { ButtonProps } from 'antd';
import { memo, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type AdminDangerousActionConfirmationError,
  type AdminDangerousActionConfirmationInput,
  type AdminDangerousActionId,
  buildAdminDangerousActionConfirm,
  validateAdminDangerousActionConfirmation,
} from './adminDangerousActions';

type AdminDangerousActionButtonProps = Omit<ButtonProps, 'children' | 'onClick'> & {
  actionId: AdminDangerousActionId;
  children: ReactNode;
  confirmDescription?: ReactNode;
  confirmTitle?: ReactNode;
  onConfirm: (input: Required<Pick<AdminDangerousActionConfirmationInput, 'confirmed'>> &
    AdminDangerousActionConfirmationInput) => Promise<void> | void;
};

const AdminDangerousActionButton = memo<AdminDangerousActionButtonProps>(
  ({ actionId, children, confirmDescription, confirmTitle, onConfirm, ...buttonProps }) => {
    const { t } = useTranslation('subscription');
    const requirement = buildAdminDangerousActionConfirm(actionId);
    const [open, setOpen] = useState(false);
    const [confirmationText, setConfirmationText] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<AdminDangerousActionConfirmationError[]>([]);

    const closeTypedConfirm = () => {
      setOpen(false);
      setConfirmationText('');
      setReason('');
      setErrors([]);
    };

    const handleTypedConfirm = async () => {
      const input = {
        confirmed: true,
        confirmationText,
        reason,
      };
      const result = validateAdminDangerousActionConfirmation(actionId, input);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }

      setSubmitting(true);
      try {
        await onConfirm(input);
        closeTypedConfirm();
      } finally {
        setSubmitting(false);
      }
    };

    if (!requirement?.requiresTypedConfirmation) {
      return (
        <Popconfirm
          okButtonProps={{ danger: buttonProps.danger }}
          okText={typeof children === 'string' ? children : requirement?.confirmation.title}
          title={confirmTitle ?? requirement?.confirmation.title ?? actionId}
          description={confirmDescription ?? requirement?.confirmation.description}
          onConfirm={() => onConfirm({ confirmed: true })}
        >
          <Button {...buttonProps}>{children}</Button>
        </Popconfirm>
      );
    }

    return (
      <>
        <Button {...buttonProps} onClick={() => setOpen(true)}>
          {children}
        </Button>
        <Modal
          confirmLoading={submitting}
          okButtonProps={{ danger: true }}
          okText={typeof children === 'string' ? children : requirement.confirmation.title}
          open={open}
          title={confirmTitle ?? requirement.confirmation.title}
          onCancel={closeTypedConfirm}
          onOk={handleTypedConfirm}
        >
          <Flexbox gap={12}>
            <Typography.Text>{confirmDescription ?? requirement.confirmation.description}</Typography.Text>
            <Typography.Text type="secondary">
              {t('admin.dangerousAction.typedConfirm', 'Type {{confirmationText}} to confirm.', {
                confirmationText: requirement.requiredConfirmationText,
              })}
            </Typography.Text>
            <Input
              autoFocus
              placeholder={requirement.requiredConfirmationText}
              value={confirmationText}
              onChange={(event) => {
                setConfirmationText(event.target.value);
                setErrors([]);
              }}
            />
            {requirement.requiresReason ? (
              <Input.TextArea
                placeholder={t('admin.dangerousAction.reasonPlaceholder', 'Reason')}
                rows={3}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setErrors([]);
                }}
              />
            ) : null}
            {errors.map((error) => (
              <Typography.Text key={error} type="danger">
                {t(`admin.dangerousAction.errors.${error}`, error)}
              </Typography.Text>
            ))}
          </Flexbox>
        </Modal>
      </>
    );
  },
);

AdminDangerousActionButton.displayName = 'AdminDangerousActionButton';

export default AdminDangerousActionButton;
