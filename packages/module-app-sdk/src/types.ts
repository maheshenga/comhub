export type ModuleAppDataFilter = {
  field: string;
  operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'prefix';
  value: unknown;
};

export type ModuleAppDataSort = {
  direction?: 'asc' | 'desc';
  field: string;
};

export type ModuleAppDataQueryInput = {
  cursor?: string;
  filters?: ModuleAppDataFilter[];
  limit?: number;
  sort?: ModuleAppDataSort[];
  tableKey: string;
};

export type ModuleAppDataGetInput = { rowKey: string; tableKey: string };
export type ModuleAppDataArchiveInput = ModuleAppDataGetInput;

export type ModuleAppDataInsertInput = {
  rowKey?: string;
  tableKey: string;
  values: Record<string, unknown>;
};

export type ModuleAppDataUpdateInput = {
  rowKey: string;
  tableKey: string;
  values: Record<string, unknown>;
};

export type ModuleAppDataTransactionOperation =
  | ({ operation: 'archive' } & ModuleAppDataArchiveInput)
  | ({ operation: 'insert' } & ModuleAppDataInsertInput)
  | ({ operation: 'update' } & ModuleAppDataUpdateInput);

export type ModuleAppDataTransaction = { operations: ModuleAppDataTransactionOperation[] };

export type ModuleAppDataRow = {
  createdAt: Date;
  installationId: string;
  rowKey: string;
  status: 'active' | 'archived';
  tableKey: string;
  updatedAt: Date;
  values: Record<string, unknown>;
};

export type ModuleAppTaskRunInput = { runId: string };
export type ModuleAppTaskRun = {
  id: string;
  status: 'cancelled' | 'failed' | 'queued' | 'running' | 'succeeded' | 'waiting';
  [key: string]: unknown;
};
