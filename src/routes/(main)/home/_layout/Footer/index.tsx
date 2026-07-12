'use client';

import { SOCIAL_URL } from '@lobechat/business-const';
import { isDesktop } from '@lobechat/const';
import { useAnalytics } from '@lobehub/analytics/react';
import { type MenuProps } from '@lobehub/ui';
import { ActionIcon, DropdownMenu, Flexbox, Icon } from '@lobehub/ui';
import { DiscordIcon, GithubIcon } from '@lobehub/ui/icons';
import { cssVar } from 'antd-style';
import {
  Book,
  CircleHelp,
  Crown,
  Feather,
  FileClockIcon,
  FlaskConical,
  MessageCircle,
  Rocket,
  Settings2,
  SettingsIcon,
} from 'lucide-react';
import useSWR from 'swr';
import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { openChangelogModal } from '@/components/ChangelogModal';
import { openFeedbackModal } from '@/components/FeedbackModal';
import { PUBLIC_HELP_MENU_SWR_KEY } from '@/const/adminCacheKeys';
import HighlightNotification from '@/components/HighlightNotification';
import { DOCUMENTS_REFER_URL, GITHUB } from '@/const/url';
import Billboard from '@/features/Billboard';
import { useBillboardMenuItems } from '@/features/Billboard/MenuItems';
import { useBrand } from '@/features/Brand';
import { useActiveNavKey } from '@/features/NavPanel';
import { buildCustomHelpMenuItems } from '@/features/User/helpMenuItems';
import ThemeButton from '@/features/User/UserPanel/ThemeButton';
import WorkspaceLink from '@/features/Workspace/WorkspaceLink';
import { useNavLayout } from '@/hooks/useNavLayout';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors/systemStatus';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/slices/settings/selectors';

import { createConfiguredHelpMenuItems } from './helpMenuItems';
import { resolveFooterPromotionState } from './promotionPipeline';

const AGENT_ONBOARDING_PROMO_SLUG = 'agent-onboarding-promo-v1';

const PRODUCT_HUNT_NOTIFICATION = {
  actionHref: 'https://www.producthunt.com/products/lobehub?launch=lobehub',
  endTime: new Date('2026-02-01T00:00:00Z'),
  image: 'https://hub-apac-1.lobeobjects.space/og/lobehub-ph.png',
  slug: 'product-hunt-2026',
  startTime: new Date('2026-01-27T08:00:00Z'),
} as const;

interface PromotionCard {
  actionHref?: string;
  actionIcon?: ReactNode;
  actionLabel: string;
  description: string;
  image?: string;
  onAction?: () => void;
  onActionClick?: () => void;
  onClose: () => void;
  title: string;
}

