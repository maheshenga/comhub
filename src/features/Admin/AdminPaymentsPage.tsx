'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Tabs } from '@lobehub/ui/base-ui';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { AdminPageShell } from './layout';
import ModulePaymentsPage from './moduleApps/finance/payments/ModulePaymentsPage';
import ChannelSettings from './PaymentChannels/ChannelSettings';
import CreditSettlementFailuresPage from './payments/CreditSettlementFailuresPage';
import SubscriptionPaymentsPage from './payments/SubscriptionPaymentsPage';
import TopUpPaymentsPage from './payments/TopUpPaymentsPage';
import { useUnsavedChangesGuard } from './shared/useUnsavedChangesGuard';

type PaymentCenterTab = 'channels' | 'moduleApps' | 'settlements' | 'subscriptions' | 'topups';

const PAYMENT_CENTER_TABS = new Set<PaymentCenterTab>([
  'channels',
  'subscriptions',
  'topups',
  'moduleApps',
  'settlements',
]);

const AdminPaymentsPage = () => {
  const { t } = useTranslation('subscription');
  const [searchParams, setSearchParams] = useSearchParams();
  const [channelDirty, setChannelDirty] = useState(false);
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canViewChannels = hasAdminCapability(role, ADMIN_CAPABILITIES.systemRead);
  const canViewFinance = hasAdminCapability(role, ADMIN_CAPABILITIES.financeRead);
  const requestedTab = searchParams.get('tab') as PaymentCenterTab | null;
  const allowedTabs = new Set<PaymentCenterTab>([
    ...(canViewChannels ? (['channels'] as const) : []),
    ...(canViewFinance ? (['subscriptions', 'topups', 'moduleApps', 'settlements'] as const) : []),
  ]);
  const defaultTab: PaymentCenterTab = canViewChannels ? 'channels' : 'topups';
  const activeTab = requestedTab && allowedTabs.has(requestedTab) ? requestedTab : defaultTab;

  useUnsavedChangesGuard({
    cancelText: t('admin.payments.unsaved.cancel', 'Continue editing'),
    confirmText: t('admin.payments.unsaved.confirm', 'Discard changes'),
    isDirty: channelDirty && activeTab === 'channels',
    message: t(
      'admin.payments.unsaved.message',
      'The payment channel form has unsaved changes. Discard them and leave this page?',
    ),
    title: t('admin.payments.unsaved.title', 'Discard payment changes?'),
  });

  const changeTab = (key: string) => {
    if (
      !PAYMENT_CENTER_TABS.has(key as PaymentCenterTab) ||
      !allowedTabs.has(key as PaymentCenterTab)
    )
      return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', key);
      return next;
    });
  };

  const tabItems = [
    canViewChannels
      ? {
          children: <ChannelSettings onDirtyChange={setChannelDirty} />,
          key: 'channels' as const,
          label: t('admin.payments.tabs.channels', 'Channel configuration'),
        }
      : null,
    canViewFinance
      ? {
          children: <SubscriptionPaymentsPage />,
          key: 'subscriptions' as const,
          label: t('admin.payments.tabs.subscriptions', 'Plan transactions'),
        }
      : null,
    canViewFinance
      ? {
          children: <TopUpPaymentsPage />,
          key: 'topups' as const,
          label: t('admin.payments.tabs.topups', 'Top-up transactions'),
        }
      : null,
    canViewFinance
      ? {
          children: <ModulePaymentsPage embedded />,
          key: 'moduleApps' as const,
          label: t('admin.payments.tabs.moduleApps', 'Module payments'),
        }
      : null,
    canViewFinance
      ? {
          children: <CreditSettlementFailuresPage />,
          key: 'settlements' as const,
          label: t('admin.payments.tabs.settlements', 'Settlement failures'),
        }
      : null,
  ].filter(Boolean) as Array<{ children: ReactNode; key: PaymentCenterTab; label: string }>;

  return (
    <AdminPageShell
      title={t('admin.payments.title', 'Payment center')}
      width="full"
      description={t(
        'admin.payments.subtitle',
        'Manage payment methods, plan purchases, online top-ups, and module-payment diagnostics.',
      )}
    >
      <Tabs activeKey={activeTab} items={tabItems} onChange={changeTab} />
    </AdminPageShell>
  );
};

export default AdminPaymentsPage;
