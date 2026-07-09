import { memo } from 'react';

interface ModuleAppAuditRow {
  actorUserId?: null | string;
  createdAt?: Date | string;
  eventType: string;
  id: string;
}

interface AuditEventsTableProps {
  items?: ModuleAppAuditRow[];
  loading?: boolean;
}

const formatDate = (value?: Date | string) => (value ? String(value) : '-');

const AuditEventsTable = memo<AuditEventsTableProps>(({ items = [], loading }) => {
  if (loading) return <div data-testid="admin-module-app-audit-events">Loading audit events</div>;
  if (items.length === 0) return <div data-testid="admin-module-app-audit-events">No audit events</div>;

  return (
    <table data-testid="admin-module-app-audit-events">
      <thead>
        <tr>
          <th>Audit</th>
          <th>Event</th>
          <th>Actor</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item.eventType}</td>
            <td>{item.actorUserId ?? '-'}</td>
            <td>{formatDate(item.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});

AuditEventsTable.displayName = 'AuditEventsTable';

export default AuditEventsTable;
