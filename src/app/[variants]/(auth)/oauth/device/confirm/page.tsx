import { notFound } from 'next/navigation';

import { authEnv } from '@/envs/auth';
import { getServerBrand } from '@/server/services/brand';

import { resolveBrandedClientMetadata } from '../../consent/[uid]/brandClientMetadata';
import DeviceCodeConfirm from './DeviceCodeConfirm';

const DeviceConfirmPage = async (props: {
  searchParams: Promise<{
    client_id?: string;
    client_name?: string;
    user_code?: string;
    xsrf?: string;
  }>;
}) => {
  if (!authEnv.ENABLE_OIDC) return notFound();

  const searchParams = await props.searchParams;

  if (!searchParams.user_code) return notFound();

  const brand = await getServerBrand();
  const clientMetadata = resolveBrandedClientMetadata({
    brand,
    clientId: searchParams.client_id || '',
    metadata: { clientName: searchParams.client_name },
  });

  return (
    <DeviceCodeConfirm
      clientName={clientMetadata.clientName || searchParams.client_id || 'Unknown Application'}
      userCode={searchParams.user_code}
      xsrf={searchParams.xsrf}
    />
  );
};

export default DeviceConfirmPage;
