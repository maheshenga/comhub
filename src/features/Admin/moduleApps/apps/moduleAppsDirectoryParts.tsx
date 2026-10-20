'use client';

import { Button, Input, Select } from '@lobehub/ui';
import type { TableProps } from 'antd';
import { Plus } from 'lucide-react';

import { AdminDataTable } from '../../shared';
import type { AdminModuleAppItem } from '../types';
import { moduleAppsDirectoryStyles as styles } from './moduleAppsDirectoryStyles';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

interface ModuleAppsFilterBarProps {
  canReadPublishers: boolean;
  categoryInput: string;
  onCategoryInput: (value: string) => void;
  onPublisherInput: (value: string) => void;
  onQueryInput: (value: string) => void;
  onUpdateFilter: (name: string, value: string) => void;
  publisherIdInput: string;
  queryInput: string;
  sort?: string;
  status?: string;
  t: TFn;
}

/** 应用目录筛选区（M5 拆页：从 ModuleAppsPage 抽出；类目/发布商走防抖输入）。 */
export const ModuleAppsFilterBar = ({
  canReadPublishers,
  categoryInput,
  onCategoryInput,
  onPublisherInput,
  onQueryInput,
  onUpdateFilter,
  publisherIdInput,
  queryInput,
  sort,
  status,
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
        value={categoryInput}
        onChange={(event) => onCategoryInput(event.target.value)}
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
          value={publisherIdInput}
          onChange={(event) => onPublisherInput(event.target.value)}
        />
      </label>
    ) : null}
  </div>
);

/** 应用目录表（M5 拆页：从 ModuleAppsPage 抽出；§4.2-1 走 AdminDataTable 统一原语）。 */
export const buildModuleAppsColumns = (
  onOpen: (appId: string) => void,
  t: TFn,
): TableProps<AdminModuleAppItem>['columns'] => [
  {
    dataIndex: 'displayName',
    key: 'displayName',
    render: (_, app) => (
      <button className={styles.tableLink} type="button" onClick={() => onOpen(app.id)}>
        {app.displayName}
      </button>
    ),
    title: t('moduleApps.admin.apps.identity.displayName'),
  },
  { dataIndex: 'category', key: 'category', title: t('moduleApps.admin.apps.category') },
  {
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => t(`moduleApps.admin.apps.status.${status}`),
    title: t('moduleApps.admin.apps.identity.status'),
  },
  {
    dataIndex: 'source',
    key: 'source',
    render: (source: null | string) => t(`moduleApps.admin.apps.source.${source ?? 'admin'}`),
    title: t('moduleApps.admin.apps.identity.source'),
  },
];

export const ModuleAppsTable = ({
  columns,
  items,
  regionLabel,
}: {
  columns: TableProps<AdminModuleAppItem>['columns'];
  items: AdminModuleAppItem[];
  regionLabel: string;
}) => (
  <AdminDataTable columns={columns} dataSource={items} regionLabel={regionLabel} rowKey="id" />
);

export const ModuleAppsCreateButton = ({ onClick, t }: { onClick: () => void; t: TFn }) => (
  <Button type="primary" onClick={onClick}>
    <Plus aria-hidden size={16} />
    {t('moduleApps.admin.apps.create')}
  </Button>
);
