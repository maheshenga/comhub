import { moduleAppCapabilityClaimsSchema } from '@lobechat/types';
import { importJWK, jwtVerify } from 'jose';

export const verifyRuntimeCapability = async (token: string, jwksValue: string) => {
  let jwks: { keys?: Record<string, unknown>[] };
  try {
    jwks = JSON.parse(jwksValue);
  } catch (error) {
    throw new Error('MODULE_APP_RUNTIME_CAPABILITY_INVALID', { cause: error });
  }
  const publicJwk = jwks.keys?.find((key) => key.alg === 'RS256' && key.kty === 'RSA');
  if (!publicJwk) throw new Error('MODULE_APP_RUNTIME_CAPABILITY_INVALID');

  try {
    const key = await importJWK(publicJwk, 'RS256');
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['RS256'],
      audience: 'module-runtime',
    });
    const claims = moduleAppCapabilityClaimsSchema.parse(payload);
    if (claims.surface !== 'runtime') throw new Error('MODULE_APP_RUNTIME_CAPABILITY_INVALID');
    return claims;
  } catch (error) {
    throw new Error('MODULE_APP_RUNTIME_CAPABILITY_INVALID', { cause: error });
  }
};
