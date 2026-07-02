import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');
const readRepoFile = (filePath: string) => readFileSync(path.resolve(repoRoot, filePath), 'utf8');

describe('agent statistics source', () => {
  it('counts assistants from the agents table instead of sessions', () => {
    const userStats = readRepoFile('src/features/User/DataStatistics.tsx');
    const totalAssistants = readRepoFile(
      'src/routes/(main)/settings/stats/features/overview/TotalAssistants.tsx',
    );
    const swrKeys = readRepoFile('src/libs/swr/keys.ts');

    expect(swrKeys).toContain("countAgents: def('stats:countAgents'");
    expect(userStats).toContain("import { agentService } from '@/services/agent'");
    expect(userStats).toContain('agentService.countAgents()');
    expect(userStats).not.toContain('sessionService.countSessions()');
    expect(totalAssistants).toContain("import { agentService } from '@/services/agent'");
    expect(totalAssistants).toContain('agentService.countAgents()');
    expect(totalAssistants).toContain('agentService.countAgents({ endDate:');
    expect(totalAssistants).not.toContain('sessionService.countSessions()');
  });
});
