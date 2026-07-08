import { memo } from 'react';
import { useParams } from 'react-router';

const ModuleAppDetail = memo(() => {
  const { appId } = useParams();

  return <div data-testid="module-app-detail">Module App {appId}</div>;
});

ModuleAppDetail.displayName = 'ModuleAppDetail';

export default ModuleAppDetail;
