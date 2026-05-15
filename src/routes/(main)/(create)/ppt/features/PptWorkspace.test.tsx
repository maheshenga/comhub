import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PptWorkspace from './PptWorkspace';

vi.mock('@/services/docmee', () => ({
  docmeeService: {
    createPptToken: vi.fn().mockResolvedValue({ sessionId: 's1', token: 'token-1' }),
    getPptRuntime: vi.fn().mockResolvedValue({
      allowPdfExport: true,
      allowPptxDownload: true,
      baseUrl: 'https://docmee.cn',
      creatorVersion: 'v2',
      enabled: true,
      lang: 'zh',
    }),
    reportPptEvent: vi.fn().mockResolvedValue({ charged: true }),
  },
}));

const docmeeConstructor = vi.fn();

vi.mock('@docmee/sdk-ui', () => ({
  DocmeeUI: function MockDocmeeUI(options: any) {
    docmeeConstructor(options);

    return { destroy: vi.fn() };
  },
}));

describe('PptWorkspace', () => {
  it('mounts DocmeeUI after runtime and token are ready', async () => {
    render(<PptWorkspace />);

    await waitFor(() => expect(docmeeConstructor).toHaveBeenCalled());
    expect(docmeeConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        DOMAIN: 'https://docmee.cn',
        page: 'creator-v2',
        token: 'token-1',
      }),
    );
  });
});
