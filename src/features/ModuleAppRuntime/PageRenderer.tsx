import { memo } from 'react';

const PageRenderer = memo(() => {
  return <div data-testid="module-app-page-renderer" />;
});

PageRenderer.displayName = 'PageRenderer';

export default PageRenderer;
