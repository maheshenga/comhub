'use client';

import { cx, createStaticStyles } from 'antd-style';
import { type ReactNode } from 'react';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  `,
  description: css`
    max-width: 360px;
    margin: 0;
    font-size: 14px;
    line-height: 22px;
    color: ${cssVar.colorTextSecondary};
    text-align: center;
  `,
  primaryAction: css`
    border-color: ${cssVar.colorPrimary};
    color: ${cssVar.colorTextLightSolid};
    background: ${cssVar.colorPrimary};
  `,
  secondaryAction: css`
    border-color: ${cssVar.colorBorder};
    color: ${cssVar.colorText};
    background: ${cssVar.colorBgContainer};
  `,
  state: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    justify-content: center;
    min-height: 180px;
    padding: 24px 16px;
    text-align: center;
  `,
  title: css`
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    line-height: 24px;
    color: ${cssVar.colorText};
  `,
  action: css`
    min-width: 44px;
    min-height: 44px;
    padding-block: 0;
    padding-inline: 16px;
    border: 1px solid;
    border-radius: 6px;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  `,
}));

export interface MobileStateAction {
  label: ReactNode;
  onClick: () => void;
  primary?: boolean;
}

export interface MobileStateViewProps {
  action?: MobileStateAction;
  actions?: MobileStateAction[];
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  variant?: 'empty' | 'error' | 'loading';
}

const MobileStateView = ({
  action,
  actions = [],
  description,
  icon,
  title,
  variant = 'empty',
}: MobileStateViewProps) => {
  const stateActions = [
    ...(action ? [{ ...action, primary: action.primary ?? true }] : []),
    ...actions,
  ];
  let hasPrimaryAction = false;

  return (
    <section className={styles.state} data-variant={variant} data-testid="mobile-state-view">
      {icon}
      <h2 className={styles.title}>{title}</h2>
      {description ? <p className={styles.description}>{description}</p> : null}
      {stateActions.length ? (
        <div className={styles.actions}>
          {stateActions.map((stateAction, index) => {
            const primary = Boolean(stateAction.primary) && !hasPrimaryAction;
            hasPrimaryAction ||= primary;

            return (
              <button
                className={cx(
                  styles.action,
                  primary ? styles.primaryAction : styles.secondaryAction,
                )}
                data-testid={primary ? 'mobile-state-primary-action' : undefined}
                key={index}
                type="button"
                onClick={stateAction.onClick}
              >
                {stateAction.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

export default MobileStateView;
