import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModelConfigFooter, { omitUnchangedContextWindowTokens } from '../Footer';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  formValues: {} as Record<string, unknown>,
  model: undefined as undefined | { contextWindowTokens?: number; id: string },
  updateAiModelsConfig: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@lobehub/ui/base-ui', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useModalContext: () => ({ close: mocks.close }),
}));

vi.mock('@/store/aiInfra', () => ({
  aiModelSelectors: {
    getAiModelById:
      (id: string) =>
      (state: { aiProviderModelList: { id: string }[] }): unknown =>
        state.aiProviderModelList.find((item) => item.id === id),
  },
  useAiInfraStore: (selector: (state: unknown) => unknown) =>
    selector({
      activeAiProvider: 'provider-1',
      aiProviderModelList: mocks.model ? [mocks.model] : [],
      updateAiModelsConfig: mocks.updateAiModelsConfig,
    }),
}));

const renderFooter = async () => {
  const formRef = { current: { getValues: () => mocks.formValues } as any };

  render(<ModelConfigFooter formRef={formRef} id={'model-1'} />);
  fireEvent.click(screen.getByText('ok'));

  await waitFor(() => expect(mocks.updateAiModelsConfig).toHaveBeenCalledTimes(1));

  return mocks.updateAiModelsConfig.mock.calls[0][2];
};

describe('omitUnchangedContextWindowTokens', () => {
  it('drops contextWindowTokens when it matches the merged initial value', () => {
    const payload = omitUnchangedContextWindowTokens(
      { contextWindowTokens: 128_000, displayName: 'Renamed' },
      128_000,
    );

    expect(payload).toEqual({ displayName: 'Renamed' });
    expect(payload).not.toHaveProperty('contextWindowTokens');
  });

  it('keeps contextWindowTokens when the user changed it', () => {
    const payload = omitUnchangedContextWindowTokens(
      { contextWindowTokens: 64_000, displayName: 'Renamed' },
      128_000,
    );

    expect(payload).toEqual({ contextWindowTokens: 64_000, displayName: 'Renamed' });
  });
});

describe('ModelConfigFooter save payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.formValues = { contextWindowTokens: 128_000, displayName: 'Renamed' };
    mocks.model = { contextWindowTokens: 128_000, id: 'model-1' };
    mocks.updateAiModelsConfig.mockResolvedValue(undefined);
  });

  it('does not pin the merged default when only other fields changed', async () => {
    const payload = await renderFooter();

    expect(payload).toEqual({ displayName: 'Renamed' });
    expect(payload).not.toHaveProperty('contextWindowTokens');
  });

  it('sends contextWindowTokens when the user changed it', async () => {
    mocks.formValues = { contextWindowTokens: 64_000, displayName: 'Renamed' };

    const payload = await renderFooter();

    expect(payload).toEqual({ contextWindowTokens: 64_000, displayName: 'Renamed' });
  });
});
