'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Avatar, Flexbox } from '@lobehub/ui';
import { Alert, Button, Form, type FormInstance, Input, message, Switch, Typography } from 'antd';
import { memo, useEffect, useState } from 'react';

import { Card } from '@/components/antd-compat/Card';
import {
  ADMIN_SETTINGS_SECTION_SWR_KEY,
  PUBLIC_EXPERT_PLAZA_SWR_KEY,
} from '@/const/adminCacheKeys';
import { DEFAULT_EXPERT_PLAZA_CONFIG, type ExpertPlazaCard } from '@/const/expertPlaza';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

const SETTING_KEYS = {
  cards: 'expertPlaza.cards',
  categories: 'expertPlaza.categories',
  description: 'expertPlaza.description',
  enabled: 'expertPlaza.enabled',
  name: 'expertPlaza.name',
} as const;

type CardFormValue = Omit<ExpertPlazaCard, 'tags'> & {
  tagsText?: string;
};

type FormValues = {
  cards: CardFormValue[];
  categoriesText: string;
  description: string;
  enabled: boolean;
  name: string;
};

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
  const { data, isLoading } = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY('expert-plaza'), () =>
    adminCommercialService.getSettingsSection('expert-plaza'),
  );

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue(toFormValues(data));
  }, [data, form]);

  const handleSave = async () => {
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
      message.success('专家广场配置已保存');
    } catch {
      message.error('保存失败，请检查卡片必填字段');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 1040 }}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          专家广场
        </Title>
        <Text type="secondary">配置侧栏新栏目、页面标题、分类和展示卡片。</Text>
      </Flexbox>

      <Alert
        showIcon
        message="开启后左侧栏会显示该入口；卡片可跳转到内部路径或外部链接。未填写 URL 时仅作为展示卡片。"
        type="info"
      />

      <Form
        disabled={isLoading}
        form={form}
        initialValues={toFormValues({ expertPlazaConfig: DEFAULT_EXPERT_PLAZA_CONFIG })}
        layout="vertical"
      >
        <Card title="入口与页面">
          <Form.Item label="启用侧栏入口" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            label="栏目名称"
            name="name"
            rules={[{ message: '请填写栏目名称', required: true }]}
          >
            <Input placeholder="专家广场" />
          </Form.Item>
          <Form.Item label="页面说明" name="description">
            <Input.TextArea autoSize={{ minRows: 2 }} />
          </Form.Item>
          <Form.Item extra="每行一个分类，也支持逗号分隔。" label="分类列表" name="categoriesText">
            <Input.TextArea autoSize={{ minRows: 4 }} />
          </Form.Item>
        </Card>

        <Card style={{ marginTop: 16 }} title="卡片信息">
          <Form.List name="cards">
            {(fields, { add, remove }) => (
              <Flexbox gap={12}>
                {fields.map(({ key, name, ...restField }) => (
                  <Card key={key} size="small" style={{ borderRadius: 8 }}>
                    <Flexbox gap={12}>
                      <Flexbox horizontal align="center" justify="space-between">
                        <SpacePreview form={form} name={name} />
                        <MinusCircleOutlined
                          style={{ color: '#ff4d4f' }}
                          onClick={() => remove(name)}
                        />
                      </Flexbox>
                      <Flexbox horizontal gap={12}>
                        <Form.Item
                          {...restField}
                          label="ID"
                          name={[name, 'id']}
                          style={{ flex: 1 }}
                        >
                          <Input placeholder="finance-advisor" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          label="标题"
                          name={[name, 'title']}
                          rules={[{ message: '请填写标题', required: true }]}
                          style={{ flex: 1 }}
                        >
                          <Input placeholder="财务顾问" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          label="分类"
                          name={[name, 'category']}
                          style={{ flex: 1 }}
                        >
                          <Input placeholder="办公" />
                        </Form.Item>
                      </Flexbox>
                      <Form.Item
                        {...restField}
                        label="描述"
                        name={[name, 'description']}
                        rules={[{ message: '请填写描述', required: true }]}
                      >
                        <Input.TextArea autoSize={{ minRows: 2 }} />
                      </Form.Item>
                      <Flexbox horizontal gap={12}>
                        <Form.Item
                          {...restField}
                          label="头像 / 图标地址"
                          name={[name, 'avatar']}
                          style={{ flex: 1 }}
                        >
                          <Input placeholder="/images/avatar-presets/avatar-1.svg" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          label="跳转链接"
                          name={[name, 'url']}
                          style={{ flex: 1 }}
                        >
                          <Input placeholder="/market/..." />
                        </Form.Item>
                      </Flexbox>
                      <Flexbox horizontal gap={12}>
                        <Form.Item
                          {...restField}
                          label="作者/来源"
                          name={[name, 'author']}
                          style={{ flex: 1 }}
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          label="指标名称"
                          name={[name, 'metricLabel']}
                          style={{ flex: 1 }}
                        >
                          <Input placeholder="使用人数" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          label="指标值"
                          name={[name, 'metricValue']}
                          style={{ flex: 1 }}
                        >
                          <Input placeholder="1.2k" />
                        </Form.Item>
                      </Flexbox>
                      <Form.Item
                        {...restField}
                        extra="每行一个标签，也支持逗号分隔。"
                        label="标签"
                        name={[name, 'tagsText']}
                      >
                        <Input.TextArea autoSize={{ minRows: 2 }} />
                      </Form.Item>
                      <Flexbox horizontal gap={24}>
                        <Form.Item
                          {...restField}
                          label="启用"
                          name={[name, 'enabled']}
                          valuePropName="checked"
                        >
                          <Switch defaultChecked />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          label="精选"
                          name={[name, 'featured']}
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                      </Flexbox>
                    </Flexbox>
                  </Card>
                ))}
                <Button
                  block
                  icon={<PlusOutlined />}
                  type="dashed"
                  onClick={() =>
                    add({
                      description: '',
                      enabled: true,
                      featured: false,
                      id: '',
                      tagsText: '',
                      title: '',
                    })
                  }
                >
                  添加卡片
                </Button>
              </Flexbox>
            )}
          </Form.List>
        </Card>

        <Flexbox horizontal justify="flex-end" style={{ marginTop: 16 }}>
          <Button loading={submitting} type="primary" onClick={handleSave}>
            保存专家广场
          </Button>
        </Flexbox>
      </Form>
    </Flexbox>
  );
});

const SpacePreview = ({ form, name }: { form: FormInstance<FormValues>; name: number }) => (
  <Form.Item noStyle shouldUpdate>
    {() => {
      const card = form.getFieldValue(['cards', name]) as CardFormValue | undefined;
      return (
        <Flexbox horizontal align="center" gap={8}>
          <Avatar avatar={card?.avatar} size={32} title={card?.title ?? ''} />
          <Text strong>{card?.title || '新卡片'}</Text>
        </Flexbox>
      );
    }}
  </Form.Item>
);

AdminExpertPlazaPage.displayName = 'AdminExpertPlazaPage';

export default AdminExpertPlazaPage;
