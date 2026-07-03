import { Composio } from '@composio/core';

import { getServerComposioApiKey, getServerComposioEnabled } from '@/config/composio';
import { type LobeChatDatabase } from '@/database/type';
import { getServerComposioConfig } from '@/server/services/appSettings';

let composioClientInstance: { apiKey: string; client: Composio } | undefined;

export const getComposioClient = async (db?: LobeChatDatabase): Promise<Composio> => {
  const config = db ? await getServerComposioConfig(db) : undefined;
  const enabled = config?.enabled ?? getServerComposioEnabled() ?? Boolean(getServerComposioApiKey());
  const apiKey = config?.apiKey ?? getServerComposioApiKey();

  if (!enabled || !apiKey) {
    throw new Error('Composio API key is not configured on server');
  }

  if (!composioClientInstance || composioClientInstance.apiKey !== apiKey) {
    composioClientInstance = {
      apiKey,
      client: new Composio({ apiKey }),
    };
  }

  return composioClientInstance.client;
};

export const isComposioClientAvailable = async (db?: LobeChatDatabase): Promise<boolean> => {
  const config = db ? await getServerComposioConfig(db) : undefined;

  return config ? config.enabled && Boolean(config.apiKey) : Boolean(getServerComposioApiKey());
};
