import { Icon } from '@lobehub/ui';
import { type ItemType } from 'antd/es/menu/interface';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

export default function useBusinessMenuItems(isSignin: boolean | undefined): ItemType[] {
  const { t } = useTranslation('subscription');
  const user = useUserStore(userProfileSelectors.userProfile);
  const role = (user as any)?.role as string | undefined;

  if (!isSignin || role !== 'admin') return [];

  return [
    {
      type: 'divider',
    },
    {
      icon: <Icon icon={ShieldCheck} />,
      key: 'admin-console',
      label: <Link to="/settings/admin">{t('admin.console', 'Admin Console')}</Link>,
    },
  ].filter(Boolean) as ItemType[];
}
