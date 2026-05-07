import { StorageModeEnum } from '@lobechat/electron-client-ipc';
import { Button, Center, Flexbox } from '@lobehub/ui';
import { LobeHub } from '@lobehub/ui/brand';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useBrandName } from '@/features/Brand';
import { useElectronStore } from '@/store/electron';

import { Option } from './Option';

const styles = createStaticStyles(({ css, cssVar }) => {
  return {
    cardGroup: css`
      width: 400px;
    `,
    container: css`
      overflow-y: auto;

      width: 100%;
      height: 100%;
      padding-block: 0 40px;
      padding-inline: 24px;
    `,
    continueButton: css`
      width: 100%;
      margin-block-start: 40px;
    `,
    groupTitle: css`
      padding-inline-start: 4px;
      font-size: 16px;
      font-weight: 500;
      color: ${cssVar.colorTextSecondary};
    `,
    title: css`
      margin-block: 16px 48px;
      font-size: 24px;
      font-weight: 600;
      color: ${cssVar.colorTextHeading};
    `,
  };
});

interface ConnectionModeProps {
  setWaiting: (waiting: boolean) => void;
}

const ConnectionMode = memo<ConnectionModeProps>(({ setWaiting }) => {
  const { t } = useTranslation(['electron', 'common']);
  const connect = useElectronStore((s) => s.connectRemoteServer);
  const brandName = useBrandName();

  const handleContinue = async () => {
    setWaiting(true);
    await connect({ remoteServerUrl: undefined, storageMode: StorageModeEnum.Cloud });
  };

  return (
    <Center className={styles.container}>
      <Flexbox align={'center'} gap={0}>
        <h1 className={styles.title}>{t('sync.mode.title')}</h1>
      </Flexbox>

      <Flexbox className={styles.cardGroup} gap={24}>
        <Flexbox gap={16}>
          <div className={styles.groupTitle}>{t('sync.mode.cloudSync')}</div>
          <Option
            isSelected
            description={t('sync.lobehubCloud.description')}
            icon={LobeHub}
            label={t('sync.lobehubCloud.title', { brandName })}
            value={StorageModeEnum.Cloud}
            onClick={() => {}}
          />
        </Flexbox>
      </Flexbox>

      <Button
        className={styles.continueButton}
        size="large"
        style={{ maxWidth: 400 }}
        type="primary"
        onClick={handleContinue}
      >
        {t('sync.continue')}
      </Button>
    </Center>
  );
});

export default ConnectionMode;
