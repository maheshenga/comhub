'use client';

import { createStaticStyles, cssVar } from 'antd-style';

export const moduleOverviewStyles = createStaticStyles(({ css, cssVar }) => ({
  band: css`
    display: grid;
    gap: 12px;

    padding-block: 20px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  bandHeader: css`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: baseline;
    justify-content: space-between;
  `,
  bandTitle: css`
    display: flex;
    gap: 8px;
    align-items: center;

    margin: 0;

    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: ${cssVar.colorText};
  `,
  control: css`
    display: grid;
    gap: 6px;
    max-width: 360px;

    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  link: css`
    display: inline-flex;
    gap: 6px;
    align-items: center;

    color: ${cssVar.colorTextSecondary};
    text-decoration: none;

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
  list: css`
    display: grid;
    gap: 0;
  `,
  page: css`
    display: grid;
    gap: 4px;
    max-width: 1180px;
  `,
  row: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: baseline;

    min-height: 44px;
    padding-block: 10px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    &:last-child {
      border-block-end: 0;
    }
  `,
  rowLink: css`
    flex: 1 1 220px;

    min-width: 0;

    overflow: hidden;

    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  `,
  secondary: css`
    color: ${cssVar.colorTextSecondary};
  `,
}));

export const statusTranslationKeys: Record<string, string> = {
  denied: 'moduleApps.admin.center.overview.status.denied',
  draft: 'moduleApps.admin.center.overview.status.draft',
  failed: 'moduleApps.admin.center.overview.status.failed',
  pending_review: 'moduleApps.admin.center.overview.status.pendingReview',
  published: 'moduleApps.admin.center.overview.status.published',
  queued: 'moduleApps.admin.center.overview.status.queued',
  running: 'moduleApps.admin.center.overview.status.running',
  succeeded: 'moduleApps.admin.center.overview.status.succeeded',
  unpublished: 'moduleApps.admin.center.overview.status.unpublished',
};
