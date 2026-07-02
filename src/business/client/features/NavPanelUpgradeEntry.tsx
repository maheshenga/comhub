'use client';

import { Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ArrowRightIcon, SparklesIcon } from 'lucide-react';
import { memo } from 'react';

import { useBrand } from '@/features/Brand';
import WorkspaceLink from '@/features/Workspace/WorkspaceLink';
import { isExternalUrl } from '@/utils/navigation';

const styles = createStaticStyles(({ css }) => ({
  arrow: css`
    flex: none;
    color: ${cssVar.colorTextDescription};
  `,
  card: css`
    display: block;
    margin-block-start: 8px;
    margin-inline: 8px;
    padding: 10px 12px;
    color: inherit;
    text-decoration: none;

    background: ${cssVar.colorBgContainer};
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    transition:
      background 0.2s ${cssVar.motionEaseOut},
      border-color 0.2s ${cssVar.motionEaseOut};

    &:hover {
      background: ${cssVar.colorFillTertiary};
      border-color: ${cssVar.colorBorder};
    }
  `,
  description: css`
    font-size: 12px;
    line-height: 1.35;
    color: ${cssVar.colorTextDescription};
  `,
  icon: css`
    flex: none;
    color: ${cssVar.colorText};
  `,
  title: css`
    font-size: 13px;
    line-height: 1.35;
  `,
}));

const UpgradeCard = ({
  description,
  title,
}: {
  description: string;
  title: string;
}) => (
  <Flexbox horizontal align="center" gap={8}>
    <Icon className={styles.icon} icon={SparklesIcon} size={18} />
    <Flexbox flex={1} gap={2} style={{ minWidth: 0 }}>
      <Text className={styles.title} ellipsis weight={600}>
        {title}
      </Text>
      <Text className={styles.description} ellipsis={{ rows: 1 }}>
        {description}
      </Text>
    </Flexbox>
    <Icon className={styles.arrow} icon={ArrowRightIcon} size={14} />
  </Flexbox>
);

const NavPanelUpgradeEntry = memo(() => {
  const brand = useBrand();
  const title = brand.sidebarMemberLabel || '升级方案';
  const description = brand.sidebarMemberDescription || '解锁更多容量与高级功能。';
  const url = brand.sidebarMemberUrl || '/settings/plans';
  const card = <UpgradeCard description={description} title={title} />;

  if (isExternalUrl(url)) {
    return (
      <a className={styles.card} href={url} rel="noreferrer" target="_blank">
        {card}
      </a>
    );
  }

  return (
    <WorkspaceLink className={styles.card} to={url}>
      {card}
    </WorkspaceLink>
  );
});

NavPanelUpgradeEntry.displayName = 'NavPanelUpgradeEntry';

export default NavPanelUpgradeEntry;
