import {
  type SubscriptionChangeRequestItem,
  type SubscriptionChangeRequestStatusType,
  type TopUpOrderHistoryItem,
  type TopUpOrderStatusType,
} from '@/types/business';

export type BillingHistoryItem = {
  amount: null | number;
  createdAt: Date;
  credits?: number;
  currency?: string;
  id: string;
  kind: 'subscription' | 'topup';
  rowKey: string;
  status: SubscriptionChangeRequestStatusType | TopUpOrderStatusType;
  title: string;
};

export const buildBillingHistoryItems = ({
  subscriptionChanges,
  topUpOrders,
}: {
  subscriptionChanges: SubscriptionChangeRequestItem[];
  topUpOrders: TopUpOrderHistoryItem[];
}): BillingHistoryItem[] => {
  const subscriptionItems: BillingHistoryItem[] = subscriptionChanges.map((item) => ({
    amount: null,
    createdAt: item.createdAt,
    id: item.id,
    kind: 'subscription',
    rowKey: `subscription:${item.id}`,
    status: item.status,
    title: `${item.fromPlan} -> ${item.toPlan}`,
  }));

  const topUpItems: BillingHistoryItem[] = topUpOrders.map((item) => ({
    amount: item.amount,
    createdAt: item.paidAt ?? item.createdAt,
    credits: item.credits,
    currency: item.currency,
    id: item.id,
    kind: 'topup',
    rowKey: `topup:${item.id}`,
    status: item.status,
    title: '积分包',
  }));

  return [...subscriptionItems, ...topUpItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};
