import { agentSignal } from './agentSignal';
import { deviceSystemInfo } from './deviceSystemInfo';
import { moduleApp } from './moduleApp';
import { skillTools } from './skillTools';
import { workspaceRescan } from './workspaceRescan';

/** Business Redis API. Providers, keys and expiry policy stay inside each domain. */
export const redisService = { agentSignal, deviceSystemInfo, moduleApp, skillTools, workspaceRescan };
