import { unstable_batchedUpdates } from 'react-dom';

import type { ResetableStore } from '@/store/utils/resetableStore';

interface ResetableStoreApi {
  getState: () => ResetableStore;
}

interface ResetDependencies {
  resetableActions: ResetableStore[];
  resetGatewayMuxRegistry: () => void;
  stores: ResetableStoreApi[];
}

/**
 * The registry itself must stay side-effect-free at module load (see
 * `agentManagerRuntimeLaziness.test.ts`): importing every store eagerly
 * instantiates Zustand stores while the module graph is still loading. Resolve
 * them on the first `reset()` instead.
 */
const getResetDependencies = async (): Promise<ResetDependencies> => {
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
    { useSessionStore },
    { useTaskStore },
    { useToolStore },
    { useUserMemoryStore },
    { useUserStore },
    { useVideoStore },
    { resetGatewayMuxRegistry },
    { agentDocumentActions },
    { pageActions },
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
    import('@/store/session'),
    import('@/store/task'),
    import('@/store/tool'),
    import('@/store/userMemory'),
    import('@/store/user'),
    import('@/store/video'),
    import('@/store/chat/slices/agentRun/actions/transports/gateway/muxRegistry'),
    import('@/store/agentDocument'),
    import('@/store/page'),
  ]);

  return {
    resetGatewayMuxRegistry,
    resetableActions: [agentDocumentActions, pageActions],
    stores: [
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
      useSessionStore,
      useTaskStore,
      useToolStore,
      useUserMemoryStore,
      useUserStore,
      useVideoStore,
    ],
  };
};

export interface StoreActions {
  reset: () => Promise<void>;
}

const createStoreActions = (getDependencies: () => Promise<ResetDependencies>): StoreActions => ({
  reset: async () => {
    const { resetGatewayMuxRegistry, resetableActions, stores } = await getDependencies();

    // Drop the per-user gateway socket(s) before the stores they feed are
    // wiped — a new data context must not inherit the old identity's socket.
    resetGatewayMuxRegistry();

    unstable_batchedUpdates(() => {
      for (const store of stores) {
        store.getState().reset();
      }
      for (const action of resetableActions) {
        action.reset();
      }
    });
  },
});

export const stores = createStoreActions(getResetDependencies);
