import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PaymentActionModal } from './PaymentActionModal';

vi.mock('antd', () => ({
  Input: (props: any) => <input {...props} />,
  Modal: (props: any) =>
    props.open ? (
      <div>
        <h2>{props.title}</h2>
        {props.children}
        <button disabled={props.okButtonProps?.disabled} type="button">
          {props.okText}
        </button>
      </div>
    ) : null,
}));
vi.mock('@lobehub/ui/base-ui', () => ({
  Input: ({ onChange, ...props }: any) => <input onChange={(e) => onChange?.(e)} {...props} />,
  Modal: (props: any) =>
    props.open ? (
      <div role="dialog">
        {props.children}
        <button disabled={props.okButtonProps?.disabled} type="button" onClick={props.onOk}>
          {props.okText}
        </button>
      </div>
    ) : null,
  TextArea: (props: any) => <textarea {...props} />,
}));

// 带插值的 t：key 在测试里没有词典，返回固定模板再注入，让断言能看到目标内容。
const TEMPLATES: Record<string, string> = {
  'moduleApps.admin.payments.actionTargetContext': 'About to {action} — app {app}, order {order}.',
  'moduleApps.admin.payments.modal.refund': 'Refund payment',
  'moduleApps.admin.payments.modal.settle': 'Settle order',
};
const t = (key: string, values?: Record<string, unknown>) => {
  const template = TEMPLATES[key] ?? key;
  if (!values) return template;
  return Object.entries(values).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
    template,
  );
};

describe('PaymentActionModal', () => {
  it('restates the action target (app + order) before the form body', () => {
    render(
      <PaymentActionModal
        action="refund"
        actionIsValid={false}
        offlineRefundReference=""
        paymentReference=""
        reason=""
        submitting={false}
        t={t as any}
        target={{ appName: 'Commerce App', orderId: 'order-42' }}
        onCancel={vi.fn()}
        onOfflineRefundReferenceChange={vi.fn()}
        onOk={vi.fn()}
        onPaymentReferenceChange={vi.fn()}
        onReasonChange={vi.fn()}
      />,
    );

    const context = screen.getByTestId('payment-action-target');
    expect(context.textContent).toContain('Refund payment');
    expect(context.textContent).toContain('Commerce App');
    expect(context.textContent).toContain('order-42');
  });

  it('omits the target line when no target is provided', () => {
    render(
      <PaymentActionModal
        action="settle"
        actionIsValid={false}
        offlineRefundReference=""
        paymentReference=""
        reason=""
        submitting={false}
        t={t as any}
        onCancel={vi.fn()}
        onOfflineRefundReferenceChange={vi.fn()}
        onOk={vi.fn()}
        onPaymentReferenceChange={vi.fn()}
        onReasonChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('payment-action-target')).toBeNull();
  });
});
