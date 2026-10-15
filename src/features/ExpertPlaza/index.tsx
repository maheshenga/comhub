'use client';

import { Empty, Flexbox, Icon } from '@lobehub/ui';
import { Avatar, Segmented, Tag, Text } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ArrowUpRight, Star } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import Loading from '@/components/Loading/BrandTextLoading';
import { PUBLIC_EXPERT_PLAZA_SWR_KEY } from '@/const/adminCacheKeys';
import { DEFAULT_EXPERT_PLAZA_CONFIG, type ExpertPlazaCard } from '@/const/expertPlaza';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const styles = createStaticStyles(({ css }) => ({
  card: css`
    cursor: pointer;

    min-height: 190px;
    padding: 18px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorBgContainer};

    transition:
      border-color ${cssVar.motionDurationMid} ease,
      transform ${cssVar.motionDurationMid} ease,
      box-shadow ${cssVar.motionDurationMid} ease;

    &:hover {
      transform: translateY(-2px);
      border-color: ${cssVar.colorPrimary};
      box-shadow: ${cssVar.boxShadowTertiary};
    }
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  `,
  page: css`
    overflow: auto;
    height: 100%;
    padding: 28px;
  `,
  pageTitle: css`
    margin: 0 !important;

    /* 基线是 antd Typography.Title level=2（fontSizeHeading2=30px、
       fontWeightStrong=600、标题行高 token）；base-ui Text 的 h2 variant 是
       fontSize*2≈28px + font-weight:bold(700) + line-height:1.25，逐项补齐
       token 保持视觉不变（与 DesktopControlCenter sectionTitle 同一口径）。 */
    font-size: ${cssVar.fontSizeHeading2};
    font-weight: ${cssVar.fontWeightStrong};
    line-height: ${cssVar.lineHeightHeading2};
  `,
}));

const isExternalUrl = (url: string) => /^https?:\/\//.test(url);

const ExpertCard = memo<{ card: ExpertPlazaCard; onOpen: (card: ExpertPlazaCard) => void }>(
  ({ card, onOpen }) => (
    <Flexbox className={styles.card} gap={14} onClick={() => onOpen(card)}>
      <Flexbox horizontal align="center" justify="space-between">
        <Flexbox horizontal align="center" gap={10}>
          <Avatar avatar={card.avatar} size={42} title={card.title} />
          <Flexbox gap={2}>
            <Flexbox horizontal align="center" gap={6}>
              <Text strong>{card.title}</Text>
              {card.featured ? <Icon color={cssVar.colorWarning} icon={Star} size={14} /> : null}
            </Flexbox>
            <Text type="secondary">{card.author || card.category || '精选入口'}</Text>
          </Flexbox>
        </Flexbox>
        {card.url ? <Icon icon={ArrowUpRight} size={16} /> : null}
      </Flexbox>

      <Text type="secondary">{card.description}</Text>

      <Flexbox horizontal align="center" gap={8} wrap="wrap">
        {card.tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </Flexbox>

      {card.metricLabel || card.metricValue ? (
        <Flexbox horizontal align="center" gap={6}>
          <Text strong>{card.metricValue}</Text>
          <Text type="secondary">{card.metricLabel}</Text>
        </Flexbox>
      ) : null}
    </Flexbox>
  ),
);

ExpertCard.displayName = 'ExpertCard';

const ExpertPlaza = memo(() => {
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>('全部');
  const { data, isLoading } = useClientDataSWR(PUBLIC_EXPERT_PLAZA_SWR_KEY, () =>
    adminCommercialService.getPublicExpertPlaza(),
  );

  const config = data ?? DEFAULT_EXPERT_PLAZA_CONFIG;
  const cards = useMemo(() => {
    const enabledCards = (config.cards ?? []).filter((item) => item.enabled !== false);
    if (category === '全部') return enabledCards;
    return enabledCards.filter((item) => item.category === category);
  }, [category, config.cards]);
  const categories = useMemo(
    () => ['全部', ...(config.categories ?? []).filter(Boolean)],
    [config.categories],
  );

  const handleOpen = (card: ExpertPlazaCard) => {
    if (!card.url) return;
    if (isExternalUrl(card.url)) {
      window.open(card.url, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(card.url.startsWith('/') ? card.url : `/${card.url}`);
  };

  if (isLoading) return <Loading debugId="ExpertPlaza" />;

  if (!config.enabled) {
    return (
      <Flexbox align="center" className={styles.page} justify="center">
        <Empty description="专家广场暂未启用" />
      </Flexbox>
    );
  }

  return (
    <Flexbox className={styles.page} gap={20}>
      <Flexbox gap={4}>
        <Text as={'h2'} className={styles.pageTitle}>
          {config.name}
        </Text>
        <Text type="secondary">{config.description}</Text>
      </Flexbox>

      <Segmented
        options={categories}
        value={category}
        onChange={(value) => setCategory(String(value))}
      />

      {cards.length > 0 ? (
        <div className={styles.grid}>
          {cards.map((card) => (
            <ExpertCard card={card} key={card.id} onOpen={handleOpen} />
          ))}
        </div>
      ) : (
        <Empty description="暂无可展示卡片" />
      )}
    </Flexbox>
  );
});

ExpertPlaza.displayName = 'ExpertPlaza';

export default ExpertPlaza;
