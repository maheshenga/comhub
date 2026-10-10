'use client';

import { Avatar, Button, Select, Tag } from '@lobehub/ui/base-ui';
import type { TableColumnsType } from 'antd';
import { Space } from 'antd';

import AdminDangerousActionButton from '@/features/Admin/AdminDangerousActionButton';
import type { AdminDangerousActionEnvelope } from '@/features/Admin/adminDangerousActions';

import { type AssignableRole, EMPTY_TEXT, type UserRow, type UserSubscription } from './shared';

type AnyConfirmCommand = any;

export interface UserColumnsContext {
  actionLoading: null | string;
  canImpersonate: boolean;
  canManageFinance: boolean;
  canManageSupport: boolean;
  canSetRoles: boolean;
  handleAdjustTarget: (row: UserRow) => void;
  handleAssignPlan: (userId: string) => void;
  handleImpersonate: (row: UserRow, command: AnyConfirmCommand) => void | Promise<void>;
  handleSetRole: (
    userId: string,
    value: AssignableRole,
    command: AdminDangerousActionEnvelope<'user.setRole'>,
  ) => void | Promise<void>;
  handleUnban: (userId: string) => void | Promise<void>;
  roleDrafts: Record<string, AssignableRole>;
  roleLabel: (value: string | null) => string;
  roleOptions: Array<{ label: string; value: AssignableRole }>;
  setAdjustAmount: (value: number) => void;
  setAdjustTarget: (value: null | string) => void;
  setBanTarget: (value: null | string) => void;
  setDetailUserId: (value: null | string) => void;
  setRoleDrafts: (
    updater: (current: Record<string, AssignableRole>) => Record<string, AssignableRole>,
  ) => void;
  /** i18next TFunction 的结构化最小面（t(key, defaultValue, values)）。 */
  t: (key: any, defaultValue?: any, values?: any) => string;
}

