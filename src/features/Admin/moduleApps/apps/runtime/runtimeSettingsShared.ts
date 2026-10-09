'use client';

import { createStaticStyles, cssVar } from 'antd-style';

export const runtimeSettingsStyles = createStaticStyles(({ css }) => ({
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  description: css`
    margin: 0;
    color: ${cssVar.colorTextSecondary};
  `,
  field: css`
    display: grid;
    gap: 6px;
    min-width: 0;
  `,
  fieldGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  `,
  input: css`
    width: 100%;
    min-width: 0;
    height: 36px;
    padding-inline: 10px;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: 6px;

    color: ${cssVar.colorText};

    background: ${cssVar.colorBgContainer};
    outline: none;

    &:focus-visible {
      border-color: ${cssVar.colorPrimary};
      box-shadow: 0 0 0 2px ${cssVar.colorPrimaryBg};
    }

    &:disabled {
      cursor: not-allowed;
      color: ${cssVar.colorTextDisabled};
      background: ${cssVar.colorBgContainerDisabled};
    }
  `,
  label: css`
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  notice: css`
    margin: 0;
    padding-block: 10px;
    padding-inline: 12px;
    border-inline-start: 3px solid ${cssVar.colorWarning};

    color: ${cssVar.colorText};

    background: ${cssVar.colorWarningBg};
  `,
  panel: css`
    display: grid;
    gap: 18px;
  `,
  secretHint: css`
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  switchGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 0 20px;
  `,
  switchRow: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    align-items: center;

    min-height: 64px;
    padding-block: 10px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  switchText: css`
    display: grid;
    gap: 3px;

    strong {
      font-size: 14px;
      font-weight: 600;
    }

    span {
      font-size: 12px;
      color: ${cssVar.colorTextSecondary};
    }
  `,
}));

export type RuntimeSettingsForm = {
  executionEnabled: boolean;
  internalToken: string;
  internalUrl: string;
  invocationEnabled: boolean;
  publicExecutionEnabled: boolean;
  publicOrigin: string;
  scheduleDispatchEnabled: boolean;
  workflowPrivilegedExecutorsEnabled: boolean;
};

/** 保存负载组装（M5 拆页：从 ModuleAppRuntimeSettings 抽出）。 */
export const buildRuntimeSettingUpdates = (
  values: RuntimeSettingsForm,
  keys: typeof import('@/const/appSettingsRegistry').APP_SETTING_KEYS,
) => [
  { key: keys.moduleAppExecutionEnabled, value: values.executionEnabled },
  { key: keys.moduleAppPublicExecutionEnabled, value: values.publicExecutionEnabled },
  { key: keys.moduleAppRuntimeInvocationEnabled, value: values.invocationEnabled },
  { key: keys.moduleAppScheduleDispatchEnabled, value: values.scheduleDispatchEnabled },
  { key: keys.moduleAppWorkflowPrivilegedExecutorsEnabled, value: values.workflowPrivilegedExecutorsEnabled },
  { key: keys.moduleAppRuntimeInternalUrl, value: values.internalUrl },
  { key: keys.moduleAppRuntimePublicOrigin, value: values.publicOrigin },
  ...(values.internalToken.trim()
    ? [{ key: keys.moduleAppRuntimeInternalToken, value: values.internalToken }]
    : []),
];
