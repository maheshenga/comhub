'use client';

import type { ModuleAppRuntimeDiagnostics } from '../../types';

export type DiagnosticTone = 'negative' | 'neutral' | 'positive' | 'warning';

export type DiagnosticStatusValue = { label: string; tone: DiagnosticTone };

export type DiagnosticRow = { label: string; status: DiagnosticStatusValue };

type TFn = (key: any, options?: Record<string, unknown>) => string;

export interface BuildDiagnosticRowsParams {
  diagnostics: ModuleAppRuntimeDiagnostics;
  t: TFn;
}

const enabledStatus = (t: TFn, enabled: boolean): DiagnosticStatusValue => ({
  label: t(
    enabled
      ? 'moduleApps.admin.runtime.diagnostics.status.enabled'
      : 'moduleApps.admin.runtime.diagnostics.status.disabled',
  ),
  tone: enabled ? 'positive' : 'neutral',
});

const configuredStatus = (t: TFn, configured: boolean): DiagnosticStatusValue => ({
  label: t(
    configured
      ? 'moduleApps.admin.runtime.diagnostics.status.configured'
      : 'moduleApps.admin.runtime.diagnostics.status.missing',
  ),
  tone: configured ? 'positive' : 'warning',
});

const unavailableStatus = (t: TFn): DiagnosticStatusValue => ({
  label: t('moduleApps.admin.runtime.diagnostics.status.unavailable'),
  tone: 'negative',
});

const countStatus = (
  t: TFn,
  value: null | number | undefined,
  tone: (value: number) => DiagnosticTone,
): DiagnosticStatusValue =>
  value === null || value === undefined
    ? unavailableStatus(t)
    : { label: new Intl.NumberFormat().format(value), tone: tone(value) };

