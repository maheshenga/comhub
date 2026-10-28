'use client';

import { Button, ModalFooter, toast, useModalContext } from '@lobehub/ui';
import { type FormInstance, type FormValues } from '@lobehub/ui/form';
import isEqual from 'fast-deep-equal';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';

import { pickModelConfigFormValues } from './utils';

interface ModelConfigFooterProps {
  formRef: { current?: FormInstance };
  id: string;
  showDeployName?: boolean;
}

/**
 * The form is seeded with the merged model (user row > admin default > card), so an
 * untouched contextWindowTokens field would write the admin default into the user row
 * and pin it. Drop the field when it still equals the initial merged value.
 */
export const omitUnchangedContextWindowTokens = (
  data: FormValues,
  initialContextWindowTokens?: number,
): FormValues => {
  const payload = { ...data };

  if (payload.contextWindowTokens === initialContextWindowTokens) {
    delete payload.contextWindowTokens;
  }

  return payload;
};

const ModelConfigFooter = memo<ModelConfigFooterProps>(({ formRef, id, showDeployName }) => {
  const { t } = useTranslation(['common', 'error']);
  const { close } = useModalContext();
  const [loading, setLoading] = useState(false);
  const [editingProvider, updateAiModelsConfig] = useAiInfraStore((s) => [
    s.activeAiProvider!,
    s.updateAiModelsConfig,
  ]);
  const model = useAiInfraStore(aiModelSelectors.getAiModelById(id), isEqual);

  return (
    <ModalFooter>
      <Button onClick={close}>{t('cancel', { ns: 'common' })}</Button>
      <Button
        loading={loading}
        type="primary"
        onClick={async () => {
          const form = formRef.current;
          if (!editingProvider || !id || !form) return;
          const values = omitUnchangedContextWindowTokens(
            form.getValues(),
            model?.contextWindowTokens,
          );
          const data = pickModelConfigFormValues(values, { showDeployName });

          setLoading(true);
          try {
            await updateAiModelsConfig(id, editingProvider, data);
            close();
          } catch (error) {
            console.error(error);
            toast.error(t('saveState.saveFailed', { ns: 'error' }));
          } finally {
            setLoading(false);
          }
        }}
      >
        {t('ok', { ns: 'common' })}
      </Button>
    </ModalFooter>
  );
});

export default ModelConfigFooter;
