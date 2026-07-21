import { deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  createDesktopBuildAssetUpload,
  inspectDesktopBuildAsset,
  readTrustedDesktopBuildAsset,
  validateDesktopBuildAssetManifest,
} from './assets';

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '22222222-2222-4222-8222-222222222222';
const HEADER_ID = '33333333-3333-4333-8333-333333333333';
const SIDEBAR_ID = '44444444-4444-4444-8444-444444444444';

const writeUint16Le = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = value & 255;
  bytes[offset + 1] = (value >>> 8) & 255;
};

const writeUint32Be = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = (value >>> 24) & 255;
  bytes[offset + 1] = (value >>> 16) & 255;
  bytes[offset + 2] = (value >>> 8) & 255;
  bytes[offset + 3] = value & 255;
};

const writeUint32Le = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = value & 255;
  bytes[offset + 1] = (value >>> 8) & 255;
  bytes[offset + 2] = (value >>> 16) & 255;
  bytes[offset + 3] = (value >>> 24) & 255;
};

const concatBytes = (...parts: Uint8Array[]) => {
  const bytes = new Uint8Array(parts.reduce((length, part) => length + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
};

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data: Uint8Array) => {
  const typeBytes = Uint8Array.from([...type].map((character) => character.charCodeAt(0)));
  const bytes = new Uint8Array(12 + data.byteLength);
  writeUint32Be(bytes, 0, data.byteLength);
  bytes.set(typeBytes, 4);
  bytes.set(data, 8);
  writeUint32Be(bytes, 8 + data.byteLength, crc32(bytes.slice(4, 8 + data.byteLength)));
  return bytes;
};

type PngOptions = {
  bitDepth?: number;
  colorType?: number;
  compressionMethod?: number;
  filterMethod?: number;
  idat?: Uint8Array;
  includeIdat?: boolean;
  interlaceMethod?: number;
};

const pngIdatCache = new Map<string, Uint8Array>();

const createValidPngIdat = (width: number, height: number) => {
  const key = `${width}x${height}`;
  const cached = pngIdatCache.get(key);
  if (cached) return cached;

  const idat = new Uint8Array(deflateSync(Buffer.alloc(height * (1 + width * 4))));
  pngIdatCache.set(key, idat);
  return idat;
};

const png = (width: number, height: number, options: PngOptions = {}) => {
  const ihdr = new Uint8Array(13);
  writeUint32Be(ihdr, 0, width);
  writeUint32Be(ihdr, 4, height);
  ihdr[8] = options.bitDepth ?? 8;
  ihdr[9] = options.colorType ?? 6;
  ihdr[10] = options.compressionMethod ?? 0;
  ihdr[11] = options.filterMethod ?? 0;
  ihdr[12] = options.interlaceMethod ?? 0;

  const idat = options.idat ?? createValidPngIdat(width, height);
  return concatBytes(
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    ...(options.includeIdat === false ? [] : [pngChunk('IDAT', idat)]),
    pngChunk('IEND', new Uint8Array()),
  );
};

const bmp = (width: number, height: number) => {
  const rowBytes = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowBytes * height;
  const bytes = new Uint8Array(54 + pixelBytes);
  bytes.set([66, 77]);
  writeUint32Le(bytes, 2, bytes.byteLength);
  writeUint32Le(bytes, 10, 54);
  writeUint32Le(bytes, 14, 40);
  writeUint32Le(bytes, 18, width);
  writeUint32Le(bytes, 22, height);
  writeUint16Le(bytes, 26, 1);
  writeUint16Le(bytes, 28, 24);
  writeUint32Le(bytes, 34, pixelBytes);
  return bytes;
};

const ico = () => {
  const sizes = [16, 32, 48, 256];
  const bytes = new Uint8Array(6 + sizes.length * 16 + sizes.length * 4);
  writeUint16Le(bytes, 0, 0);
  writeUint16Le(bytes, 2, 1);
  writeUint16Le(bytes, 4, sizes.length);

  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    bytes[entry] = size === 256 ? 0 : size;
    bytes[entry + 1] = size === 256 ? 0 : size;
    writeUint16Le(bytes, entry + 4, 1);
    writeUint16Le(bytes, entry + 6, 32);
    writeUint32Le(bytes, entry + 8, 4);
    writeUint32Le(bytes, entry + 12, 6 + sizes.length * 16 + index * 4);
  });

  return bytes;
};

