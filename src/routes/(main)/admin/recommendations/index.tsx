'use client';

import { Navigate } from 'react-router';

const RecommendationsPage = () =>
  <Navigate replace to="/settings/admin/content-operations?tab=recommendations" />;

export default RecommendationsPage;
