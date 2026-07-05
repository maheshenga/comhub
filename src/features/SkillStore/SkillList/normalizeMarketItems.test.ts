import { describe, expect, it } from 'vitest';

import {
  normalizeAgentSkillListItem,
  normalizeMarketSkillItems,
  normalizeMcpMarketItems,
} from './normalizeMarketItems';

describe('normalizeMarketItems', () => {
  it('normalizes market skills that use title/avatar fields', () => {
    const result = normalizeMarketSkillItems([
      {
        avatar: 'skill-icon',
        description: 'Current market shape',
        identifier: 'skill-one',
        title: 'Skill One',
      } as any,
      {
        name: 'Broken Skill',
      } as any,
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        icon: 'skill-icon',
        identifier: 'skill-one',
        name: 'Skill One',
        title: 'Skill One',
      }),
    ]);
  });

  it('normalizes MCP market items and removes items without identifiers', () => {
    const result = normalizeMcpMarketItems([
      {
        identifier: 'mcp-one',
        summary: 'Summary text',
        title: 'MCP One',
      } as any,
      {
        title: 'Broken MCP',
      } as any,
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        description: 'Summary text',
        identifier: 'mcp-one',
        name: 'MCP One',
        title: 'MCP One',
      }),
    ]);
  });

  it('uses the database id as a last resort for installed agent skills', () => {
    const result = normalizeAgentSkillListItem({
      id: 'skill-id',
      source: 'market',
    } as any);

    expect(result).toEqual(
      expect.objectContaining({
        identifier: 'skill-id',
        name: 'skill-id',
      }),
    );
  });
});
