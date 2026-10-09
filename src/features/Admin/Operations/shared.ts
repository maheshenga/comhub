import type { SkillSorts } from '@/types/discover';

export const SETTING_KEYS = {
  announcementContent: 'community.homeAnnouncement.content',
  announcementEnabled: 'community.homeAnnouncement.enabled',
  announcementTitle: 'community.homeAnnouncement.title',
  announcementType: 'community.homeAnnouncement.type',
  creatorRewardBannerEnabled: 'community.creatorRewardBanner.enabled',
  featuredAssistantPageSize: 'community.featuredAssistant.pageSize',
  featuredAssistantTitle: 'community.featuredAssistant.title',
  featuredAssistantsEnabled: 'community.featuredAssistants.enabled',
  featuredMcpPageSize: 'community.featuredMcp.pageSize',
  featuredMcpTitle: 'community.featuredMcp.title',
  featuredMcpsEnabled: 'community.featuredMcps.enabled',
  featuredSkillCategory: 'community.featuredSkill.category',
  featuredSkillPageSize: 'community.featuredSkill.pageSize',
  featuredSkillSort: 'community.featuredSkill.sort',
  featuredSkillTitle: 'community.featuredSkill.title',
  featuredSkillsEnabled: 'community.featuredSkills.enabled',
} as const;

export type FormValues = {
  announcementContent: string;
  announcementEnabled: boolean;
  announcementTitle: string;
  announcementType: 'success' | 'info' | 'warning' | 'error';
  creatorRewardBannerEnabled: boolean;
  featuredAssistantPageSize: number;
  featuredAssistantTitle: string;
  featuredAssistantsEnabled: boolean;
  featuredMcpPageSize: number;
  featuredMcpTitle: string;
  featuredMcpsEnabled: boolean;
  featuredSkillCategory: string;
  featuredSkillPageSize: number;
  featuredSkillSort: SkillSorts;
  featuredSkillTitle: string;
  featuredSkillsEnabled: boolean;
};

