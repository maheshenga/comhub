'use client';

import { Input, InputNumber, Switch } from '@lobehub/ui';
import { Form } from '@lobehub/ui/form';
import { useTranslation } from 'react-i18next';

import { AdminFormGrid } from '../layout';

const PackageFormFields = ({ editing }: { editing?: { id?: string } | null } = {}) => {
  const { t } = useTranslation('subscription');

  return (
    <>
      <Form.Field required label={t('admin.topup.field.id', '套餐 ID（如 starter-100）')} name="id">
        <Input disabled={!!editing?.id} />
      </Form.Field>
      <Form.Field required label={t('admin.topup.field.name', '套餐名称')} name="displayName">
        <Input />
      </Form.Field>
      <AdminFormGrid columns={3} label={t('admin.topup.amountFields', '积分与金额字段')}>
        <Form.Field label={t('admin.topup.field.credits', '积分')} name="credits">
          <InputNumber min={0} precision={6} style={{ width: '100%' }} suffix={'M'} />
        </Form.Field>
        <Form.Field label={t('admin.topup.field.amount', '金额')} name="amount">
          <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
        </Form.Field>
        <Form.Field label={t('admin.topup.field.currency', '币种')} name="currency">
          <Input />
        </Form.Field>
      </AdminFormGrid>
      <AdminFormGrid label={t('admin.topup.orderFields', '有效期与排序字段')}>
        <Form.Field label={t('admin.topup.field.validity', '有效期（月）')} name="validityMonths">
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Field>
        <Form.Field label={t('admin.topup.field.sortOrder', '排序值')} name="sortOrder">
          <InputNumber style={{ width: '100%' }} />
        </Form.Field>
      </AdminFormGrid>
      <AdminFormGrid label={t('admin.topup.stateFields', '推荐与启用状态')}>
        <Form.Field
          label={t('admin.topup.field.recommended', '推荐')}
          name="recommended"
          valueProp="checked"
        >
          <Switch />
        </Form.Field>
        <Form.Field
          label={t('admin.topup.field.active', '启用')}
          name="isActive"
          valueProp="checked"
        >
          <Switch />
        </Form.Field>
      </AdminFormGrid>
      <AdminFormGrid label={t('admin.topup.promotionFields', '促销状态与原价')}>
        <Form.Field
          label={t('admin.topup.field.promotionEnabled', '启用促销')}
          name="promotionEnabled"
          valueProp="checked"
        >
          <Switch />
        </Form.Field>
        <Form.Field label={t('admin.topup.field.originalAmount', '促销原价')} name="originalAmount">
          <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
        </Form.Field>
      </AdminFormGrid>
      <AdminFormGrid label={t('admin.topup.promotionCopyFields', '促销文案字段')}>
        <Form.Field label={t('admin.topup.field.promotionLabel', '促销标签')} name="promotionLabel">
          <Input placeholder={t('admin.topup.field.promotionLabelPlaceholder', '限时优惠')} />
        </Form.Field>
        <Form.Field label={t('admin.topup.field.promotionNote', '促销说明')} name="promotionNote">
          <Input placeholder={t('admin.topup.field.promotionNotePlaceholder', '有效期 6 个月')} />
        </Form.Field>
      </AdminFormGrid>
    </>
  );
};

PackageFormFields.displayName = 'PackageFormFields';

export default PackageFormFields;
