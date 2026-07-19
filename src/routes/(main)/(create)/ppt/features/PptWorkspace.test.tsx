import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PptWorkspace from './PptWorkspace';

const serviceMocks = vi.hoisted(() => ({
  createPptToken: vi.fn(),
  getPptRuntime: vi.fn(),
  reportPptEvent: vi.fn(),
}));
const routerLocation = vi.hoisted(() => ({ search: '' }));

vi.mock('@/services/docmee', () => ({
  docmeeService: serviceMocks,
}));

vi.mock('react-router', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  useLocation: () => routerLocation,
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
    routerLocation.search = '';
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

  it('opens a saved upstream presentation directly in the editor', async () => {
    routerLocation.search = '?recordId=00000000-0000-4000-8000-000000000001';
    serviceMocks.createPptToken.mockResolvedValue({
      sessionId: 'saved-session',
      token: 'token-1',
      upstreamTaskId: 'upstream/ppt-1',
    });

    render(<PptWorkspace />);

    await waitFor(() => expect(docmeeConstructor).toHaveBeenCalled());
    expect(docmeeConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ page: 'editor', pptId: 'upstream/ppt-1' }),
    );
    expect(serviceMocks.createPptToken).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
    );
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

  it('uses the shared loading indicator while the runtime is loading', () => {
    serviceMocks.getPptRuntime.mockReturnValue(new Promise(() => undefined));

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <PptWorkspace />
      </SWRConfig>,
    );

    expect(screen.getByTestId('ppt-workspace-loading')).toHaveAttribute('aria-busy', 'true');
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

  it('shows a retryable error state when the runtime configuration fails to load', async () => {
    serviceMocks.getPptRuntime.mockRejectedValueOnce(new Error('PPT_UPSTREAM_TOKEN_FAILED'));

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <PptWorkspace />
      </SWRConfig>,
    );

    fireEvent.click(await screen.findByRole('button'));

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
