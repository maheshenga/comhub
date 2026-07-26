import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { moduleAppCacheKeys } from '../../shared/cacheKeys';
import ModuleAppRuntimePage from './ModuleAppRuntimePage';

const moduleApps = vi.hoisted(() => ({
  getRuntimeDiagnostics: vi.fn().mockResolvedValue({
    configuration: {
      internalTokenConfigured: true,
      internalUrlConfigured: true,
      publicOriginConfigured: true,
    },
    probe: { status: 'ready' },
    switches: {
      executionEnabled: true,
      invocationEnabled: true,
      publicExecutionEnabled: true,
    },
  }),
  listArtifacts: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  listInstalls: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  listRecords: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  listRuns: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
}));
const mutate = vi.hoisted(() => vi.fn());
const runtimeState = vi.hoisted(() => ({ errorDomain: undefined as string | undefined }));

vi.mock('@/services/adminCommercial', () => ({ adminCommercialService: { moduleApps } }));
vi.mock('@/libs/swr', () => ({
  mutate,
  useClientDataSWR: (key: unknown, fetcher: () => Promise<unknown>) => {
    if (key) void fetcher();
    const parts = Array.isArray(key) ? key : [];
    const domain = parts[1] === 'runtime' ? parts[2] : parts[1];
    const error = runtimeState.errorDomain === domain ? new Error(`${domain} failed`) : undefined;
    if (domain === 'diagnostics') {
      return {
        data: error
          ? undefined
          : {
              configuration: {
                internalTokenConfigured: true,
                internalUrlConfigured: true,
                publicOriginConfigured: false,
              },
              probe: {
                code: 'MODULE_APP_RUNTIME_DOCKER_UNAVAILABLE',
                status: 'unavailable',
              },
              switches: {
                executionEnabled: false,
                invocationEnabled: false,
                publicExecutionEnabled: false,
              },
            },
        error,
        isLoading: false,
      };
    }
    return {
      data: {
        items: error
          ? []
          : [
              {
                collectionKey: 'records',
                fileName: 'result.md',
                id: `${domain}-1`,
                mimeType: 'text/markdown',
                scopeType: 'personal',
                status: 'succeeded',
                storageKey: 'module-apps/app-1/result.md',
              },
            ],
        nextCursor: null,
      },
      error,
      isLoading: false,
    };
  },
}));
vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({ children, htmlType = 'button', icon: Icon, ...props }: any) => (
    <button type={htmlType} {...props}>
      {Icon ? <Icon /> : null}
      {children}
    </button>
  ),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { code?: string }) =>
      options?.code ? `${key}: ${options.code}` : key,
  }),
}));

describe('ModuleAppRuntimePage', () => {
  beforeEach(() => {
    runtimeState.errorDomain = undefined;
    vi.clearAllMocks();
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/settings/admin/modules/apps/app-1/runtime']}>
        <Routes>
          <Route
            element={<ModuleAppRuntimePage />}
            path="/settings/admin/modules/apps/:appId/runtime"
          />
        </Routes>
      </MemoryRouter>,
    );

  it('loads diagnostics and four independent app-scoped runtime sections', async () => {
    renderPage();

    await waitFor(() => {
      expect(moduleApps.listInstalls).toHaveBeenCalledWith({
        appId: 'app-1',
        cursor: undefined,
        limit: 10,
      });
      expect(moduleApps.listRecords).toHaveBeenCalledWith({
        appId: 'app-1',
        cursor: undefined,
        limit: 10,
      });
      expect(moduleApps.listRuns).toHaveBeenCalledWith({
        appId: 'app-1',
        cursor: undefined,
        limit: 10,
      });
      expect(moduleApps.listArtifacts).toHaveBeenCalledWith({
        appId: 'app-1',
        cursor: undefined,
        limit: 10,
      });
      expect(moduleApps.getRuntimeDiagnostics).toHaveBeenCalledOnce();
    });

    expect(screen.getByTestId('module-app-runtime')).toBeInTheDocument();
    const diagnostics = within(screen.getByTestId('module-runtime-diagnostics'));
    expect(diagnostics.getByText('moduleApps.admin.runtime.diagnostics.probe')).toBeInTheDocument();
    expect(diagnostics.getByText(/MODULE_APP_RUNTIME_DOCKER_UNAVAILABLE/)).toBeInTheDocument();
    fireEvent.click(
      diagnostics.getByRole('button', {
        name: 'moduleApps.admin.runtime.diagnostics.refresh',
      }),
    );
    expect(mutate).toHaveBeenCalledWith(moduleAppCacheKeys.runtimeDiagnostics());
    expect(screen.getByTestId('module-runtime-installs')).toBeInTheDocument();
    expect(screen.getByTestId('module-runtime-records')).toBeInTheDocument();
    expect(screen.getByTestId('module-runtime-runs')).toBeInTheDocument();
    expect(screen.getByTestId('module-runtime-artifacts')).toBeInTheDocument();

    const installs = within(screen.getByTestId('module-runtime-installs'));
    expect(
      installs.getByRole('columnheader', {
        name: 'moduleApps.admin.operations.installs.columns.install',
      }),
    ).toBeInTheDocument();
    expect(installs.getByRole('link')).toHaveAttribute(
      'href',
      '/settings/admin/modules/operations/installs?appId=app-1',
    );
  });

  it('keeps section errors and retries independent', () => {
    runtimeState.errorDomain = 'runs';
    renderPage();

    expect(
      within(screen.getByTestId('module-runtime-runs')).getByTestId('module-error-state'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('module-runtime-installs')).getByRole('table'),
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId('module-runtime-runs')).getByRole('button', {
        name: 'moduleApps.admin.center.state.retry',
      }),
    );
    expect(mutate).toHaveBeenCalledWith(moduleAppCacheKeys.runtime('runs', 'app-1', 10));
  });
});
