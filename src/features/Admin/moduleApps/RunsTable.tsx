import { memo } from 'react';

interface ModuleAppRunRow {
  actionId?: null | string;
  createdAt?: Date | string;
  durationMs?: null | number;
  errorType?: null | string;
  id: string;
  status: string;
}

interface RunsTableProps {
  items?: ModuleAppRunRow[];
  loading?: boolean;
}

const RunsTable = memo<RunsTableProps>(({ items = [], loading }) => {
  if (loading) {
    return <div data-testid="admin-module-app-runs">Loading runs</div>;
  }

  if (items.length === 0) {
    return <div data-testid="admin-module-app-runs">No runs</div>;
  }

  return (
    <table data-testid="admin-module-app-runs">
      <thead>
        <tr>
          <th>Run</th>
          <th>Action</th>
          <th>Status</th>
          <th>Error</th>
          <th>Duration</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item.actionId ?? '-'}</td>
            <td>{item.status}</td>
            <td>{item.errorType ?? '-'}</td>
            <td>{item.durationMs === undefined || item.durationMs === null ? '-' : `${item.durationMs}ms`}</td>
            <td>{item.createdAt ? String(item.createdAt) : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});

RunsTable.displayName = 'RunsTable';

export default RunsTable;
