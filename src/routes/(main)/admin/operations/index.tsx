'use client';

import { Navigate } from 'react-router';

const OperationsPage = () =>
  <Navigate replace to="/settings/admin/content-operations?tab=operations" />;

export default OperationsPage;
