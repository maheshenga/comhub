'use client';

import { memo } from 'react';
import { useOutletContext } from 'react-router';

import ProductManager from '../../ProductManager';
import type { ModuleAppDetailOutletContext } from '../../layouts/ModuleAppDetailLayout';

const ModuleAppProductsPage = memo(() => {
  const { app } = useOutletContext<ModuleAppDetailOutletContext>();

  return <ProductManager appId={app.id} />;
});

ModuleAppProductsPage.displayName = 'ModuleAppProductsPage';

export default ModuleAppProductsPage;
