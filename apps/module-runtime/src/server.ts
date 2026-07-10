import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';

import { verifyRuntimeCapability } from './capability';
import { FixedProcessModuleAppLauncher, ModuleAppRuntimeInvoker } from './invocation';

const MAX_REQUEST_BYTES = 1024 * 1024 + 16 * 1024;

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

export const createModuleAppRuntimeServer = (options: {
  internalToken: string;
  invoker: ModuleAppRuntimeInvoker;
  runtimeJwks: string;
}) => {
  if (!options.internalToken.trim() || !options.runtimeJwks.trim()) {
    throw new Error('MODULE_APP_RUNTIME_CONFIG_MISSING');
  }

  return createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/invocations') {
      sendJson(response, 404, { error: 'not_found' });
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
