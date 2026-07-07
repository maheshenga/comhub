import type { PlatformPluginListItem } from '@lobechat/types';

export type PlatformPluginRestrictionReason =
  | 'agent_not_enabled'
  | 'not_installed'
  | 'plan_install_denied'
  | 'plan_run_denied'
  | 'plan_visibility_denied'
  | 'runtime_not_ready'
  | 'unknown';

const restrictionCopy: Record<PlatformPluginRestrictionReason, string> = {
  agent_not_enabled: '需要先为当前 Agent 启用该插件，然后才能运行。',
  not_installed: '需要先安装该插件。',
  plan_install_denied: '当前套餐暂不支持安装该插件，请升级套餐后使用。',
  plan_run_denied: '当前套餐暂不支持运行该插件，请升级套餐后使用。',
  plan_visibility_denied: '当前套餐暂不可见该插件，请升级套餐解锁更多功能。',
  runtime_not_ready: '插件运行能力正在接入中，当前可先完成安装和 Agent 绑定。',
  unknown: '当前无法执行该插件，请稍后重试或联系管理员。',
};

export const getPlatformPluginRestrictionCopy = (reason: string) =>
  restrictionCopy[(reason as PlatformPluginRestrictionReason) || 'unknown'] ?? restrictionCopy.unknown;

export const isPlatformPluginRunnable = (
  plugin: Pick<PlatformPluginListItem, 'installed' | 'planState'>,
) => plugin.planState.visible && plugin.planState.installable && plugin.planState.runnable && plugin.installed;

export const getPlatformPluginRestrictionReason = (
  plugin: Pick<PlatformPluginListItem, 'installed' | 'planState'>,
): PlatformPluginRestrictionReason | null => {
  if (!plugin.planState.visible) return 'plan_visibility_denied';
  if (!plugin.planState.installable) return 'plan_install_denied';
  if (!plugin.installed) return 'not_installed';
  if (!plugin.planState.runnable) return 'plan_run_denied';
  return null;
};

export const formatPlatformPluginRuntimeType = (runtimeType: PlatformPluginListItem['runtimeType']) =>
  runtimeType === 'content_generation' ? '内容生成' : 'API Action';

export const formatPlatformPluginCredits = (value?: number) => {
  const credits = Number(value ?? 0);
  if (!Number.isFinite(credits) || credits <= 0) return '0';
  if (credits >= 1_000_000) return `${Number((credits / 1_000_000).toFixed(1))}M`;
  if (credits >= 1_000) return `${Number((credits / 1_000).toFixed(1))}K`;
  return `${Math.round(credits)}`;
};

export const getPlatformPluginBillingSummary = (plugin: Pick<PlatformPluginListItem, 'billing'>) => {
  const billing = plugin.billing ?? {};
  return `倍率 ${billing.defaultMultiplier ?? 1}x · 固定 ${formatPlatformPluginCredits(
    billing.fixedServiceFeeCredits,
  )} 积分`;
};
