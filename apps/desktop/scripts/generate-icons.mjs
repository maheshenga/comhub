/**
 * Generate ComHub brand icons for electron-builder.
 * Produces: build/icon.png (512x512), build/icon.ico (multi-size ICO),
 *           resources/tray.png (24x24)
 *
 * Uses @napi-rs/canvas which is already a project dependency.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCanvas } from '@napi-rs/canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, '../build');
const resourcesDir = path.resolve(__dirname, '../resources');

function drawComHubIcon(ctx, size) {
  const cx = size / 2;
  const cy = size / 2;

  // Background gradient (blue-purple)
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#4F46E5');
  grad.addColorStop(1, '#7C3AED');

  // Rounded square background
  const cornerRadius = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(cornerRadius, 0);
  ctx.lineTo(size - cornerRadius, 0);
  ctx.quadraticCurveTo(size, 0, size, cornerRadius);
  ctx.lineTo(size, size - cornerRadius);
  ctx.quadraticCurveTo(size, size, size - cornerRadius, size);
  ctx.lineTo(cornerRadius, size);
  ctx.quadraticCurveTo(0, size, 0, size - cornerRadius);
  ctx.lineTo(0, cornerRadius);
  ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // "C" letter
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.55}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', cx, cy + size * 0.02);

  // Small hub dot (bottom-right accent)
  const dotR = size * 0.07;
  ctx.beginPath();
  ctx.arc(cx + size * 0.22, cy + size * 0.22, dotR, 0, Math.PI * 2);
  ctx.fillStyle = '#34D399';
  ctx.fill();
}

// Create ICO file (multi-size)
function createIco(buffers) {
  // ICO format: header + directory entries + image data
  const numImages = buffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;

  let offset = headerSize + dirSize;
  const sizes = [16, 24, 32, 48, 64, 128, 256];

  // Calculate total size
  let totalSize = offset;
  for (const buf of buffers) {
    totalSize += buf.length;
  }

  const ico = Buffer.alloc(totalSize);

  // Header
  ico.writeUInt16LE(0, 0); // Reserved
  ico.writeUInt16LE(1, 2); // Type: ICO
  ico.writeUInt16LE(numImages, 4); // Number of images

  // Directory entries
  for (let i = 0; i < numImages; i++) {
    const entryOffset = headerSize + i * dirEntrySize;
    const s = sizes[i];
    ico.writeUInt8(s < 256 ? s : 0, entryOffset); // Width
    ico.writeUInt8(s < 256 ? s : 0, entryOffset + 1); // Height
    ico.writeUInt8(0, entryOffset + 2); // Color palette
    ico.writeUInt8(0, entryOffset + 3); // Reserved
    ico.writeUInt16LE(1, entryOffset + 4); // Color planes
    ico.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    ico.writeUInt32LE(buffers[i].length, entryOffset + 8); // Size
    ico.writeUInt32LE(offset, entryOffset + 12); // Offset
    offset += buffers[i].length;
  }

  // Image data
  offset = headerSize + dirSize;
  for (const buf of buffers) {
    buf.copy(ico, offset);
    offset += buf.length;
  }

  return ico;
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(resourcesDir, { recursive: true });

  // Generate main icon (512x512 PNG)
  const mainSize = 512;
  const mainCanvas = createCanvas(mainSize, mainSize);
  const mainCtx = mainCanvas.getContext('2d');
  drawComHubIcon(mainCtx, mainSize);
  const mainPng = mainCanvas.toBuffer('image/png');
  await fs.writeFile(path.join(buildDir, 'icon.png'), mainPng);
  console.log('Created build/icon.png (512x512)');

  // Generate ICO with multiple sizes
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];
  for (const s of icoSizes) {
    const canvas = createCanvas(s, s);
    const ctx = canvas.getContext('2d');
    drawComHubIcon(ctx, s);
    pngBuffers.push(Buffer.from(canvas.toBuffer('image/png')));
  }
  const icoBuffer = createIco(pngBuffers);
  await fs.writeFile(path.join(buildDir, 'icon.ico'), icoBuffer);
  console.log('Created build/icon.ico (multi-size)');

  // Generate tray icon (24x24)
  const traySize = 24;
  const trayCanvas = createCanvas(traySize, traySize);
  const trayCtx = trayCanvas.getContext('2d');
  drawComHubIcon(trayCtx, traySize);
  const trayPng = trayCanvas.toBuffer('image/png');
  await fs.writeFile(path.join(resourcesDir, 'tray.png'), trayPng);
  await fs.writeFile(path.join(resourcesDir, 'trayTemplate.png'), trayPng);
  await fs.writeFile(path.join(resourcesDir, 'trayTemplate@2x.png'), trayPng);
  console.log('Created resources/tray.png');

  // Generate NSIS header (150x57 BMP-like PNG — electron-builder accepts PNG)
  const headerCanvas = createCanvas(150, 57);
  const headerCtx = headerCanvas.getContext('2d');
  const hGrad = headerCtx.createLinearGradient(0, 0, 150, 0);
  hGrad.addColorStop(0, '#4F46E5');
  hGrad.addColorStop(1, '#7C3AED');
  headerCtx.fillStyle = hGrad;
  headerCtx.fillRect(0, 0, 150, 57);
  headerCtx.fillStyle = '#FFFFFF';
  headerCtx.font = 'bold 20px sans-serif';
  headerCtx.textAlign = 'center';
  headerCtx.textBaseline = 'middle';
  headerCtx.fillText('ComHub', 75, 28);
  await fs.writeFile(path.join(buildDir, 'nsis-header.bmp'), headerCanvas.toBuffer('image/png'));
  console.log('Created build/nsis-header.bmp');

  // Generate NSIS sidebar (164x314)
  const sideCanvas = createCanvas(164, 314);
  const sideCtx = sideCanvas.getContext('2d');
  const sGrad = sideCtx.createLinearGradient(0, 0, 0, 314);
  sGrad.addColorStop(0, '#4F46E5');
  sGrad.addColorStop(1, '#7C3AED');
  sideCtx.fillStyle = sGrad;
  sideCtx.fillRect(0, 0, 164, 314);
  // Draw icon in center
  drawComHubIcon(sideCtx, 80);
  sideCtx.save();
  sideCtx.translate(42, 100);
  drawComHubIcon(sideCtx, 80);
  sideCtx.restore();
  sideCtx.fillStyle = '#FFFFFF';
  sideCtx.font = 'bold 18px sans-serif';
  sideCtx.textAlign = 'center';
  sideCtx.fillText('ComHub', 82, 220);
  await fs.writeFile(path.join(buildDir, 'nsis-sidebar.bmp'), sideCanvas.toBuffer('image/png'));
  console.log('Created build/nsis-sidebar.bmp');

  console.log('\nAll ComHub icons generated successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
