'use client';

import type { DesktopBuildAsset, DesktopBuildAssetKind } from '@lobechat/types';
import { Descriptions, Input, Modal, Segmented, TextArea, toast } from '@lobehub/ui/base-ui';
import { Form, useForm, useWatch } from '@lobehub/ui/base-ui/form';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminCommercialService } from '@/services/adminCommercial';

import { buildAdminDangerousActionEnvelope } from '../adminDangerousActions';
import {
  type BuildProfileFormValues,
  buildProfilePayloadFromForm,
  renderInstallerArtifactName,
} from './buildProfileForm';

interface CreateDesktopReleaseModalProps {
  assets: Partial<Record<DesktopBuildAssetKind, DesktopBuildAsset>>;
  formValues: BuildProfileFormValues;
  onClose: () => void;
  onReleaseChanged: () => void;
  open: boolean;
  profile: any;
}

const CreateDesktopReleaseModal = memo<CreateDesktopReleaseModalProps>(
  ({ formValues, onClose, onReleaseChanged, open, profile }) => {
    const { t } = useTranslation('subscription');
    const form = useForm<{
      channel: 'canary' | 'stable';
      releaseNotes: string;
      version: string;
    }>({ initialValues: { channel: 'canary', releaseNotes: '', version: '2.4.0-canary.1' } });
    const [submitting, setSubmitting] = useState(false);
    const payload = useMemo(() => buildProfilePayloadFromForm(formValues), [formValues]);
    const version = useWatch(form, 'version') || '0.0.0';
    const artifactName = renderInstallerArtifactName(payload.installerArtifactName, {
      arch: 'x64',
      ext: 'exe',
      productName: payload.applicationName,
      version,
    });

    const handleCreate = async (
      envelope: ReturnType<typeof buildAdminDangerousActionEnvelope<'desktop.release.create'>>,
    ) => {
      const { valid } = await form.validate();
      if (!valid) return;

      const values = form.getValues();
      setSubmitting(true);
      try {
        await adminCommercialService.createDesktopRelease({
          channel: values.channel,
          command: envelope,
          profileId: profile.id,
          releaseNotes: values.releaseNotes || '',
          version: values.version,
        });
        toast.success(t('admin.desktopBuild.release.queued'));
        onClose();
      } catch {
        toast.error(t('admin.desktopBuild.release.failed'));
      } finally {
        setSubmitting(false);
        onReleaseChanged();
      }
    };

    return (
      <Modal
        destroyOnHidden
        aria-label={t('admin.desktopBuild.release.title')}
        confirmLoading={submitting}
        okText={t('admin.desktopBuild.release.confirm')}
        open={open}
        title={
          <span id="desktop-build-release-title">{t('admin.desktopBuild.release.title')}</span>
        }
        onCancel={submitting ? undefined : onClose}
        onOk={() =>
          void handleCreate(
            // One envelope drives both catalog siblings server-side at
            // admin.desktop.createDesktopRelease: the create audit freezes
            // the draft and the dispatch audit launches the workflow.
            // actionId="desktop.release.dispatch" shares this confirmation.
            buildAdminDangerousActionEnvelope('desktop.release.create', { confirmed: true }),
          )
        }
      >
        <Form form={form} layout="vertical">
          <Form.Field label={t('admin.desktopBuild.release.channel')} name="channel">
            <Segmented
              options={[
                { label: t('admin.desktopControl.status.canary'), value: 'canary' },
                { label: t('admin.desktopControl.status.stable'), value: 'stable' },
              ]}
            />
          </Form.Field>
          <Form.Field required label={t('admin.desktopBuild.release.version')} name="version">
            <Input placeholder="2.4.0" />
          </Form.Field>
          <Form.Field label={t('admin.desktopBuild.release.notes')} name="releaseNotes">
            <TextArea autoSize={{ maxRows: 4, minRows: 2 }} />
          </Form.Field>
        </Form>
        <Descriptions
          bordered
          column={1}
          items={[
            {
              children: profile.currentRevision || '-',
              key: 'revision',
              label: t('admin.desktopBuild.profile.revision'),
            },
            {
              children: payload.applicationName,
              key: 'applicationName',
              label: t('admin.desktopBuild.applicationName'),
            },
            {
              children: payload.executableName,
              key: 'executableName',
              label: t('admin.desktopBuild.executableName'),
            },
            {
              children: artifactName,
              key: 'artifact',
              label: t('admin.desktopBuild.release.artifact'),
            },
          ]}
        />
        {!profile.firstStableReleaseAt ? (
          <p>{t('admin.desktopBuild.release.firstStableWarning')}</p>
        ) : null}
      </Modal>
    );
  },
);

CreateDesktopReleaseModal.displayName = 'CreateDesktopReleaseModal';

export default CreateDesktopReleaseModal;
