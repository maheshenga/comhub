'use client';

import 'antd/dist/reset.css';

import { ConfigProvider, ThemeProvider } from '@lobehub/ui';
import { App } from 'antd';
import { createGlobalStyle } from 'antd-style';
import * as m from 'motion/react-m';
import Link from 'next/link';
import { type PropsWithChildren } from 'react';
import { memo } from 'react';

import AntdStaticMethods from '@/components/AntdStaticMethods';
import { useIsDark } from '@/hooks/useIsDark';
import Image from '@/libs/next/Image';

const AuthAntdFallbackStyle = createGlobalStyle`
  .auth-layout {
    color: #080808;
  }

  html[data-theme='dark'] .auth-layout {
    color: #f5f5f5;
  }

  .auth-layout .ant-typography-secondary {
    color: #8c8c8c;
  }

  html[data-theme='dark'] .auth-layout .ant-typography-secondary {
    color: #a3a3a3;
  }

  .auth-layout .ant-input-affix-wrapper {
    position: relative;

    display: inline-flex;
    align-items: center;

    width: 100%;
    min-width: 0;
    border: 1px solid #e3e3e3;
    border-radius: 12px;

    color: #080808;

    background: #fff;

    transition: all 0.2s ease;
  }

  .auth-layout .ant-input-affix-wrapper:hover,
  .auth-layout .ant-input-affix-wrapper:focus-within {
    border-color: #d0d0d0;
    box-shadow: 0 0 0 2px rgb(5 5 5 / 4%);
  }

  html[data-theme='dark'] .auth-layout .ant-input-affix-wrapper {
    border-color: #262626;
    color: #f5f5f5;
    background: #141414;
  }

  html[data-theme='dark'] .auth-layout .ant-input-affix-wrapper:hover,
  html[data-theme='dark'] .auth-layout .ant-input-affix-wrapper:focus-within {
    border-color: #3a3a3a;
    box-shadow: 0 0 0 2px rgb(255 255 255 / 6%);
  }

  .auth-layout .ant-input-affix-wrapper-lg {
    min-height: 50px;
    padding-block: 6px !important;
    padding-inline: 11px 7px !important;

    font-size: 16px;
    line-height: 1.5;
  }

  .auth-layout .ant-input-affix-wrapper > input.ant-input {
    flex: 1;

    min-width: 0;
    padding: 0;
    border: 0;

    font: inherit;
    line-height: inherit;
    color: inherit;

    background: transparent;
    outline: 0;
  }

  .auth-layout .ant-input-affix-wrapper > input.ant-input::placeholder {
    color: #b8b8b8;
  }

  .auth-layout .ant-input-prefix,
  .auth-layout .ant-input-suffix {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
  }

  .auth-layout .ant-input-prefix {
    margin-inline-end: 4px;
  }

  .auth-layout .ant-input-suffix {
    margin-inline-start: 4px;
  }

  .auth-layout .ant-btn {
    cursor: pointer;
    user-select: none;

    display: inline-flex;
    gap: 8px;
    align-items: center;
    justify-content: center;

    height: 32px;
    padding-block: 4px;
    padding-inline: 15px;
    border: 1px solid #e3e3e3;
    border-radius: 8px;

    font-size: 14px;
    line-height: 1.5;
    color: #080808;
    text-align: center;
    white-space: nowrap;

    background: #fff;
    box-shadow: none;

    transition: all 0.2s ease;
  }

  .auth-layout .ant-btn:hover {
    border-color: #d0d0d0;
  }

  html[data-theme='dark'] .auth-layout .ant-btn {
    border-color: #262626;
    color: #f5f5f5;
    background: #141414;
  }

  .auth-layout .ant-btn-lg {
    height: 45px;
    padding-block: 6px;
    padding-inline: 15px;
    border-radius: 12px;

    font-size: 16px;
  }

  .auth-layout .ant-btn-block {
    width: 100%;
  }

  .auth-layout .ant-btn-icon-only {
    width: 32px;
    padding: 0;
  }

  .auth-layout .ant-input-affix-wrapper .ant-btn-icon-only {
    width: 36px;
    height: 36px;
    border-color: transparent;
    border-radius: 8px;

    color: #080808;

    background: #f5f5f5;
  }

  html[data-theme='dark'] .auth-layout .ant-input-affix-wrapper .ant-btn-icon-only {
    color: #f5f5f5;
    background: #262626;
  }

  .auth-layout .ant-btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .auth-layout .ant-divider-horizontal {
    display: flex;
    align-items: center;

    width: 100%;
    min-width: 100%;
    margin-block: 20px;
    margin-inline: 0;

    font-size: 12px;
    color: #8c8c8c;
    text-align: center;
    white-space: nowrap;
  }

  .auth-layout .ant-divider-horizontal::before,
  .auth-layout .ant-divider-horizontal::after {
    content: '';
    position: relative;
    width: 50%;
    border-block-start: 1px solid #eee;
  }

  html[data-theme='dark'] .auth-layout .ant-divider-horizontal::before,
  html[data-theme='dark'] .auth-layout .ant-divider-horizontal::after {
    border-color: #262626;
  }

  .auth-layout .ant-divider-inner-text {
    display: inline-block;
    padding-block: 0;
    padding-inline: 16px;
  }
`;

interface AuthThemeLiteProps extends PropsWithChildren {
  globalCDN?: boolean;
}

const AuthThemeLite = memo<AuthThemeLiteProps>(({ children, globalCDN }) => {
  const isDark = useIsDark();
  const currentAppearance = isDark ? 'dark' : 'light';

  return (
    <ThemeProvider
      appearance={currentAppearance}
      className={'auth-layout'}
      defaultAppearance={currentAppearance}
      defaultThemeMode={currentAppearance}
      style={{ height: '100%' }}
      theme={{
        cssVar: { key: 'lobe-vars' },
      }}
    >
      <App style={{ height: '100%' }}>
        <AuthAntdFallbackStyle />
        <AntdStaticMethods />
        <ConfigProvider
          motion={m}
          config={{
            aAs: Link,
            imgAs: Image,
            imgUnoptimized: true,
            proxy: globalCDN ? 'unpkg' : undefined,
          }}
        >
          {children}
        </ConfigProvider>
      </App>
    </ThemeProvider>
  );
});

AuthThemeLite.displayName = 'AuthThemeLite';

export default AuthThemeLite;
