'use client';

import { useTranslation } from 'react-i18next';

import { AdminPageState } from '../shared';

/**
 * First-use empty state for the desktop build profile tab (AdminPageState
 * `isEmpty` shape). Extracted from BuildProfilePage so that file stays inside
 * the Admin 300-line budget.
 */
export const BuildProfileEmptyState = ({ onCreate }: { onCreate: () => void }) => {
  const { t } = useTranslation('subscription');

  return (
    <AdminPageState
      isEmpty
      emptyDescription={t('admin.desktopBuild.emptyDescription')}
      emptyTitle={t('admin.desktopBuild.empty')}
      primaryAction={{ label: t('admin.desktopBuild.profile.create'), onClick: onCreate }}
    >
      {null}
    </AdminPageState>
  );
};

export default BuildProfileEmptyState;
