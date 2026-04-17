import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

type BrandState = 'default' | 'done' | 'error' | 'progress';

interface IconSpec {
  dev?: boolean;
  file: string;
  maskable?: boolean;
  size: number;
  state?: BrandState;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const brandingFile = path.join(rootDir, 'packages/const/src/branding.ts');

const iconSpecs: IconSpec[] = [
  { file: 'favicon.png', size: 64 },
  { file: 'favicon-done.png', size: 64, state: 'done' },
  { file: 'favicon-error.png', size: 64, state: 'error' },
  { file: 'favicon-progress.png', size: 64, state: 'progress' },
  { dev: true, file: 'favicon-dev.png', size: 64 },
  { dev: true, file: 'favicon-done-dev.png', size: 64, state: 'done' },
  { dev: true, file: 'favicon-error-dev.png', size: 64, state: 'error' },
  { dev: true, file: 'favicon-progress-dev.png', size: 64, state: 'progress' },
  { file: 'favicon-32x32.png', size: 32 },
  { file: 'favicon-32x32-done.png', size: 32, state: 'done' },
  { file: 'favicon-32x32-error.png', size: 32, state: 'error' },
  { file: 'favicon-32x32-progress.png', size: 32, state: 'progress' },
  { dev: true, file: 'favicon-32x32-dev.png', size: 32 },
  { dev: true, file: 'favicon-32x32-done-dev.png', size: 32, state: 'done' },
  { dev: true, file: 'favicon-32x32-error-dev.png', size: 32, state: 'error' },
  { dev: true, file: 'favicon-32x32-progress-dev.png', size: 32, state: 'progress' },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icons/icon-192x192.png', size: 192 },
  { file: 'icons/icon-192x192.maskable.png', maskable: true, size: 192 },
  { file: 'icons/icon-512x512.png', size: 512 },
  { file: 'icons/icon-512x512.maskable.png', maskable: true, size: 512 },
];

const createBackgroundSvg = (size: number, maskable = false, dev = false) => {
  const inset = Math.round(size * (maskable ? 0.08 : 0.06));
  const frameSize = size - inset * 2;
  const radius = Math.round(frameSize * (maskable ? 0.23 : 0.26));
  const strokeWidth = Math.max(2, Math.round(size * 0.014));
  const glowColor = dev ? '#4FD1BC' : '#B8CCFF';
  const shadowColor = dev ? '#0C7A67' : '#274E8A';

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="qingyou-bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF" />
      <stop offset="1" stop-color="${dev ? '#DFF7F2' : '#E4ECFF'}" />
    </linearGradient>
    <radialGradient id="qingyou-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${Math.round(
      size * 0.28,
    )} ${Math.round(size * 0.22)}) rotate(35) scale(${Math.round(size * 0.34)} ${Math.round(
      size * 0.3,
    )})">
      <stop stop-color="${glowColor}" stop-opacity="0.46" />
      <stop offset="1" stop-color="${glowColor}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="qingyou-shadow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${Math.round(
      size * 0.76,
    )} ${Math.round(size * 0.78)}) rotate(180) scale(${Math.round(size * 0.42)} ${Math.round(
      size * 0.38,
    )})">
      <stop stop-color="${shadowColor}" stop-opacity="0.12" />
      <stop offset="1" stop-color="${shadowColor}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect x="${inset}" y="${inset}" width="${frameSize}" height="${frameSize}" rx="${radius}" fill="url(#qingyou-bg)" />
  <rect x="${inset}" y="${inset}" width="${frameSize}" height="${frameSize}" rx="${radius}" fill="none" stroke="${
    dev ? '#59C9B8' : '#AFC2F5'
  }" stroke-opacity="0.82" stroke-width="${strokeWidth}" />
  <circle cx="${Math.round(size * 0.28)}" cy="${Math.round(size * 0.22)}" r="${Math.round(
    size * 0.26,
  )}" fill="url(#qingyou-glow)" />
  <circle cx="${Math.round(size * 0.76)}" cy="${Math.round(size * 0.78)}" r="${Math.round(
    size * 0.34,
  )}" fill="url(#qingyou-shadow)" />
</svg>`;
};

const badgeSvg = (size: number, options: { bottomRight?: BrandState; topLeftDev?: boolean }) => {
  const fragments: string[] = [];
  const circleRadius = Math.max(4, Math.round(size * 0.16));
  const circleSize = circleRadius * 2;

  const renderBadge = (
    x: number,
    y: number,
    fill: string,
    shape: string,
    shapeStroke = 'none',
    strokeWidth = 0,
  ) => `
    <g>
      <circle cx="${x}" cy="${y}" r="${circleRadius}" fill="${fill}" stroke="#FFFFFF" stroke-width="${Math.max(
        1.5,
        size * 0.03,
      )}" />
      ${shape
        .replaceAll('{x}', String(x))
        .replaceAll('{y}', String(y))
        .replaceAll('{r}', String(circleRadius))
        .replaceAll('{stroke}', shapeStroke)
        .replaceAll('{strokeWidth}', String(strokeWidth))}
    </g>`;

  if (options.topLeftDev) {
    const x = Math.round(size * 0.23);
    const y = Math.round(size * 0.23);
    fragments.push(
      renderBadge(
        x,
        y,
        '#0E9F8B',
        `<text x="{x}" y="{y}" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="${Math.max(
          6,
          circleSize * 0.72,
        )}" font-weight="700" text-anchor="middle" dominant-baseline="central">D</text>`,
      ),
    );
  }

  if (options.bottomRight) {
    const x = Math.round(size * 0.77);
    const y = Math.round(size * 0.77);

    if (options.bottomRight === 'done') {
      fragments.push(
        renderBadge(
          x,
          y,
          '#16A34A',
          `<path d="M {x} ${y + circleRadius * 0.34} L ${x - circleRadius * 0.45} ${
            y - circleRadius * 0.03
          } L ${x - circleRadius * 0.08} ${y + circleRadius * 0.3} L ${x + circleRadius * 0.52} ${
            y - circleRadius * 0.38
          }" fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-width="${Math.max(
            1.7,
            size * 0.05,
          )}" />`,
        ),
      );
    }

    if (options.bottomRight === 'error') {
      fragments.push(
        renderBadge(
          x,
          y,
          '#DC2626',
          `<g fill="#FFFFFF">
            <rect x="${x - Math.max(1, circleRadius * 0.12)}" y="${y - circleRadius * 0.56}" width="${Math.max(
              2,
              circleRadius * 0.24,
            )}" height="${circleRadius * 0.78}" rx="${Math.max(1, circleRadius * 0.12)}" />
            <circle cx="${x}" cy="${y + circleRadius * 0.55}" r="${Math.max(1.2, circleRadius * 0.14)}" />
          </g>`,
        ),
      );
    }

    if (options.bottomRight === 'progress') {
      const dotRadius = Math.max(1.2, circleRadius * 0.13);
      const dotOffset = circleRadius * 0.38;
      fragments.push(
        renderBadge(
          x,
          y,
          '#F59E0B',
          `<g fill="#FFFFFF">
            <circle cx="${x - dotOffset}" cy="${y}" r="${dotRadius}" />
            <circle cx="${x}" cy="${y}" r="${dotRadius}" />
            <circle cx="${x + dotOffset}" cy="${y}" r="${dotRadius}" />
          </g>`,
        ),
      );
    }
  }

  if (fragments.length === 0) return null;

  return Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${fragments.join(
      '',
    )}</svg>`,
  );
};

const loadBrandIconSvg = async () => {
  const brandingSource = await readFile(brandingFile, 'utf8');
  const match = brandingSource.match(/DEFAULT_BRAND_ICON_SVG = `([\s\S]*?)`;/);

  if (!match) {
    throw new Error('Unable to locate DEFAULT_BRAND_ICON_SVG in packages/const/src/branding.ts');
  }

  return match[1];
};

const brandIconSvg = await loadBrandIconSvg();

const renderBrandAsset = async ({
  size,
  state = 'default',
  dev = false,
  maskable = false,
}: IconSpec) => {
  const iconScale = size <= 32 ? 0.58 : maskable ? 0.5 : 0.56;
  const iconSize = Math.round(size * iconScale);
  const iconOffset = Math.round((size - iconSize) / 2);

  const layers = [
    {
      input: Buffer.from(createBackgroundSvg(size, maskable, dev)),
    },
    {
      input: await sharp(Buffer.from(brandIconSvg))
        .resize(iconSize, iconSize, { fit: 'contain' })
        .png()
        .toBuffer(),
      left: iconOffset,
      top: iconOffset,
    },
  ];

  const badges = badgeSvg(size, {
    bottomRight: state === 'default' ? undefined : state,
    topLeftDev: dev,
  });

  if (badges) layers.push({ input: badges });

  return sharp({
    create: {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
      height: size,
      width: size,
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
};

const writeAsset = async (spec: IconSpec) => {
  const outputPath = path.join(publicDir, spec.file);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const buffer = await renderBrandAsset(spec);
  await sharp(buffer).toFile(outputPath);
  console.log(`generated ${spec.file}`);
};

await Promise.all(iconSpecs.map(writeAsset));