const manifest = () => ({
  appPreview: {
    contentType: 'text/plain',
    height: 1,
    key: `desktop-build-assets/${PROFILE_ID}/${ASSET_ID}.png`,
    kind: 'appPreview' as const,
    sha256: 'untrusted',
    size: 1,
    width: 1,
  },
  nsisHeader: {
    contentType: 'text/plain',
    height: 1,
    key: `desktop-build-assets/${PROFILE_ID}/${HEADER_ID}.bmp`,
    kind: 'nsisHeader' as const,
    sha256: 'untrusted',
    size: 1,
    width: 1,
  },
  nsisSidebar: {
    contentType: 'text/plain',
    height: 1,
    key: `desktop-build-assets/${PROFILE_ID}/${SIDEBAR_ID}.bmp`,
    kind: 'nsisSidebar' as const,
    sha256: 'untrusted',
    size: 1,
    width: 1,
  },
  windowsIcon: {
    contentType: 'text/plain',
    key: `desktop-build-assets/${PROFILE_ID}/${ASSET_ID}.ico`,
    kind: 'windowsIcon' as const,
    sha256: 'untrusted',
    size: 1,
  },
});

describe('inspectDesktopBuildAsset', () => {
  it('accepts an ico containing all required sizes', () => {
    expect(inspectDesktopBuildAsset('windowsIcon', ico())).toMatchObject({
      contentType: 'image/x-icon',
      kind: 'windowsIcon',
    });
  });

  it.each([
    ['appPreview', png(1024, 1024)],
    ['nsisHeader', bmp(150, 57)],
    ['nsisSidebar', bmp(164, 314)],
  ] as const)('validates %s dimensions', (kind, body) => {
    expect(inspectDesktopBuildAsset(kind, body)).toMatchObject({ kind });
  });

  it('rejects a truncated PNG chunk', () => {
    expect(() => inspectDesktopBuildAsset('appPreview', png(1024, 1024).slice(0, 30))).toThrow(
      'Invalid desktop build asset',
    );
  });

  it.each([
    ['without an IDAT chunk', png(1024, 1024, { includeIdat: false })],
    ['with an empty IDAT chunk', png(1024, 1024, { idat: new Uint8Array() })],
    [
      'with an IDAT stream that cannot represent image scanlines',
      png(1024, 1024, { idat: new Uint8Array(deflateSync(new Uint8Array())) }),
    ],
    ['with an invalid bit-depth/color-type combination', png(1024, 1024, { bitDepth: 4 })],
    ['with a non-zero compression method', png(1024, 1024, { compressionMethod: 1 })],
    ['with a non-zero filter method', png(1024, 1024, { filterMethod: 1 })],
    ['with an invalid interlace method', png(1024, 1024, { interlaceMethod: 2 })],
    [
      'with an invalid IEND CRC',
      (() => {
        const body = png(1024, 1024);
        body[body.byteLength - 1] ^= 1;
        return body;
      })(),
    ],
    [
      'with a duplicate IHDR chunk',
      (() => {
        const body = png(1024, 1024);
        return concatBytes(body.slice(0, 8), body.slice(8, 33), body.slice(8));
      })(),
    ],
    [
      'with non-contiguous IDAT chunks',
      (() => {
        const body = png(1024, 1024);
        return concatBytes(
          body.slice(0, 33),
          pngChunk('IDAT', new Uint8Array()),
          pngChunk('tEXt', new Uint8Array([0])),
          body.slice(33),
        );
      })(),
    ],
    ['with trailing data after IEND', concatBytes(png(1024, 1024), new Uint8Array([0]))],
  ])('rejects a PNG %s', (_reason, body) => {
    expect(() => inspectDesktopBuildAsset('appPreview', body)).toThrow(
      'Invalid desktop build asset',
    );
  });

  it('rejects an invalid desktop-build dimension', () => {
    expect(() => inspectDesktopBuildAsset('nsisHeader', bmp(149, 57))).toThrow(
      'Invalid desktop build asset',
    );
  });

  it('rejects an invalid BMP compression header', () => {
    const invalidCompression = bmp(150, 57);
    writeUint32Le(invalidCompression, 30, 99);

    expect(() => inspectDesktopBuildAsset('nsisHeader', invalidCompression)).toThrow(
      'Invalid desktop build asset',
    );
  });

  it('rejects an ICO missing a required size', () => {
    const missingSize = ico();
    missingSize[6] = 24;

    expect(() => inspectDesktopBuildAsset('windowsIcon', missingSize)).toThrow(
      'Invalid desktop build asset',
    );
  });

  it('issues a private upload target with a server-generated profile and exact asset key', async () => {
    const createPrivatePreSignedUpload = async () => ({
      headers: { 'x-amz-acl': 'private' },
      url: 'https://uploads.example.test/opaque-signature',
    });

    const result = await createDesktopBuildAssetUpload({
      input: { kind: 'appPreview' },
      randomId: (() => {
        const ids = [PROFILE_ID, ASSET_ID];
        return () => ids.shift()!;
      })(),
      storage: { createPrivatePreSignedUpload },
    });

    expect(result).toEqual({
      headers: { 'Content-Type': 'image/png', 'x-amz-acl': 'private' },
      key: `desktop-build-assets/${PROFILE_ID}/${ASSET_ID}.png`,
      kind: 'appPreview',
      profileId: PROFILE_ID,
      uploadUrl: 'https://uploads.example.test/opaque-signature',
    });
    expect(JSON.stringify(result)).not.toContain('GET');
  });

  it('reads trusted metadata and bytes instead of client-provided values', async () => {
    const body = png(1024, 1024);
    const storage = {
      getFileByteArray: async () => body,
      getFileMetadata: async () => ({ contentLength: body.byteLength, contentType: 'image/png' }),
    };

    await expect(
      readTrustedDesktopBuildAsset({
        key: `desktop-build-assets/${PROFILE_ID}/${ASSET_ID}.png`,
        kind: 'appPreview',
        profileId: PROFILE_ID,
        storage,
      }),
    ).resolves.toMatchObject({
      contentType: 'image/png',
      height: 1024,
      kind: 'appPreview',
      size: body.byteLength,
      width: 1024,
    });
  });

  it.each([
    [
      'metadata MIME mismatch',
      { contentLength: png(1024, 1024).byteLength, contentType: 'image/bmp' },
    ],
    ['metadata/body size mismatch', { contentLength: 1, contentType: 'image/png' }],
  ])('rejects a %s before trusting an uploaded asset', async (_name, metadata) => {
    await expect(
      readTrustedDesktopBuildAsset({
        key: `desktop-build-assets/${PROFILE_ID}/${ASSET_ID}.png`,
        kind: 'appPreview',
        profileId: PROFILE_ID,
        storage: {
          getFileByteArray: async () => png(1024, 1024),
          getFileMetadata: async () => metadata,
        },
      }),
    ).rejects.toThrow('Invalid desktop build asset');
  });

  it('rejects a cross-profile or traversal asset key before reading storage', async () => {
    const getFileMetadata = async () => ({ contentLength: 1, contentType: 'image/png' });

    await expect(
      readTrustedDesktopBuildAsset({
        key: `desktop-build-assets/${PROFILE_ID}/../${ASSET_ID}.png`,
        kind: 'appPreview',
        profileId: PROFILE_ID,
        storage: { getFileByteArray: async () => png(1024, 1024), getFileMetadata },
      }),
    ).rejects.toThrow('Invalid desktop build asset');
  });

  it('requires the generated key prefix and extension casing exactly', async () => {
    await expect(
      readTrustedDesktopBuildAsset({
        key: `DESKTOP-BUILD-ASSETS/${PROFILE_ID}/${ASSET_ID}.PNG`,
        kind: 'appPreview',
        profileId: PROFILE_ID,
        storage: {
          getFileByteArray: async () => png(1024, 1024),
          getFileMetadata: async () => ({
            contentLength: png(1024, 1024).byteLength,
            contentType: 'image/png',
          }),
        },
      }),
    ).rejects.toThrow('Invalid desktop build asset');
  });

  it('revalidates every draft-manifest entry and replaces browser metadata', async () => {
    const bodies = {
      appPreview: png(1024, 1024),
      nsisHeader: bmp(150, 57),
      nsisSidebar: bmp(164, 314),
      windowsIcon: ico(),
    };
    const storage = {
      getFileByteArray: async (key: string) => {
        if (key.endsWith('.png')) return bodies.appPreview;
        if (key.endsWith('.ico')) return bodies.windowsIcon;
        return key.includes(HEADER_ID) ? bodies.nsisHeader : bodies.nsisSidebar;
      },
      getFileMetadata: async (key: string) => {
        const body = await storage.getFileByteArray(key);
        return {
          contentLength: body.byteLength,
          contentType: key.endsWith('.png')
            ? 'image/png'
            : key.endsWith('.ico')
              ? 'image/x-icon'
              : 'image/bmp',
        };
      },
    };
    const input = manifest();
    const trustedManifest = await validateDesktopBuildAssetManifest({
      manifest: input,
      profileId: PROFILE_ID,
      storage,
    });

    expect(trustedManifest).toMatchObject({
      appPreview: { contentType: 'image/png', height: 1024, width: 1024 },
      nsisHeader: { contentType: 'image/bmp', height: 57, width: 150 },
      nsisSidebar: { contentType: 'image/bmp', height: 314, width: 164 },
      windowsIcon: { contentType: 'image/x-icon' },
    });
    expect(trustedManifest.appPreview.sha256).not.toBe('untrusted');
    expect(trustedManifest.appPreview.size).toBe(bodies.appPreview.byteLength);
  });
});
