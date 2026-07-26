import {
  type ModuleAppInvocation,
  moduleAppInvocationSchema,
  type ModuleAppRuntimeReadiness,
  moduleAppRuntimeReadinessSchema,
} from '@lobechat/types';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type ModuleAppRuntimeClientOptions = {
  baseUrl?: string;
  enabled?: boolean;
  fetch?: FetchLike;
  healthCheckTimeoutMs?: number;
  internalToken?: string;
  invocationEnabled?: boolean;
};

const MODULE_APP_RUNTIME_HEALTH_CHECK_TIMEOUT_MS = 3000;

export class ModuleAppRuntimeClient {
  private readonly baseUrl?: string;
  private readonly enabled: boolean;
  private readonly fetch: FetchLike;
  private readonly healthCheckTimeoutMs: number;
  private readonly internalToken?: string;
  private readonly invocationEnabled: boolean;

  constructor(options: ModuleAppRuntimeClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env.MODULE_APP_RUNTIME_INTERNAL_URL;
    this.enabled = options.enabled ?? process.env.MODULE_APP_EXECUTION_ENABLED === 'true';
    this.fetch = options.fetch ?? fetch;
    this.healthCheckTimeoutMs =
      options.healthCheckTimeoutMs ?? MODULE_APP_RUNTIME_HEALTH_CHECK_TIMEOUT_MS;
    this.internalToken = options.internalToken ?? process.env.MODULE_APP_RUNTIME_INTERNAL_TOKEN;
    this.invocationEnabled =
      options.invocationEnabled ?? process.env.MODULE_APP_RUNTIME_INVOCATION_ENABLED === 'true';
  }

  getConfigurationStatus = () => ({
    internalTokenConfigured: Boolean(this.internalToken?.trim()),
    internalUrlConfigured: Boolean(this.baseUrl?.trim()),
  });

  healthCheck = async (): Promise<ModuleAppRuntimeReadiness> => {
    if (!this.baseUrl?.trim()) {
      return { code: 'MODULE_APP_RUNTIME_CONFIG_MISSING', status: 'unavailable' };
    }

    let endpoint: string;
    try {
      endpoint = new URL('/ready', `${this.baseUrl.replace(/\/$/, '')}/`).toString();
    } catch {
      return { code: 'MODULE_APP_RUNTIME_PROBE_INVALID', status: 'unavailable' };
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.healthCheckTimeoutMs);

    try {
      const response = await this.fetch(endpoint, {
        method: 'GET',
        signal: abortController.signal,
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return abortController.signal.aborted
          ? { code: 'MODULE_APP_RUNTIME_PROBE_TIMEOUT', status: 'unavailable' }
          : { code: 'MODULE_APP_RUNTIME_PROBE_INVALID', status: 'unavailable' };
      }
      const parsed = moduleAppRuntimeReadinessSchema.safeParse(body);
      if (
        !parsed.success ||
        (response.ok && parsed.data.status === 'unavailable') ||
        (!response.ok && parsed.data.status !== 'unavailable')
      ) {
        return { code: 'MODULE_APP_RUNTIME_PROBE_INVALID', status: 'unavailable' };
      }
      return parsed.data;
    } catch (error) {
      return abortController.signal.aborted
        ? { code: 'MODULE_APP_RUNTIME_PROBE_TIMEOUT', status: 'unavailable' }
        : { code: 'MODULE_APP_RUNTIME_UNREACHABLE', status: 'unavailable' };
    } finally {
      clearTimeout(timeout);
    }
  };

  invoke = async (input: ModuleAppInvocation) => {
    if (!this.enabled) throw new Error('MODULE_APP_EXECUTION_DISABLED');
    if (!this.invocationEnabled) {
      throw new Error('MODULE_APP_RUNTIME_INVOCATION_DISABLED');
    }
    if (!this.baseUrl || !this.internalToken) throw new Error('MODULE_APP_RUNTIME_CONFIG_MISSING');
    const invocation = moduleAppInvocationSchema.parse(input);
    const endpoint = new URL('/v1/invocations', `${this.baseUrl.replace(/\/$/, '')}/`).toString();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), invocation.timeoutMs);

    try {
      const response = await this.fetch(endpoint, {
        body: JSON.stringify(invocation),
        headers: {
          'authorization': `Bearer ${this.internalToken}`,
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
