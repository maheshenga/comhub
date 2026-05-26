import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PptWorkspace from './PptWorkspace';

const serviceMocks = vi.hoisted(() => ({
  createPptToken: vi.fn(),
  getPptRuntime: vi.fn(),
  reportPptEvent: vi.fn(),
}));

vi.mock('@/services/docmee', () => ({
  docmeeService: serviceMocks,
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  useNavigate: () => vi.fn(),
}));

const docmeeConstructor = vi.fn();
const docmeeEventHandlers = new Map<string, Array<(message?: any) => void>>();

vi.mock('@docmee/sdk-ui', () => ({
  DocmeeUI: function MockDocmeeUI(options: any) {
    docmeeConstructor(options);

    return {
      destroy: vi.fn(),
      on: vi.fn((eventName: string, callback: (message?: any) => void) => {
        const handlers = docmeeEventHandlers.get(eventName) ?? [];
        handlers.push(callback);
        docmeeEventHandlers.set(eventName, handlers);
      }),
    };
  },
}));

describe('PptWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    docmeeEventHandlers.clear();
    serviceMocks.createPptToken.mockResolvedValue({ sessionId: 's1', token: 'token-1' });
    serviceMocks.getPptRuntime.mockResolvedValue({
      allowPdfExport: true,
      allowPptxDownload: true,
      baseUrl: 'https://docmee.cn',
      creatorVersion: 'v2',
      enabled: true,
      lang: 'zh',
    });
    serviceMocks.reportPptEvent.mockResolvedValue({ charged: true });
  });

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

  it('can recover after token creation fails and the user retries', async () => {
    serviceMocks.createPptToken
      .mockRejectedValueOnce(new Error('PPT_UPSTREAM_TOKEN_FAILED'))
      .mockResolvedValueOnce({ sessionId: 's1', token: 'token-1' });

    render(<PptWorkspace />);

    await screen.findByText('服务连接失败');
    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }));

    await waitFor(() => expect(docmeeConstructor).toHaveBeenCalled());
  });

  it('shows an error state when Docmee reports an invalid token', async () => {
    render(<PptWorkspace />);

    await waitFor(() => expect(docmeeConstructor).toHaveBeenCalled());

    act(() => {
      docmeeEventHandlers.get('invalid-token')?.[0]?.({ type: 'invalid-token' });
    });

    expect(await screen.findByText('服务连接失败')).toBeInTheDocument();
  });

  it('shows an error state when Docmee emits a runtime error', async () => {
    render(<PptWorkspace />);

    await waitFor(() => expect(docmeeConstructor).toHaveBeenCalled());

    act(() => {
      docmeeEventHandlers.get('error')?.[0]?.({
        data: { message: 'iframe failed' },
        type: 'error',
      });
    });

    expect(await screen.findByText('PPT 创作加载失败')).toBeInTheDocument();
  });
});
