'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, toast } from '@lobehub/ui/base-ui';
import { Form, type FormInstance } from 'antd';
import { memo, useEffect, useState } from 'react';

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
  const [form] = Form.useForm<FormValues>();
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
    form.setFieldsValue(toFormValues(data));
  }, [data, form]);

  const handleSave = async () => {
    if (!data) return;

    setSubmitting(true);
    try {
      const values = await form.validateFields();
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
      toast.success('专家广场配置已保存');
    } catch {
      toast.error('保存失败，请检查卡片必填字段');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminPageShell
      description="配置专家广场入口、页面信息、分类和展示卡片。"
      title="专家广场"
      width="medium"
    >
      <Alert
        showIcon
        message="开启后左侧栏会显示该入口；卡片可跳转到内部路径或外部链接。未填写 URL 时仅作为展示卡片。"
        type="info"
      />
      {error ? (
        <AdminPageError description="无法读取当前专家广场配置，请重试。" onRetry={refresh} />
      ) : null}

      <Form
        disabled={isLoading}
        form={form}
        initialValues={toFormValues({ expertPlazaConfig: DEFAULT_EXPERT_PLAZA_CONFIG })}
        layout="vertical"
      >
        <Flexbox gap={24}>
          <EntryMetaFields />

          <CardListFields form={form as FormInstance<any>} />

          <AdminFormActions label="专家广场配置操作">
            <Button
              disabled={isLoading || !data}
              loading={submitting}
              type="primary"
              onClick={handleSave}
            >
              保存专家广场
            </Button>
          </AdminFormActions>
        </Flexbox>
      </Form>
    </AdminPageShell>
  );
});

AdminExpertPlazaPage.displayName = 'AdminExpertPlazaPage';

export default AdminExpertPlazaPage;