const formatDiagnosticDate = (value: Date | null | string | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

/** 调度器诊断行（scheduler 子组）。 */
export const buildSchedulerDiagnosticRows = ({
  diagnostics,
  t,
}: BuildDiagnosticRowsParams): DiagnosticRow[] => {
  const scheduler = diagnostics.scheduler;
  if (!scheduler) return [];

  if (scheduler.status !== 'available') {
    return [
      {
        label: t('moduleApps.admin.runtime.diagnostics.schedulerStatus'),
        status: unavailableStatus(t),
      },
    ];
  }

  return [
    {
      label: t('moduleApps.admin.runtime.diagnostics.schedulerStatus'),
      status: { label: t('moduleApps.admin.runtime.diagnostics.status.available'), tone: 'positive' },
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.enabledSchedules'),
      status: countStatus(t, scheduler.enabledSchedules, () => 'neutral'),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.claimableSchedules'),
      status: countStatus(t, scheduler.claimableSchedules, (value) =>
        value > 0 ? 'warning' : 'positive',
      ),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.activeClaims'),
      status: countStatus(t, scheduler.activeClaims, () => 'neutral'),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.staleClaims'),
      status: countStatus(t, scheduler.staleClaims, (value) =>
        value > 0 ? 'negative' : 'positive',
      ),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.oldestClaimableAt'),
      status: scheduler.oldestClaimableAt
        ? {
            label:
              formatDiagnosticDate(scheduler.oldestClaimableAt) ??
              t('moduleApps.admin.runtime.diagnostics.status.unavailable'),
            tone: 'warning',
          }
        : {
            label: t('moduleApps.admin.runtime.diagnostics.status.noBacklog'),
            tone: 'positive',
          },
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.lastScheduledRunAt'),
      status: scheduler.lastScheduledRunAt
        ? {
            label:
              formatDiagnosticDate(scheduler.lastScheduledRunAt) ??
              t('moduleApps.admin.runtime.diagnostics.status.unavailable'),
            tone: 'neutral',
          }
        : {
            label: t('moduleApps.admin.runtime.diagnostics.status.never'),
            tone: 'warning',
          },
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.failedScheduledRuns24h'),
      status: countStatus(t, scheduler.failedScheduledRuns24h, (value) =>
        value > 0 ? 'negative' : 'positive',
      ),
    },
  ];
};

/** 运行时开关与配置诊断行（主组）。 */
export const buildRuntimeDiagnosticRows = ({
  diagnostics,
  t,
}: BuildDiagnosticRowsParams): DiagnosticRow[] => {
  const probeStatus: DiagnosticStatusValue = {
    label: t(`moduleApps.admin.runtime.diagnostics.status.${diagnostics.probe.status}`),
    tone:
      diagnostics.probe.status === 'ready'
        ? 'positive'
        : diagnostics.probe.status === 'unavailable'
          ? 'negative'
          : 'neutral',
  };

  return [
    { label: t('moduleApps.admin.runtime.diagnostics.probe'), status: probeStatus },
    {
      label: t('moduleApps.admin.runtime.diagnostics.execution'),
      status: enabledStatus(t, diagnostics.switches.executionEnabled),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.publicExecution'),
      status: enabledStatus(t, diagnostics.switches.publicExecutionEnabled),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.invocation'),
      status: enabledStatus(t, diagnostics.switches.invocationEnabled),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.scheduleDispatch'),
      status: enabledStatus(t, diagnostics.switches.scheduleDispatchEnabled),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.workflowExecutors'),
      status: enabledStatus(t, diagnostics.switches.workflowPrivilegedExecutorsEnabled),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.internalUrl'),
      status: configuredStatus(t, diagnostics.configuration.internalUrlConfigured),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.internalToken'),
      status: configuredStatus(t, diagnostics.configuration.internalTokenConfigured),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.publicOrigin'),
      status: configuredStatus(t, diagnostics.configuration.publicOriginConfigured),
    },
  ];
};

/** 平台网关诊断行（网关子组）。 */
export const buildGatewayDiagnosticRows = ({
  diagnostics,
  t,
}: BuildDiagnosticRowsParams): DiagnosticRow[] => {
  const enabledChatModelCount = diagnostics.platformGateways.ai.enabledChatModelCount ?? 0;
  const paymentMethods = diagnostics.platformGateways.payments.methods ?? [];
  const paymentSource = diagnostics.platformGateways.payments.source;

  const paymentMethodStatus: DiagnosticStatusValue = {
    label:
      paymentMethods.length > 0
        ? paymentMethods.map((method) => t(`moduleApps.purchase.methods.${method}`)).join(', ')
        : t('moduleApps.admin.runtime.diagnostics.status.missing'),
    tone: paymentMethods.length > 0 ? 'positive' : 'warning',
  };

  const paymentSourceStatus: DiagnosticStatusValue = {
    label: paymentSource?.backendManaged
      ? t('moduleApps.admin.runtime.diagnostics.paymentSource.backend')
      : t('moduleApps.admin.runtime.diagnostics.paymentSource.legacyEnvironment', {
          count: paymentSource?.legacyEnvironmentKeyCount ?? 0,
        }),
    tone: paymentSource?.backendManaged ? 'positive' : 'warning',
  };

  return [
    {
      label: t('moduleApps.admin.runtime.diagnostics.managedAiModels'),
      status: {
        label: t('moduleApps.admin.runtime.diagnostics.enabledChatModels', {
          count: enabledChatModelCount,
        }),
        tone: enabledChatModelCount > 0 ? 'positive' : 'warning',
      },
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.paymentGateway'),
      status: configuredStatus(t, diagnostics.platformGateways.payments.configured),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.paymentConfigurationSource'),
      status: paymentSourceStatus,
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.paymentSystem'),
      status: enabledStatus(t, diagnostics.platformGateways.payments.enabled),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.modulePayments'),
      status: enabledStatus(t, diagnostics.platformGateways.payments.moduleAppEnabled),
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.paymentMethods'),
      status: paymentMethodStatus,
    },
    {
      label: t('moduleApps.admin.runtime.diagnostics.paymentCallbackOrigin'),
      status: configuredStatus(t, diagnostics.platformGateways.payments.publicOriginConfigured),
    },
  ];
};
