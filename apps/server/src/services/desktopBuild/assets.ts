import { createHash, randomUUID } from 'node:crypto';

import type {
  DesktopBuildAsset,
  DesktopBuildAssetKind,
  DesktopBuildAssetManifest,
} from '@lobechat/types';

import type { FileS3 } from '@/server/modules/S3';

export const DESKTOP_BUILD_ASSET_PREFIX = 'desktop-build-assets';

const ASSET_SPECS: Record<
  DesktopBuildAssetKind,
  { contentType: string; extension: 'bmp' | 'ico' | 'png' }
> = {
  appPreview: { contentType: 'image/png', extension: 'png' },
  nsisHeader: { contentType: 'image/bmp', extension: 'bmp' },
  nsisSidebar: { contentType: 'image/bmp', extension: 'bmp' },
  windowsIcon: { contentType: 'image/x-icon', extension: 'ico' },
};

const MAX_ASSET_BYTES: Record<DesktopBuildAssetKind, number> = {
  appPreview: 4 * 1024 * 1024,
  nsisHeader: 1 * 1024 * 1024,
  nsisSidebar: 1 * 1024 * 1024,
  windowsIcon: 2 * 1024 * 1024,
};

const assetError = () => new Error('Invalid desktop build asset');

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const normalizedContentType = (value: string | undefined) =>
  value?.split(';')[0]?.trim().toLowerCase();

const isUuid = (value: string) => new RegExp(`^${UUID_PATTERN}$`, 'i').test(value);

const readUint16Le = (bytes: Uint8Array, offset: number) =>
  bytes[offset]! | (bytes[offset + 1]! << 8);

const readUint32Be = (bytes: Uint8Array, offset: number) =>
  ((bytes[offset]! << 24) |
    (bytes[offset + 1]! << 16) |
    (bytes[offset + 2]! << 8) |
    bytes[offset + 3]!) >>>
  0;

const readUint32Le = (bytes: Uint8Array, offset: number) =>
  (bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)) >>>
  0;

const readInt32Le = (bytes: Uint8Array, offset: number) =>
  bytes[offset]! |
  (bytes[offset + 1]! << 8) |
  (bytes[offset + 2]! << 16) |
  (bytes[offset + 3]! << 24);

const assertExpectedDimensions = (
  kind: 'appPreview' | 'nsisHeader' | 'nsisSidebar',
  width: number,
  height: number,
) => {
  const expected =
    kind === 'appPreview' ? [1024, 1024] : kind === 'nsisHeader' ? [150, 57] : [164, 314];
  if (width !== expected[0] || height !== expected[1]) throw assetError();
};

const inspectPng = (kind: 'appPreview', bytes: Uint8Array) => {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.byteLength < signature.length ||
    !signature.every((value, index) => bytes[index] === value)
  ) {
    throw assetError();
  }

  let offset = signature.length;
  let dimensions: { height: number; width: number } | undefined;
  let foundIend = false;

  while (offset < bytes.byteLength) {
    if (offset + 12 > bytes.byteLength) throw assetError();
    const length = readUint32Be(bytes, offset);
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    );
    const dataOffset = offset + 8;
    const nextOffset = dataOffset + length + 4;
    if (nextOffset > bytes.byteLength) throw assetError();

    if (!dimensions) {
      if (type !== 'IHDR' || length !== 13) throw assetError();
      const width = readUint32Be(bytes, dataOffset);
      const height = readUint32Be(bytes, dataOffset + 4);
      if (width === 0 || height === 0) throw assetError();
      dimensions = { height, width };
    }

    if (type === 'IEND') {
      if (length !== 0 || nextOffset !== bytes.byteLength) throw assetError();
      foundIend = true;
      break;
    }

    offset = nextOffset;
  }

  if (!dimensions || !foundIend) throw assetError();
  assertExpectedDimensions(kind, dimensions.width, dimensions.height);
  return { contentType: 'image/png', ...dimensions };
};

const inspectIco = (bytes: Uint8Array) => {
  if (bytes.byteLength < 6 || readUint16Le(bytes, 0) !== 0 || readUint16Le(bytes, 2) !== 1) {
    throw assetError();
  }

  const count = readUint16Le(bytes, 4);
  const directoryEnd = 6 + count * 16;
  if (count === 0 || directoryEnd > bytes.byteLength) throw assetError();

  const sizes = new Set<number>();
  for (let index = 0; index < count; index++) {
    const offset = 6 + index * 16;
    const width = bytes[offset] === 0 ? 256 : bytes[offset]!;
    const height = bytes[offset + 1] === 0 ? 256 : bytes[offset + 1]!;
    const dataLength = readUint32Le(bytes, offset + 8);
    const dataOffset = readUint32Le(bytes, offset + 12);
    if (
      dataLength === 0 ||
      dataOffset < directoryEnd ||
      dataOffset + dataLength > bytes.byteLength
    ) {
      throw assetError();
    }
    if (width === height) sizes.add(width);
  }

  if (![16, 32, 48, 256].every((size) => sizes.has(size))) throw assetError();
  return { contentType: 'image/x-icon' };
};

