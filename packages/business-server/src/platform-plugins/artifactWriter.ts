import { randomUUID } from 'node:crypto';

import { platformPluginArtifacts } from '@/database/schemas';
import type { LobeChatDatabase, Transaction } from '@/database/type';

import type { PlatformPluginArtifactRequest } from './runners/apiActionRunner';
import { sanitizeArtifactFileName } from './runners/template';

type PlatformPluginArtifactDb = LobeChatDatabase | Transaction;

export interface PlatformPluginArtifactStorage {
  uploadBuffer: (
    key: string,
    buffer: Buffer,
    contentType: string,
  ) => Promise<{ key?: string } | void>;
}

export interface WritePlatformPluginArtifactInput {
  artifact: PlatformPluginArtifactRequest;
  db: PlatformPluginArtifactDb;
  pluginId: string;
  runId: string;
  storage: PlatformPluginArtifactStorage;
  userId: string;
}

export const writePlatformPluginArtifact = async ({
  artifact,
  db,
  pluginId,
  runId,
  storage,
  userId,
}: WritePlatformPluginArtifactInput): Promise<{ id: string; storageKey: string }> => {
  const fileName = sanitizeArtifactFileName(artifact.fileName);
  const buffer = Buffer.isBuffer(artifact.content)
    ? artifact.content
    : Buffer.from(artifact.content, 'utf8');
  const storagePath = `platform-plugins/${pluginId}/${runId}/${randomUUID()}-${fileName}`;
  const uploaded = await storage.uploadBuffer(storagePath, buffer, artifact.mimeType);
  const storageKey = uploaded?.key ?? storagePath;
  const [row] = await db
    .insert(platformPluginArtifacts)
    .values({
      expiresAt: artifact.expiresAt ?? null,
      fileName,
      mimeType: artifact.mimeType,
      pluginId,
      runId,
      sizeBytes: buffer.length,
      storageKey,
      userId,
    })
    .returning({ id: platformPluginArtifacts.id });

  if (!row) {
    throw new Error('PLATFORM_PLUGIN_ARTIFACT_CREATE_FAILED');
  }

  return { id: row.id, storageKey };
};
