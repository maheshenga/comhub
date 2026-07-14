import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppDetail, { submitModuleAppPaymentForm } from './AppDetail';

const commerceState = vi.hoisted(() => ({
  installed: false,
  licenseLoading: false,
  licenseMutate: vi.fn(),
  orderStatus: 'pending',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('swr', () => ({
  default: vi.fn((key: unknown) => {
    const name = Array.isArray(key) ? key[0] : key;
    if (name === 'moduleApp.getDetail') {
      return {
        data: {
          actions: [],
          category: 'business',
          description: 'Recruitment workflow',
          displayName: 'Recruiting Desk',
          id: 'app-1',
          installed: commerceState.installed,
          source: 'developer',
          version: '1.0.0',
        },
        isLoading: false,
      };
    }
    if (name === 'moduleApp.listCatalog') {
      return {
        data: [
          {
            amount: 100,
            appId: 'app-1',
            currency: 'CNY',
            licenseScope: 'personal',
            productId: 'product-personal',
            productType: 'one_time',
          },
          {
            amount: 200,
            appId: 'app-1',
            currency: 'CNY',
            licenseScope: 'workspace',
            productId: 'product-team',
            productType: 'one_time',
          },
        ],
        isLoading: false,
      };
    }
    if (name === 'moduleApp.getLicense') {
      return {
        data: null,
        isLoading: commerceState.licenseLoading,
        mutate: commerceState.licenseMutate,
      };
    }
    if (name === 'moduleApp.listOrders') {
      return {
        data: [
          { appId: 'app-1', id: 'order-1', status: commerceState.orderStatus, workspaceId: null },
          {
            appId: 'app-1',
            id: 'order-team',
            status: commerceState.orderStatus,
            workspaceId: 'workspace-1',
          },
        ],
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      };
    }
    return { data: undefined, isLoading: false };
  }),
}));

vi.mock('./PurchaseModal', () => ({
  default: ({
    catalog,
    open,
    order,
    workspaceId,
  }: {
    catalog: Array<{ licenseScope: string }>;
    open: boolean;
    order?: { id: string };
    workspaceId?: string;
  }) =>
    open ? (
      <div>
        <span>{order?.id}</span>
        <span>{catalog.map((item) => item.licenseScope).join(',')}</span>
        <span>{workspaceId}</span>
      </div>
    ) : null,
}));

describe('ModuleAppDetail', () => {
  beforeEach(() => {
    commerceState.licenseLoading = false;
    commerceState.installed = false;
    commerceState.licenseMutate.mockReset();
    commerceState.orderStatus = 'pending';
  });

  it('shows pending payment without presenting the app as licensed', () => {
    render(
      <MemoryRouter initialEntries={['/apps/app-1']}>
        <Routes>
          <Route element={<AppDetail />} path="/apps/:appId" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Recruiting Desk')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'moduleApps.market.open' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.purchase.pending' }));
    expect(screen.getByText('order-1')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
    expect(screen.queryByText('workspace')).not.toBeInTheDocument();
  });

  it('uses only team products and orders in a workspace context', () => {
    render(
      <MemoryRouter initialEntries={['/apps/app-1?workspaceId=workspace-1']}>
        <Routes>
          <Route element={<AppDetail />} path="/apps/:appId" />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.purchase.pending' }));
    expect(screen.getByText('order-team')).toBeInTheDocument();
    expect(screen.getByText('workspace')).toBeInTheDocument();
    expect(screen.queryByText('personal')).not.toBeInTheDocument();
    expect(screen.getByText('workspace-1')).toBeInTheDocument();
  });

  it('shows open and uninstall actions for an installed workspace app', () => {
    commerceState.installed = true;
    render(
      <MemoryRouter initialEntries={['/apps/app-1?workspaceId=workspace-1']}>
        <Routes>
          <Route element={<AppDetail />} path="/apps/:appId" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'moduleApps.market.open' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'moduleApps.market.uninstall' })).toBeInTheDocument();
  });

  it('blocks checkout while commerce state is loading', () => {
    commerceState.licenseLoading = true;
    render(
      <MemoryRouter initialEntries={['/apps/app-1']}>
        <Routes>
          <Route element={<AppDetail />} path="/apps/:appId" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /moduleApps\.purchase\.pending/ })).toBeDisabled();
  });

  it('refreshes the license after an order becomes paid', async () => {
    commerceState.orderStatus = 'paid';
    render(
      <MemoryRouter initialEntries={['/apps/app-1']}>
        <Routes>
          <Route element={<AppDetail />} path="/apps/:appId" />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(commerceState.licenseMutate).toHaveBeenCalled());
  });

  it('submits the signed HTTPS payment form returned by the server', () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});

    submitModuleAppPaymentForm(
      '<form action="https://openapi.alipay.com/gateway.do" method="post"><input type="hidden" name="sign" value="signed" /></form>',
    );

    expect(submit).toHaveBeenCalledTimes(1);
    const form = document.body.querySelector(
      'form[action="https://openapi.alipay.com/gateway.do"]',
    );
    expect(form).toHaveAttribute('method', 'post');
    expect(form?.querySelector('input[name="sign"]')).toHaveAttribute('value', 'signed');
    form?.remove();
  });

  it('rebuilds the payment form without executable attributes or arbitrary elements', () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});

    submitModuleAppPaymentForm(
      '<form action="https://openapi.alipay.com/gateway.do" method="post" onsubmit="alert(1)">' +
        '<input type="hidden" name="sign" value="signed" onfocus="alert(1)" />' +
        '<button name="unexpected">Run</button><script>alert(1)</script></form>',
    );

    const form = document.body.querySelector(
      'form[action="https://openapi.alipay.com/gateway.do"]',
    );
    expect(submit).toHaveBeenCalledTimes(1);
    expect(form).not.toHaveAttribute('onsubmit');
    expect(form?.querySelector('input[name="sign"]')).not.toHaveAttribute('onfocus');
    expect(form?.querySelector('button')).toBeNull();
    expect(form?.querySelector('script')).toBeNull();
    form?.remove();
  });
});
