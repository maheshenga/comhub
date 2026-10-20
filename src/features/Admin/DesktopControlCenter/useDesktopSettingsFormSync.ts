import { useForm } from '@lobehub/ui/form';
import { useCallback, useEffect, useState } from 'react';

import type { DesktopSettingsValues } from './desktopSettingsForm';

interface DesktopSettingsFormSyncOptions {
  hasData: boolean;
  initialValues: DesktopSettingsValues;
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Owns the FormKit instance for the desktop settings tabs. FormKit reads
 * `onValuesChange` from `useForm` options rather than a `<Form>` prop, so the
 * hook has to create the instance instead of receiving it.
 */
export const useDesktopSettingsFormSync = ({
  hasData,
  initialValues,
  onDirtyChange,
}: DesktopSettingsFormSyncOptions) => {
  const [dirtyFields, setDirtyFields] = useState<ReadonlySet<keyof DesktopSettingsValues>>(
    () => new Set(),
  );

  const markEdited = useCallback(
    (changedValues: Partial<DesktopSettingsValues>, allValues: DesktopSettingsValues) => {
      setDirtyFields((current) => {
        const next = new Set(current);
        let changed = false;

        for (const field of Object.keys(changedValues) as Array<keyof DesktopSettingsValues>) {
          const isDirty = !Object.is(allValues[field], initialValues[field]);
          if (isDirty === next.has(field)) continue;

          changed = true;
          if (isDirty) next.add(field);
          else next.delete(field);
        }

        return changed ? next : current;
      });
    },
    [initialValues],
  );

  const form = useForm<DesktopSettingsValues>({ onValuesChange: markEdited });

  useEffect(() => {
    if (!hasData) return;

    const synchronizedValues = Object.fromEntries(
      Object.entries(initialValues).filter(
        ([field]) => !dirtyFields.has(field as keyof DesktopSettingsValues),
      ),
    ) as Partial<DesktopSettingsValues>;
    form.setValues(synchronizedValues);
  }, [dirtyFields, form, hasData, initialValues]);

  useEffect(() => {
    onDirtyChange?.(dirtyFields.size > 0);
  }, [dirtyFields, onDirtyChange]);

  const markSaved = useCallback(() => setDirtyFields(new Set()), []);

  return { dirtyFields, form, markEdited, markSaved };
};
