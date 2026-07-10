'use client';

import type { ModuleAppAdminUpsertInput } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Form, Input, message, Modal, Select } from 'antd';
import { memo, type ReactNode, useEffect } from 'react';

import ActionEditor from './ActionEditor';
import BillingEditor from './BillingEditor';
import EntitlementEditor from './EntitlementEditor';
import {
  buildModuleAppUpsertInput,
  createDefaultModuleAppFormValues,
  type ModuleAppAdminFormInput,
  normalizeModuleAppFormValues,
} from './formSchema';
import PageEditor from './PageEditor';
import type { AdminModuleAppDetail } from './types';

export type AppEditorModalProps = {
  children?: ReactNode;
  initialApp?: AdminModuleAppDetail | null;
  onCancel: () => void;
  onSubmit: (input: ModuleAppAdminUpsertInput) => Promise<void>;
  open: boolean;
  submitting?: boolean;
};

const appTypeOptions = [
  'standard_app',
  'api_app',
  'ai_app',
  'workflow_app',
  'hybrid_app',
].map((value) => ({ label: value, value }));

const statusOptions = ['draft', 'published', 'unpublished'].map((value) => ({
  label: value,
  value,
}));

const AppEditorModal = memo<AppEditorModalProps>(
  ({ initialApp, onCancel, onSubmit, open, submitting }) => {
    const [form] = Form.useForm<ModuleAppAdminFormInput>();

    useEffect(() => {
      if (!open) return;

      form.setFieldsValue(
        normalizeModuleAppFormValues(initialApp ?? createDefaultModuleAppFormValues()),
      );
    }, [form, initialApp, open]);

    const handleOk = async () => {
      try {
        const values = await form.validateFields();
        const normalized = normalizeModuleAppFormValues(values);
        await onSubmit(buildModuleAppUpsertInput(normalized));
      } catch (error) {
        if (Array.isArray((error as { errorFields?: unknown[] }).errorFields)) return;
        message.error(
          error instanceof Error ? error.message : 'Module app form validation failed',
        );
      }
    };

    return (
      <Modal
        destroyOnHidden
        confirmLoading={submitting}
        open={open}
        title={initialApp ? 'Edit module app' : 'New module app'}
        width={900}
        onCancel={onCancel}
        onOk={handleOk}
      >
        <Form form={form} layout="vertical">
          <Form.Item hidden name="id">
            <Input />
          </Form.Item>

          <Flexbox horizontal gap={12}>
            <Form.Item
              label="Module app name"
              name="displayName"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="Workbench" />
            </Form.Item>
            <Form.Item
              label="Slug"
              name="slug"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input disabled={!!initialApp} placeholder="workbench" />
            </Form.Item>
          </Flexbox>

          <Flexbox horizontal gap={12}>
            <Form.Item
              label="Category"
              name="category"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="productivity" />
            </Form.Item>
            <Form.Item
              label="Icon"
              name="icon"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="Blocks" />
            </Form.Item>
          </Flexbox>

          <Flexbox horizontal gap={12}>
            <Form.Item
              label="App type"
              name="appType"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Select options={appTypeOptions} />
            </Form.Item>
            <Form.Item
              label="Status"
              name="status"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Select options={statusOptions} />
            </Form.Item>
          </Flexbox>

          <Form.Item label="Tags" name="tags">
            <Select mode="tags" placeholder="Add tag and press Enter" />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
            rules={[{ required: true }]}
          >
            <Input.TextArea autoSize={{ maxRows: 5, minRows: 3 }} />
          </Form.Item>

          <Flexbox gap={24}>
            <PageEditor />
            <ActionEditor />
            <EntitlementEditor />
            <BillingEditor />
          </Flexbox>
        </Form>
      </Modal>
    );
  },
);

AppEditorModal.displayName = 'AppEditorModal';

export default AppEditorModal;
