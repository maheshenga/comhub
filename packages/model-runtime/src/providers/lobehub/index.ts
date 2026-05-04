import { ModelProvider } from 'model-bank';

import { createRouterRuntime } from '../../core/RouterRuntime';
import type { CreateRouterRuntimeOptions } from '../../core/RouterRuntime/createRuntime';
import { params as newapiParams } from '../newapi';

const SYSTEM_API_KEY = () => process.env.NEWAPI_API_KEY;
const SYSTEM_BASE_URL = () => process.env.NEWAPI_PROXY_URL;

const lobehubParams: CreateRouterRuntimeOptions = {
  ...newapiParams,
  defaultHeaders: {
    ...newapiParams.defaultHeaders,
    'X-Client': 'ComHub',
  },
  id: ModelProvider.LobeHub,
  routers: (options) => {
    const systemOptions = {
      ...options,
      apiKey: options?.apiKey || SYSTEM_API_KEY(),
      baseURL: options?.baseURL || SYSTEM_BASE_URL(),
    };
    return newapiParams.routers(systemOptions);
  },
};

export const LobeHubAI = createRouterRuntime(lobehubParams);
