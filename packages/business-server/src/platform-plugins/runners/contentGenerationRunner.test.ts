import { describe, expect, it, vi } from 'vitest';

import { runContentGenerationPlugin } from './contentGenerationRunner';

describe('runContentGenerationPlugin', () => {
  it('renders the prompt template and returns a markdown artifact request', async () => {
    const textGenerator = vi.fn().mockResolvedValue({
      aiActualCredits: 42,
      text: '# Apple Notes\n\nA compact research note.',
      tokenUsage: { totalTokens: 128 },
    });

    const result = await runContentGenerationPlugin({
      action: {
        contentGeneration: {
          artifactMimeType: 'text/markdown',
          artifactNameTemplate: '{topic}-notes.md',
          model: 'gpt-4.1-mini',
          promptTemplate: 'Write research notes about {topic} for {audience}.',
          provider: 'openai',
        },
        id: 'research_notes',
        inputSchema: { fields: [] },
        moduleMultiplier: 1,
        name: 'Research Notes',
        runtimeType: 'content_generation',
      },
      input: { audience: 'students', topic: 'apple' },
      textGenerator,
      userId: 'user-a',
    });

    expect(textGenerator).toHaveBeenCalledWith({
      model: 'gpt-4.1-mini',
      prompt: 'Write research notes about apple for students.',
      provider: 'openai',
      userId: 'user-a',
    });
    expect(result.preview).toContain('Apple Notes');
    expect(result.aiActualCredits).toBe(42);
    expect(result.artifacts).toEqual([
      expect.objectContaining({
        content: '# Apple Notes\n\nA compact research note.',
        fileName: 'apple-notes.md',
        mimeType: 'text/markdown',
      }),
    ]);
  });
});
