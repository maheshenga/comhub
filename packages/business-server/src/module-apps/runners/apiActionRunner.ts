import type { ModuleAppActionConfig } from '@lobechat/types';

import { redactResolvedModuleAppSecretValues } from '../logRedaction';
import {
  assertSafeModuleAppApiUrl,
  type ModuleAppUrlResolver,
} from '../safeUrl';
import { renderModuleAppTemplateString, renderModuleAppTemplateValue } from '../runtimeTemplate';

type FetchResponse = {
  headers?: { get: (name: string) => string | null };
  ok: boolean;
  status: number;
  statusText?: string;
  text: () => Promise<string>;
};

export type ModuleAppFetch = (
  input: string,
  init: RequestInit,
) => Promise<FetchResponse>;

export type ModuleAppRunnerArtifactRequest = {
  content: Buffer | string;
  expiresAt?: Date | null;
  fileName: string;
  mimeType: string;
};

export type ModuleAppRunnerResult = {
  actualAiCredits: number;
  artifacts: ModuleAppRunnerArtifactRequest[];
  output: Record<string, unknown>;
  preview: string;
};

export interface RunModuleAppApiActionInput {
  action: ModuleAppActionConfig;
  fetchImpl?: ModuleAppFetch;
  input: Record<string, unknown>;
  resolvedSecrets?: Record<string, string>;
  resolveHostname?: ModuleAppUrlResolver;
}

const getStringConfig = (config: Record<string, unknown>, key: string) => {
  const value = config[key];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const getNumberConfig = (config: Record<string, unknown>, key: string, fallback: number) => {
  const value = config[key];

  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
};

const getMethodConfig = (config: Record<string, unknown>) => {
  const method = getStringConfig(config, 'method')?.toUpperCase();

  return method === 'GET' ? 'GET' : 'POST';
};

const getHeadersConfig = (config: Record<string, unknown>) => {
  const value = config.headers;

  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => typeof entry === 'string')
      .map(([key, entry]) => [key, entry as string]),
  );
};

const buildHeaders = (headers: Record<string, string>, values: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      renderModuleAppTemplateString(value, values),
    ]),
  );

const getByPath = (value: unknown, path?: string) => {
  if (!path) return value;

  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;

    return (current as Record<string, unknown>)[segment];
  }, value);
};

const stringifyPreview = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';

  return JSON.stringify(value);
};

const parseResponseBody = async (response: FetchResponse) => {
  const text = await response.text();
  const contentType = response.headers?.get('content-type') ?? '';

  if (contentType.toLowerCase().includes('json')) {
    return text ? JSON.parse(text) : null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const runModuleAppApiAction = async ({
  action,
  fetchImpl = fetch as unknown as ModuleAppFetch,
  input,
  resolvedSecrets = {},
  resolveHostname,
}: RunModuleAppApiActionInput): Promise<ModuleAppRunnerResult> => {
  const config = action.runtimeConfig;
  const configuredUrl = getStringConfig(config, 'url') ?? getStringConfig(config, 'endpoint');

  if (action.runtimeType !== 'api_action' || !configuredUrl) {
    throw new Error('MODULE_APP_API_ACTION_NOT_CONFIGURED');
  }

  const values = { ...input, ...resolvedSecrets };
  const renderedUrl = renderModuleAppTemplateString(configuredUrl, values);
  const url = await assertSafeModuleAppApiUrl(renderedUrl, { resolveHostname });
  const method = getMethodConfig(config);
  const headers = buildHeaders(getHeadersConfig(config), values);
  const init: RequestInit = { headers, method };

  if (method === 'POST') {
    const bodyTemplate = config.bodyTemplate ?? input;
    const body = renderModuleAppTemplateValue(bodyTemplate, values);
    init.body = JSON.stringify(body);
    headers['Content-Type'] ??= 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getNumberConfig(config, 'timeoutMs', 30_000));
  init.signal = controller.signal;

  try {
    const response = await fetchImpl(url, init);
    const responseBody = await parseResponseBody(response);
    const selectedValue = getByPath(responseBody, getStringConfig(config, 'responsePath'));
    const output = {
      request: redactResolvedModuleAppSecretValues(
        {
          body: method === 'POST' ? init.body : undefined,
          headers,
          method,
          url,
        },
        resolvedSecrets,
      ),
      response: redactResolvedModuleAppSecretValues(
        {
          body: responseBody,
          status: response.status,
        },
        resolvedSecrets,
      ),
    };

    if (!response.ok) {
      throw new Error(`MODULE_APP_API_REQUEST_FAILED:${response.status}`);
    }

    return {
      actualAiCredits: 0,
      artifacts: [],
      output,
      preview: stringifyPreview(selectedValue),
    };
  } finally {
    clearTimeout(timeout);
  }
};
