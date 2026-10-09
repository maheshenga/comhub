'use client';

import { memo } from 'react';

import type { MobilePublicConfigV1 } from '@/const/mobileConfig';

import MobileConfigPreview from '../MobileConfigPreview';
import { mobileSettingsStyles } from './index';

interface PreviewSectionProps {
  config: MobilePublicConfigV1;
  t: (key: any, defaultValue?: any, values?: any) => string;
}

const PreviewSection = memo<PreviewSectionProps>(({ config, t }) => (
  <section
    aria-label={t('admin.mobile.preview', 'Preview')}
    className={mobileSettingsStyles.section}
  >
    <h2 className={mobileSettingsStyles.sectionTitle}>{t('admin.mobile.preview', 'Preview')}</h2>
    <MobileConfigPreview config={config} />
  </section>
));

PreviewSection.displayName = 'PreviewSection';

export default PreviewSection;
