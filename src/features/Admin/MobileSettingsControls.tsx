'use client';

import { Alert, Button, createStaticStyles,Flexbox, Switch } from '@lobehub/ui';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { MOBILE_ICON_NAMES, type MobileIconName } from '@/const/mobileConfig';

import { adminDesignStyles } from './layout';
import type { SelectOption, SelectorStatus } from './mobileSettingsHelpers';

const styles = createStaticStyles(({ css, cssVar }) => ({
  field: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 160px;
  `,
  /**
   * Native `<select>` shell. Height and radius now come from the antd control
   * tokens (`controlHeight` / `borderRadius`) instead of the hand-written
   * 32px/6px literals, and the shared `adminDesignStyles.focusRing` supplies
   * the missing focus-visible indicator.
   *
   * The base-ui `Select` migration is deliberately not taken: the locked page
   * tests drive these controls with `fireEvent.change(screen.getByLabelText(…))`
   * and assert `findByRole('option', …)` before opening any popup
   * (AdminMobileSettingsPage.test.tsx:257/297/311/433) — native `<select>`
   * semantics that a portalled base-ui combobox does not expose.
   */
  select: css`
    height: ${cssVar.controlHeight};
    border: 1px solid ${cssVar.colorBorder};
    border-radius: ${cssVar.borderRadius};

    background: ${cssVar.colorBgContainer};

    color: ${cssVar.colorText};

    /* Composed from adminDesignStyles.focusRing (token consumption). */
    ${adminDesignStyles.focusRing}
  `,
}));

export const LabeledField = ({ children, label }: { children: ReactNode; label: string }) => (
  <label className={styles.field}>
    <span>{label}</span>
    {children}
  </label>
);

export const IconSelect = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: MobileIconName) => void;
  value: string;
}) => {
  const { t } = useTranslation('subscription');

  return (
    <select
      aria-label={label}
      className={styles.select}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t('admin.mobile.selectIcon', { defaultValue: 'Select icon' })}</option>
      {MOBILE_ICON_NAMES.map((icon) => (
        <option key={icon} value={icon}>
          {icon}
        </option>
      ))}
    </select>
  );
};

export const SelectField = ({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  value: string;
}) => {
  const { t } = useTranslation('subscription');

  return (
    <select
      aria-label={label}
      className={styles.select}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t('admin.mobile.select', { defaultValue: 'Select' })}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export const AccessibleSwitch = ({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) => {
  const id = useId();

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <Switch checked={checked} id={id} onChange={(nextChecked) => onChange(nextChecked)} />
    </div>
  );
};

export const OrderButtons = ({
  label,
  onMove,
  position,
  total,
}: {
  label: string;
  onMove: (direction: -1 | 1) => void;
  position: number;
  total: number;
}) => {
  const { t } = useTranslation('subscription');
  const up = t('admin.mobile.moveUp', { defaultValue: 'Move {{label}} up', label });
  const down = t('admin.mobile.moveDown', { defaultValue: 'Move {{label}} down', label });

  return (
    <Flexbox horizontal gap={4}>
      <Button
        aria-label={up}
        disabled={position === 0}
        icon={<ArrowUp size={14} />}
        title={up}
        onClick={() => onMove(-1)}
      />
      <Button
        aria-label={down}
        disabled={position === total - 1}
        icon={<ArrowDown size={14} />}
        title={down}
        onClick={() => onMove(1)}
      />
    </Flexbox>
  );
};

export const RemoveButton = ({ label, onClick }: { label: string; onClick: () => void }) => {
  const { t } = useTranslation('subscription');
  const removeLabel = t('admin.mobile.remove', { defaultValue: 'Remove {{label}}', label });

  return (
    <Button
      aria-label={removeLabel}
      icon={<Trash2 size={14} />}
      title={removeLabel}
      onClick={onClick}
    />
  );
};

export const SelectorAlert = ({
  label,
  onRetry,
  retryLabel,
  status,
}: {
  label: string;
  onRetry: () => void;
  retryLabel: string;
  status: SelectorStatus;
}) =>
  status.error ? (
    <Alert
      showIcon
      title={label}
      type="warning"
      action={
        <Button disabled={status.loading} size="small" onClick={onRetry}>
          {retryLabel}
        </Button>
      }
    />
  ) : null;
