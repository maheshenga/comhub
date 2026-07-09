import { render, screen } from '@testing-library/react';
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
      <ArtifactsTable items={[{ fileName: 'result.md', id: 'artifact-1', mimeType: 'text/markdown' }]} />,
    );

    expect(screen.getByText('result.md')).toBeInTheDocument();
  });
});
