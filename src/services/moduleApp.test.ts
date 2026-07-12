import { describe, expect, it, vi } from 'vitest';

import { createModuleAppService } from './moduleApp';

describe('createModuleAppService', () => {
  it('calls moduleApp listMarketplace query', async () => {
    const query = vi.fn().mockResolvedValue([{ id: 'app1' }]);
    const service = createModuleAppService({
      moduleApp: {
        listMarketplace: { query },
      },
    } as never);

    await expect(service.listMarketplace({ query: 'desk' })).resolves.toEqual([{ id: 'app1' }]);
    expect(query).toHaveBeenCalledWith({ query: 'desk' });
  });

  it('calls the current user package submission list query', async () => {
    const query = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const service = createModuleAppService({
      moduleApp: {
        listMyPackageSubmissions: { query },
      },
    } as never);

    await expect(
      service.listMyPackageSubmissions({ limit: 20, reviewStatus: 'pending_review' }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    expect(query).toHaveBeenCalledWith({ limit: 20, reviewStatus: 'pending_review' });
  });

  it('requests an installation-scoped launch context', async () => {
    const query = vi.fn().mockResolvedValue({ capability: 'signed-capability' });
    const service = createModuleAppService({
      moduleApp: {
        getLaunchContext: { query },
      },
    } as never);

    await expect(
      service.getLaunchContext({ appId: 'app-1', workspaceId: 'workspace-1' }),
    ).resolves.toEqual({ capability: 'signed-capability' });
    expect(query).toHaveBeenCalledWith({ appId: 'app-1', workspaceId: 'workspace-1' });
  });

  it('lists installation-scoped runs with an opaque cursor', async () => {
    const query = vi.fn().mockResolvedValue({ items: [], nextCursor: 'next' });
    const service = createModuleAppService({ moduleApp: { listRuns: { query } } } as never);
    await expect(
      service.listRuns({
        cursor: 'cursor-1',
        installationId: '00000000-0000-4000-8000-000000000010',
        limit: 20,
        workspaceId: 'workspace-1',
      }),
    ).resolves.toEqual({ items: [], nextCursor: 'next' });
    expect(query).toHaveBeenCalledWith({
      cursor: 'cursor-1',
      installationId: '00000000-0000-4000-8000-000000000010',
      limit: 20,
      workspaceId: 'workspace-1',
    });
  });

  it('reads and cancels persisted workflow state', async () => {
    const getRun = vi.fn().mockResolvedValue({ id: 'run-1', status: 'running' });
    const listNodes = vi.fn().mockResolvedValue([{ nodeKey: 'start', status: 'running' }]);
    const cancelRun = vi.fn().mockResolvedValue({ id: 'run-1', status: 'cancelled' });
    const service = createModuleAppService({
      moduleApp: {
        cancelWorkflowRun: { mutate: cancelRun },
        getWorkflowRun: { query: getRun },
        listWorkflowNodes: { query: listNodes },
      },
    } as never);
    const input = {
      installationId: '00000000-0000-4000-8000-000000000010',
      runId: '00000000-0000-4000-8000-000000000020',
      workspaceId: 'workspace-1',
    };

    await expect(service.getWorkflowRun(input)).resolves.toMatchObject({ status: 'running' });
    await expect(service.listWorkflowNodes(input)).resolves.toEqual([
      { nodeKey: 'start', status: 'running' },
    ]);
    await expect(service.cancelWorkflowRun(input)).resolves.toMatchObject({ status: 'cancelled' });
    expect(getRun).toHaveBeenCalledWith(input);
    expect(listNodes).toHaveBeenCalledWith(input);
    expect(cancelRun).toHaveBeenCalledWith(input);
  });

  it('uploads a ZIP to the server-issued target before submitting it for review', async () => {
    const createUpload = vi.fn().mockResolvedValue({
      expiresAt: '2026-07-11T02:00:00.000Z',
      headers: { 'x-amz-acl': 'private' },
      storageKey: 'module-app-packages/user-scope/package.zip',
      uploadId: '00000000-0000-4000-8000-000000000010',
      uploadUrl: 'https://uploads.example.com/package.zip',
    });
    const submitUploadedPackage = vi.fn().mockResolvedValue({ id: 'package-1' });
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const service = createModuleAppService({
      moduleApp: {
        createPackageUpload: { mutate: createUpload },
        submitUploadedPackage: { mutate: submitUploadedPackage },
      },
    } as never, fetcher as typeof fetch);
    const file = new File(['zip-content'], 'package-app.zip', { type: 'application/zip' });

    await expect(service.uploadPackage(file)).resolves.toEqual({ id: 'package-1' });
    expect(createUpload).toHaveBeenCalledWith({
      fileName: 'package-app.zip',
      mimeType: 'application/zip',
      sizeBytes: file.size,
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://uploads.example.com/package.zip',
      expect.objectContaining({
        body: file,
        headers: expect.objectContaining({
          'Content-Type': 'application/zip',
          'x-amz-acl': 'private',
        }),
        method: 'PUT',
      }),
    );
    expect(submitUploadedPackage).toHaveBeenCalledWith({
      fileName: 'package-app.zip',
      storageKey: 'module-app-packages/user-scope/package.zip',
      uploadId: '00000000-0000-4000-8000-000000000010',
    });
  });

  it('reads the authenticated user orders and personal app license', async () => {
    const listOrders = vi.fn().mockResolvedValue([{ id: 'order-1' }]);
    const getLicense = vi.fn().mockResolvedValue({ id: 'license-1' });
    const service = createModuleAppService({
      moduleApp: {
        getLicense: { query: getLicense },
        listOrders: { query: listOrders },
      },
    } as never);

    await expect(service.listOrders({ limit: 20 })).resolves.toEqual([{ id: 'order-1' }]);
    await expect(service.getLicense({ appId: 'app-1' })).resolves.toEqual({ id: 'license-1' });
    expect(listOrders).toHaveBeenCalledWith({ limit: 20 });
    expect(getLicense).toHaveBeenCalledWith({ appId: 'app-1' });
  });

  it('uses server catalog inputs for quote, order creation, and cancellation', async () => {
    const listCatalog = vi.fn().mockResolvedValue([{ productId: 'product-1' }]);
    const quoteProduct = vi.fn().mockResolvedValue({ price: 88 });
    const createOrder = vi.fn().mockResolvedValue({ id: 'order-1', status: 'pending' });
    const cancelOrder = vi.fn().mockResolvedValue({ id: 'order-1', status: 'cancelled' });
    const service = createModuleAppService({
      moduleApp: {
        cancelOrder: { mutate: cancelOrder },
        createOrder: { mutate: createOrder },
        listCatalog: { query: listCatalog },
        quoteProduct: { query: quoteProduct },
      },
    } as never);

    await service.listCatalog({ appId: 'app-1' });
    await service.quoteProduct({ productId: 'product-1' });
    await service.createOrder({ productId: 'product-1' });
    await service.cancelOrder({ orderId: 'order-1' });
    expect(listCatalog).toHaveBeenCalledWith({ appId: 'app-1' });
    expect(quoteProduct).toHaveBeenCalledWith({ productId: 'product-1' });
    expect(createOrder).toHaveBeenCalledWith({ productId: 'product-1' });
    expect(cancelOrder).toHaveBeenCalledWith({ orderId: 'order-1' });
  });
});
