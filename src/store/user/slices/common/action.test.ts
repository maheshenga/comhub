import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PREFERENCE } from '@/const/user';
import { userService } from '@/services/user';
import { useUserStore } from '@/store/user';
import { settingsSelectors, userGeneralSettingsSelectors } from '@/store/user/selectors';
import { type GlobalServerConfig } from '@/types/serverConfig';
import { type UserInitializationState, type UserPreference } from '@/types/user';
import { withSWR } from '~test-utils';

vi.mock('zustand/traditional');

vi.mock('swr', async (importOriginal) => {
  const modules = await importOriginal();
  return {
    ...(modules as any),
    mutate: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createCommonSlice', () => {
  describe('updateAvatar', () => {
    it('should update avatar', async () => {
      const { result } = renderHook(() => useUserStore());
      const avatar = 'data:image/png;base64,';

      const spyOn = vi.spyOn(result.current, 'refreshUserState');
      const updateAvatarSpy = vi.spyOn(userService, 'updateAvatar').mockResolvedValue({} as any);

      await act(async () => {
        await result.current.updateAvatar(avatar);
      });

      expect(updateAvatarSpy).toHaveBeenCalledWith('data:image/png;base64,');
      expect(spyOn).toHaveBeenCalled();
    });
  });

  describe('useInitUserState', () => {
    const mockServerConfig = {
      defaultAgent: 'agent1',
      languageModel: 'model1',
      telemetry: {},
      aiProvider: {},
    } as GlobalServerConfig;

    it('should not fetch user state if user is not login', async () => {
      const mockUserConfig: any = undefined; // ģ��δ��ʼ�������������
      vi.spyOn(userService, 'getUserState').mockResolvedValueOnce(mockUserConfig);
      const successCallback = vi.fn();

      const { result } = renderHook(
        () =>
          useUserStore().useInitUserState(false, mockServerConfig, {
            onSuccess: successCallback,
          }),
        { wrapper: withSWR },
      );

      // ��Ϊ initServer Ϊ false�����Բ��ᴥ�� getUserState �ĵ���
      expect(userService.getUserState).not.toHaveBeenCalled();
      // Ҳ���ᴥ�� onSuccess �ص�
      expect(successCallback).not.toHaveBeenCalled();
      // ȷ��״̬δ�ı�
      expect(result.current.data).toBeUndefined();
    });

    it('should fetch user state correctly when user is login', async () => {
      const mockUserState: UserInitializationState = {
        userId: 'user-id',
        isOnboard: true,
        onboarding: { finishedAt: '2024-01-01T00:00:00Z', version: 1 },
        preference: {
          telemetry: true,
        },
        settings: {
          general: { fontSize: 14, timezone: 'America/New_York' },
        },
        email: 'test@example.com',
      };

      vi.spyOn(userService, 'getUserState').mockResolvedValueOnce(mockUserState);
      const successCallback = vi.fn();

      const { result } = renderHook(
        () =>
          useUserStore().useInitUserState(true, mockServerConfig, {
            onSuccess: successCallback,
          }),
        {
          wrapper: withSWR,
        },
      );

      // �ȴ� SWR ������ݻ�ȡ
      await waitFor(() => expect(result.current.data).toEqual(mockUserState));

      // ��֤״̬�Ƿ���ȷ����
      expect(useUserStore.getState().user?.avatar).toBe(mockUserState.avatar);
      expect(userGeneralSettingsSelectors.config(useUserStore.getState() as any)).toEqual(
        expect.objectContaining({
          fontSize: 14,
          responseLanguage: expect.any(String),
          timezone: 'America/New_York',
        }),
      );
      expect(useUserStore.getState().user?.email).toEqual(mockUserState.email);
      expect(successCallback).toHaveBeenCalledWith(mockUserState);
    });

    it('should merge user role into the profile when user state initializes', async () => {
      const mockUserState = {
        userId: 'user-id',
        isOnboard: true,
        preference: {
          telemetry: true,
        },
        role: 'admin',
        settings: {},
      } as UserInitializationState;

      vi.spyOn(userService, 'getUserState').mockResolvedValueOnce(mockUserState);

      renderHook(() => useUserStore().useInitUserState(true, mockServerConfig), {
        wrapper: withSWR,
      });

      await waitFor(() => {
        expect(useUserStore.getState().isUserStateInit).toBeTruthy();
        expect((useUserStore.getState().user as any)?.role).toBe('admin');
      });
    });

    it('should apply admin-managed default model and provider over saved user defaults', async () => {
      const mockUserState = {
        userId: 'user-id',
        isOnboard: true,
        preference: {
          telemetry: true,
        },
        settings: {
          defaultAgent: {
            config: {
              model: 'user-model',
              provider: 'openai',
              systemRole: 'keep user role',
            },
          },
        },
      } as UserInitializationState;
      const serverConfig = {
        ...mockServerConfig,
        defaultAgent: {
          config: {
            model: 'admin-model',
            provider: 'newapi',
          },
        },
      } as GlobalServerConfig;

      vi.spyOn(userService, 'getUserState').mockResolvedValueOnce(mockUserState);

      renderHook(() => useUserStore().useInitUserState(true, serverConfig), {
        wrapper: withSWR,
      });

      await waitFor(() => {
        expect(useUserStore.getState().isUserStateInit).toBeTruthy();
        expect(settingsSelectors.defaultAgentConfig(useUserStore.getState()).model).toBe(
          'admin-model',
        );
        expect(settingsSelectors.defaultAgentConfig(useUserStore.getState()).provider).toBe(
          'newapi',
        );
        expect(settingsSelectors.defaultAgentConfig(useUserStore.getState()).systemRole).toBe(
          'keep user role',
        );
      });
    });

    it('should call switch language when language is auto', async () => {
      const mockUserState: UserInitializationState = {
        userId: 'user-id',
        isOnboard: true,
        preference: {
          telemetry: true,
        },
        settings: {},
      };

      vi.spyOn(userService, 'getUserState').mockResolvedValueOnce(mockUserState);

      const { result } = renderHook(() => useUserStore().useInitUserState(true, mockServerConfig), {
        wrapper: withSWR,
      });

      // �ȴ� SWR ������ݻ�ȡ
      await waitFor(() => expect(result.current.data).toEqual(mockUserState));
    });

    it('should fetch use server config correctly', async () => {
      const mockUserState: UserInitializationState = {
        userId: 'user-id',
        isOnboard: true,
        preference: {
          telemetry: true,
        },
        settings: {},
      };
      vi.spyOn(userService, 'getUserState').mockResolvedValueOnce(mockUserState);

      const { result } = renderHook(() => useUserStore().useInitUserState(true, mockServerConfig));

      await waitFor(() => expect(result.current.data).toEqual(mockUserState));
    });

    it('should return saved preference when local storage has data', async () => {
      const { result } = renderHook(() => useUserStore());

      const savedPreference: UserPreference = {
        ...DEFAULT_PREFERENCE,
        hideSyncAlert: true,
        guide: { topic: false, moveSettingsToAvatar: true },
      };

      const mockUserState: UserInitializationState = {
        userId: 'user-id',
        isOnboard: true,
        preference: savedPreference,
        settings: {
          general: { fontSize: 14 },
        },
      };
      vi.spyOn(userService, 'getUserState').mockResolvedValueOnce(mockUserState);

      const { result: preference } = renderHook(
        () => result.current.useInitUserState(true, mockServerConfig),
        { wrapper: withSWR },
      );

      await waitFor(() => {
        expect(preference.current.data?.preference).toEqual(savedPreference);
        expect(result.current.isUserStateInit).toBeTruthy();
        expect(result.current.preference).toEqual(savedPreference);
      });
    });

    it('should handle the case when user state have avatar', async () => {
      const { result } = renderHook(() => useUserStore());
      const mockUserState: UserInitializationState = {
        userId: 'user-id',
        isOnboard: true,
        onboarding: { finishedAt: '2024-01-01T00:00:00Z', version: 1 },
        preference: undefined as any,
        settings: null as any,
        avatar: 'abc',
      };

      vi.spyOn(userService, 'getUserState').mockResolvedValueOnce(mockUserState);

      renderHook(() => result.current.useInitUserState(true, mockServerConfig), {
        wrapper: withSWR,
      });

      //   �ȴ� SWR ������ݻ�ȡ
      await waitFor(() => {
        expect(result.current.isUserStateInit).toBeTruthy();
        // ��֤״̬δ���������
        expect(result.current.user?.avatar).toEqual('abc');
        // When settings is null, auto-detect general settings will set them
        expect(result.current.settings).toEqual({
          general: { responseLanguage: expect.any(String), timezone: expect.any(String) },
        });
      });
    });

    it('should NOT auto-fill responseLanguage while onboarding is unfinished', async () => {
      const { result } = renderHook(() => useUserStore());

      const mockUserState: UserInitializationState = {
        userId: 'user-id',
        isOnboard: false,
        // No onboarding.finishedAt and no agentOnboarding.finishedAt:
        // user is still in the shared-prefix flow.
        preference: {} as any,
        settings: { general: { fontSize: 14 } },
      };
      vi.spyOn(userService, 'getUserState').mockResolvedValueOnce(mockUserState);

      renderHook(() => result.current.useInitUserState(true, mockServerConfig), {
        wrapper: withSWR,
      });

      await waitFor(() => {
        expect(result.current.isUserStateInit).toBeTruthy();
        expect(result.current.settings.general?.responseLanguage).toBeUndefined();
      });
    });

    it('should return default preference when local storage is empty', async () => {
      const { result } = renderHook(() => useUserStore());

      const mockUserState: UserInitializationState = {
        userId: 'user-id',
        isOnboard: true,
        preference: {} as any,
        settings: {
          general: { fontSize: 12 },
        },
      };

      vi.spyOn(userService, 'getUserState').mockResolvedValueOnce(mockUserState);

      renderHook(() => result.current.useInitUserState(true, mockServerConfig), {
        wrapper: withSWR,
      });

      await waitFor(() => {
        expect(result.current.isUserStateInit).toBeTruthy();
        expect(result.current.preference).toEqual(DEFAULT_PREFERENCE);
      });
    });
  });

  describe('useCheckTrace', () => {
    it('should return undefined when shouldFetch is false', async () => {
      const { result } = renderHook(() => useUserStore().useCheckTrace(false), {
        wrapper: withSWR,
      });

      await waitFor(() => expect(result.current.data).toBeUndefined());
    });

    it('should return false when telemetry is already set', async () => {
      vi.spyOn(userGeneralSettingsSelectors, 'telemetry').mockReturnValueOnce(true);

      const { result } = renderHook(() => useUserStore().useCheckTrace(true), {
        wrapper: withSWR,
      });

      await waitFor(() => expect(result.current.data).toBe(false));
    });

    it('should call messageService.messageCountToCheckTrace when needed', async () => {
      vi.spyOn(userGeneralSettingsSelectors, 'telemetry').mockReturnValueOnce(undefined as any);

      act(() => {
        useUserStore.setState({
          isUserCanEnableTrace: true,
        });
      });

      const { result } = renderHook(() => useUserStore.getState().useCheckTrace(true), {
        wrapper: withSWR,
      });

      await waitFor(() => expect(result.current.data).toBe(true));
    });
  });
});
