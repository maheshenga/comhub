import type { PlatformPluginPlanEntitlement, PlatformPluginStatus } from '@lobechat/types';

export type PlatformPluginPermissionReason =
  | 'agent_not_enabled'
  | 'not_installed'
  | 'plan_install_denied'
  | 'plan_run_denied'
  | 'plan_visibility_denied'
  | 'plugin_not_published';

export type PlatformPluginPermissionDecision = {
  installable: { allowed: boolean; reason?: PlatformPluginPermissionReason };
  runnable: { allowed: boolean; reason?: PlatformPluginPermissionReason };
  visible: { allowed: boolean; reason?: PlatformPluginPermissionReason };
};

export interface ResolvePlatformPluginPermissionInput {
  agentBound: boolean;
  entitlement: PlatformPluginPlanEntitlement | null | undefined;
  installed: boolean;
  pluginStatus: PlatformPluginStatus;
}

const allow = { allowed: true } as const;

const deny = (reason: PlatformPluginPermissionReason) => ({ allowed: false, reason });

export const resolvePlatformPluginPermission = ({
  agentBound,
  entitlement,
  installed,
  pluginStatus,
}: ResolvePlatformPluginPermissionInput): PlatformPluginPermissionDecision => {
  if (pluginStatus !== 'published') {
    const unpublished = deny('plugin_not_published');

    return {
      installable: unpublished,
      runnable: unpublished,
      visible: unpublished,
    };
  }

  const visible = entitlement?.visible ? allow : deny('plan_visibility_denied');
  const installable = entitlement?.installable ? allow : deny('plan_install_denied');

  let runnable: PlatformPluginPermissionDecision['runnable'];

  if (!entitlement?.runnable) {
    runnable = deny('plan_run_denied');
  } else if (!installed) {
    runnable = deny('not_installed');
  } else if (!agentBound) {
    runnable = deny('agent_not_enabled');
  } else {
    runnable = allow;
  }

  return {
    installable,
    runnable,
    visible,
  };
};
