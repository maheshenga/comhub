'use client';

import { type ReactNode } from 'react';
import { Outlet } from 'react-router';

import MobileContentLayout from '@/components/server/MobileNavLayout';

const MobilePageLayout = ({ children, header }: { children?: ReactNode; header?: ReactNode }) => (
  <MobileContentLayout withNav header={header}>
    {children ?? <Outlet />}
  </MobileContentLayout>
);

export default MobilePageLayout;
