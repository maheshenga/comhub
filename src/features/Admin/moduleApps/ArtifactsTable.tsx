import { memo } from 'react';

interface ModuleAppArtifactRow {
  artifactType?: null | string;
  fileName?: null | string;
  id: string;
  storageUrl?: null | string;
}

interface ArtifactsTableProps {
  items?: ModuleAppArtifactRow[];
}

const ArtifactsTable = memo<ArtifactsTableProps>(({ items = [] }) => {
  if (items.length === 0) {
    return <div data-testid="admin-module-app-artifacts">No artifacts</div>;
  }

  return (
    <table data-testid="admin-module-app-artifacts">
      <thead>
        <tr>
          <th>Artifact</th>
          <th>Type</th>
          <th>File</th>
          <th>Storage</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item.artifactType ?? '-'}</td>
            <td>{item.fileName ?? '-'}</td>
            <td>{item.storageUrl ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});

ArtifactsTable.displayName = 'ArtifactsTable';

export default ArtifactsTable;
