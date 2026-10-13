'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Flexbox } from '@lobehub/ui';
import { Alert, toast } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form + Form.List 动态增删字段；base-ui FormKit 虽有 FormList 等价能力，但 API 形态不同（render-props + 按字段校验需改写），迁移属 FormKit 另行立项；Button/Input/Switch 为受控表单字段控件，属 #135 keep-antd 豁免清单。
import { Button, Form, Input, Switch } from 'antd';
import { cssVar } from 'antd-style';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { ADMIN_SETTINGS_SECTION_SWR_KEY, PUBLIC_PLAN_FAQ_SWR_KEY } from '@/const/adminCacheKeys';
import { APP_SETTING_KEYS } from '@/const/appSettingsRegistry';
import { normalizePlanFaqSettings, type PlanFaqItem } from '@/const/billingPresentation';
import { AdminPageError } from '@/features/Admin/shared/AdminPageState';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { isFormValidationError } from './shared/adminFormErrors';

type PlanFaqFormValues = {
  planFaqItems: PlanFaqItem[];
};

const AdminPlanFaqCard = memo(() => {
  const { t } = useTranslation('subscription');
  const [form] = Form.useForm<PlanFaqFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const {
    data,
    error,
    isLoading,
    mutate: refreshSection,
  } = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY('plans'), () =>
    adminCommercialService.getSettingsSection('plans'),
  );

  useEffect(() => {
    if (!data) return;

    form.setFieldsValue({ planFaqItems: normalizePlanFaqSettings(data.plansFaqItems) });
  }, [data, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await adminCommercialService.setAppSettingsBatch({
        updates: [
          {
            key: APP_SETTING_KEYS.plansFaqItems,
            value: normalizePlanFaqSettings(values.planFaqItems),
          },
        ],
      });
      await mutate(ADMIN_SETTINGS_SECTION_SWR_KEY('plans'));
      await mutate(PUBLIC_PLAN_FAQ_SWR_KEY);
      toast.success(t('admin.plans.faqSaveSuccess', '套餐常见问题已保存'));
    } catch (error) {
      if (!isFormValidationError(error))
        toast.error(t('admin.plans.faqSaveFailed', '保存失败，请检查常见问题内容'));
    } finally {
      setSubmitting(false);
    }
  };

  // 尚无服务端数据时一律不给保存入口（不只是「报错时」）：validateFields 对
  // 未连接的表单会以空 values resolve，normalizePlanFaqSettings(undefined)
  // 返回 DEFAULT_PLAN_FAQ_ITEMS —— 误点一次就把服务端 FAQ 覆盖成默认。
  // 该状态有三个来源：首次请求失败、请求失败且无缓存、以及 SWR 以空值收敛
  // （无 error、无 data），只有按「有没有拿到过服务端数据」判定才能全盖住。
  const hasServerData = data !== undefined && data !== null;
  const blocked = !isLoading && !hasServerData;

  return (
    <Card
      title={t('admin.plans.faqTitle', '套餐页常见问题')}
      extra={
        blocked ? null : (
          <Button disabled={isLoading} loading={submitting} type="primary" onClick={handleSave}>
            {t('admin.plans.faqSave', '保存常见问题')}
          </Button>
        )
      }
    >
      {blocked ? (
        <AdminPageError
          description={t('admin.plans.faqLoadFailed', '常见问题配置加载失败，请重试。')}
          onRetry={() => refreshSection()}
        />
      ) : (
        <>
          {error ? (
            <Alert
              showIcon
              type="warning"
              message={t(
                'admin.plans.faqRefreshFailed',
                '刷新失败，当前显示的是缓存数据；保存前请先重试刷新。',
              )}
            />
          ) : null}
          <Form disabled={isLoading} form={form} layout="vertical">
            <Form.List name="planFaqItems">
              {(fields, { add, remove }) => (
                <Flexbox gap={8}>
                  {fields.map(({ key, name, ...restField }) => (
                    <Flexbox
                      horizontal
                      align="center"
                      gap={8}
                      key={key}
                      style={{ flexWrap: 'wrap' }}
                    >
                      <Form.Item {...restField} hidden name={[name, 'id']}>
                        <Input />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        noStyle
                        name={[name, 'question']}
                        rules={[{ message: '请填写问题', required: true }]}
                      >
                        <Input
                          placeholder={t('admin.plans.faqQuestion', '问题')}
                          style={{ flex: 1 }}
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        noStyle
                        name={[name, 'answer']}
                        rules={[{ message: '请填写答案', required: true }]}
                      >
                        <Input
                          placeholder={t('admin.plans.faqAnswer', '答案')}
                          style={{ flex: 1.8 }}
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        noStyle
                        name={[name, 'enabled']}
                        valuePropName="checked"
                      >
                        <Switch size="small" />
                      </Form.Item>
                      <MinusCircleOutlined
                        style={{ color: cssVar.colorError }}
                        onClick={() => remove(name)}
                      />
                    </Flexbox>
                  ))}
                  <Button
                    block
                    icon={<PlusOutlined />}
                    type="dashed"
                    onClick={() => add({ answer: '', enabled: true, id: '', question: '' })}
                  >
                    {t('admin.plans.faqAdd', '添加常见问题')}
                  </Button>
                </Flexbox>
              )}
            </Form.List>
          </Form>
        </>
      )}
    </Card>
  );
});

AdminPlanFaqCard.displayName = 'AdminPlanFaqCard';

export default AdminPlanFaqCard;
