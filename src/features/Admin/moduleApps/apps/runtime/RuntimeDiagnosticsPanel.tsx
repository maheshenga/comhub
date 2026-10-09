'use client';

import { Button } from '@lobehub/ui/base-ui';
import { ArrowRight, Play, RefreshCw } from 'lucide-react';
import { type ReactNode } from 'react';
import { Link } from 'react-router';

import { ADMIN_BASE_PATH } from '@/features/Admin/adminCatalog';

import type { DiagnosticRow, DiagnosticTone } from './runtimeDiagnostics';
import { runtimeStyles as styles } from './runtimeStyles';

type TFn = (key: any, options?: Record<string, unknown>) => string;

const DiagnosticStatus = ({ label, tone }: { label: string; tone: DiagnosticTone }) => (
  <span className={styles.diagnosticStatus} data-tone={tone}>
    <span aria-hidden className={styles.diagnosticStatusDot} />
    {label}
  </span>
);

const DiagnosticGrid = ({ rows }: { rows: DiagnosticRow[] }) => (
  <dl className={styles.diagnosticGrid}>
    {rows.map((item) => (
      <div className={styles.diagnosticItem} key={item.label}>
        <dt className={styles.diagnosticLabel}>{item.label}</dt>
        <dd>
          <DiagnosticStatus {...item.status} />
        </dd>
      </div>
    ))}
  </dl>
);

export interface RuntimeDiagnosticsPanelProps {
  canWrite: boolean;
  diagnosticsData: DiagnosticsShape;
  dispatchingSchedules: boolean;
  gatewayRows: DiagnosticRow[];
  onRefresh: () => void;
  onScheduleDispatch: () => void;
  runtimeRows: DiagnosticRow[];
  schedulerRows: DiagnosticRow[];
  t: TFn;
}

interface DiagnosticsShape {
  probe: { code?: null | string; status: string };
  switches: { scheduleDispatchEnabled: boolean };
}

/** 运行时诊断面板主体（M5 拆页：从 ModuleAppRuntimePage 抽出）。 */
export const RuntimeDiagnosticsPanel = ({
  canWrite,
  diagnosticsData,
  dispatchingSchedules,
  gatewayRows,
  onRefresh,
  onScheduleDispatch,
  runtimeRows,
  schedulerRows,
  t,
}: RuntimeDiagnosticsPanelProps): ReactNode => (
  <>
    <header className={styles.header}>
      <div>
        <h2>{t('moduleApps.admin.runtime.diagnostics.title')}</h2>
        <p>{t('moduleApps.admin.runtime.diagnostics.description')}</p>
      </div>
      <Button
        icon={RefreshCw}
        title={t('moduleApps.admin.runtime.diagnostics.refresh')}
        onClick={onRefresh}
      />
    </header>
    <DiagnosticGrid rows={runtimeRows} />
    <div className={styles.diagnosticGroup}>
      <header className={styles.header}>
        <div>
          <h3>{t('moduleApps.admin.runtime.diagnostics.schedulerTitle')}</h3>
          <p>{t('moduleApps.admin.runtime.diagnostics.schedulerDescription')}</p>
        </div>
        {canWrite ? (
          <Button
            disabled={dispatchingSchedules || !diagnosticsData.switches.scheduleDispatchEnabled}
            icon={Play}
            loading={dispatchingSchedules}
            title={
              diagnosticsData.switches.scheduleDispatchEnabled
                ? t('moduleApps.admin.runtime.diagnostics.dispatchNow')
                : t('moduleApps.admin.runtime.diagnostics.dispatchNowDisabled')
            }
            onClick={onScheduleDispatch}
          >
            {t('moduleApps.admin.runtime.diagnostics.dispatchNow')}
          </Button>
        ) : null}
      </header>
      <DiagnosticGrid rows={schedulerRows} />
    </div>
    <div className={styles.diagnosticGroup}>
      <header>
        <h3>{t('moduleApps.admin.runtime.diagnostics.platformGatewaysTitle')}</h3>
        <p>{t('moduleApps.admin.runtime.diagnostics.platformGatewaysDescription')}</p>
      </header>
      <DiagnosticGrid rows={gatewayRows} />
      <nav
        aria-label={t('moduleApps.admin.runtime.diagnostics.gatewayManagement')}
        className={styles.diagnosticActions}
      >
        <Link className={styles.diagnosticAction} to={`${ADMIN_BASE_PATH}/providers`}>
          {t('moduleApps.admin.runtime.diagnostics.manageProviders')}
          <ArrowRight aria-hidden size={15} />
        </Link>
        <Link className={styles.diagnosticAction} to={`${ADMIN_BASE_PATH}/payments`}>
          {t('moduleApps.admin.runtime.diagnostics.managePayments')}
          <ArrowRight aria-hidden size={15} />
        </Link>
      </nav>
    </div>
    {diagnosticsData.probe.status === 'unavailable' ? (
      <p className={styles.diagnosticCode} role="status">
        {t('moduleApps.admin.runtime.diagnostics.failureCode', {
          code: diagnosticsData.probe.code,
        })}
      </p>
    ) : null}
  </>
);
