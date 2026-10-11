import { render, screen } from '@testing-library/react';
import { type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import ArtifactsTable from './ArtifactsTable';
import AuditEventsTable from './AuditEventsTable';
import InstallsTable from './InstallsTable';
import RecordsTable from './RecordsTable';
import RunsTable from './RunsTable';

describe('module app admin operational tables', () => {
  it('renders installs', () => {
    render(
      <InstallsTable
        items={[{ id: 'install-1', scopeType: 'personal', status: 'installed', userId: 'user-1' }]}
      />,
    );

    expect(screen.getByText('install-1')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
  });

  it('accepts localized operational column labels', () => {
    render(
      <InstallsTable
        items={[{ id: 'install-1', scopeType: 'personal', status: 'installed' }]}
        labels={{ install: '安装', status: '状态' }}
      />,
    );

    expect(screen.getByRole('columnheader', { name: '安装' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '状态' })).toBeInTheDocument();
  });

  it('renders audit events', () => {
    render(
      <AuditEventsTable
        items={[{ actorUserId: 'admin-1', eventType: 'module_app.upserted', id: 'audit-1' }]}
      />,
    );

    expect(screen.getByText('module_app.upserted')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
  });

  it('renders record rows', () => {
    render(
      <RecordsTable
        items={[
          { collectionKey: 'records', id: 'record-1', scopeType: 'personal', status: 'active' },
        ]}
      />,
    );

    expect(screen.getByText('record-1')).toBeInTheDocument();
  });

  it('renders run rows', () => {
    render(<RunsTable items={[{ id: 'run-1', status: 'succeeded' }]} />);

    expect(screen.getByText('run-1')).toBeInTheDocument();
    expect(screen.getByText('succeeded')).toBeInTheDocument();
  });

  it('renders artifact rows', () => {
    render(
      <ArtifactsTable
        items={[
          {
            fileName: 'result.md',
            id: 'artifact-1',
            mimeType: 'text/markdown',
            scopeType: 'personal',
            storageKey: 'module-apps/app-1/result.md',
          },
        ]}
      />,
    );

    expect(screen.getByText('result.md')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
    expect(screen.getByText('module-apps/app-1/result.md')).toBeInTheDocument();
  });

  // 无障碍滚动区是这批迁移的核心收益：裸 <table> 没有 role="region"，键盘用户
  // 无法聚焦到横向滚动的容器。必须用 role 断言——空态与 loading 共用同一个
  // data-testid，用 testid 断言锁不住无障碍语义。
  it.each([
    ['installs', InstallsTable, { id: 'install-1', scopeType: 'personal' }],
    ['runs', RunsTable, { id: 'run-1', status: 'succeeded' }],
    ['records', RecordsTable, { collectionKey: 'records', id: 'record-1', scopeType: 'personal' }],
    ['artifacts', ArtifactsTable, { id: 'artifact-1', scopeType: 'personal' }],
    ['audit events', AuditEventsTable, { eventType: 'module_app.upserted', id: 'audit-1' }],
  ])('exposes %s as a labelled scroll region', (_name, Table, item) => {
    const Component = Table as (props: { items: unknown[]; regionLabel: string }) => ReactElement;

    render(<Component items={[item]} regionLabel={`${_name} table`} />);

    expect(screen.getByRole('region', { name: `${_name} table` })).toBeInTheDocument();
  });
});
