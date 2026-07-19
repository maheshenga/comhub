import { type PropsWithChildren } from 'react';

import MobileContentLayout from '@/components/server/MobileNavLayout';

import SessionHeader from './SessionHeader';

const MobileLayout = ({ children }: PropsWithChildren) => {
  return (
    <MobileContentLayout withNav header={<SessionHeader />}>
      {children}
    </MobileContentLayout>
  );
};

export default MobileLayout;
