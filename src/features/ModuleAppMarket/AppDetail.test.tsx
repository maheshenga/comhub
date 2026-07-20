import { ConfigProvider } from '@lobehub/ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as m from 'motion/react-m';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppDetail, { submitModuleAppPaymentForm } from './AppDetail';

const commerceState = vi.hoisted(() => ({
  detailError: undefined as unknown,
  detailLoading: false,
  detailMissing: false,
  detailMutate: vi.fn(),
  installed: false,
  licenseData: null as null | { status: string },
  licenseLoading: false,
  licenseMutate: vi.fn(),
  orderStatus: 'pending',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/NeuralNetworkLoading', () => ({
  default: () => <div data-testid="neural-network-loading" />,
}));

vi.mock('swr', () => ({
  default: vi.fn((key: unknown) => {
    const name = Array.isArray(key) ? key[0] : key;
    if (name === 'moduleApp.getDetail') {
      return {
        data: commerceState.detailMissing
          ? undefined
          : {
              actions: [],
              category: 'business',
              description: 'Recruitment workflow',
              displayName: 'Recruiting Desk',
              id: 'app-1',
              installed: commerceState.installed,
              source: 'developer',
              version: '1.0.0',
            },
        error: commerceState.detailError,
        isLoading: commerceState.detailLoading,
        mutate: commerceState.detailMutate,
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
        data: commerceState.licenseData,
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

const renderDetail = (entry = '/apps/app-1') =>
  render(
    <ConfigProvider motion={m}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<AppDetail />} path="/apps/:appId" />
        </Routes>
      </MemoryRouter>
    </ConfigProvider>,
  );

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
    commerceState.detailError = undefined;
    commerceState.detailLoading = false;
    commerceState.detailMissing = false;
    commerceState.detailMutate.mockReset();
    commerceState.licenseLoading = false;
    commerceState.licenseData = null;
    commerceState.installed = false;
    commerceState.licenseMutate.mockReset();
    commerceState.orderStatus = 'pending';
  });

  it('shows pending payment without presenting the app as licensed', () => {
    renderDetail();

    expect(screen.getByText('Recruiting Desk')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'moduleApps.market.open' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.purchase.pending' }));
    expect(screen.getByText('order-1')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
    expect(screen.queryByText('workspace')).not.toBeInTheDocument();
  });

  it('uses only team products and orders in a workspace context', () => {
    renderDetail('/apps/app-1?workspaceId=workspace-1');

    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.purchase.pending' }));
    expect(screen.getByText('order-team')).toBeInTheDocument();
    expect(screen.getByText('workspace')).toBeInTheDocument();
    expect(screen.queryByText('personal')).not.toBeInTheDocument();
    expect(screen.getByText('workspace-1')).toBeInTheDocument();
  });

  it('shows open and uninstall actions for an installed workspace app', () => {
    commerceState.installed = true;
    renderDetail('/apps/app-1?workspaceId=workspace-1');

    const open = screen.getByRole('link', { name: 'moduleApps.market.open' });
    const uninstall = screen.getByRole('button', { name: 'moduleApps.market.uninstall' });
    expect(open).toHaveAttribute('data-button-type', 'primary');
    expect(open.compareDocumentPosition(uninstall) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('module-app-detail-actions').children).toHaveLength(2);
  });

  it('shows install as the only primary action for licensed apps that are not installed', () => {
    commerceState.licenseData = { status: 'active' };

    renderDetail();

    const install = screen.getByRole('button', { name: 'moduleApps.purchase.install' });
    expect(install).toHaveAttribute('data-button-type', 'primary');
    expect(screen.getByTestId('module-app-detail-actions').children).toHaveLength(1);
  });

  it('renders a semantic responsive metadata list', () => {
    renderDetail();

    const metadata = screen.getByTestId('module-app-detail-metadata');
    expect(metadata.tagName).toBe('DL');
    expect(metadata).toHaveStyle({
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    });
    expect(screen.getAllByTestId('module-app-detail-metadata-item')).toHaveLength(4);
    expect(metadata).toHaveTextContent('developer');
    expect(metadata).toHaveTextContent('1.0.0');
  });

  it('uses the shared loading state while detail data is loading', () => {
    commerceState.detailLoading = true;
    commerceState.detailMissing = true;

    renderDetail();

    expect(screen.getByRole('status', { name: 'moduleApps.market.loading' })).toBeInTheDocument();
    expect(screen.getByTestId('neural-network-loading')).toBeInTheDocument();
  });

  it('renders a retryable detail error without clearing other commerce state', () => {
    commerceState.detailError = new Error('offline');
    commerceState.detailMissing = true;

    renderDetail();

    expect(screen.getByTestId('mobile-state-view')).toHaveAttribute('data-variant', 'error');
    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.market.retry' }));
    expect(commerceState.detailMutate).toHaveBeenCalled();
  });

  it('blocks checkout while commerce state is loading', () => {
    commerceState.licenseLoading = true;
    renderDetail();

    expect(screen.getByRole('button', { name: /moduleApps\.purchase\.pending/ })).toBeDisabled();
  });

  it('refreshes the license after an order becomes paid', async () => {
    commerceState.orderStatus = 'paid';
    renderDetail();

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
