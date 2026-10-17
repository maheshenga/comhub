'use client';

import { AutoComplete, Input } from '@lobehub/ui/base-ui';
import { Form, type FormInstance, useWatch } from '@lobehub/ui/base-ui/form';
import { memo, type ReactNode } from 'react';

import {
  type DefaultModelOption,
  resolveModelProviderLabel,
} from '@/features/Admin/adminSettingsForm';

import { AdminFormGrid } from '../layout';

export interface RuntimeModelFieldPairProps {
  extra?: ReactNode;
  // Consumed with dynamic field-name strings only (setValue/useWatch), so the
  // untyped FormInstance keeps every caller's FormValues binding assignable.
  form: FormInstance<Record<string, any>>;
  modelField: string;
  modelLabel: string;
  options: DefaultModelOption[];
  placeholder: string;
  providerField: string;
  providerLabel?: string;
}

const RuntimeModelFieldPair = memo<RuntimeModelFieldPairProps>(
  ({
    extra,
    form,
    modelField,
    modelLabel,
    options,
    placeholder,
    providerField,
    providerLabel = '供应商',
  }) => {
    const model = useWatch(form, modelField) as string | undefined;
    const provider = useWatch(form, providerField) as string | undefined;
    const displayProvider = resolveModelProviderLabel({ model, provider }, options);

    return (
      <AdminFormGrid label={`${modelLabel}与${providerLabel}`}>
        <Form.Field
          extra={extra}
          getValue={(raw: string) => options.find((option) => option.value === raw)?.model ?? raw}
          label={modelLabel}
          name={modelField}
          // Map the picked option value to its bare model name exactly like the
          // previous antd Form.Item + setFieldsValue net effect; free-typed text
          // falls through unchanged.
        >
          <AutoComplete
            allowClear
            options={options}
            placeholder={placeholder}
            onChange={(value) => {
              const selected = options.find((option) => option.value === value);
              if (!selected) return form.setValue(providerField, '');

              // base-ui AutoComplete has no separate onSelect: onChange already
              // fires with the picked option value, so selection syncs here.
              // The model field itself is mapped through getValue above.
              form.setValue(providerField, selected.provider);
            }}
          />
        </Form.Field>
        <Form.Field hidden name={providerField}>
          <Input />
        </Form.Field>
        <Form.Field label={providerLabel}>
          <Input
            readOnly
            aria-label={providerLabel}
            placeholder="选择模型后自动显示"
            value={displayProvider}
          />
        </Form.Field>
      </AdminFormGrid>
    );
  },
);

RuntimeModelFieldPair.displayName = 'RuntimeModelFieldPair';

export default RuntimeModelFieldPair;
