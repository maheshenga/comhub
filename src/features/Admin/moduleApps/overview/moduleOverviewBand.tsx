'use client';

import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { moduleOverviewStyles as styles } from './moduleOverviewShared';

/** 概览分区带（标题 + 全部链接 + 内容，M5 拆页：从 ModuleOverviewPage 抽出）。 */
export const ModuleOverviewBand = ({
  children,
  icon,
  link,
  linkLabel,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  link: string;
  linkLabel: string;
  title: string;
}) => (
  <section className={styles.band}>
    <div className={styles.bandHeader}>
      <h2 className={styles.bandTitle}>
        {icon}
        {title}
      </h2>
      <Link className={styles.link} to={link}>
        <span>{linkLabel}</span>
        <ArrowRight aria-hidden size={14} />
      </Link>
    </div>
    {children}
  </section>
);

/** 概览列表行（链接 + 次要信息，M5 拆页：从 ModuleOverviewPage 抽出）。 */
export const ModuleOverviewRow = ({
  label,
  secondary,
  to,
}: {
  label: ReactNode;
  secondary: ReactNode;
  to: string;
}) => (
  <div className={styles.row}>
    <Link className={styles.rowLink} to={to}>
      {label}
    </Link>
    <span className={styles.secondary}>{secondary}</span>
  </div>
);
