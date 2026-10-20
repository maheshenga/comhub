import { Form, useForm } from '@lobehub/ui/form';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ActionEditor from './ActionEditor';
import BillingEditor from './BillingEditor';
import EntitlementEditor from './EntitlementEditor';
import PageEditor from './PageEditor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'moduleApps.admin.configuration.actions': 'Actions',
        'moduleApps.admin.configuration.addAction': 'Add action',
        'moduleApps.admin.configuration.addPage': 'Add page',
        'moduleApps.admin.configuration.newPageTitle': 'New page',
        'moduleApps.admin.configuration.pages': 'Pages',
        'moduleApps.admin.entitlements.billing': 'Billing',
        'moduleApps.admin.entitlements.billingNotice':
          'Runtime charges use the shared credit ledger.',
        'moduleApps.admin.entitlements.chargeMode': 'Charge mode',
        'moduleApps.admin.entitlements.entitlements': 'Plan entitlements',
        'moduleApps.admin.entitlements.add': 'Add entitlement',
      })[key] ?? key,
  }),
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, type: _type, ...props }: any) => <button {...props}>{children}</button>,
  // UI6 merges the former `@lobehub/ui/base-ui` import into the root barrel,
  // so the root mock now also has to cover the layout primitive.
  Flexbox: ({ children, gap: _gap, ...props }: any) => <div {...props}>{children}</div>,
  Input: (props: any) => <input {...props} />,
  InputNumber: ({ onChange, ...props }: any) => (
    <input onChange={(event) => onChange?.(event.target.value)} {...props} />
  ),
  Select: ({ onChange, options = [], ...props }: any) => (
    <select onChange={(event) => onChange?.(event.target.value)} {...props}>
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Switch: (props: any) => <input type="checkbox" {...props} />,
  TextArea: (props: any) => <textarea {...props} />,
}));

const FormHarness = ({
  children,
  initialValues,
}: {
  children: React.ReactNode;
  initialValues?: Record<string, any>;
}) => {
  const form = useForm<Record<string, any>>({ initialValues });

  return <Form form={form}>{children}</Form>;
};

const renderWithForm = (node: React.ReactNode, initialValues = {}) =>
  render(<FormHarness initialValues={initialValues}>{node}</FormHarness>);

describe('module app admin section editors', () => {
  it('renders page editor controls', () => {
    renderWithForm(<PageEditor />, { pages: [] });

    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add page/i })).toBeInTheDocument();
  });

  it('uses localized copy for a new page title', () => {
    renderWithForm(<PageEditor />, { pages: [] });

    fireEvent.click(screen.getByRole('button', { name: /Add page/i }));

    expect(screen.getByDisplayValue('New page')).toBeInTheDocument();
  });

  it('renders action editor controls', () => {
    renderWithForm(<ActionEditor />, { actions: [] });

    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add action/i })).toBeInTheDocument();
  });

  it('renders entitlement editor controls', () => {
    renderWithForm(<EntitlementEditor />, { entitlements: [] });

    expect(screen.getByText('Plan entitlements')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add entitlement/i })).toBeInTheDocument();
  });

  it('renders billing editor controls', () => {
    renderWithForm(<BillingEditor />, {
      billing: { chargeMode: 'free', defaultMultiplier: 1 },
    });

    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByLabelText('Charge mode')).toBeInTheDocument();
    expect(screen.getByText(/shared credit ledger/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/real credit ledger posting is not enabled/i),
    ).not.toBeInTheDocument();
  });
});
