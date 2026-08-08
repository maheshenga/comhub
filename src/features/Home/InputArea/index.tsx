import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUploadFiles } from '@/components/DragUploadZone';
import { useBrand } from '@/features/Brand';
import { useHomeDailyBrief } from '@/hooks/useHomeDailyBrief';
import { useInitAgentConfig } from '@/hooks/useInitAgentConfig';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors, builtinAgentSelectors } from '@/store/agent/selectors';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

import type { HomeMode } from '../types';
import { HOME_INPUT_RESERVED_HEIGHT } from './constants';
import { getHomeInputBannerCandidates, type BannerKind } from './bannerCandidates';
import BotIntegrationBanner, { BOT_INTEGRATION_BANNER_ID } from './BotIntegrationBanner';
import { EditorSlot } from './EditorSlot';
import { stripMarkdownLinks } from './hintFormat';
import InputDragUpload from './InputDragUpload';
import MessengerBanner, { MESSENGER_BANNER_ID } from './MessengerBanner';
import SkillInstallBanner, { SKILL_INSTALL_BANNER_ID } from './SkillInstallBanner';
import StarterList from './StarterList';
import { useSend } from './useSend';

const styles = createStaticStyles(({ css }) => ({
  inputSlot: css`
    width: 100%;
    min-height: ${HOME_INPUT_RESERVED_HEIGHT}px;
  `,
}));

interface InputAreaProps {
  inputValue: string;
  mode: HomeMode;
  onInputValueChange: (value: string) => void;
  onModeChange: (mode: HomeMode) => void;
}

const InputArea = ({ inputValue, mode, onInputValueChange, onModeChange }: InputAreaProps) => {
  const { t } = useTranslation('home');
  const { loading, send, agentId } = useSend(mode);
  useInitAgentConfig(agentId);

  const isAgentConfigLoading = useAgentStore((s) =>
    agentByIdSelectors.isAgentConfigLoadingById(agentId ?? '')(s),
  );
  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);
  const isLobehubSkillEnabled = useServerConfigStore(serverConfigSelectors.enableLobehubSkill);
  const isComposioEnabled = useServerConfigStore(serverConfigSelectors.enableComposio);
  const serverConfigInit = useServerConfigStore((s) => s.serverConfigInit);
  const isMessengerEnabled = useBrand().homeMessengerEnabled;
  const isSkillBannerDismissed = useGlobalStore(
    systemStatusSelectors.isBannerDismissed(SKILL_INSTALL_BANNER_ID),
  );
  const isBotIntegrationBannerDismissed = useGlobalStore(
    systemStatusSelectors.isBannerDismissed(BOT_INTEGRATION_BANNER_ID),
  );
  const isMessengerBannerDismissed = useGlobalStore(
    systemStatusSelectors.isBannerDismissed(MESSENGER_BANNER_ID),
  );
  const isStatusInit = useGlobalStore(systemStatusSelectors.isStatusInit);
  const [activeBanner, setActiveBanner] = useState<BannerKind | null>(null);
  const hasPickedRef = useRef(false);

  useEffect(() => {
    if (mode !== 'chat' || hasPickedRef.current) return;
    if (!isStatusInit || !serverConfigInit || !inboxAgentId) return;

    const candidates = getHomeInputBannerCandidates({
      isBotIntegrationBannerDismissed,
      isComposioEnabled,
      isLobehubSkillEnabled,
      isMessengerBannerDismissed,
      isMessengerEnabled,
      isSkillBannerDismissed,
    });
    if (candidates.length === 0) return;

    hasPickedRef.current = true;
    setActiveBanner(candidates[Math.floor(Math.random() * candidates.length)]);
  }, [
    inboxAgentId,
    isBotIntegrationBannerDismissed,
    isComposioEnabled,
    isLobehubSkillEnabled,
    isMessengerBannerDismissed,
    isMessengerEnabled,
    isSkillBannerDismissed,
    isStatusInit,
    mode,
    serverConfigInit,
  ]);

  const isActiveBannerDismissed =
    (activeBanner === 'skill' && isSkillBannerDismissed) ||
    (activeBanner === 'botIntegration' && isBotIntegrationBannerDismissed) ||
    (activeBanner === 'messenger' && isMessengerBannerDismissed);
  const visibleBanner = mode === 'chat' && !isActiveBannerDismissed ? activeBanner : null;

  const resolvedAgentId = agentId ?? '';
  const model = useAgentStore((s) => agentByIdSelectors.getAgentModelById(resolvedAgentId)(s));
  const provider = useAgentStore((s) =>
    agentByIdSelectors.getAgentModelProviderById(resolvedAgentId)(s),
  );
  const { handleUploadFiles } = useUploadFiles({ agentId: resolvedAgentId, model, provider });

  const { currentPair } = useHomeDailyBrief();
  const dailyHint = currentPair?.hint ? stripMarkdownLinks(currentPair.hint) : undefined;
  const placeholder =
    mode === 'chat'
      ? dailyHint || t('dashboard.placeholder.chat')
      : t(`dashboard.placeholder.${mode}`);

  const editorSlot = (
    <div className={styles.inputSlot}>
      <EditorSlot
        agentId={agentId}
        initialValue={inputValue}
        isAgentConfigLoading={isAgentConfigLoading}
        loading={loading}
        mode={mode}
        placeholder={placeholder}
        send={send}
        onModeChange={onModeChange}
        onValueChange={onInputValueChange}
      />
    </div>
  );

  return (
    <Flexbox gap={mode === 'chat' ? 16 : 0}>
      <Flexbox style={{ paddingBottom: visibleBanner ? 32 : 0, position: 'relative' }}>
        {visibleBanner === 'skill' && <SkillInstallBanner />}
        {visibleBanner === 'botIntegration' && <BotIntegrationBanner />}
        {visibleBanner === 'messenger' && <MessengerBanner />}
        {mode === 'chat' ? (
          <InputDragUpload
            radius={20}
            style={{ position: 'relative', zIndex: 1 }}
            onUploadFiles={handleUploadFiles}
          >
            {editorSlot}
          </InputDragUpload>
        ) : (
          editorSlot
        )}
      </Flexbox>
      {mode === 'chat' && <StarterList />}
    </Flexbox>
  );
};

export default InputArea;
