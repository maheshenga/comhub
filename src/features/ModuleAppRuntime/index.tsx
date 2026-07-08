import { memo } from 'react';
import { useParams } from 'react-router';

const ModuleAppRuntime = memo(() => {
  const { appId, pageKey } = useParams();

  return (
    <div data-testid="module-app-runtime">
      Module App Runtime {appId}
      {pageKey ? ` / ${pageKey}` : ''}
    </div>
  );
});

ModuleAppRuntime.displayName = 'ModuleAppRuntime';

export default ModuleAppRuntime;
