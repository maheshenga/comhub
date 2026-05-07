'use client';

import { Alert } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import CommunityRecommendations from '@/features/CommunityRecommendations';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useDiscoverStore } from '@/store/discover';
import { AssistantSorts, McpSorts, SkillSorts } from '@/types/discover';

import Title from '../../components/Title';
import AssistantList from '../agent/features/List';
import McpList from '../mcp/features/List';
import SkillList from '../skill/features/List';
import CreatorRewardBanner from './features/CreatorRewardBanner';
import Loading from './loading';

const normalizeSkillSort = (value?: string): SkillSorts => {
  if (value && Object.values(SkillSorts).includes(value as SkillSorts)) return value as SkillSorts;

  return SkillSorts.InstallCount;
};

const HomePage = memo(() => {
  const { t } = useTranslation('discover');
  const { data: operationsConfig } = useClientDataSWR(['public-operations'], () =>
    adminCommercialService.getPublicOperations(),
  );
  const useAssistantList = useDiscoverStore((s) => s.useAssistantList);
  const useMcpList = useDiscoverStore((s) => s.useFetchMcpList);
  const useSkillList = useDiscoverStore((s) => s.useFetchSkillList);
  const featuredAssistants = operationsConfig?.featuredAssistants ?? {
    enabled: true,
    pageSize: 12,
    title: '',
  };
  const featuredMcps = operationsConfig?.featuredMcps ?? {
    enabled: true,
    pageSize: 12,
    title: '',
  };
  const featuredSkills = operationsConfig?.featuredSkills ?? {
    category: '',
    enabled: false,
    pageSize: 8,
    sort: SkillSorts.InstallCount,
    title: '',
  };

  const { data: assistantList, isLoading: assistantLoading } = useAssistantList({
    page: 1,
    pageSize: featuredAssistants.pageSize,
    sort: AssistantSorts.Recommended,
  });

  const { data: mcpList, isLoading: pluginLoading } = useMcpList({
    page: 1,
    pageSize: featuredMcps.pageSize,
    sort: McpSorts.Recommended,
  });

  const { data: skillList, isLoading: skillLoading } = useSkillList({
    category: featuredSkills.category || undefined,
    page: 1,
    pageSize: featuredSkills.pageSize,
    sort: normalizeSkillSort(featuredSkills.sort),
  });

  const shouldWaitAssistants = featuredAssistants.enabled && (assistantLoading || !assistantList);
  const shouldWaitMcps = featuredMcps.enabled && (pluginLoading || !mcpList);
  const shouldWaitSkills = featuredSkills.enabled && (skillLoading || !skillList);

  if (shouldWaitAssistants || shouldWaitMcps || shouldWaitSkills) return <Loading />;

  return (
    <>
      {operationsConfig?.announcement?.enabled && (
        <Alert
          showIcon
          description={operationsConfig.announcement.content || undefined}
          message={operationsConfig.announcement.title || operationsConfig.announcement.content}
          type={operationsConfig.announcement.type as any}
        />
      )}
      {(operationsConfig?.creatorRewardBannerEnabled ?? true) && <CreatorRewardBanner />}
      <CommunityRecommendations />
      {featuredAssistants.enabled && assistantList && (
        <>
          <Title more={t('home.more')} moreLink={'/community/agent'}>
            {featuredAssistants.title || t('home.featuredAssistants')}
          </Title>
          <AssistantList data={assistantList.items} rows={4} />
          <div />
        </>
      )}
      {featuredMcps.enabled && mcpList && (
        <>
          <Title more={t('home.more')} moreLink={'/community/mcp'}>
            {featuredMcps.title || t('home.featuredTools')}
          </Title>
          <McpList data={mcpList.items} rows={4} />
        </>
      )}
      {featuredSkills.enabled && skillList && (
        <>
          <Title more={t('home.more')} moreLink={'/community/skill'}>
            {featuredSkills.title || 'Featured Skills'}
          </Title>
          <SkillList data={skillList.items} rows={4} />
        </>
      )}
    </>
  );
});

export default HomePage;
