import {
  type ModuleAppInvocation,
  moduleAppInvocationSchema,
} from '@lobechat/types';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type ModuleAppRuntimeClientOptions = {
  baseUrl?: string;
  enabled?: boolean;
  fetch?: FetchLike;
  internalToken?: string;
};

export class ModuleAppRuntimeClient {
  private readonly baseUrl?: string;
  private readonly enabled: boolean;
  private readonly fetch: FetchLike;
  private readonly internalToken?: string;

  constructor(options: ModuleAppRuntimeClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env.MODULE_APP_RUNTIME_INTERNAL_URL;
    this.enabled = options.enabled ?? process.env.MODULE_APP_EXECUTION_ENABLED === 'true';
    this.fetch = options.fetch ?? fetch;
    this.internalToken = options.internalToken ?? process.env.MODULE_APP_RUNTIME_INTERNAL_TOKEN;
  }

  invoke = async (input: ModuleAppInvocation) => {
    if (!this.enabled) throw new Error('MODULE_APP_EXECUTION_DISABLED');
    if (!this.baseUrl || !this.internalToken) throw new Error('MODULE_APP_RUNTIME_CONFIG_MISSING');
    const invocation = moduleAppInvocationSchema.parse(input);
    const endpoint = new URL('/v1/invocations', `${this.baseUrl.replace(/\/$/, '')}/`).toString();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), invocation.timeoutMs);

    try {
      const response = await this.fetch(endpoint, {
        body: JSON.stringify(invocation),
        headers: {
          authorization: `Bearer ${this.internalToken}`,
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: abortController.signal,
      });
      if (!response.ok) throw new Error('MODULE_APP_RUNTIME_REQUEST_FAILED');
      return response.json();
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error('MODULE_APP_RUNTIME_TIMEOUT', { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}
