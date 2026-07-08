import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import defaultSubscription from '../../../packages/locales/src/default/subscription';

const readJson = (path: string): Record<string, string> =>
  JSON.parse(readFileSync(join(process.cwd(), path), 'utf8'));

const requiredDetailKeys = [
  'platformPlugins.detail.agentBinding',
  'platformPlugins.detail.agentBindingDisabled',
  'platformPlugins.detail.agentBindingEnabled',
  'platformPlugins.detail.agentIdPlaceholder',
  'platformPlugins.detail.available.installable',
  'platformPlugins.detail.available.runnable',
  'platformPlugins.detail.available.visible',
  'platformPlugins.detail.enable',
  'platformPlugins.detail.install',
  'platformPlugins.detail.installed',
  'platformPlugins.detail.installRequired',
  'platformPlugins.detail.loadError',
  'platformPlugins.detail.missing',
  'platformPlugins.detail.runPlugin',
  'platformPlugins.detail.slug',
  'platformPlugins.detail.tags',
  'platformPlugins.detail.uninstall',
  'platformPlugins.detail.uninstalled',
  'platformPlugins.detail.unavailable',
  'platformPlugins.detail.version',
  'platformPlugins.restriction.agentNotEnabled',
  'platformPlugins.restriction.notInstalled',
  'platformPlugins.restriction.planInstallDenied',
  'platformPlugins.restriction.planRunDenied',
  'platformPlugins.restriction.planVisibilityDenied',
  'platformPlugins.restriction.runtimeNotReady',
  'platformPlugins.restriction.unknown',
];

describe('platform plugin marketplace locale keys', () => {
  it('ships detail and restriction keys in default, en-US, and zh-CN locales', () => {
    const enUS = readJson('locales/en-US/subscription.json');
    const zhCN = readJson('locales/zh-CN/subscription.json');

    for (const key of requiredDetailKeys) {
      expect(defaultSubscription, `default missing ${key}`).toHaveProperty(key);
      expect(enUS, `en-US missing ${key}`).toHaveProperty(key);
      expect(zhCN, `zh-CN missing ${key}`).toHaveProperty(key);
    }
  });
});
