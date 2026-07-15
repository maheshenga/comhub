import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { FileModel } from '@/database/models/file';
import { DocumentService } from '@/server/services/document';
import { FileService } from '@/server/services/file';

import { recordAdminAudit } from './audit';
import { adminContentRouter } from './content';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/config/db', () => ({
  serverDBEnv: {
    REMOVE_GLOBAL_FILE: true,
  },
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn(),
}));

vi.mock('@/server/services/document', () => ({
  DocumentService: vi.fn(),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn(),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
}));

const createDb = ({
  document,
  file,
  topic,
}: {
  document?: Record<string, unknown>;
  file?: Record<string, unknown>;
  topic?: Record<string, unknown>;
} = {}) => {
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn(() => ({ where: deleteWhere }));

  return {
    __mocks: {
      delete: deleteMock,
      deleteWhere,
    },
    delete: deleteMock,
    query: {
      documents: {
        findFirst: vi.fn().mockResolvedValue(document ?? null),
      },
      files: {
        findFirst: vi.fn().mockResolvedValue(file ?? null),
      },
      topics: {
        findFirst: vi.fn().mockResolvedValue(topic ?? null),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
      },
    },
  } as any;
};

describe('admin content router', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('deletes files through FileModel and S3 cleanup instead of direct row deletion', async () => {
    const fileDelete = vi.fn().mockResolvedValue({ url: 'uploads/file.pdf' });
    const storageDelete = vi.fn().mockResolvedValue(undefined);
    vi.mocked(FileModel).mockImplementation(() => ({ delete: fileDelete }) as any);
    vi.mocked(FileService).mockImplementation(() => ({ deleteFile: storageDelete }) as any);

    const db = createDb({
      file: {
        fileType: 'application/pdf',
        id: 'file-1',
        name: 'file.pdf',
        size: 128,
        userId: 'user-1',
      },
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminContentRouter.createCaller({ userId: 'admin-user' } as any);
    await caller.deleteFile({ fileId: 'file-1' });

    expect(FileModel).toHaveBeenCalledWith(db, 'user-1');
    expect(fileDelete).toHaveBeenCalledWith('file-1', expect.any(Boolean));
    expect(FileService).toHaveBeenCalledWith(db, 'user-1');
    expect(storageDelete).toHaveBeenCalledWith('uploads/file.pdf');
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'content.file.delete',
        resourceId: 'file-1',
        targetUserId: 'user-1',
      }),
    );
  });

  it('deletes documents through DocumentService so associated files and children are handled', async () => {
    const deleteDocument = vi.fn().mockResolvedValue(undefined);
    vi.mocked(DocumentService).mockImplementation(() => ({ deleteDocument }) as any);

    const db = createDb({
      document: {
        id: 'doc-1',
        sourceType: 'api',
        title: 'Document',
        userId: 'user-2',
      },
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminContentRouter.createCaller({ userId: 'admin-user' } as any);
    await caller.deleteDocument({ documentId: 'doc-1' });

    expect(DocumentService).toHaveBeenCalledWith(db, 'user-2');
    expect(deleteDocument).toHaveBeenCalledWith('doc-1');
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'content.document.delete',
        resourceId: 'doc-1',
        targetUserId: 'user-2',
      }),
    );
  });

  it('deletes topics through the topics table so database cascade removes child rows', async () => {
    const db = createDb({
      topic: {
        id: 'topic-1',
        title: 'Topic',
        userId: 'user-3',
      },
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminContentRouter.createCaller({ userId: 'admin-user' } as any);
    await caller.deleteTopic({ topicId: 'topic-1' });

    expect(db.__mocks.delete).toHaveBeenCalledTimes(1);
    expect(db.__mocks.deleteWhere).toHaveBeenCalledTimes(1);
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'content.topic.delete',
        resourceId: 'topic-1',
        targetUserId: 'user-3',
      }),
    );
  });

  it('does not select document body content for admin list rows', () => {
    const source = readFileSync(path.join(__dirname, 'content.ts'), 'utf8');

    expect(source).not.toContain('content: documents.content');
  });
});
