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
});
