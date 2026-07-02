/**
 * Where a registered binary was resolved from.
 */
export type BinarySource = 'system' | 'managed';

/**
 * Status of a registered binary
 */
export interface BinaryStatus {
  available: boolean;
  error?: string;
  lastChecked?: Date;
  manageable?: boolean;
  path?: string;
  resolvedPathEnv?: string;
  source?: BinarySource;
  version?: string;
}

/**
 * Binary categories
 */
export type BinaryCategory =
  | 'content-search'
  | 'ast-search'
  | 'file-search'
  | 'browser-automation'
  | 'runtime-environment'
  | 'cli-agents'
  | 'system'
  | 'custom';

/**
 * Binary info for display
 */
export interface BinaryInfo {
  description?: string;
  name: string;
  priority?: number;
}

export type HeterogeneousCliAgentType = 'claude-code' | 'codex';

export interface DetectHeterogeneousAgentCommandParams {
  agentType: HeterogeneousCliAgentType;
  command: string;
}

/**
 * Claude Code CLI auth status (from `claude auth status --json`)
 */
export interface ClaudeAuthStatus {
  apiProvider?: string;
  authMethod?: string;
  email?: string;
  loggedIn: boolean;
  orgId?: string;
  orgName?: string;
  subscriptionType?: string;
}
