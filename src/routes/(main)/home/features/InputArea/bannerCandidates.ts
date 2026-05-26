export type BannerKind = 'skill' | 'botIntegration' | 'messenger';

type BannerCandidateOptions = {
  isBotIntegrationBannerDismissed: boolean;
  isKlavisEnabled: boolean;
  isLobehubSkillEnabled: boolean;
  isMessengerBannerDismissed: boolean;
  isMessengerEnabled: boolean;
  isSkillBannerDismissed: boolean;
};

export const getHomeInputBannerCandidates = ({
  isBotIntegrationBannerDismissed,
  isKlavisEnabled,
  isLobehubSkillEnabled,
  isMessengerBannerDismissed,
  isMessengerEnabled,
  isSkillBannerDismissed,
}: BannerCandidateOptions): BannerKind[] => {
  const candidates: BannerKind[] = [];

  if ((isLobehubSkillEnabled || isKlavisEnabled) && !isSkillBannerDismissed) {
    candidates.push('skill');
  }

  if (!isBotIntegrationBannerDismissed) candidates.push('botIntegration');
  if (isMessengerEnabled && !isMessengerBannerDismissed) candidates.push('messenger');

  return candidates;
};
