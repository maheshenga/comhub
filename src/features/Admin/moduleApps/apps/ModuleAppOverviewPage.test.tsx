import { readFileSync } from 'node:fs';
import path from 'node:path';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ModuleAppOverviewPage from './ModuleAppOverviewPage';

const mocks = vi.hoisted(() => ({
  confirmModal: vi.fn(),
  mutate: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));
const moduleApps = vi.hoisted(() => ({
  publish: vi.fn(),
  unpublish: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: { moduleApps },
}));
vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: 'admin' } }),
}));
vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: { userProfile: (state: { user: unknown }) => state.user },
}));
vi.mock('@/libs/swr', () => ({ mutate: mocks.mutate }));
vi.mock('@lobehub/ui', () => ({
  createStaticStyles: () => new Proxy({}, { get: () => '' }),
  cssVar: new Proxy({}, { get: (_target, token) => `var(--${String(token)})` }),
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Input: ({ ...props }: any) => <input {...props} />,
  Modal: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  Select: ({ options, ...props }: any) => (
    <select {...props}>
      {options.map((option: { label: string; value: string }) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  TextArea: ({ ...props }: any) => <textarea {...props} />,
  confirmModal: mocks.confirmModal,
  toast: { error: mocks.toastError },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const app = {
  actions: [],
  appType: 'standard_app' as const,
  category: 'office',
  description: 'A workbench application.',
  displayName: 'Workbench',
  entitlements: [],
  icon: 'Blocks',
  id: '00000000-0000-4000-8000-000000000001',
  pages: [],
  slug: 'workbench',
  source: 'admin' as const,
  status: 'draft' as const,
  tags: ['office'],
  version: '1.0.0',
};

const ContextRoute = () => <Outlet context={{ app, refresh: mocks.refresh }} />;

describe('ModuleAppOverviewPage', () => {
  afterEach(() => cleanup());

  it('exposes a structured overview header and metadata region', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<ContextRoute />}>
            <Route index element={<ModuleAppOverviewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('module-app-overview-header')).toBeInTheDocument();
    expect(screen.getByTestId('module-app-overview-actions')).toBeInTheDocument();
    expect(screen.getByTestId('module-app-overview-metadata')).toBeInTheDocument();
  });

  it('consumes the detail outlet context and refreshes only application caches after publish', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<ContextRoute />}>
            <Route index element={<ModuleAppOverviewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('module-app-overview')).toBeInTheDocument();
    expect(screen.getByText('Workbench')).toBeInTheDocument();
    fireEvent.click(screen.getByText('moduleApps.admin.overview.publish'));

    // 多条警告逐行分段渲染（HTML 文本节点会折叠 join('\n')）：
    // content 是 React element <div><p>…</p>…</div>，逐段断言 warning 文本。
    const [confirmation] = mocks.confirmModal.mock.calls[0] as [
      {
        content: { props: { children: Array<{ props: { children: string } }> } };
        onOk: () => Promise<void>;
      },
    ];
    const warningTexts = confirmation.content.props.children.map(
      (paragraph: { props: { children: string } }) => paragraph.props.children,
    );
    expect(warningTexts).toEqual([
      'moduleApps.admin.overview.publishWarnings.noPages',
      'moduleApps.admin.overview.publishWarnings.noActions',
      'moduleApps.admin.overview.publishWarnings.noVisibleEntitlement',
    ]);
    await confirmation.onOk();

    expect(moduleApps.publish).toHaveBeenCalledWith({ appId: app.id });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.arrayContaining(['admin-module-apps', 'detail', app.id]),
    );
    expect(mocks.mutate).toHaveBeenCalledWith(expect.any(Function), undefined, {
      revalidate: true,
    });
  });

  it('surfaces a visible toast and rejects when publish fails instead of failing silently', async () => {
    moduleApps.publish.mockRejectedValueOnce(new Error('NETWORK'));
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<ContextRoute />}>
            <Route index element={<ModuleAppOverviewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('moduleApps.admin.overview.publish'));
    const [confirmation] = mocks.confirmModal.mock.calls.at(-1) as [{ onOk: () => Promise<void> }];
    await expect(confirmation.onOk()).rejects.toThrow('MODULE_APP_PUBLICATION_FAILED');
    expect(mocks.toastError).toHaveBeenCalledWith('moduleApps.admin.overview.publishFailed');
    // 失败后不得刷新缓存（数据没变）。
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('ships English and Chinese publish warning translations', () => {
    const readLocale = (locale: 'en-US' | 'zh-CN') =>
      JSON.parse(
        readFileSync(path.resolve(process.cwd(), `locales/${locale}/common.json`), 'utf8'),
      ) as Record<string, string>;
    const enUS = readLocale('en-US');
    const zhCN = readLocale('zh-CN');

    expect(enUS['moduleApps.admin.overview.publishWarnings.noPages']).toBe('No pages configured');
    expect(enUS['moduleApps.admin.overview.publishWarnings.noActions']).toBe(
      'No runnable actions configured',
    );
    expect(enUS['moduleApps.admin.overview.publishWarnings.noVisibleEntitlement']).toBe(
      'No visible plan entitlement configured',
    );
    expect(zhCN['moduleApps.admin.overview.publishWarnings.noPages']).toBe('尚未配置页面');
    expect(zhCN['moduleApps.admin.overview.publishWarnings.noActions']).toBe('尚未配置可运行操作');
    expect(zhCN['moduleApps.admin.overview.publishWarnings.noVisibleEntitlement']).toBe(
      '尚未配置可见的套餐权益',
    );
  });
});
