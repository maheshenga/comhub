const STORAGE_KEY = 'lobe:user-memory:analysis-task';
const STORAGE_EVENT = 'lobe:user-memory:analysis-task-change';
const TASK_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredMemoryAnalysisTask {
  taskId: string;
  updatedAt: number;
}

const getStorage = () => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

const parseStoredTask = (value: string | null): StoredMemoryAnalysisTask | undefined => {
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value) as Partial<StoredMemoryAnalysisTask>;
    if (!parsed.taskId || typeof parsed.taskId !== 'string') return undefined;
    if (!parsed.updatedAt || typeof parsed.updatedAt !== 'number') return undefined;

    return { taskId: parsed.taskId, updatedAt: parsed.updatedAt };
  } catch {
    return undefined;
  }
};

export const clearStoredMemoryAnalysisTaskId = () => {
  getStorage()?.removeItem(STORAGE_KEY);
  dispatchMemoryAnalysisTaskChange();
};

export const getStoredMemoryAnalysisTaskId = () => {
  const storage = getStorage();
  const stored = parseStoredTask(storage?.getItem(STORAGE_KEY) ?? null);

  if (!stored) return undefined;

  if (Date.now() - stored.updatedAt > TASK_TTL_MS) return undefined;

  return stored.taskId;
};

export const storeMemoryAnalysisTaskId = (taskId: string) => {
  getStorage()?.setItem(
    STORAGE_KEY,
    JSON.stringify({
      taskId,
      updatedAt: Date.now(),
    } satisfies StoredMemoryAnalysisTask),
  );
  dispatchMemoryAnalysisTaskChange();
};

export const dispatchMemoryAnalysisTaskChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(STORAGE_EVENT));
};

export const subscribeMemoryAnalysisTaskId = (listener: () => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };

  window.addEventListener(STORAGE_EVENT, listener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(STORAGE_EVENT, listener);
    window.removeEventListener('storage', handleStorage);
  };
};
