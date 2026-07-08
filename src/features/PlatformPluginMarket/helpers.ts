import type {
  PlatformPluginListItem,
  PlatformPluginMarketplaceListInput,
  PlatformPluginRunHistoryItem,
  PlatformPluginRunStatus,
} from '@lobechat/types';

export type PlatformPluginRestrictionReason =
  | 'agent_not_enabled'
  | 'not_installed'
  | 'plan_install_denied'
  | 'plan_run_denied'
  | 'plan_visibility_denied'
  | 'runtime_not_ready'
  | 'unknown';

export type PlatformPluginRestrictionCopyKey =
  | 'platformPlugins.restriction.agentNotEnabled'
  | 'platformPlugins.restriction.notInstalled'
  | 'platformPlugins.restriction.planInstallDenied'
  | 'platformPlugins.restriction.planRunDenied'
  | 'platformPlugins.restriction.planVisibilityDenied'
  | 'platformPlugins.restriction.runtimeNotReady'
  | 'platformPlugins.restriction.unknown';

const restrictionCopyKey: Record<PlatformPluginRestrictionReason, PlatformPluginRestrictionCopyKey> =
  {
    agent_not_enabled: 'platformPlugins.restriction.agentNotEnabled',
    not_installed: 'platformPlugins.restriction.notInstalled',
    plan_install_denied: 'platformPlugins.restriction.planInstallDenied',
    plan_run_denied: 'platformPlugins.restriction.planRunDenied',
    plan_visibility_denied: 'platformPlugins.restriction.planVisibilityDenied',
    runtime_not_ready: 'platformPlugins.restriction.runtimeNotReady',
    unknown: 'platformPlugins.restriction.unknown',
  };

const restrictionFallbackCopy: Record<PlatformPluginRestrictionReason, string> = {
  agent_not_enabled: 'Enable this plugin for the current Agent before running it.',
  not_installed: 'Install this plugin before running it.',
  plan_install_denied: 'Your current plan cannot install this plugin. Upgrade to use it.',
  plan_run_denied: 'Your current plan cannot run this plugin. Upgrade to use it.',
  plan_visibility_denied:
    'Your current plan cannot view this plugin. Upgrade to unlock more capabilities.',
  runtime_not_ready: 'Plugin runtime is still being connected. You can install and bind it first.',
  unknown: 'This plugin cannot run right now. Try again later or contact an administrator.',
};

export const getPlatformPluginRestrictionCopyKey = (
  reason: string,
): PlatformPluginRestrictionCopyKey =>
  restrictionCopyKey[(reason as PlatformPluginRestrictionReason) || 'unknown'] ??
  restrictionCopyKey.unknown;

export const getPlatformPluginRestrictionCopy = (reason: string) =>
  restrictionFallbackCopy[(reason as PlatformPluginRestrictionReason) || 'unknown'] ??
  restrictionFallbackCopy.unknown;

export const isPlatformPluginRunnable = (
  plugin: Pick<PlatformPluginListItem, 'installed' | 'planState'>,
) =>
  plugin.planState.visible &&
  plugin.planState.installable &&
  plugin.planState.runnable &&
  plugin.installed;

export const getPlatformPluginRestrictionReason = (
  plugin: Pick<PlatformPluginListItem, 'installed' | 'planState'>,
): PlatformPluginRestrictionReason | null => {
  if (!plugin.planState.visible) return 'plan_visibility_denied';
  if (!plugin.planState.installable) return 'plan_install_denied';
  if (!plugin.planState.runnable) return 'plan_run_denied';
  if (!plugin.installed) return 'not_installed';
  return null;
};

