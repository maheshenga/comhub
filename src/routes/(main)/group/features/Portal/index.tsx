import { Suspense } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';
import Portal from '@/routes/(main)/agent/features/Portal/features/Portal';
import PortalPanel from '@/routes/(main)/agent/features/Portal/features/PortalPanel';

const ChatPortal = ({ mobile = false }: { mobile?: boolean }) => {
  return (
    <Portal>
      <Suspense fallback={<Loading debugId={'ChatPortal'} />}>
        <PortalPanel mobile={mobile} />
      </Suspense>
    </Portal>
  );
};

export default ChatPortal;
