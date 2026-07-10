import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { verifyRuntimeCapability } from './capability';
import { FixedProcessModuleAppLauncher, ModuleAppRuntimeInvoker } from './invocation';

const MAX_REQUEST_BYTES = 1024 * 1024 + 16 * 1024;
const MODULE_APP_RUNTIME_ARTIFACT_ROOT = '/runtime/artifacts';

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const readJson = async (request: IncomingMessage) => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > MAX_REQUEST_BYTES) throw new Error('MODULE_APP_RUNTIME_REQUEST_TOO_LARGE');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
};

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
};

const sendNotFound = (response: ServerResponse) => sendJson(response, 404, { error: 'not_found' });

const serveRuntimeAsset = async (
  request: IncomingMessage,
  response: ServerResponse,
  artifactRoot: string,
) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const pathname = new URL(request.url ?? '/', 'http://module-runtime.internal').pathname;
  const match = pathname.match(/^\/artifacts\/([a-f0-9]{64})\/(.+)$/i);
  if (!match) return false;

  try {
    const artifactDirectory = await realpath(path.join(artifactRoot, match[1]));
    const assetPath = await realpath(path.join(artifactDirectory, decodeURIComponent(match[2])));
    const relativePath = path.relative(artifactDirectory, assetPath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      sendNotFound(response);
      return true;
    }
    const asset = await stat(assetPath);
    if (!asset.isFile()) {
      sendNotFound(response);
      return true;
    }
    const host = request.headers.host?.toLowerCase();
    const trustedHost = host && /^[a-z0-9.-]+(?::\d+)?$/.test(host) ? host : undefined;
    const assetOrigins = trustedHost ? `http://${trustedHost} https://${trustedHost}` : '';

    response.writeHead(200, {
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=31536000, immutable',
      'content-length': asset.size,
      'content-security-policy':
        `default-src 'none'; base-uri 'none'; connect-src 'none'; font-src ${assetOrigins} data:; ` +
        `frame-ancestors *; img-src ${assetOrigins} data: blob:; object-src 'none'; ` +
        `script-src ${assetOrigins} 'unsafe-inline'; style-src ${assetOrigins} 'unsafe-inline'`,
      'content-type': contentTypes[path.extname(assetPath).toLowerCase()] ?? 'application/octet-stream',
      'cross-origin-resource-policy': 'cross-origin',
      'x-content-type-options': 'nosniff',
    });
    if (request.method === 'HEAD') {
      response.end();
      return true;
    }
    const stream = createReadStream(assetPath);
    stream.once('error', () => response.destroy());
    stream.pipe(response);
    return true;
  } catch {
    sendNotFound(response);
    return true;
  }
};

export const createModuleAppRuntimeServer = (options: {
  artifactRoot?: string;
  internalToken: string;
  invoker: ModuleAppRuntimeInvoker;
  runtimeJwks: string;
}) => {
  if (!options.internalToken.trim() || !options.runtimeJwks.trim()) {
    throw new Error('MODULE_APP_RUNTIME_CONFIG_MISSING');
  }

  return createServer(async (request, response) => {
    if (
      await serveRuntimeAsset(
        request,
        response,
        options.artifactRoot ?? MODULE_APP_RUNTIME_ARTIFACT_ROOT,
      )
    ) {
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/invocations') {
      sendNotFound(response);
      return;
    }
    if (request.headers.authorization !== `Bearer ${options.internalToken}`) {
      sendJson(response, 401, { error: 'unauthorized' });
      return;
    }

    try {
      const input = await readJson(request);
      if (!input || typeof input !== 'object' || !('capability' in input)) {
        throw new Error('MODULE_APP_RUNTIME_CAPABILITY_INVALID');
      }
      await verifyRuntimeCapability(String(input.capability), options.runtimeJwks);
      sendJson(response, 200, await options.invoker.invoke(input));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'MODULE_APP_RUNTIME_FAILED';
      sendJson(response, 400, { error: code });
    }
  });
};

export const startModuleAppRuntimeServerFromEnv = () => {
  if (process.env.MODULE_APP_EXECUTION_ENABLED !== 'true') {
    throw new Error('MODULE_APP_EXECUTION_DISABLED');
  }
  const internalToken = process.env.MODULE_APP_RUNTIME_INTERNAL_TOKEN;
  const runtimeJwks = process.env.MODULE_APP_RUNTIME_JWKS;
  if (!internalToken || !runtimeJwks) throw new Error('MODULE_APP_RUNTIME_CONFIG_MISSING');

  const server = createModuleAppRuntimeServer({
    internalToken,
    invoker: new ModuleAppRuntimeInvoker({ launcher: new FixedProcessModuleAppLauncher() }),
    runtimeJwks,
  });
  server.listen(Number(process.env.PORT ?? 3210), '0.0.0.0');
  return server;
};

export const isModuleAppRuntimeMain = (moduleUrl: string, entryPath?: string) =>
  Boolean(entryPath && moduleUrl === pathToFileURL(entryPath).href);

if (isModuleAppRuntimeMain(import.meta.url, process.argv[1])) {
  startModuleAppRuntimeServerFromEnv();
}