export const filterAndSortPlatformPlugins = (
  plugins: PlatformPluginListItem[],
  filters: PlatformPluginMarketplaceListInput,
) => {
  const query = filters.query?.toLowerCase();

  return plugins
    .filter((plugin) => {
      const matchesCategory = !filters.category || plugin.category === filters.category;
      const matchesRuntime = !filters.runtimeType || plugin.runtimeType === filters.runtimeType;
      const matchesQuery =
        !query ||
        plugin.displayName.toLowerCase().includes(query) ||
        plugin.slug.toLowerCase().includes(query) ||
        plugin.category.toLowerCase().includes(query) ||
        plugin.tags.some((tag) => tag.toLowerCase().includes(query));

      return matchesCategory && matchesRuntime && matchesQuery;
    })
    .sort((a, b) => {
      if (a.operations.featured !== b.operations.featured) return a.operations.featured ? -1 : 1;
      if (a.operations.sortWeight !== b.operations.sortWeight) {
        return b.operations.sortWeight - a.operations.sortWeight;
      }

      return a.displayName.localeCompare(b.displayName);
    });
};

export const getPlatformPluginPlanStatusLabel = (
  plugin: Pick<PlatformPluginListItem, 'installed' | 'planState'>,
): {
  color: 'default' | 'green' | 'orange';
  labelKey:
    | 'platformPlugins.marketplace.status.installable'
    | 'platformPlugins.marketplace.status.runnable'
    | 'platformPlugins.marketplace.status.upgradeRequired';
} => {
  const reason = getPlatformPluginRestrictionReason(plugin);

  if (!reason) return { color: 'green', labelKey: 'platformPlugins.marketplace.status.runnable' };
  if (reason === 'not_installed')
    return { color: 'default', labelKey: 'platformPlugins.marketplace.status.installable' };

  return { color: 'orange', labelKey: 'platformPlugins.marketplace.status.upgradeRequired' };
};

export const getPlatformPluginRuntimeLabelKey = (
  runtimeType: PlatformPluginListItem['runtimeType'],
): 'platformPlugins.marketplace.runtime.apiAction' | 'platformPlugins.marketplace.runtime.contentGeneration' =>
  runtimeType === 'content_generation'
    ? 'platformPlugins.marketplace.runtime.contentGeneration'
    : 'platformPlugins.marketplace.runtime.apiAction';

export type PlatformPluginRunStatusLabelKey =
  | 'platformPlugins.runHistory.status.denied'
  | 'platformPlugins.runHistory.status.failed'
  | 'platformPlugins.runHistory.status.queued'
  | 'platformPlugins.runHistory.status.running'
  | 'platformPlugins.runHistory.status.succeeded';

export type PlatformPluginRunErrorCopyKey =
  | PlatformPluginRestrictionCopyKey
  | 'platformPlugins.run.errors.actionUnavailable'
  | 'platformPlugins.run.errors.adminConfiguration'
  | 'platformPlugins.run.errors.externalApiFailed'
  | 'platformPlugins.run.errors.insufficientBudget'
  | 'platformPlugins.run.errors.pluginUnavailable'
  | 'platformPlugins.run.errors.unsafeUrl'
  | 'platformPlugins.run.errors.unknown';

export type PlatformPluginRunNoticeKey =
  | 'platformPlugins.run.completed'
  | 'platformPlugins.run.failed';

export type PlatformPluginRunPreviewCopyKey =
  | 'platformPlugins.run.failedPreview'
  | 'platformPlugins.run.noPreview';

export const getPlatformPluginRunStatusMeta = (
  status: PlatformPluginRunStatus,
): { color: string; labelKey: PlatformPluginRunStatusLabelKey } => {
  const map = {
    denied: { color: 'orange', labelKey: 'platformPlugins.runHistory.status.denied' },
    failed: { color: 'red', labelKey: 'platformPlugins.runHistory.status.failed' },
    queued: { color: 'default', labelKey: 'platformPlugins.runHistory.status.queued' },
    running: { color: 'blue', labelKey: 'platformPlugins.runHistory.status.running' },
    succeeded: { color: 'green', labelKey: 'platformPlugins.runHistory.status.succeeded' },
  } satisfies Record<
    PlatformPluginRunStatus,
    { color: string; labelKey: PlatformPluginRunStatusLabelKey }
  >;

  return map[status];
};

