'use client';

import { memo } from 'react';

import MobileConfigPreview from '../MobileConfigPreview';
import { mobileSettingsStyles } from './index';

interface PreviewSectionProps {
  config: Record<string, unknown>;
  t: (key: any, defaultValue?: any, values?: any) => string;
}

const PreviewSection = memo<PreviewSectionProps>(({ config, t }) => (
  <section
    aria-label={t('admin.mobile.preview', 'Preview')}
    className={mobileSettingsStyles.section}
  >
    <h2 className={mobileSettingsStyles.sectionTitle}>{t('admin.mobile.preview', 'Preview')}</h2>
    <MobileConfigPreview config={config as any} />
  </section>
));

PreviewSection.displayName = 'PreviewSection';

export default PreviewSection;
