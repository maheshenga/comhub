'use client';

import { useCallback, useState } from 'react';

import {
  idleSelectorStatus,
  loadAssistantOptions,
  loadModelOptions,
  loadModuleAppOptions,
  type ModelOption,
  type SelectOption,
  type SelectorStatus,
} from '../mobileSettingsHelpers';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

interface AsyncGuardLike {
  isMounted: () => boolean;
}

const buildSelectorRefresh = <T,>({
  asyncGuard,
  load,
  onResetSelection,
  setOptions,
  setStatus,
  tr,
  unavailableDefault,
  unavailableKey,
}: {
  asyncGuard: AsyncGuardLike;
  load: () => Promise<T[]>;
  onResetSelection: () => void;
  setOptions: (options: T[]) => void;
  setStatus: (status: SelectorStatus) => void;
  tr: TFn;
  unavailableDefault: string;
  unavailableKey: string;
}) =>
  useCallback(async () => {
    if (!asyncGuard.isMounted()) return;
    setStatus({ loading: true });
    try {
      const options = await load();
      if (!asyncGuard.isMounted()) return;
      setOptions(options);
      setStatus({ loading: false });
    } catch {
      if (!asyncGuard.isMounted()) return;
      setOptions([]);
      onResetSelection();
      setStatus({
        error: tr(unavailableKey, unavailableDefault),
        loading: false,
      });
    }
  }, [asyncGuard, tr]);

export const useMobileSelectorOptions = ({ asyncGuard, tr }: { asyncGuard: AsyncGuardLike; tr: TFn }) => {
  const [assistantOptions, setAssistantOptions] = useState<SelectOption[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [moduleAppOptions, setModuleAppOptions] = useState<SelectOption[]>([]);
  const [assistantStatus, setAssistantStatus] = useState<SelectorStatus>(idleSelectorStatus);
  const [modelStatus, setModelStatus] = useState<SelectorStatus>(idleSelectorStatus);
  const [moduleAppStatus, setModuleAppStatus] = useState<SelectorStatus>(idleSelectorStatus);
  const [selectedAssistantId, setSelectedAssistantId] = useState('');
  const [selectedModelValue, setSelectedModelValue] = useState('');
  const [selectedModuleAppId, setSelectedModuleAppId] = useState('');

  const refreshAssistantOptions = buildSelectorRefresh({
    asyncGuard,
    load: loadAssistantOptions,
    onResetSelection: () => setSelectedAssistantId(''),
    setOptions: setAssistantOptions,
    setStatus: setAssistantStatus,
    tr,
    unavailableDefault: 'Assistant selector unavailable.',
    unavailableKey: 'admin.mobile.assistantSelectorUnavailable',
  });

  const refreshModelOptions = buildSelectorRefresh({
    asyncGuard,
    load: loadModelOptions,
    onResetSelection: () => setSelectedModelValue(''),
    setOptions: setModelOptions,
    setStatus: setModelStatus,
    tr,
    unavailableDefault: 'Model selector unavailable.',
    unavailableKey: 'admin.mobile.modelSelectorUnavailable',
  });

  const refreshModuleAppOptions = buildSelectorRefresh({
    asyncGuard,
    load: loadModuleAppOptions,
    onResetSelection: () => setSelectedModuleAppId(''),
    setOptions: setModuleAppOptions,
    setStatus: setModuleAppStatus,
    tr,
    unavailableDefault: 'Module app selector unavailable.',
    unavailableKey: 'admin.mobile.moduleAppSelectorUnavailable',
  });

  return {
    assistantOptions,
    assistantStatus,
    modelOptions,
    modelStatus,
    moduleAppOptions,
    moduleAppStatus,
    refreshAssistantOptions,
    refreshModelOptions,
    refreshModuleAppOptions,
    selectedAssistantId,
    selectedModelValue,
    selectedModuleAppId,
    setSelectedAssistantId,
    setSelectedModelValue,
    setSelectedModuleAppId,
  };
};
