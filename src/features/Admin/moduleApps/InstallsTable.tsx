import { memo } from 'react';

interface ModuleAppInstallRow {
  id: string;
  installedAt?: Date | string;
  scopeType?: string;
  status?: string;
  userId?: null | string;
  workspaceId?: null | string;
}

interface InstallsTableProps {
  items?: ModuleAppInstallRow[];
  loading?: boolean;
}

const formatDate = (value?: Date | string) => (value ? String(value) : '-');

const InstallsTable = memo<InstallsTableProps>(({ items = [], loading }) => {
  if (loading) return <div data-testid="admin-module-app-installs">Loading installs</div>;
  if (items.length === 0) return <div data-testid="admin-module-app-installs">No installs</div>;

  return (
    <table data-testid="admin-module-app-installs">
      <thead>
        <tr>
          <th>Install</th>
          <th>Scope</th>
          <th>Status</th>
          <th>User</th>
          <th>Workspace</th>
          <th>Installed</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item.scopeType ?? '-'}</td>
            <td>{item.status ?? '-'}</td>
            <td>{item.userId ?? '-'}</td>
            <td>{item.workspaceId ?? '-'}</td>
            <td>{formatDate(item.installedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});

InstallsTable.displayName = 'InstallsTable';

export default InstallsTable;
