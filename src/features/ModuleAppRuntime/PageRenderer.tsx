import type { ModuleAppLaunchContext } from '@lobechat/types';
import { memo } from 'react';

import SandboxFrame from './SandboxFrame';

interface PageRendererProps {
  context: ModuleAppLaunchContext;
}

const PageRenderer = memo<PageRendererProps>(({ context }) => (
  <SandboxFrame context={context} title={context.displayName} />
));

PageRenderer.displayName = 'PageRenderer';

export default PageRenderer;
