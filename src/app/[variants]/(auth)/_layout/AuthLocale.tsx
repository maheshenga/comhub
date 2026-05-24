'use client';

import { ConfigProvider } from 'antd';
import { memo, type PropsWithChildren, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { isRtlLang } from 'rtl-detect';

import { isOnServerSide } from '@/utils/env';

import { createAuthI18n } from './createAuthI18n';

interface AuthLocaleProps extends PropsWithChildren {
  defaultLang?: string;
}

const AuthLocale = memo<AuthLocaleProps>(({ children, defaultLang }) => {
  const [i18n] = useState(() => createAuthI18n(defaultLang));
  const [lang, setLang] = useState(defaultLang ?? 'en-US');

  if (isOnServerSide) {
    i18n.init({ initAsync: false });
  } else if (!i18n.instance.isInitialized) {
    i18n.init();
  }

  useEffect(() => {
    const handleLang = (lng: string) => {
      setLang((prev) => (prev === lng ? prev : lng));
    };

    i18n.instance.on('languageChanged', handleLang);
    return () => {
      i18n.instance.off('languageChanged', handleLang);
    };
  }, [i18n]);

  const documentDir = isRtlLang(lang) ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = documentDir;
  }, [documentDir, lang]);

  return (
    <I18nextProvider i18n={i18n.instance}>
      <ConfigProvider
        direction={documentDir}
        theme={{
          components: {
            Button: {
              contentFontSizeSM: 12,
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </I18nextProvider>
  );
});

AuthLocale.displayName = 'AuthLocale';

export default AuthLocale;
