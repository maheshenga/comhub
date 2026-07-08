import { memo } from 'react';

interface ModuleAppRunRow {
  actionId?: null | string;
  createdAt?: Date | string;
  id: string;
  status: string;
}

interface RunsTableProps {
  items?: ModuleAppRunRow[];
}

const RunsTable = memo<RunsTableProps>(({ items = [] }) => {
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
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item.actionId ?? '-'}</td>
            <td>{item.status}</td>
            <td>{item.createdAt ? String(item.createdAt) : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});

RunsTable.displayName = 'RunsTable';

export default RunsTable;
