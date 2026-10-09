'use client';

import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export const SecretHint = ({
  configured,
  masked,
}: {
  configured?: boolean;
  masked?: null | string;
}) => {
  const { t } = useTranslation('subscription');
  return (
    <Text type="secondary">
      {configured
        ? t('admin.payments.secretConfigured', {
            defaultValue: 'Configured as {{masked}}. Leave blank to keep it unchanged.',
            masked: masked ?? '****',
          })
        : t('admin.payments.secretMissing', 'Not configured')}
    </Text>
  );
};
