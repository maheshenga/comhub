import { applyWorkingDirByDevicePatch, type LobeAgentAgencyConfig } from '@lobechat/types';
import isEqual from 'fast-deep-equal';
import { produce } from 'immer';
import type { PartialDeep } from 'type-fest';

import type { AgentItem, LobeAgentConfig } from '@/types/agent';
import { merge } from '@/utils/merge';

/**
 * Deep-merge a partial config into the current one. `profile` is replaced as a
 * whole and explicitly edited working directory selections are replaced atomically.
 * Returns `current` itself when nothing changed, so readers keep their reference.
 *
 * Lives in its own leaf module because the builtin-agent slice imports it: going
 * through `./action` would drag the whole agent store graph into that slice's
 * import chain, which re-enters the agent store before `createAgentSlice` exists.
 */
export const mergeAgentConfig = (
  current: PartialDeep<AgentItem> | undefined,
  config: PartialDeep<LobeAgentConfig>,
  options?: { replaceWorkingDirDeviceIds?: string[]; workingDirByDeviceSnapshot?: boolean },
): PartialDeep<AgentItem> => {
  const { value } = produce({ value: current ?? {} }, (draft) => {
    draft.value = merge(draft.value, config);
    // The character sheet is authored as one document — `AgentModel`
    // replaces it rather than merging — so mirror that here, or a trait the
    // user just cleared reappears until the next full fetch.
    if (Object.hasOwn(config, 'profile')) draft.value.profile = config.profile;
    const agencyConfig = draft.value.agencyConfig as PartialDeep<LobeAgentAgencyConfig>;
    if (agencyConfig && options?.workingDirByDeviceSnapshot) {
      // Complete server snapshots also remove device entries omitted by the server.
      agencyConfig.workingDirByDevice = config.agencyConfig?.workingDirByDevice;
    } else {
      applyWorkingDirByDevicePatch(
        agencyConfig,
        config.agencyConfig,
        options?.replaceWorkingDirDeviceIds,
      );
    }
  });
  return current && isEqual(current, value) ? current : value;
};
