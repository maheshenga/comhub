'use client';

import { AdminPagePlaceholder } from '@/features/Admin';

const AdminOrdersPage = () => (
  <AdminPagePlaceholder
    title={'Orders Disabled'}
    description={'Online payment orders are disabled. Use redemption codes to grant plans or credits.'}
  />
);

AdminOrdersPage.displayName = 'AdminOrdersPage';

export default AdminOrdersPage;
