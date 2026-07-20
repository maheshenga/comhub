import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo, useId } from 'react';
import { useTranslation } from 'react-i18next';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    display: flex;
    flex-direction: column;
    gap: 10px;

    box-sizing: border-box;
    min-width: 0;
    min-height: 180px;
    padding: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorBgContainer};
  `,
  description: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;

    margin: 0;

    font-size: 13px;
    line-height: 20px;
    color: ${cssVar.colorTextSecondary};
    overflow-wrap: anywhere;
  `,
  footer: css`
    margin-block-start: auto;
    padding-block-start: 2px;
  `,
  header: css`
    display: flex;
    gap: 8px;
    align-items: flex-start;
    justify-content: space-between;
  `,
  installed: css`
    flex: none;

    padding-block: 2px;
    padding-inline: 6px;
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 12px;
    line-height: 18px;
    color: ${cssVar.colorSuccess};

    background: ${cssVar.colorSuccessBg};
  `,
  metadata: css`
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;

    min-width: 0;

    font-size: 12px;
    line-height: 18px;
    color: ${cssVar.colorTextTertiary};
    overflow-wrap: anywhere;
  `,
  title: css`
    min-width: 0;
    margin: 0;

    font-size: 16px;
    font-weight: 600;
    line-height: 22px;
    color: ${cssVar.colorText};
    overflow-wrap: anywhere;
  `,
}));

type ModuleAppCardProps = {
  category?: string;
  description?: string;
  id: string;
  installed?: boolean;
  name: string;
  version?: string;
  workspaceId?: string;
};

const ModuleAppCard = memo<ModuleAppCardProps>(
  ({ category, description, id, installed, name, version, workspaceId }) => {
    const { t } = useTranslation('common');
    const titleId = useId();
    const detailUrl = `/apps/${id}${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''}`;

    return (
      <article aria-labelledby={titleId} className={styles.card}>
        <header className={styles.header}>
          <h3 className={styles.title} id={titleId}>
            {name}
          </h3>
          {installed ? <span className={styles.installed}>{t('moduleApps.market.installed')}</span> : null}
        </header>
        {category || version ? (
          <div className={styles.metadata}>
            {category ? <span>{category}</span> : null}
            {version ? (
              <span>
                {t('moduleApps.market.version')} {version}
              </span>
            ) : null}
          </div>
        ) : null}
        {description ? <p className={styles.description}>{description}</p> : null}
        <div className={styles.footer}>
          <Button
            block
            aria-label={t('moduleApps.market.viewDetailsFor', { name })}
            href={detailUrl}
            type="default"
          >
            {t('moduleApps.market.viewDetails')}
          </Button>
        </div>
      </article>
    );
  },
);

ModuleAppCard.displayName = 'ModuleAppCard';

export default ModuleAppCard;
