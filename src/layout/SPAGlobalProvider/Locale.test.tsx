/**
 * @vitest-environment happy-dom
 */
import { render } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Locale from './Locale';

const { init, instance } = vi.hoisted(() => ({
  init: vi.fn(() => Promise.resolve()),
  instance: {
    isInitialized: false,
    language: 'en-US',
    off: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock('@/locales/create', () => ({
  createI18nNext: () => ({ init, instance }),
}));

vi.mock('@/utils/dayjsLocale', () => ({
  loadDayjsLocaleModule: () => Promise.resolve({ default: 'en' }),
  normalizeDayjsLocale: () => 'en',
}));

vi.mock('@/utils/locale', () => ({
  getAntdLocale: () => Promise.resolve(undefined),
}));

vi.mock('antd', () => ({
  ConfigProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/layout/GlobalProvider/Editor', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('dayjs', () => ({
  default: { locale: vi.fn() },
}));

vi.mock('rtl-detect', () => ({
  isRtlLang: () => false,
}));

describe('SPAGlobalProvider Locale', () => {
  beforeEach(() => {
    init.mockClear();
    instance.isInitialized = false;
  });

  it('requests synchronous initialization for bundled resources', () => {
    render(
      <Locale defaultLang="en-US">
        <div>content</div>
      </Locale>,
    );

    expect(init).toHaveBeenCalledWith({ initAsync: false });
  });
});