/** 用户列表列定义（B2 拆分自 routes/(main)/admin/users，渲染逻辑原样迁移）。 */
export const buildUserColumns = (ctx: UserColumnsContext): TableColumnsType<UserRow> => {
  const { t } = ctx;

  return [
    {
      dataIndex: 'fullName',
      key: 'name',
      render: (name: string | null, row) => (
        <Space>
          <Avatar avatar={row.avatar ?? undefined} size={28} title={name ?? row.email ?? ''} />
          <span>{name ?? EMPTY_TEXT}</span>
        </Space>
      ),
      title: t('admin.name', '姓名'),
    },
    {
      dataIndex: 'email',
      key: 'email',
      render: (value: string | null) => value ?? EMPTY_TEXT,
      title: t('admin.email', '邮箱'),
    },
    {
      dataIndex: 'phone',
      key: 'phone',
      render: (value: string | null) => value ?? EMPTY_TEXT,
      title: t('admin.phone', '手机号'),
    },
    {
      dataIndex: 'subscription',
      key: 'subscription',
      render: (subscription: UserSubscription | null) =>
        subscription ? (
          <Space size={6}>
            <Tag color="blue">{subscription.plan}</Tag>
            <span>
              {subscription.startedAt
                ? new Date(subscription.startedAt).toLocaleDateString()
                : EMPTY_TEXT}
            </span>
          </Space>
        ) : (
          <Tag>{EMPTY_TEXT}</Tag>
        ),
      title: t('admin.currentPlanWithStartedAt', '当前套餐 / 开始时间'),
    },
    {
      dataIndex: 'role',
      key: 'role',
      render: (value: string | null) =>
        value ? (
          <Tag color={value === 'admin' ? 'purple' : 'blue'}>{ctx.roleLabel(value)}</Tag>
        ) : (
          <span>{EMPTY_TEXT}</span>
        ),
      title: t('admin.role', '角色'),
    },
    {
      dataIndex: 'banned',
      key: 'status',
      render: (value: boolean | null) =>
        value ? <Tag color="red">已封禁</Tag> : <Tag color="green">正常</Tag>,
      title: t('admin.status', '状态'),
    },
    {
      dataIndex: 'createdAt',
      key: 'joined',
      render: (value: Date | null) => (value ? new Date(value).toLocaleDateString() : EMPTY_TEXT),
      title: t('admin.joined', '注册时间'),
    },
    {
      dataIndex: 'lastActiveAt',
      key: 'lastActive',
      render: (value: Date | null) => (value ? new Date(value).toLocaleDateString() : EMPTY_TEXT),
      title: t('admin.lastActive', '最近活跃'),
    },
    {
      key: 'actions',
      render: (_: unknown, row: UserRow) => (
        <Space>
          {ctx.canManageSupport ? (
            row.banned ? (
              <Button
                loading={ctx.actionLoading === row.id}
                size="small"
                onClick={() => ctx.handleUnban(row.id)}
              >
                {t('admin.unban', '解封')}
              </Button>
            ) : (
              <Button
                danger
                loading={ctx.actionLoading === row.id}
                size="small"
                onClick={() => ctx.setBanTarget(row.id)}
              >
                {t('admin.ban', '封禁')}
              </Button>
            )
          ) : null}
          {ctx.canSetRoles ? (
            <Space.Compact>
              <Select
                loading={ctx.actionLoading === `${row.id}-role`}
                options={ctx.roleOptions}
                placeholder={t('admin.setRole', '设置角色')}
                size="small"
                style={{ width: 132 }}
                value={ctx.roleDrafts[row.id] ?? ((row.role ?? '__none__') as AssignableRole)}
                onChange={(value) => {
                  if (!value) return;
                  ctx.setRoleDrafts((current) => ({
                    ...current,
                    [row.id]: value as AssignableRole,
                  }));
                }}
              />
              <AdminDangerousActionButton
                actionId="user.setRole"
                loading={ctx.actionLoading === `${row.id}-role`}
                size="small"
                disabled={
                  (ctx.roleDrafts[row.id] ?? ((row.role ?? '__none__') as AssignableRole)) ===
                  ((row.role ?? '__none__') as AssignableRole)
                }
                onConfirm={(command) =>
                  ctx.handleSetRole(
                    row.id,
                    ctx.roleDrafts[row.id] ?? ((row.role ?? '__none__') as AssignableRole),
                    command,
                  )
                }
              >
                {t('admin.setRole', '设置角色')}
              </AdminDangerousActionButton>
            </Space.Compact>
          ) : null}
          {ctx.canManageFinance ? (
            <>
              <Button
                size="small"
                onClick={() => {
                  ctx.handleAdjustTarget(row);
                }}
              >
                {t('admin.adjustCredits', '调整积分')}
              </Button>
              <Button
                loading={ctx.actionLoading === `${row.id}-plan`}
                size="small"
                onClick={() => ctx.handleAssignPlan(row.id)}
              >
                {t('admin.assignPlan', '设置套餐')}
              </Button>
            </>
          ) : null}
          {ctx.canImpersonate ? (
            <AdminDangerousActionButton
              actionId="user.impersonate.attempt"
              confirmTitle={t('admin.impersonate.confirmTitle', '以该用户身份登录？')}
              loading={ctx.actionLoading === `${row.id}-impersonate`}
              size="small"
              confirmDescription={t(
                'admin.impersonate.confirmContent',
                '系统会把当前管理员会话切换为该用户，用于排查套餐、模型和前台体验问题。完成排查后请退出登录并重新登录管理员账号。',
              )}
              onConfirm={(command) => ctx.handleImpersonate(row, command)}
            >
              {t('admin.impersonate', '以用户身份登录')}
            </AdminDangerousActionButton>
          ) : null}
          <Button size="small" onClick={() => ctx.setDetailUserId(row.id)}>
            {t('admin.viewDetail', '详情')}
          </Button>
        </Space>
      ),
      title: t('admin.actions', '操作'),
    },
  ];
};
