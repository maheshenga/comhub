import type { PlatformPluginActionConfig } from '@lobechat/types';

import { redactPlatformPluginLogValue } from '../secrets';
import {
  assertSafePlatformPluginUrl,
  type PlatformPluginUrlResolver,
} from '../urlSafety';
import { renderTemplateString, renderTemplateValue } from './template';

type FetchResponse = {
  headers?: { get: (name: string) => string | null };
  ok: boolean;
  status: number;
  statusText?: string;
  text: () => Promise<string>;
};

export type PlatformPluginFetch = (
  input: string,
  init: RequestInit,
) => Promise<FetchResponse>;

export type PlatformPluginArtifactRequest = {
  content: Buffer | string;
  expiresAt?: Date | null;
  fileName: string;
  mimeType: string;
};

export type PlatformPluginRunnerResult = {
  aiActualCredits: number;
  artifacts: PlatformPluginArtifactRequest[];
  outputSnapshot: Record<string, unknown>;
  preview: string;
};

export interface RunApiActionPluginInput {
  action: PlatformPluginActionConfig;
  fetchImpl?: PlatformPluginFetch;
  input: Record<string, unknown>;
  resolvedSecrets?: Record<string, string>;
  resolveHostname?: PlatformPluginUrlResolver;
}

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

const buildHeaders = (
  headers: Record<string, string> | undefined,
  values: Record<string, unknown>,
) =>
  Object.fromEntries(
    Object.entries(headers ?? {}).map(([key, value]) => [key, renderTemplateString(value, values)]),
  );

const redactResolvedSecretValues = (value: unknown, secrets: Record<string, string>): unknown => {
  const secretValues = Object.values(secrets).filter(Boolean);

  if (secretValues.length === 0) return redactPlatformPluginLogValue(value);

  const redactText = (text: string) =>
    secretValues.reduce((current, secret) => current.split(secret).join('[REDACTED]'), text);

  const redactValue = (item: unknown): unknown => {
    if (typeof item === 'string') return redactText(item);
    if (Array.isArray(item)) return item.map((entry) => redactValue(entry));

    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>).map(([key, entry]) => [
          key,
          redactValue(entry),
        ]),
      );
    }

    return item;
  };

  return redactPlatformPluginLogValue(redactValue(value));
};

export const runApiActionPlugin = async ({
  action,
  fetchImpl = fetch as unknown as PlatformPluginFetch,
  input,
  resolveHostname,
  resolvedSecrets = {},
}: RunApiActionPluginInput): Promise<PlatformPluginRunnerResult> => {
  if (action.runtimeType !== 'api_action' || !action.api?.url) {
    throw new Error('PLATFORM_PLUGIN_API_ACTION_NOT_CONFIGURED');
  }

  const values = { ...input, ...resolvedSecrets };
  const renderedUrl = renderTemplateString(action.api.url, values);
  const url = await assertSafePlatformPluginUrl(renderedUrl, { resolveHostname });
  const method = action.api.method ?? 'POST';
  const headers = buildHeaders(action.api.headers, values);
  const init: RequestInit = { headers, method };

  if (method === 'POST') {
    const body = renderTemplateValue(action.api.bodyTemplate ?? input, values);
    init.body = JSON.stringify(body);
    headers['Content-Type'] ??= 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), action.api.timeoutMs ?? 30_000);
  init.signal = controller.signal;

  try {
    const response = await fetchImpl(url, init);
    const responseBody = await parseResponseBody(response);
    const selectedValue = getByPath(responseBody, action.api.responsePath);
    const outputSnapshot = {
      request: redactResolvedSecretValues({
        body: method === 'POST' ? init.body : undefined,
        headers,
        method,
        url,
      }, resolvedSecrets),
      response: redactResolvedSecretValues({
        body: responseBody,
        status: response.status,
      }, resolvedSecrets),
    };

    if (!response.ok) {
      throw new Error(`PLATFORM_PLUGIN_API_REQUEST_FAILED:${response.status}`);
    }

    return {
      aiActualCredits: 0,
      artifacts: [],
      outputSnapshot,
      preview: stringifyPreview(selectedValue),
    };
  } finally {
    clearTimeout(timeout);
  }
};
