'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Select } from '@lobehub/ui/base-ui';

import { AdminBulkActionFlow } from '@/features/Admin';
import { adminCommercialService } from '@/services/adminCommercial';

import type { AssignableRole } from './shared';

export interface UserBulkToolbarContext {
  bulkRole: AssignableRole | null;
  canSetRoles: boolean;
  invalidate: () => void | Promise<void>;
  onClearSelection: () => void;
  roleOptions: Array<{ label: string; value: AssignableRole }>;
  selectedUserIds: string[];
  setBulkRole: (value: AssignableRole | null) => void;
  /** i18next TFunction 的结构化最小面（t(key, defaultValue, values)）。 */
  t: (key: any, defaultValue?: any, values?: any) => string;
}

const bulkSummary = (result: any) => ({
  failed: result?.results?.filter((r: any) => !r.ok).length ?? 0,
  requested: result?.total,
  succeeded: result?.results?.filter((r: any) => r.ok).length ?? 0,
});

/** 用户批量操作工具条（B2 拆分；确认语义由 AdminBulkActionFlow 内部承担）。 */
export const UserBulkToolbar = (ctx: UserBulkToolbarContext) => {
  const { t } = ctx;

  return (
    <Flexbox horizontal gap={8}>
      <AdminBulkActionFlow
        danger
        actionId="user.bulkBan"
        count={ctx.selectedUserIds.length}
        size="small"
        summary={bulkSummary}
        confirmDescription={t(
          'admin.users.bulkBanDescription',
          '将选中的用户标记为封禁状态，同批次同事务逐条审计（batchCorrelationId 可在审计页聚合检索）。',
        )}
        confirmTitle={t('admin.users.bulkBanTitle', '批量封禁 {{count}} 个用户？', {
          count: ctx.selectedUserIds.length,
        })}
        onRun={async (command) =>
          adminCommercialService.bulkBanUsers(
            ctx.selectedUserIds,
            command,
          )
        }
        onSuccess={async () => {
          ctx.onClearSelection();
          await ctx.invalidate();
        }}
      >
        {t('admin.users.bulkBan', '批量封禁')}
      </AdminBulkActionFlow>
      {ctx.canSetRoles ? (
        <>
          <Select
            allowClear
            options={ctx.roleOptions.filter((option) => option.value !== '__none__')}
            placeholder={t('admin.users.bulkRolePlaceholder', '选择目标角色')}
            value={ctx.bulkRole ?? undefined}
            onChange={(value: AssignableRole) => ctx.setBulkRole(value ?? null)}
          />
          <AdminBulkActionFlow
            actionId="user.bulkSetRole"
            count={ctx.bulkRole && ctx.selectedUserIds.length ? ctx.selectedUserIds.length : 0}
            size="small"
            summary={bulkSummary}
            confirmDescription={t(
              'admin.users.bulkSetRoleDescription',
              '将选中的用户角色统一变更为所选目标角色。此为 typed 确认命令，需要输入命令 ID。',
            )}
            confirmTitle={t(
              'admin.users.bulkSetRoleTitle',
              '批量调整 {{count}} 个用户角色为 {{role}}？',
              { count: ctx.selectedUserIds.length, role: ctx.bulkRole ?? '' },
            )}
            onRun={async (command) =>
              adminCommercialService.bulkSetUserRole(
                {
                  role: (ctx.bulkRole === '__none__' ? null : (ctx.bulkRole ?? 'user')) as any,
                  userIds: ctx.selectedUserIds,
                },
                command,
              )
            }
            onSuccess={async () => {
              ctx.onClearSelection();
              await ctx.invalidate();
            }}
          >
            {t('admin.users.bulkSetRole', '批量改角色')}
          </AdminBulkActionFlow>
        </>
      ) : null}
      <Button size="small" onClick={ctx.onClearSelection}>
        {t('admin.users.clearSelection', '清空选择')}
      </Button>
    </Flexbox>
  );
};
