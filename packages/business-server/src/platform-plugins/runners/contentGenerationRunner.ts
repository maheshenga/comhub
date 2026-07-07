import type { PlatformPluginActionConfig } from '@lobechat/types';

import type { PlatformPluginRunnerResult } from './apiActionRunner';
import { renderTemplateString, sanitizeArtifactFileName } from './template';

export type PlatformPluginTextGenerator = (input: {
  model?: string;
  prompt: string;
  provider?: string;
  userId: string;
}) => Promise<{
  aiActualCredits: number;
  text: string;
  tokenUsage?: Record<string, number>;
}>;

export interface RunContentGenerationPluginInput {
  action: PlatformPluginActionConfig;
  input: Record<string, unknown>;
  textGenerator?: PlatformPluginTextGenerator;
  userId: string;
}

export const runContentGenerationPlugin = async ({
  action,
  input,
  textGenerator,
  userId,
}: RunContentGenerationPluginInput): Promise<PlatformPluginRunnerResult> => {
  const config = action.contentGeneration;

  if (action.runtimeType !== 'content_generation' || !config?.promptTemplate) {
    throw new Error('PLATFORM_PLUGIN_CONTENT_GENERATION_NOT_CONFIGURED');
  }

  if (!textGenerator) {
    throw new Error('PLATFORM_PLUGIN_TEXT_GENERATOR_REQUIRED');
  }

  const prompt = renderTemplateString(config.promptTemplate, input);
  const generated = await textGenerator({
    model: config.model,
    prompt,
    provider: config.provider,
    userId,
  });
  const artifactMimeType = config.artifactMimeType ?? 'text/markdown';
  const artifactName = sanitizeArtifactFileName(
    renderTemplateString(config.artifactNameTemplate ?? 'plugin-result.md', input),
  );

  return {
    aiActualCredits: generated.aiActualCredits,
    artifacts:
      artifactMimeType === 'text/markdown'
        ? [
            {
              content: generated.text,
              fileName: artifactName,
              mimeType: artifactMimeType,
            },
          ]
        : [],
    outputSnapshot: {
      model: config.model,
      provider: config.provider,
      text: generated.text,
      tokenUsage: generated.tokenUsage ?? {},
    },
    preview: generated.text,
  };
};
