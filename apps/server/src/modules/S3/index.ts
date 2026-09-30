import { z } from 'zod';

export { EnvFileS3 } from './envFileS3';
export { FileS3, invalidateFileS3RuntimeCache } from './fileS3Runtime';
export { type PreSignedUpload, S3 } from './s3Client';

export const fileSchema = z.object({
  Key: z.string(),
  LastModified: z.date(),
  Size: z.number(),
});

export const listFileSchema = z.array(fileSchema);

export type FileType = z.infer<typeof fileSchema>;
