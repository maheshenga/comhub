'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';

import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import type { ModuleAppDetailOutletContext } from '../../layouts/ModuleAppDetailLayout';
import ProductManager from '../../ProductManager';
import { detailSubPageStyles as styles } from '../detailSubPageStyles';

const ModuleAppProductsPage = memo(() => {
  const { t } = useTranslation('common');
  const { app } = useOutletContext<ModuleAppDetailOutletContext>();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canWrite = hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppWrite);

  return (
    <section className={styles.page} data-testid="module-app-products">
      <header className={styles.header} data-testid="module-app-products-header">
        <div>
          <h2 className={styles.title}>{t('moduleApps.admin.products.title')}</h2>
          <p className={styles.description}>{t('moduleApps.admin.products.description')}</p>
        </div>
      </header>
      <ProductManager appId={app.id} canWrite={canWrite} />
    </section>
  );
});

ModuleAppProductsPage.displayName = 'ModuleAppProductsPage';

export default ModuleAppProductsPage;
