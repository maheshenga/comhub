'use client';

import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar  } from 'antd-style';

import type { MobileConfigPublicationState } from '@/const/mobileConfigPublication';

import { mobileSettingsStyles } from './index';

const styles = createStaticStyles(({ css }) => ({
  publicationMeta: css`
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  revisionRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;

    min-height: 44px;
    padding-block: 6px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
}));

interface PublicationHistorySectionProps {
  onRollback: (revision: number) => void;
  publicationState: MobileConfigPublicationState;
  rollingBackRevision: number | undefined;
  t: (key: any, defaultValue?: any, values?: any) => string;
}

const PublicationHistorySection = ({
  onRollback,
  publicationState,
  rollingBackRevision,
  t,
}: PublicationHistorySectionProps) => (
  <section
    aria-label={t('admin.mobile.history', 'Publication history')}
    className={mobileSettingsStyles.section}
  >
    <h2 className={mobileSettingsStyles.sectionTitle}>
      {t('admin.mobile.history', 'Publication history')}
    </h2>
    <div className={styles.publicationMeta}>
      {t('admin.mobile.draftRevision', 'Draft revision {{draft}}', {
        draft: publicationState.draft.revision,
      })}
      {' | '}
      {t('admin.mobile.publishedRevision', 'Published revision {{published}}', {
        published: publicationState.published.revision,
      })}
    </div>
    {publicationState.history.map((snapshot) => (
      <div className={styles.revisionRow} key={snapshot.revision}>
        <span>
          {t('admin.mobile.revision', 'Revision {{revision}}', {
            revision: snapshot.revision,
          })}{' '}
          <time dateTime={snapshot.updatedAt}>
            {new Date(snapshot.updatedAt).toLocaleString()}
          </time>
        </span>
        {snapshot.revision !== publicationState.published.revision ? (
          <Button
            loading={rollingBackRevision === snapshot.revision}
            onClick={() => onRollback(snapshot.revision)}
          >
            {t('admin.mobile.rollback', 'Roll back')}
          </Button>
        ) : null}
      </div>
    ))}
  </section>
);

PublicationHistorySection.displayName = 'PublicationHistorySection';

export default PublicationHistorySection;
