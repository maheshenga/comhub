import { memo } from 'react';

import { formatModuleAppRunPreview } from './runtimeHelpers';

interface RunResultPanelProps {
  run?: {
    artifactIds?: string[];
    billing?: { chargedCredits?: number };
    preview?: string;
    status: string;
  } | null;
}

const RunResultPanel = memo<RunResultPanelProps>(({ run }) => {
  if (!run) {
    return <div data-testid="module-app-run-result">No run result</div>;
  }

  return (
    <section data-testid="module-app-run-result">
      <div>{formatModuleAppRunPreview(run)}</div>
      <div>Status: {run.status}</div>
      <div>Credits: {run.billing?.chargedCredits ?? 0}</div>
      <div>Artifacts: {run.artifactIds?.length ?? 0}</div>
    </section>
  );
});

RunResultPanel.displayName = 'RunResultPanel';

export default RunResultPanel;