const runErrorCopyKey: Record<string, PlatformPluginRunErrorCopyKey> = {
  COMMERCIAL_BALANCE_EXHAUSTED_ON_FINAL_CHARGE: 'platformPlugins.run.errors.insufficientBudget',
  InsufficientBudgetForModel: 'platformPlugins.run.errors.insufficientBudget',
  PLATFORM_PLUGIN_API_ACTION_NOT_CONFIGURED: 'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_CONTENT_GENERATION_NOT_CONFIGURED:
    'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_RUN_REPOSITORY_REQUIRED: 'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_SECRET_KEY_INVALID: 'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_SECRET_KEY_REQUIRED: 'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_TEXT_GENERATOR_PROVIDER_MODEL_REQUIRED:
    'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_TEXT_GENERATOR_REQUIRED: 'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_UNSAFE_URL: 'platformPlugins.run.errors.unsafeUrl',
  platform_plugin_action_not_found: 'platformPlugins.run.errors.actionUnavailable',
  platform_plugin_not_found: 'platformPlugins.run.errors.pluginUnavailable',
  platform_plugin_version_not_found: 'platformPlugins.run.errors.actionUnavailable',
};

const normalizePlatformPluginErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  return '';
};

export const getPlatformPluginRunErrorCopyKey = (
  error: unknown,
): PlatformPluginRunErrorCopyKey => {
  const message = normalizePlatformPluginErrorMessage(error);
  const restrictionKey = restrictionCopyKey[message as PlatformPluginRestrictionReason];

  if (restrictionKey) return restrictionKey;
  if (message.startsWith('PLATFORM_PLUGIN_API_REQUEST_FAILED:')) {
    return 'platformPlugins.run.errors.externalApiFailed';
  }

  return runErrorCopyKey[message] ?? 'platformPlugins.run.errors.unknown';
};

export const getPlatformPluginRunNoticeKey = (
  status: PlatformPluginRunStatus,
): PlatformPluginRunNoticeKey =>
  status === 'succeeded' ? 'platformPlugins.run.completed' : 'platformPlugins.run.failed';

export const getPlatformPluginRunPreviewCopyKey = ({
  preview,
  status,
}: {
  preview?: string;
  status: PlatformPluginRunStatus;
}): PlatformPluginRunPreviewCopyKey | null => {
  if (status === 'failed' && preview === 'platform_plugin_run_failed') {
    return 'platformPlugins.run.failedPreview';
  }
  if (!preview) return 'platformPlugins.run.noPreview';
  return null;
};

export const formatPlatformPluginRuntimeType = (runtimeType: PlatformPluginListItem['runtimeType']) =>
  runtimeType === 'content_generation' ? 'Content Generation' : 'API Action';

export const formatPlatformPluginCredits = (value?: number) => {
  const credits = Number(value ?? 0);
  if (!Number.isFinite(credits) || credits <= 0) return '0';
  if (credits >= 1_000_000) return `${Number((credits / 1_000_000).toFixed(1))}M`;
  if (credits >= 1_000) return `${Number((credits / 1_000).toFixed(1))}K`;
  return `${Math.round(credits)}`;
};

export const getPlatformPluginBillingSummaryValues = (
  plugin: Pick<PlatformPluginListItem, 'billing'>,
) => {
  const billing = plugin.billing ?? {};

  return {
    fixedCredits: formatPlatformPluginCredits(billing.fixedServiceFeeCredits),
    multiplier: billing.defaultMultiplier ?? 1,
  };
};

export const getPlatformPluginBillingSummary = (plugin: Pick<PlatformPluginListItem, 'billing'>) => {
  const billing = plugin.billing ?? {};
  return `${billing.defaultMultiplier ?? 1}x · ${formatPlatformPluginCredits(
    billing.fixedServiceFeeCredits,
  )} credits fixed`;
};

export const mergePlatformPluginRunHistoryItems = (
  current: PlatformPluginRunHistoryItem[],
  next: PlatformPluginRunHistoryItem[],
) => {
  const seen = new Set(current.map((item) => item.runId));
  const merged = [...current];

  for (const item of next) {
    if (seen.has(item.runId)) continue;
    seen.add(item.runId);
    merged.push(item);
  }

  return merged;
};
