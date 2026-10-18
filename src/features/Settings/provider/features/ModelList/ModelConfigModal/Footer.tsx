'use client';

import { Button, ModalFooter, useModalContext } from '@lobehub/ui/base-ui';
import { type FormInstance, type FormValues } from '@lobehub/ui/base-ui/form';
import isEqual from 'fast-deep-equal';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';

interface ModelConfigFooterProps {
  formRef: { current?: FormInstance };
  id: string;
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

const ModelConfigFooter = memo<ModelConfigFooterProps>(({ formRef, id }) => {
  const { t } = useTranslation('common');
  const { close } = useModalContext();
  const [loading, setLoading] = useState(false);
  const [editingProvider, updateAiModelsConfig] = useAiInfraStore((s) => [
    s.activeAiProvider!,
    s.updateAiModelsConfig,
  ]);
  const model = useAiInfraStore(aiModelSelectors.getAiModelById(id), isEqual);

  return (
    <ModalFooter>
      <Button onClick={close}>{t('cancel')}</Button>
      <Button
        loading={loading}
        type="primary"
        onClick={async () => {
          const form = formRef.current;
          if (!editingProvider || !id || !form) return;
          const data = form.getValues();
          const payload = omitUnchangedContextWindowTokens(data, model?.contextWindowTokens);

          setLoading(true);
          await updateAiModelsConfig(id, editingProvider, payload);
          setLoading(false);

          close();
        }}
      >
        {t('ok')}
      </Button>
    </ModalFooter>
  );
});

export default ModelConfigFooter;
