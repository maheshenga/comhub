import { type MarkdownProps } from '@lobehub/ui';
import { Center, Markdown } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';

import { siteConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

const ChatPreview = ({ fontSize }: Pick<MarkdownProps, 'fontSize'>) => {
  const { t } = useTranslation('welcome');
  const brandName = useServerConfigStore(siteConfigSelectors.brandName);
  return (
    <Center>
      <Markdown fontSize={fontSize} variant={'chat'}>
        {t('guide.defaultMessageWithoutCreate', {
          appName: brandName,
        })}
      </Markdown>
    </Center>
  );
};

export default ChatPreview;
