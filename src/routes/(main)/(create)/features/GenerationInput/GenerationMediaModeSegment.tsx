'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Select, type SelectProps } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { ImageIcon, Presentation, Video } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';

export interface GenerationMediaModeSegmentProps {
  /** `hero`: large inline headline select (cyan, borderless). `toolbar`: compact control in the input bar. */
  layout?: 'hero' | 'toolbar';
  mode: 'image' | 'ppt' | 'video';
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  lite: css`
    height: 36px;
  `,
  heroSelect: css`
    width: auto;
    font-size: inherit;
    line-height: 1.2;
  `,
  heroText: css`
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
  `,
}));

const GenerationMediaModeSegment = memo<GenerationMediaModeSegmentProps>(
  ({ mode, layout = 'toolbar' }) => {
    const { t } = useTranslation('common');
    const navigate = useWorkspaceAwareNavigate();
    const isHero = layout === 'hero';

    const options = useMemo<SelectProps['options']>(
      () => [
        {
          label: (
            <Flexbox horizontal align="center" gap={8}>
              {!isHero && <Icon icon={ImageIcon} />}
              <span className={isHero ? styles.heroText : undefined}>{t('tab.image')}</span>
            </Flexbox>
          ),
          value: 'image',
        },
        {
          label: (
            <Flexbox horizontal align="center" gap={8}>
              {!isHero && <Icon icon={Video} />}
              <span className={isHero ? styles.heroText : undefined}>{t('tab.video')}</span>
            </Flexbox>
          ),
          value: 'video',
        },
        {
          label: (
            <Flexbox horizontal align="center" gap={8}>
              {!isHero && <Icon icon={Presentation} />}
              <span className={isHero ? styles.heroText : undefined}>{t('tab.ppt')}</span>
            </Flexbox>
          ),
          value: 'ppt',
        },
      ],
      [t, isHero],
    );

    const labelRender: SelectProps['labelRender'] = useCallback(
      (props: any) => {
        const v = String((props as { value?: string }).value ?? '');
        const text = v === 'video' ? t('tab.video') : v === 'ppt' ? t('tab.ppt') : t('tab.image');
        const icon = v === 'video' ? Video : v === 'ppt' ? Presentation : ImageIcon;
        if (isHero) {
          return (
            <span
              style={{
                fontSize: 'inherit',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {text}
            </span>
          );
        }
        return (
          <Flexbox horizontal align="center" gap={6}>
            <Icon icon={icon} size={16} />
            <span style={{ whiteSpace: 'nowrap' }}>{text}</span>
          </Flexbox>
        );
      },
      [isHero, t],
    );

    const handleChange = useCallback(
      (value: string) => {
        if (value === mode) return;
        const pathMap = { image: '/image', ppt: '/ppt', video: '/video' } as const;
        navigate(pathMap[value as keyof typeof pathMap] ?? '/image');
      },
      [mode, navigate],
    );

    return (
      <Select
        className={isHero ? styles.heroSelect : styles.lite}
        labelRender={labelRender}
        options={options}
        popupMatchSelectWidth={false}
        size={isHero ? 'large' : 'middle'}
        value={mode}
        variant={isHero ? 'borderless' : 'filled'}
        onChange={handleChange}
      />
    );
  },
);

GenerationMediaModeSegment.displayName = 'GenerationMediaModeSegment';

export default GenerationMediaModeSegment;
