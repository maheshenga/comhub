import type { ModelProviderCard } from '@/types/llm';

const LobeHub: ModelProviderCard = {
  chatModels: [],
  description:
    'ComHub AI 通过官方 API 访问主流大模型,按模型 token 用量以积分计费,无需自行配置 API Key。',
  enabled: true,
  id: 'lobehub',
  name: 'ComHub AI',
  settings: {
    modelEditable: false,
    showAddNewModel: false,
    showModelFetcher: false,
  },
  showConfig: false,
  url: 'https://chat.vip.hezelove.cn',
};

export default LobeHub;

export const planCardModels = [
  'deepseek-v4-pro',
  'claude-sonnet-4-6',
  'gemini-3.1-pro-preview',
  'gpt-5.5',
];
