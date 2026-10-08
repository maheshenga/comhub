import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as SwrModule from '@/libs/swr';
import { useClientDataSWRWithSync } from '@/libs/swr';
import { DocumentSourceType, type LobeDocument } from '@/types/document';

import type { PageStore } from '../../store';
import { usePageStore } from '../../store';
import { CrudActionImpl } from './action';

vi.mock('@/libs/swr', async (importOriginal) => {
  const actual = await importOriginal<typeof SwrModule>();
  return {
    ...actual,
    useClientDataSWRWithSync: vi.fn(() => ({ data: undefined, isValidating: false })),
  };
});

const createAction = () => {
  const createError = new Error('create failed');
  const navigate = vi.fn();
  const state = {
    createOptimisticPage: vi.fn(() => 'temp-page'),
    createPage: vi.fn().mockRejectedValue(createError),
    navigate,
    removeTempPage: vi.fn(),
  } as unknown as PageStore;
  const set = vi.fn();

  return {
    action: new CrudActionImpl(set as never, () => state),
    createError,
    navigate,
    state,
  };
};

describe('CrudActionImpl.createNewPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigates to the page list when creation fails by default', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { action, createError, navigate, state } = createAction();

    await expect(action.createNewPage('Untitled')).rejects.toThrow(createError);

    expect(state.removeTempPage).toHaveBeenCalledWith('temp-page');
    expect(navigate).toHaveBeenCalledWith('/page');
  });

  it('preserves the caller location when failure navigation is suppressed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { action, createError, navigate, state } = createAction();

    await expect(
      action.createNewPage('Untitled', { suppressFailureNavigation: true }),
    ).rejects.toThrow(createError);

    expect(state.removeTempPage).toHaveBeenCalledWith('temp-page');
    expect(navigate).not.toHaveBeenCalled();
  });
});

const doc = (id: string, title: string): LobeDocument => ({
  content: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  editorData: null,
  fileType: 'custom/document',
  filename: title,
  id,
  metadata: {},
  source: 'document',
  sourceType: DocumentSourceType.EDITOR,
  title,
  totalCharCount: 0,
  totalLineCount: 0,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

const captureOnData = (pageId: string) => {
  renderHook(() => usePageStore.getState().useFetchPageDetail(pageId));
  const swrCall = vi.mocked(useClientDataSWRWithSync).mock.calls.at(-1);
  return swrCall?.[2]?.onData as (data: LobeDocument | null) => void;
};

describe('useFetchPageDetail onData', () => {
  beforeEach(() => {
    vi.mocked(useClientDataSWRWithSync).mockClear();
    usePageStore.setState({ documents: undefined });
  });

  it('adds a deep-linked page that is not in the loaded list', () => {
    usePageStore.setState({ documents: [doc('docs_other', 'Other')] });

    captureOnData('docs_target')(doc('docs_target', 'Target'));

    expect(usePageStore.getState().documents?.map((d) => d.id)).toEqual([
      'docs_target',
      'docs_other',
    ]);
  });

  it('adds the page when no list has been fetched (mobile)', () => {
    captureOnData('docs_target')(doc('docs_target', 'Target'));

    expect(usePageStore.getState().documents).toEqual([doc('docs_target', 'Target')]);
  });

  it('updates the page in place when it is already in the list', () => {
    usePageStore.setState({ documents: [doc('docs_target', 'Old'), doc('docs_other', 'Other')] });

    captureOnData('docs_target')(doc('docs_target', 'New'));

    const { documents } = usePageStore.getState();
    expect(documents).toHaveLength(2);
    expect(documents?.find((d) => d.id === 'docs_target')?.title).toBe('New');
  });
});
