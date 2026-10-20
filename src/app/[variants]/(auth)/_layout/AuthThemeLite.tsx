'use client';

import 'antd/dist/reset.css';

import { ConfigProvider, ThemeScope, ToastHost } from '@lobehub/ui';
import { App } from 'antd';
import { domMax, LazyMotion } from 'motion/react';
import * as m from 'motion/react-m';
import Link from 'next/link';
import { type PropsWithChildren } from 'react';
import { memo } from 'react';

import { useIsDark } from '@/hooks/useIsDark';
import Image from '@/libs/next/Image';

interface AuthThemeLiteProps extends PropsWithChildren {
  globalCDN?: boolean;
}

const AuthThemeLite = memo<AuthThemeLiteProps>(({ children, globalCDN }) => {
  const isDark = useIsDark();
  const currentAppearance = isDark ? 'dark' : 'light';

  return (
    <ThemeScope appearance={currentAppearance} className={'auth-layout'} style={{ height: '100%' }}>
      <App style={{ height: '100%' }}>
        <ConfigProvider
          motion={m}
          config={{
            aAs: Link,
            imgAs: Image,
            imgUnoptimized: true,
            proxy: globalCDN ? 'unpkg' : undefined,
          }}
        >
          <LazyMotion features={domMax}>{children}</LazyMotion>
          <ToastHost />
        </ConfigProvider>
      </App>
    </ThemeScope>
  );
});

AuthThemeLite.displayName = 'AuthThemeLite';

export default AuthThemeLite;
