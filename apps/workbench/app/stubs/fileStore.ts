const emptyState = {
  uploadWithProgress: async () => undefined,
  // `src/store/tree/store.ts` mirrors `state.queryParams` in its module-level
  // subscription (and `src/store/tree/actions.ts` references it); on the
  // server there is no explorer, so it stays unset — the real store types it
  // optional (src/store/file/slices/resource/initialState.ts).
  queryParams: undefined,
};

export const useFileStore = <T = unknown>(selector?: (state: typeof emptyState) => T): T =>
  selector ? selector(emptyState) : (emptyState as T);

useFileStore.getState = () => emptyState;
// `src/store/tree/store.ts` mirrors the explorer list into the sidebar tree at
// module scope; on the server there is no explorer to mirror.
useFileStore.subscribe = () => () => {};

export const documentSelectors = {};
export const fileChatSelectors = {};
export const fileManagerSelectors = {};
export const filesSelectors = {};
export const getChunkTargetId = () => undefined;
