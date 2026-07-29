import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';

import type { HomeNewModelItem } from '@/business/client/hooks/useHomeNewModels';

export const DEEPSEEK_V4_PRO_MODEL = 'deepseek-v4-pro';
export const DEEPSEEK_V4_PRO_PROVIDER = ENABLE_BUSINESS_FEATURES ? 'newapi' : 'deepseek';

// Chat
export const NEW_CLAUDE_MODEL = 'claude-opus-5';
export const NEW_CLAUDE_MODEL_NAME = 'Claude Opus 5';
export const NEW_GEMINI_MODEL = 'gemini-3.6-flash';
export const NEW_GEMINI_MODEL_NAME = 'Gemini 3.6 Flash';
export const NEW_QWEN_MODEL = 'qwen3.8-max-preview';
export const NEW_QWEN_MODEL_NAME = 'Qwen3.8 Max Preview';
export const NEW_KIMI_MODEL = 'kimi-k3';
export const NEW_KIMI_MODEL_NAME = 'Kimi K3';

export const BUSINESS_CHAT_PROVIDER = ENABLE_BUSINESS_FEATURES ? 'newapi' : 'lobehub';
export const OSS_CLAUDE_PROVIDER = 'anthropic';
export const OSS_GEMINI_PROVIDER = 'google';
export const OSS_QWEN_PROVIDER = 'qwen';
export const OSS_KIMI_PROVIDER = 'moonshot';

export const BUSINESS_HOME_NEW_MODELS = [
  {
    model: NEW_CLAUDE_MODEL,
    provider: BUSINESS_CHAT_PROVIDER,
    title: NEW_CLAUDE_MODEL_NAME,
    type: 'chat',
  },
  {
    model: NEW_GEMINI_MODEL,
    provider: BUSINESS_CHAT_PROVIDER,
    title: NEW_GEMINI_MODEL_NAME,
    type: 'chat',
  },
  {
    model: NEW_QWEN_MODEL,
    provider: BUSINESS_CHAT_PROVIDER,
    title: NEW_QWEN_MODEL_NAME,
    type: 'chat',
  },
  {
    model: NEW_KIMI_MODEL,
    provider: BUSINESS_CHAT_PROVIDER,
    title: NEW_KIMI_MODEL_NAME,
    type: 'chat',
  },
] satisfies HomeNewModelItem[];

export const OSS_HOME_NEW_MODELS = [
  {
    model: NEW_CLAUDE_MODEL,
    provider: OSS_CLAUDE_PROVIDER,
    title: NEW_CLAUDE_MODEL_NAME,
    type: 'chat',
  },
  {
    model: NEW_GEMINI_MODEL,
    provider: OSS_GEMINI_PROVIDER,
    title: NEW_GEMINI_MODEL_NAME,
    type: 'chat',
  },
  {
    model: NEW_QWEN_MODEL,
    provider: OSS_QWEN_PROVIDER,
    title: NEW_QWEN_MODEL_NAME,
    type: 'chat',
  },
  {
    model: NEW_KIMI_MODEL,
    provider: OSS_KIMI_PROVIDER,
    title: NEW_KIMI_MODEL_NAME,
    type: 'chat',
  },
] satisfies HomeNewModelItem[];
