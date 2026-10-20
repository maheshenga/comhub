import { createStaticStyles } from '@lobehub/ui';

export const modulePaymentStyles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  controls: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  form: css`
    display: grid;
    gap: 12px;
  `,
  targetContext: css`
    margin: 0;

    font-size: 13px;
    line-height: 20px;
    color: ${cssVar.colorTextSecondary};
    overflow-wrap: anywhere;
  `,
}));


export type PaymentStatus = 'created' | 'failed' | 'paid' | 'pending' | 'refunded';
export type RefundStatus = 'failed' | 'requested' | 'succeeded';
export type DiscrepancyStatus = 'open' | 'resolved';
export type PaymentFormAction = 'offlineRefund' | 'refund' | 'settle';

export const downloadJson = (value: unknown) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.download = `module-payment-discrepancies-${new Date().toISOString()}.json`;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
};
