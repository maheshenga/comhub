'use client';

import { Button, Input, Select } from '@lobehub/ui/base-ui';
import { Plus } from 'lucide-react';

import { moduleAppsDirectoryStyles as styles } from './moduleAppsDirectoryStyles';
import type { AdminModuleAppItem } from '../types';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

interface ModuleAppsFilterBarProps {
  canReadPublishers: boolean;
  category?: string;
  publisherId?: string;
  queryInput: string;
  sort?: string;
  status?: string;
  onQueryInput: (value: string) => void;
  onUpdateFilter: (name: string, value: string) => void;
  t: TFn;
}

/** 应用目录筛选区（M5 拆页：从 ModuleAppsPage 抽出）。 */
export const ModuleAppsFilterBar = ({
  canReadPublishers,
  category,
  publisherId,
  queryInput,
  sort,
  status,
  onQueryInput,
  onUpdateFilter,
  t,
}: ModuleAppsFilterBarProps) => (
  <div className={styles.filterBar} data-testid="module-app-filters">
    <label className={styles.control} htmlFor="module-app-search">
      <span>{t('moduleApps.admin.apps.search')}</span>
      <Input
        id="module-app-search"
        value={queryInput}
        onChange={(event) => onQueryInput(event.target.value)}
      />
    </label>
    <label className={styles.control} htmlFor="module-app-status">
      <span>{t('moduleApps.admin.apps.status.label')}</span>
      <Select
        id="module-app-status"
        value={status ?? ''}
        options={[
          { label: t('moduleApps.admin.apps.filters.all'), value: '' },
          { label: t('moduleApps.admin.apps.status.draft'), value: 'draft' },
          { label: t('moduleApps.admin.apps.status.published'), value: 'published' },
          { label: t('moduleApps.admin.apps.status.unpublished'), value: 'unpublished' },
        ]}
        onChange={(value) => onUpdateFilter('status', String(value ?? ''))}
      />
    </label>
    <label className={styles.control} htmlFor="module-app-category">
      <span>{t('moduleApps.admin.apps.category')}</span>
      <Input
        id="module-app-category"
        value={category ?? ''}
        onChange={(event) => onUpdateFilter('category', event.target.value)}
      />
    </label>
    <label className={styles.control} htmlFor="module-app-sort">
      <span>{t('moduleApps.admin.apps.sort')}</span>
      <Select
        id="module-app-sort"
        value={sort ?? ''}
        options={[
          { label: t('moduleApps.admin.apps.sort.catalog'), value: '' },
          { label: t('moduleApps.admin.apps.sort.nameAsc'), value: 'name_asc' },
          { label: t('moduleApps.admin.apps.sort.updatedDesc'), value: 'updated_desc' },
        ]}
        onChange={(value) => onUpdateFilter('sort', String(value ?? ''))}
      />
    </label>
    {canReadPublishers ? (
      <label className={`${styles.control} ${styles.controlWide}`} htmlFor="module-app-publisher">
        <span>{t('moduleApps.admin.apps.publisher')}</span>
        <Input
          id="module-app-publisher"
          value={publisherId ?? ''}
          onChange={(event) => onUpdateFilter('publisherId', event.target.value)}
        />
      </label>
    ) : null}
  </div>
);

interface ModuleAppsTableProps {
  items: AdminModuleAppItem[];
  onOpen: (appId: string) => void;
  t: TFn;
}

/** 应用目录表（M5 拆页：从 ModuleAppsPage 抽出）。 */
export const ModuleAppsTable = ({ items, onOpen, t }: ModuleAppsTableProps) => (
  <div className={styles.tableFrame} data-testid="module-app-table">
    <div className={styles.tableShell}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('moduleApps.admin.apps.identity.displayName')}</th>
            <th>{t('moduleApps.admin.apps.category')}</th>
            <th>{t('moduleApps.admin.apps.identity.status')}</th>
            <th>{t('moduleApps.admin.apps.identity.source')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((app) => (
            <tr key={app.id}>
              <td>
                <button className={styles.tableLink} type="button" onClick={() => onOpen(app.id)}>
                  {app.displayName}
                </button>
              </td>
              <td>{app.category}</td>
              <td>{t(`moduleApps.admin.apps.status.${app.status}`)}</td>
              <td>{t(`moduleApps.admin.apps.source.${app.source ?? 'admin'}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const ModuleAppsCreateButton = ({ onClick, t }: { onClick: () => void; t: TFn }) => (
  <Button type="primary" onClick={onClick}>
    <Plus aria-hidden size={16} />
    {t('moduleApps.admin.apps.create')}
  </Button>
);
