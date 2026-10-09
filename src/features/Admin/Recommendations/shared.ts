import type { SkillSorts } from '@/types/discover';

export const SETTING_KEYS = {
  assistantsEnabled: 'recommendation.assistants.enabled',
  assistantTags: 'recommendation.assistantTags',
  assistantTitle: 'recommendation.assistantTitle',
  enabled: 'recommendation.section.enabled',
  generalSkillsEnabled: 'recommendation.generalSkills.enabled',
  generalSkillCategories: 'recommendation.generalSkillCategories',
  generalSkillTitle: 'recommendation.generalSkillTitle',
  hotSkillsEnabled: 'recommendation.hotSkills.enabled',
  hotSkillSort: 'recommendation.hotSkillSort',
  hotSkillTitle: 'recommendation.hotSkillTitle',
  mcpsEnabled: 'recommendation.mcps.enabled',
  mcpCategories: 'recommendation.mcpCategories',
  mcpTitle: 'recommendation.mcpTitle',
  selectedTags: 'recommendation.selectedTags',
  skillsEnabled: 'recommendation.skills.enabled',
  skillCategories: 'recommendation.skillCategories',
  skillTitle: 'recommendation.skillTitle',
} as const;

export type FormValues = {
  assistantsEnabled: boolean;
  assistantTags: string;
  assistantTitle: string;
  enabled: boolean;
  generalSkillsEnabled: boolean;
  generalSkillCategories: string;
  generalSkillTitle: string;
  hotSkillsEnabled: boolean;
  hotSkillSort: SkillSorts;
  hotSkillTitle: string;
  mcpsEnabled: boolean;
  mcpCategories: string;
  mcpTitle: string;
  selectedTags: string;
  skillsEnabled: boolean;
  skillCategories: string;
  skillTitle: string;
};

export const splitList = (value: unknown) =>
  (typeof value === 'string' ? value.split(/[\r\n,;；，]+/) : [])
    .map((item) => item.trim())
    .filter(Boolean);
export const joinList = (value?: string[]) => (value ?? []).join('\n');

