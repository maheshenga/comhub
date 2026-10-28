'use client';

import { Alert, Button, Flexbox, toast } from '@lobehub/ui';
import { Form, useForm } from '@lobehub/ui/form';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ADMIN_SETTINGS_SECTION_SWR_KEY,
  PUBLIC_EXPERT_PLAZA_SWR_KEY,
} from '@/const/adminCacheKeys';
import { DEFAULT_EXPERT_PLAZA_CONFIG, type ExpertPlazaCard } from '@/const/expertPlaza';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import CardListFields from './ExpertPlaza/CardListFields';
import EntryMetaFields from './ExpertPlaza/EntryMetaFields';
import type { CardFormValue, FormValues } from './ExpertPlaza/shared';
import { AdminFormActions, AdminPageError, AdminPageShell } from './layout';

const SETTING_KEYS = {
  cards: 'expertPlaza.cards',
  categories: 'expertPlaza.categories',
  description: 'expertPlaza.description',
  enabled: 'expertPlaza.enabled',
  name: 'expertPlaza.name',
} as const;

const splitTextList = (value?: string) =>
  Array.from(
    new Set(
      (value ?? '')
        .split(/[\r\n,;，；]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const toFormValues = (data: any): FormValues => {
  const config = data?.expertPlazaConfig ?? DEFAULT_EXPERT_PLAZA_CONFIG;

  return {
    cards: (config.cards ?? []).map((item: ExpertPlazaCard) => ({
      ...item,
      tagsText: item.tags?.join('\n') ?? '',
    })),
    categoriesText: (config.categories ?? DEFAULT_EXPERT_PLAZA_CONFIG.categories).join('\n'),
    description: config.description ?? DEFAULT_EXPERT_PLAZA_CONFIG.description,
    enabled: config.enabled ?? DEFAULT_EXPERT_PLAZA_CONFIG.enabled,
    name: config.name ?? DEFAULT_EXPERT_PLAZA_CONFIG.name,
  };
};

const toCards = (cards: CardFormValue[]) =>
  (cards ?? []).map((item) => ({
    author: item.author?.trim() || undefined,
    avatar: item.avatar?.trim() || undefined,
    category: item.category?.trim() || undefined,
    description: item.description?.trim() || '',
    enabled: item.enabled !== false,
    featured: Boolean(item.featured),
    id: item.id?.trim() || item.title?.trim().toLowerCase().replaceAll(/\s+/g, '-'),
    metricLabel: item.metricLabel?.trim() || undefined,
    metricValue: item.metricValue?.trim() || undefined,
    tags: splitTextList(item.tagsText),
    title: item.title?.trim() || '',
    url: item.url?.trim() || undefined,
  }));

const AdminExpertPlazaPage = memo(() => {
  const { t } = useTranslation('subscription');
  const form = useForm<FormValues>({
    initialValues: toFormValues({ expertPlazaConfig: DEFAULT_EXPERT_PLAZA_CONFIG }),
  });
  const [submitting, setSubmitting] = useState(false);
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY('expert-plaza'), () =>
    adminCommercialService.getSettingsSection('expert-plaza'),
  );

  useEffect(() => {
    if (!data) return;
    form.setValues(toFormValues(data));
  }, [data, form]);

  const handleSave = async () => {
    if (!data) return;

    const { valid } = await form.validate();
    if (!valid) return;

    setSubmitting(true);
    try {
      const values = form.getValues();
      const cards = toCards(values.cards).filter(
        (item) => item.id && item.title && item.description,
      );

      await adminCommercialService.setAppSettingsBatch({
        updates: [
          { key: SETTING_KEYS.enabled, value: values.enabled },
          { key: SETTING_KEYS.name, value: values.name },
          {
            key: SETTING_KEYS.description,
            value: values.description,
          },
          {
            key: SETTING_KEYS.categories,
            value: splitTextList(values.categoriesText),
          },
          { key: SETTING_KEYS.cards, value: cards },
        ],
      });

      await mutate(PUBLIC_EXPERT_PLAZA_SWR_KEY);
      toast.success(t('admin.expertPlaza.saveSuccess', '专家广场配置已保存'));
    } catch {
      toast.error(t('admin.expertPlaza.saveFailed', '保存失败，请检查卡片必填字段'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminPageShell
      description={t('admin.expertPlaza.subtitle', '配置专家广场入口、页面信息、分类和展示卡片。')}
      title={t('admin.expertPlaza.title', '专家广场')}
      width="medium"
    >
      <Alert
        showIcon
        type="info"
        message={t(
          'admin.expertPlaza.tip',
          '开启后左侧栏会显示该入口；卡片可跳转到内部路径或外部链接。未填写 URL 时仅作为展示卡片。',
        )}
      />
      {error ? (
        <AdminPageError
          description={t('admin.expertPlaza.loadFailed', '无法读取当前专家广场配置，请重试。')}
          onRetry={refresh}
        />
      ) : null}

      <Form form={form} layout="vertical">
        <fieldset disabled={isLoading} style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}>
          <Flexbox gap={24}>
            <EntryMetaFields />

            <CardListFields form={form} />

            <AdminFormActions label={t('admin.expertPlaza.actions', '专家广场配置操作')}>
              <Button
                disabled={isLoading || !data}
                loading={submitting}
                type="primary"
                onClick={handleSave}
              >
                {t('admin.expertPlaza.save', '保存专家广场')}
              </Button>
            </AdminFormActions>
          </Flexbox>
        </fieldset>
      </Form>
    </AdminPageShell>
  );
});

AdminExpertPlazaPage.displayName = 'AdminExpertPlazaPage';

export default AdminExpertPlazaPage;
