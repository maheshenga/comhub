'use client';

import { Navigate } from 'react-router';

const NotificationsPage = () =>
  <Navigate replace to="/settings/admin/content-operations?tab=notifications" />;

export default NotificationsPage;
