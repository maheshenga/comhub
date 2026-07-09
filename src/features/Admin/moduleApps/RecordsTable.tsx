import { memo } from 'react';

interface ModuleAppRecordRow {
  collectionKey: string;
  id: string;
  scopeType: string;
  status?: string;
  title?: null | string;
  updatedAt?: Date | string;
}

interface RecordsTableProps {
  items?: ModuleAppRecordRow[];
  loading?: boolean;
}

const RecordsTable = memo<RecordsTableProps>(({ items = [], loading }) => {
  if (loading) {
    return <div data-testid="admin-module-app-records">Loading records</div>;
  }

  if (items.length === 0) {
    return <div data-testid="admin-module-app-records">No records</div>;
  }

  return (
    <table data-testid="admin-module-app-records">
      <thead>
        <tr>
          <th>Record</th>
          <th>Collection</th>
          <th>Scope</th>
          <th>Status</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.title ?? item.id}</td>
            <td>{item.collectionKey}</td>
            <td>{item.scopeType}</td>
            <td>{item.status ?? '-'}</td>
            <td>{item.updatedAt ? String(item.updatedAt) : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});

RecordsTable.displayName = 'RecordsTable';

export default RecordsTable;
