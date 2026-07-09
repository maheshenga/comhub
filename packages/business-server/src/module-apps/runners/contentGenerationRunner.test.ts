import { describe, expect, it, vi } from 'vitest';
import type { ModuleAppActionConfig } from '@lobechat/types';

import { runModuleAppContentGeneration } from './contentGenerationRunner';

const action: ModuleAppActionConfig = {
  id: 'generate',
  inputSchema: { fields: [] },
  moduleMultiplier: 1,
  name: 'Generate',
  outputSchema: {},
  runtimeConfig: {
    artifactNameTemplate: '{{topic}} report?.md',
    artifactMimeType: 'text/markdown',
    model: 'gpt-test',
    promptTemplate: 'Write about {{topic}}',
    provider: 'openai',
  },
  runtimeType: 'content_generation',
};

describe('runModuleAppContentGeneration', () => {
  it('renders prompt and returns a markdown artifact request', async () => {
    const textGenerator = vi.fn().mockResolvedValue({
      actualAiCredits: 12,
      text: 'Apple report',
      tokenUsage: { completion: 20, prompt: 10 },
    });

    const result = await runModuleAppContentGeneration({
      action,
      input: { topic: 'apple' },
      textGenerator,
      userId: 'user-1',
    });

    expect(textGenerator).toHaveBeenCalledWith({
      model: 'gpt-test',
      prompt: 'Write about apple',
      provider: 'openai',
      userId: 'user-1',
    });
    expect(result).toMatchObject({
      actualAiCredits: 12,
      artifacts: [
        {
          content: 'Apple report',
          fileName: 'apple-report.md',
          mimeType: 'text/markdown',
        },
      ],
      output: {
        model: 'gpt-test',
        provider: 'openai',
        text: 'Apple report',
        tokenUsage: { completion: 20, prompt: 10 },
      },
      preview: 'Apple report',
    });
  });

  it('requires an injected text generator', async () => {
    await expect(
      runModuleAppContentGeneration({
        action,
        input: { topic: 'apple' },
        userId: 'user-1',
      }),
    ).rejects.toThrow('MODULE_APP_TEXT_GENERATOR_REQUIRED');
  });
});