const Footer = memo(() => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { analytics } = useAnalytics();
  const { footer } = useNavLayout();
  const brand = useBrand();
  const activeNavKey = useActiveNavKey();
  const isHomeSidebar = activeNavKey === 'home';
  const billboardMenuItems = useBillboardMenuItems();
  const enableAgentOnboarding = useServerConfigStore((s) => s.featureFlags.enableAgentOnboarding);
  const isMobile = useServerConfigStore((s) => !!s.isMobile);
  const serverConfigInit = useServerConfigStore((s) => s.serverConfigInit);
  const enableBusinessFeatures = useServerConfigStore(serverConfigSelectors.enableBusinessFeatures);
  const customization = useServerConfigStore((s) => s.serverConfig.customization);
  const [agentOnboardingFinished, agentOnboardingStarted, classicOnboardingFinished, isDevMode] =
    useUserStore((s) => [
      !!s.agentOnboarding?.finishedAt,
      !!s.agentOnboarding?.activeTopicId,
      !!s.onboarding?.finishedAt,
      userGeneralSettingsSelectors.config(s).isDevMode,
    ]);
  const [isAgentOnboardingCardOpen, setIsAgentOnboardingCardOpen] = useState(false);
  const [isProductHuntCardOpen, setIsProductHuntCardOpen] = useState(false);

  const { data: configuredHelpMenuItems } = useSWR(PUBLIC_HELP_MENU_SWR_KEY, () =>
    adminCommercialService.getPublicHelpMenu(),
  );
  const [isAgentOnboardingPromoRead, isProductHuntNotificationRead, updateSystemStatus] =
    useGlobalStore((s) => [
      systemStatusSelectors.isNotificationRead(AGENT_ONBOARDING_PROMO_SLUG)(s),
      systemStatusSelectors.isNotificationRead(PRODUCT_HUNT_NOTIFICATION.slug)(s),
      s.updateSystemStatus,
    ]);

  const isWithinTimeWindow = useMemo(() => {
    const now = new Date();
    return now >= PRODUCT_HUNT_NOTIFICATION.startTime && now <= PRODUCT_HUNT_NOTIFICATION.endTime;
  }, []);

  const {
    shouldAutoShowAgentOnboardingPromo,
    shouldAutoShowProductHuntCard,
    shouldShowProductHuntMenuEntry,
  } = useMemo(
    () =>
      resolveFooterPromotionState({
        agentOnboardingFinished,
        agentOnboardingStarted,
        classicOnboardingFinished,
        enableAgentOnboarding: !!enableAgentOnboarding,
        isAgentOnboardingPromoRead,
        isDesktop,
        isMobile,
        isProductHuntNotificationRead,
        isWithinProductHuntWindow: isWithinTimeWindow,
        serverConfigInit,
      }),
    [
      agentOnboardingFinished,
      agentOnboardingStarted,
      classicOnboardingFinished,
      enableAgentOnboarding,
      isAgentOnboardingPromoRead,
      isMobile,
      isProductHuntNotificationRead,
      isWithinTimeWindow,
      serverConfigInit,
    ],
  );

  const trackPromotionEvent = useCallback(
    (eventName: string, properties: Record<string, string>) => {
      try {
        analytics?.track({ name: eventName, properties });
      } catch {
        // silently ignore tracking errors to avoid affecting business logic
      }
    },
    [analytics],
  );

  const markNotificationRead = useCallback(
    (slug: string) => {
      const currentSlugs = useGlobalStore.getState().status.readNotificationSlugs || [];

      if (currentSlugs.includes(slug)) return;

      updateSystemStatus({ readNotificationSlugs: [...currentSlugs, slug] });
    },
    [updateSystemStatus],
  );

  useEffect(() => {
    if (!shouldAutoShowAgentOnboardingPromo) return;

    setIsAgentOnboardingCardOpen(true);
    trackPromotionEvent('agent_onboarding_promo_viewed', {
      spm: 'homepage.agent_onboarding_promo.viewed',
      trigger: 'auto',
    });
  }, [shouldAutoShowAgentOnboardingPromo, trackPromotionEvent]);

  useEffect(() => {
    if (!shouldAutoShowProductHuntCard) return;

    setIsProductHuntCardOpen(true);
    trackPromotionEvent('product_hunt_card_viewed', {
      spm: 'homepage.product_hunt.viewed',
      trigger: 'auto',
    });
  }, [isWithinTimeWindow, shouldAutoShowProductHuntCard, trackPromotionEvent]);

  const handleOpenChangelogModal = useCallback(() => {
    openChangelogModal();
  }, []);

  const handleOpenFeedbackModal = useCallback(() => {
    openFeedbackModal();
  }, []);

  const handleCloseAgentOnboardingCard = useCallback(() => {
    setIsAgentOnboardingCardOpen(false);
    markNotificationRead(AGENT_ONBOARDING_PROMO_SLUG);
    trackPromotionEvent('agent_onboarding_promo_closed', {
      spm: 'homepage.agent_onboarding_promo.closed',
    });
  }, [markNotificationRead, trackPromotionEvent]);

  const handleAgentOnboardingAction = useCallback(() => {
    setIsAgentOnboardingCardOpen(false);
    markNotificationRead(AGENT_ONBOARDING_PROMO_SLUG);
    trackPromotionEvent('agent_onboarding_promo_clicked', {
      spm: 'homepage.agent_onboarding_promo.clicked',
    });
    navigate('/onboarding/agent');
  }, [markNotificationRead, navigate, trackPromotionEvent]);

  const handleOpenProductHuntCard = useCallback(() => {
    setIsProductHuntCardOpen(true);
    trackPromotionEvent('product_hunt_card_viewed', {
      spm: 'homepage.product_hunt.viewed',
      trigger: 'menu_click',
    });
  }, [trackPromotionEvent]);

  const handleCloseProductHuntCard = useCallback(() => {
    setIsProductHuntCardOpen(false);
    markNotificationRead(PRODUCT_HUNT_NOTIFICATION.slug);
    trackPromotionEvent('product_hunt_card_closed', {
      spm: 'homepage.product_hunt.closed',
    });
  }, [markNotificationRead, trackPromotionEvent]);

  const handleProductHuntActionClick = useCallback(() => {
    trackPromotionEvent('product_hunt_action_clicked', {
      spm: 'homepage.product_hunt.action_clicked',
    });
  }, [trackPromotionEvent]);

  const activePromotion = useMemo<PromotionCard | undefined>(() => {
    if (isAgentOnboardingCardOpen) {
      return {
        actionIcon: <Icon icon={MessageCircle} size={14} />,
        actionLabel: t('agentOnboardingPromo.actionLabel'),
        description: t('agentOnboardingPromo.description'),
        onAction: handleAgentOnboardingAction,
        onClose: handleCloseAgentOnboardingCard,
        title: t('agentOnboardingPromo.title'),
      };
    }

    if (isProductHuntCardOpen) {
      return {
        actionHref: PRODUCT_HUNT_NOTIFICATION.actionHref,
        actionLabel: t('productHunt.actionLabel'),
        description: t('productHunt.description'),
        image: PRODUCT_HUNT_NOTIFICATION.image,
        onActionClick: handleProductHuntActionClick,
        onClose: handleCloseProductHuntCard,
        title: t('productHunt.title'),
      };
    }

    return undefined;
  }, [
    handleAgentOnboardingAction,
    handleCloseAgentOnboardingCard,
    handleCloseProductHuntCard,
    handleProductHuntActionClick,
    isAgentOnboardingCardOpen,
    isProductHuntCardOpen,
    t,
  ]);

  const customHelpItems = useMemo(
    () => buildCustomHelpMenuItems(customization?.helpMenuItems),
    [customization?.helpMenuItems],
  );
  const hasCustomHelpItems = customHelpItems.length > 0;

  const defaultHelpMenuItems: MenuProps['items'] = useMemo(
    () => [
      ...(footer.showSettingsEntry && !isDevMode
        ? [
            {
              icon: <Icon icon={Settings2} />,
              key: 'setting',
              label: <WorkspaceLink to="/settings">{t('userPanel.setting')}</WorkspaceLink>,
            },
            {
              type: 'divider' as const,
            },
          ]
        : []),
      ...(hasCustomHelpItems
        ? customHelpItems
        : [
            {
              icon: <Icon icon={Book} />,
              key: 'docs',
              label: (
                <a href={DOCUMENTS_REFER_URL} rel="noopener noreferrer" target="_blank">
                  {t('userPanel.docs')}
                </a>
              ),
            },
            {
              icon: <Icon icon={Feather} />,
              key: 'feedback',
              label: t('userPanel.feedback'),
              onClick: handleOpenFeedbackModal,
            },
            {
              icon: <Icon icon={DiscordIcon} />,
              key: 'discord',
              label: (
                <a href={SOCIAL_URL.discord} rel="noopener noreferrer" target="_blank">
                  {t('userPanel.discord')}
                </a>
              ),
            },
            {
              type: 'divider' as const,
            },
            {
              icon: <Icon icon={FileClockIcon} />,
              key: 'changelog',
              label: t('changelog'),
              onClick: handleOpenChangelogModal,
            },
            ...(footer.layout === 'compact' && !footer.hideGitHub
              ? [
                  {
                    icon: <Icon icon={GithubIcon} />,
                    key: 'github',
                    label: (
                      <a href={GITHUB} rel="noopener noreferrer" target="_blank">
                        GitHub
                      </a>
                    ),
                  },
                ]
              : []),
            ...(footer.showEvalEntry && footer.layout === 'compact'
              ? [
                  {
                    icon: <Icon icon={FlaskConical} />,
                    key: 'eval',
                    label: <WorkspaceLink to="/eval">Evaluation Lab</WorkspaceLink>,
                  },
                ]
              : []),
          ]),
      ...(shouldShowProductHuntMenuEntry
        ? [
            {
              icon: <Icon icon={Rocket} />,
              key: 'productHunt',
              label: 'Product Hunt',
              onClick: handleOpenProductHuntCard,
            },
          ]
        : []),
    ],
    [
      customHelpItems,
      footer.showSettingsEntry,
      footer.layout,
      footer.hideGitHub,
      footer.showEvalEntry,
      handleOpenChangelogModal,
      handleOpenFeedbackModal,
      handleOpenProductHuntCard,
      hasCustomHelpItems,
      isDevMode,
      shouldShowProductHuntMenuEntry,
      t,
    ],
  );

  const configuredMenuItems: MenuProps['items'] = useMemo(
    () =>
      Array.isArray(configuredHelpMenuItems)
        ? createConfiguredHelpMenuItems(configuredHelpMenuItems, {
            onChangelog: handleOpenChangelogModal,
            onFeedback: handleOpenFeedbackModal,
            onProductHunt: handleOpenProductHuntCard,
          })
        : [],
    [configuredHelpMenuItems, handleOpenChangelogModal, handleOpenFeedbackModal, handleOpenProductHuntCard],
  );

  const helpMenuItems: MenuProps['items'] = useMemo(
    () => [
      ...(Array.isArray(configuredHelpMenuItems)
        ? configuredMenuItems || []
        : defaultHelpMenuItems),
      ...(isHomeSidebar && billboardMenuItems && billboardMenuItems.length > 0
        ? [{ type: 'divider' as const }, ...billboardMenuItems]
        : []),
    ],
    [
      billboardMenuItems,
      configuredHelpMenuItems,
      configuredMenuItems,
      defaultHelpMenuItems,
      isHomeSidebar,
    ],
  );
  return (
    <>
      {isHomeSidebar && enableBusinessFeatures && (
        <WorkspaceLink
          style={{ color: 'inherit', display: 'block', paddingInline: 8, textDecoration: 'none' }}
          to={brand.sidebarMemberUrl || '/settings/plans'}
        >
          <Flexbox
            gap={4}
            padding={10}
            style={{
              border: `1px solid ${cssVar.colorBorderSecondary}`,
              borderRadius: 8,
              marginBlockEnd: 4,
            }}
          >
            <Flexbox horizontal align="center" gap={6}>
              <Icon icon={Crown} size={14} />
              <strong style={{ fontSize: 13 }}>{brand.sidebarMemberLabel || '升级方案'}</strong>
            </Flexbox>
            <span style={{ fontSize: 12, opacity: 0.72 }}>解锁更多容量与高级功能。</span>
          </Flexbox>
        </WorkspaceLink>
      )}
      {footer.layout === 'expanded' ? (
        <Flexbox horizontal align={'center'} gap={2} justify={'space-between'} padding={8}>
          <Flexbox horizontal align={'center'} flex={1} gap={2}>
            <DropdownMenu items={helpMenuItems} placement="topLeft">
              <ActionIcon
                aria-label={t('userPanel.help')}
                data-billboard-anchor=""
                icon={CircleHelp}
                size={16}
              />
            </DropdownMenu>
            {!footer.hideGitHub && (
              <a aria-label={'GitHub'} href={GITHUB} rel="noopener noreferrer" target={'_blank'}>
                <ActionIcon icon={GithubIcon} size={16} title={'GitHub'} />
              </a>
            )}
            <WorkspaceLink to="/eval">
              <ActionIcon icon={FlaskConical} size={16} title="Evaluation Lab" />
            </WorkspaceLink>
          </Flexbox>
          <ThemeButton placement={'topCenter'} size={16} />
        </Flexbox>
      ) : (
        <Flexbox horizontal align={'center'} gap={2} padding={8}>
          <DropdownMenu items={helpMenuItems} placement="topLeft">
            <ActionIcon aria-label={t('userPanel.help')} icon={CircleHelp} size={16} />
          </DropdownMenu>
          {isDevMode && (
            <WorkspaceLink to="/settings">
              <ActionIcon
                aria-label={t('userPanel.setting')}
                icon={SettingsIcon}
                size={16}
                title={t('userPanel.setting')}
              />
            </WorkspaceLink>
          )}
        </Flexbox>
      )}
      {activePromotion && (
        <HighlightNotification
          open
          actionHref={activePromotion.actionHref}
          actionIcon={activePromotion.actionIcon}
          actionLabel={activePromotion.actionLabel}
          description={activePromotion.description}
          image={activePromotion.image}
          title={activePromotion.title}
          onAction={activePromotion.onAction}
          onActionClick={activePromotion.onActionClick}
          onClose={activePromotion.onClose}
        />
      )}
      {isHomeSidebar && <Billboard />}
    </>
  );
});

export default Footer;
