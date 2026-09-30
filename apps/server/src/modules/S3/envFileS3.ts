import { fileEnv } from '@/envs/file';

import { S3 } from './s3Client';

export class EnvFileS3 extends S3 {
  constructor() {
    super(fileEnv.S3_ACCESS_KEY_ID, fileEnv.S3_SECRET_ACCESS_KEY, fileEnv.S3_ENDPOINT, {
      bucket: fileEnv.S3_BUCKET,
      forcePathStyle: fileEnv.S3_ENABLE_PATH_STYLE,
      internalEndpoint: fileEnv.S3_INTERNAL_ENDPOINT,
      previewUrlExpireIn: fileEnv.S3_PREVIEW_URL_EXPIRE_IN,
      region: fileEnv.S3_REGION,
      setAcl: fileEnv.S3_SET_ACL,
    });
  }
}
