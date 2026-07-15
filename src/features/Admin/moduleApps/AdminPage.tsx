'use client';

import { lazy, memo, Suspense } from 'react';

import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { getModuleAppAdminSurface } from './access';

const ModuleAppFinancePage = lazy(() => import('./FinancePage'));
const ModuleAppGovernancePage = lazy(() => import('./index'));

const AdminModuleAppsPage = memo(() => {
  const user = useUserStore(userProfileSelectors.userProfile);
  const role = (user as { role?: string } | undefined)?.role;
  const surface = getModuleAppAdminSurface(role);

  if (surface === 'none') return null;

  return (
    <Suspense fallback={null}>
      {surface === 'finance' ? <ModuleAppFinancePage /> : <ModuleAppGovernancePage />}
    </Suspense>
  );
});

AdminModuleAppsPage.displayName = 'AdminModuleAppsPage';

export default AdminModuleAppsPage;
