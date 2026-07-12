import { render, screen } from '@testing-library/react';
import { Form } from 'antd';
import { describe, expect, it } from 'vitest';

import ActionEditor from './ActionEditor';
import BillingEditor from './BillingEditor';
import EntitlementEditor from './EntitlementEditor';
import PageEditor from './PageEditor';

const renderWithForm = (node: React.ReactNode, initialValues = {}) =>
  render(<Form initialValues={initialValues}>{node}</Form>);

describe('module app admin section editors', () => {
  it('renders page editor controls', () => {
    renderWithForm(<PageEditor />, { pages: [] });

    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add page/i })).toBeInTheDocument();
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
    expect(screen.queryByText(/real credit ledger posting is not enabled/i)).not.toBeInTheDocument();
  });
});
