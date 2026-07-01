import { act, renderHook } from '@testing-library/react';
import {
  type AIVideoModelCard,
  extractVideoDefaultValues,
  type RuntimeVideoGenParams,
  type VideoModelParamsSchema,
} from 'model-bank';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVideoStore } from '@/store/video';
import { type GlobalServerConfig } from '@/types/serverConfig';

type ServerConfigStoreMockState = {
  serverConfig: Pick<GlobalServerConfig, 'video'>;
};

const modelASchema: VideoModelParamsSchema = {
  prompt: { default: '' },
  imageUrl: { default: '' },
  endImageUrl: { default: '' },
  duration: { default: 5, min: 1, max: 10 },
};

const modelBSchema: VideoModelParamsSchema = {
  prompt: { default: '' },
  imageUrl: { default: '' },
  endImageUrl: { default: '' },
  duration: { default: 3, min: 1, max: 10 },
};

const testVideoModels: AIVideoModelCard[] = [
  {
    id: 'video-model-a',
    displayName: 'Video Model A',
    type: 'video',
    parameters: modelASchema,
    releasedAt: '2025-01-01',
  },
  {
    id: 'video-model-b',
    displayName: 'Video Model B',
    type: 'video',
    parameters: modelBSchema,
    releasedAt: '2025-01-02',
  },
];

const mockProviders = [
  {
    id: 'provider-a',
    name: 'Provider A',
    children: [testVideoModels[0]],
  },
  {
    id: 'provider-b',
    name: 'Provider B',
    children: [testVideoModels[1]],
  },
];

const { getServerConfigStoreStateMock, updateSystemStatusMock } = vi.hoisted(() => ({
  getServerConfigStoreStateMock: vi.fn<() => ServerConfigStoreMockState | undefined>(
    () => undefined,
  ),
  updateSystemStatusMock: vi.fn(),
}));

vi.mock('@/store/aiInfra', () => ({
  aiProviderSelectors: {
    enabledVideoModelList: vi.fn(() => mockProviders),
  },
  getAiInfraStoreState: vi.fn(() => ({})),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: {
    getState: vi.fn(() => ({
      updateSystemStatus: updateSystemStatusMock,
    })),
  },
}));

vi.mock('@/store/global/selectors', () => ({
  systemStatusSelectors: {},
}));

vi.mock('@/store/global/selectors/systemStatus', () => ({
  systemStatusSelectors: {},
}));

vi.mock('@/store/serverConfig', () => ({
  getServerConfigStoreState: getServerConfigStoreStateMock,
}));

const modelBDefaultValues = extractVideoDefaultValues(modelBSchema);

beforeEach(() => {
  vi.clearAllMocks();
  getServerConfigStoreStateMock.mockReturnValue(undefined);

  useVideoStore.setState({
    isInit: true,
    model: 'video-model-a',
    provider: 'provider-a',
    parametersSchema: modelASchema,
    parameters: {
      prompt: 'initial prompt',
      imageUrl: 'start-frame.png',
      endImageUrl: 'end-frame.png',
      duration: 6,
    } as RuntimeVideoGenParams,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('video generationConfig actions', () => {
  it('should initialize with admin default video model when there is no remembered selection', () => {
    getServerConfigStoreStateMock.mockReturnValue({
      serverConfig: {
        video: {
          defaultModel: 'video-model-b',
          defaultProvider: 'provider-b',
        },
      },
    });
    const { result } = renderHook(() => useVideoStore());

    act(() => {
      useVideoStore.setState({ isInit: false, model: '', provider: '' });
    });

    act(() => {
      result.current.initializeVideoConfig(false);
    });

    expect(result.current.model).toBe('video-model-b');
    expect(result.current.provider).toBe('provider-b');
    expect(result.current.parameters).toEqual(modelBDefaultValues);
    expect(result.current.parametersSchema).toEqual(modelBSchema);
    expect(result.current.isInit).toBe(true);
  });

  it('should preserve prompt and frame images when switching model', () => {
    const { result } = renderHook(() => useVideoStore());

    act(() => {
      result.current.setParamOnInput('prompt', 'cinematic sunset');
      result.current.setParamOnInput('imageUrl', 'start-custom.png');
      result.current.setParamOnInput('endImageUrl', 'end-custom.png');
      result.current.setParamOnInput('duration', 8);
    });

    act(() => {
      result.current.setModelAndProviderOnSelect('video-model-b', 'provider-b');
    });

    expect(result.current.parameters).toEqual({
      ...modelBDefaultValues,
      prompt: 'cinematic sunset',
      imageUrl: 'start-custom.png',
      endImageUrl: 'end-custom.png',
    });
    expect(result.current.parameters?.duration).toBe(modelBDefaultValues.duration);
  });
});

describe('uploading image previews', () => {
  it('should append and remove in-flight upload previews', () => {
    const { result } = renderHook(() => useVideoStore());

    act(() => {
      useVideoStore.setState({ uploadingImagePreviews: [] });
    });

    act(() => {
      result.current.addUploadingImagePreviews(['blob:a', 'blob:b']);
    });
    expect(result.current.uploadingImagePreviews).toEqual(['blob:a', 'blob:b']);

    act(() => {
      result.current.addUploadingImagePreviews(['blob:c']);
    });
    expect(result.current.uploadingImagePreviews).toEqual(['blob:a', 'blob:b', 'blob:c']);

    act(() => {
      result.current.removeUploadingImagePreviews(['blob:a', 'blob:c']);
    });
    expect(result.current.uploadingImagePreviews).toEqual(['blob:b']);
  });
});
