import { MODULE_APP_PACKAGE_MAX_ARCHIVE_BYTES } from '@lobechat/types';
import { Flexbox, Icon } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { LoaderCircle, Upload } from 'lucide-react';
import { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleAppService } from '@/services/moduleApp';

type UploadState =
  | { message: string; status: 'error' | 'success' }
  | { status: 'idle' | 'uploading' };

type ModuleAppPackageUploaderProps = {
  onSubmitted?: () => Promise<void> | void;
};

const ModuleAppPackageUploader = memo<ModuleAppPackageUploaderProps>(({ onSubmitted }) => {
  const { t } = useTranslation('common');
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const uploading = state.status === 'uploading';

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setState({ message: t('moduleApps.packageUploader.zipOnly'), status: 'error' });
      return;
    }
    if (file.size > MODULE_APP_PACKAGE_MAX_ARCHIVE_BYTES) {
      setState({ message: t('moduleApps.packageUploader.tooLarge'), status: 'error' });
      return;
    }

    setState({ status: 'uploading' });
    try {
      await moduleAppService.uploadPackage(file);
      setState({ message: t('moduleApps.packageUploader.success'), status: 'success' });
      await Promise.resolve(onSubmitted?.()).catch(() => undefined);
    } catch {
      setState({ message: t('moduleApps.packageUploader.failure'), status: 'error' });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Flexbox horizontal align={'center'} gap={12}>
      <input
        hidden
        accept={'.zip,application/zip,application/x-zip-compressed'}
        aria-label={t('moduleApps.packageUploader.fileLabel')}
        ref={inputRef}
        type={'file'}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <Button
        disabled={uploading}
        htmlType={'button'}
        icon={<Icon icon={uploading ? LoaderCircle : Upload} spin={uploading} />}
        type={'primary'}
        onClick={() => inputRef.current?.click()}
      >
        {t('moduleApps.packageUploader.submit')}
      </Button>
      {'message' in state && (
        <small aria-live={'polite'} role={state.status === 'error' ? 'alert' : 'status'}>
          {state.message}
        </small>
      )}
    </Flexbox>
  );
});

ModuleAppPackageUploader.displayName = 'ModuleAppPackageUploader';

export default ModuleAppPackageUploader;
