import { type ServerBrandConfig } from '@/server/services/brand';

export interface OAuthClientMetadata {
  clientName?: string;
  isFirstParty?: boolean;
  logo?: string;
}

const BUILTIN_CLIENT_NAME_SUFFIX: Record<string, string> = {
  'lobehub-cli': 'CLI',
  'lobehub-desktop': 'Desktop',
  'lobehub-market': 'Marketplace',
  'lobehub-mobile': 'Mobile',
};

export const resolveBrandedClientMetadata = ({
  brand,
  clientId,
  metadata,
}: {
  brand: ServerBrandConfig;
  clientId: string;
  metadata: OAuthClientMetadata;
}): OAuthClientMetadata => {
  const suffix = BUILTIN_CLIENT_NAME_SUFFIX[clientId];
  const brandName = brand.name?.trim();

  if (!suffix || !brandName) return metadata;

  return {
    ...metadata,
    clientName: `${brandName} ${suffix}`,
    logo: brand.logoUrl || metadata.logo,
  };
};
