import { unstable_batchedUpdates } from 'react-dom';

import type { ResetableStore } from '@/store/utils/resetableStore';

interface ResetableStoreApi {
  getState: () => ResetableStore;
}

const getResetableStores = async (): Promise<ResetableStoreApi[]> => {
  const [
    { useAgentGroupStore },
    { useAgentStore },
    { useChatStore },
    { useDiscoverStore },
    { useDocumentStore },
    { useEvalStore },
    { useFileStore },
    { useHomeStore },
    { useImageStore },
    { useKnowledgeBaseStore },
    { useMentionStore },
    { useNotebookStore },
    { usePageStore },
    { useSessionStore },
    { useTaskStore },
    { useToolStore },
    { useUserMemoryStore },
    { useUserStore },
    { useVideoStore },
  ] = await Promise.all([
    import('@/store/agentGroup'),
    import('@/store/agent'),
    import('@/store/chat'),
    import('@/store/discover'),
    import('@/store/document'),
    import('@/store/eval'),
    import('@/store/file'),
    import('@/store/home'),
    import('@/store/image'),
    import('@/store/library'),
    import('@/store/mention'),
    import('@/store/notebook'),
    import('@/store/page'),
    import('@/store/session'),
    import('@/store/task'),
    import('@/store/tool'),
    import('@/store/userMemory'),
    import('@/store/user'),
    import('@/store/video'),
  ]);

  return [
    useAgentGroupStore,
    useAgentStore,
    useChatStore,
    useDiscoverStore,
    useDocumentStore,
    useEvalStore,
    useFileStore,
    useHomeStore,
    useImageStore,
    useKnowledgeBaseStore,
    useMentionStore,
    useNotebookStore,
    usePageStore,
    useSessionStore,
    useTaskStore,
    useToolStore,
    useUserMemoryStore,
    useUserStore,
    useVideoStore,
  ];
};

export interface StoreActions {
  reset: () => Promise<void>;
}

const createStoreActions = (getStores: () => Promise<ResetableStoreApi[]>): StoreActions => ({
  reset: async () => {
    const stores = await getStores();

    unstable_batchedUpdates(() => {
      for (const store of stores) {
        store.getState().reset();
      }
    });
  },
});

export const stores = createStoreActions(getResetableStores);