const inspectBmp = (kind: 'nsisHeader' | 'nsisSidebar', bytes: Uint8Array) => {
  if (bytes.byteLength < 54 || bytes[0] !== 66 || bytes[1] !== 77) throw assetError();

  const fileSize = readUint32Le(bytes, 2);
  const pixelOffset = readUint32Le(bytes, 10);
  const dibSize = readUint32Le(bytes, 14);
  if (fileSize !== bytes.byteLength || dibSize < 40 || 14 + dibSize > bytes.byteLength) {
    throw assetError();
  }

  const width = readInt32Le(bytes, 18);
  const height = readInt32Le(bytes, 22);
  const planes = readUint16Le(bytes, 26);
  const bitsPerPixel = readUint16Le(bytes, 28);
  const compression = readUint32Le(bytes, 30);
  const absoluteHeight = Math.abs(height);
  if (
    width <= 0 ||
    absoluteHeight === 0 ||
    planes !== 1 ||
    bitsPerPixel === 0 ||
    compression !== 0 ||
    pixelOffset < 14 + dibSize
  )
    throw assetError();

  const requiredPixels = Math.ceil((width * bitsPerPixel) / 32) * 4 * absoluteHeight;
  if (requiredPixels === 0 || pixelOffset + requiredPixels > bytes.byteLength) throw assetError();

  assertExpectedDimensions(kind, width, absoluteHeight);
  return { contentType: 'image/bmp', height: absoluteHeight, width };
};

export type DesktopBuildAssetInspection = Omit<DesktopBuildAsset, 'key'>;

export type DesktopBuildAssetStorage = Pick<
  FileS3,
  'createPrivatePreSignedUpload' | 'getFileByteArray' | 'getFileMetadata'
>;

export const getDesktopBuildAssetKey = (
  profileId: string,
  kind: DesktopBuildAssetKind,
  assetId: string,
) => `${DESKTOP_BUILD_ASSET_PREFIX}/${profileId}/${assetId}.${ASSET_SPECS[kind].extension}`;

export const isValidDesktopBuildAssetKey = (
  profileId: string,
  kind: DesktopBuildAssetKind,
  key: string,
) => {
  if (!isUuid(profileId)) return false;

  const prefix = `${DESKTOP_BUILD_ASSET_PREFIX}/${profileId}/`;
  const extension = `.${ASSET_SPECS[kind].extension}`;
  if (!key.startsWith(prefix) || !key.endsWith(extension)) return false;

  return isUuid(key.slice(prefix.length, -extension.length));
};

export const inspectDesktopBuildAsset = (
  kind: DesktopBuildAssetKind,
  bytes: Uint8Array,
): DesktopBuildAssetInspection => {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ASSET_BYTES[kind]) throw assetError();

  const inspection =
    kind === 'appPreview'
      ? inspectPng(kind, bytes)
      : kind === 'windowsIcon'
        ? inspectIco(bytes)
        : inspectBmp(kind, bytes);

  return {
    ...inspection,
    kind,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.byteLength,
  };
};

export const createDesktopBuildAssetUpload = async ({
  input,
  randomId = randomUUID,
  storage,
}: {
  input: { kind: DesktopBuildAssetKind; profileId?: string };
  randomId?: () => string;
  storage: Pick<DesktopBuildAssetStorage, 'createPrivatePreSignedUpload'>;
}) => {
  const profileId = input.profileId ?? randomId();
  const assetId = randomId();
  if (!isUuid(profileId) || !isUuid(assetId)) throw assetError();

  const key = getDesktopBuildAssetKey(profileId, input.kind, assetId);
  const upload = await storage.createPrivatePreSignedUpload(key);

  return {
    headers: { ...upload.headers, 'Content-Type': ASSET_SPECS[input.kind].contentType },
    key,
    kind: input.kind,
    profileId,
    uploadUrl: upload.url,
  };
};

export const readTrustedDesktopBuildAsset = async ({
  key,
  kind,
  profileId,
  storage,
}: {
  key: string;
  kind: DesktopBuildAssetKind;
  profileId: string;
  storage: Pick<DesktopBuildAssetStorage, 'getFileByteArray' | 'getFileMetadata'>;
}): Promise<DesktopBuildAsset> => {
  if (!isValidDesktopBuildAssetKey(profileId, kind, key)) throw assetError();

  const metadata = await storage.getFileMetadata(key);
  const spec = ASSET_SPECS[kind];
  if (
    metadata.contentLength <= 0 ||
    metadata.contentLength > MAX_ASSET_BYTES[kind] ||
    normalizedContentType(metadata.contentType) !== spec.contentType
  ) {
    throw assetError();
  }

  const bytes = await storage.getFileByteArray(key);
  if (bytes.byteLength !== metadata.contentLength) throw assetError();

  const inspection = inspectDesktopBuildAsset(kind, bytes);
  if (inspection.contentType !== spec.contentType) throw assetError();
  return { ...inspection, key };
};

export const validateDesktopBuildAssetManifest = async ({
  manifest,
  profileId,
  storage,
}: {
  manifest: DesktopBuildAssetManifest;
  profileId: string;
  storage: Pick<DesktopBuildAssetStorage, 'getFileByteArray' | 'getFileMetadata'>;
}): Promise<DesktopBuildAssetManifest> => {
  const kinds: DesktopBuildAssetKind[] = ['appPreview', 'windowsIcon', 'nsisHeader', 'nsisSidebar'];
  const assets = await Promise.all(
    kinds.map(async (kind) => {
      const asset = manifest[kind];
      if (!asset || asset.kind !== kind) throw assetError();
      return [
        kind,
        await readTrustedDesktopBuildAsset({ key: asset.key, kind, profileId, storage }),
      ] as const;
    }),
  );

  return Object.fromEntries(assets) as DesktopBuildAssetManifest;
};
