'use client';

import { Descriptions, Flexbox, Tag } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';

import { formatAdminCredits } from '../adminCreditUnits';
import { AdminDataTable, AdminPageState } from '../shared';

const EMPTY_TEXT = '-';

const UserDetailSections = ({ data }: { data: any }) => {
  const { t } = useTranslation('subscription');

  return (
    <Flexbox gap={24}>
      <Descriptions
        bordered
        column={1}
        title={t('admin.userDetail.profile', '用户资料')}
        items={[
          {
            children: <code>{data.user.id}</code>,
            key: 'userId',
            label: t('admin.userDetail.userId', 'ID'),
          },
          {
            children: data.user.email ?? EMPTY_TEXT,
            key: 'email',
            label: t('admin.email', '邮箱'),
          },
          {
            children: data.user.phone ?? EMPTY_TEXT,
            key: 'phone',
            label: t('admin.phone', '手机号'),
          },
          {
            children: data.user.fullName ?? EMPTY_TEXT,
            key: 'name',
            label: t('admin.name', '名称'),
          },
          {
            children: data.user.role ? (
              <Tag color={data.user.role === 'admin' ? 'purple' : 'blue'}>{data.user.role}</Tag>
            ) : (
              EMPTY_TEXT
            ),
            key: 'role',
            label: t('admin.role', '角色'),
          },
          {
            children: data.user.banned ? (
              <Tag color="red">{t('admin.userStatus.banned', 'Banned')}</Tag>
            ) : (
              <Tag color="green">{t('admin.userStatus.active', 'Active')}</Tag>
            ),
            key: 'status',
            label: t('admin.status', '状态'),
          },
          {
            children: data.user.createdAt
              ? new Date(data.user.createdAt).toLocaleString()
              : EMPTY_TEXT,
            key: 'joined',
            label: t('admin.joined', '注册时间'),
          },
        ]}
      />

      <Descriptions
        bordered
        column={2}
        title={t('admin.userDetail.balance', '积分余额')}
        items={[
          {
            children: formatAdminCredits(data.creditAccount?.balance),
            key: 'balanceCurrent',
            label: t('admin.userDetail.balanceCurrent', '当前余额'),
          },
          {
            children: formatAdminCredits(data.creditAccount?.totalCredited),
            key: 'totalCredited',
            label: t('admin.userDetail.totalCredited', '累计增加'),
          },
          {
            children: formatAdminCredits(data.creditAccount?.totalDebited),
            key: 'totalDebited',
            label: t('admin.userDetail.totalDebited', '累计扣减'),
          },
          {
            children: data.creditAccount?.currency ?? 'credits',
            key: 'currency',
            label: t('admin.userDetail.currency', '币种'),
          },
        ]}
      />

      {data.subscription ? (
        <Descriptions
          bordered
          column={2}
          title={t('admin.userDetail.subscription', '订阅')}
          items={[
            {
              children: <Tag>{data.subscription.plan}</Tag>,
              key: 'plan',
              label: t('admin.userDetail.plan', '套餐'),
            },
            {
              children: data.subscription.cycle,
              key: 'cycle',
              label: t('admin.userDetail.cycle', '周期'),
            },
            {
              children: data.subscription.status,
              key: 'subStatus',
              label: t('admin.userDetail.subStatus', '状态'),
            },
            {
              children: formatAdminCredits(data.subscription.monthlyCredits),
              key: 'monthlyCredits',
              label: t('admin.userDetail.monthlyCredits', '每月积分'),
            },
            {
              children: (
                <>
                  {data.subscription.monthlyPrice} {data.subscription.currency}
                </>
              ),
              key: 'cycleAmount',
              label: t('admin.userDetail.cycleAmount', '周期金额'),
            },
            {
              children: data.subscription.renewsAt
                ? new Date(data.subscription.renewsAt).toLocaleDateString()
                : EMPTY_TEXT,
              key: 'renewsAt',
              label: t('admin.userDetail.renewsAt', '续费时间'),
            },
            {
              children: data.subscription.endsAt
                ? new Date(data.subscription.endsAt).toLocaleDateString()
                : EMPTY_TEXT,
              key: 'endTime',
              label: t('admin.userDetail.endTime', '结束时间'),
            },
          ]}
        />
      ) : (
        <AdminPageState
          isEmpty
          emptyKind="initial"
          emptyTitle={t('admin.userDetail.noSubscription', '暂无订阅')}
          emptyDescription={t(
            'admin.userDetail.noSubscriptionDescription',
            '该用户当前没有生效中的订阅，可在上方「给用户分配套餐」。',
          )}
        >
          {null}
        </AdminPageState>
      )}

      <div>
        <h4>{t('admin.userDetail.recentLedger', '最近积分流水')}</h4>
        <AdminDataTable
          dataSource={data.recentLedger}
          regionLabel={t('admin.userDetail.recentLedger', '详情表格')}
          rowKey="id"
          columns={[
            { dataIndex: 'type', key: 'type', title: t('admin.userDetail.ledgerType', '类型') },
            {
              dataIndex: 'amount',
              key: 'amount',
              render: (value: number) => formatAdminCredits(value),
              title: t('admin.userDetail.ledgerAmount', '数量'),
            },
            {
              dataIndex: 'balanceAfter',
              key: 'balanceAfter',
              render: (value: number) => formatAdminCredits(value),
              title: t('admin.userDetail.ledgerBalanceAfter', '变动后余额'),
            },
            {
              dataIndex: 'description',
              key: 'description',
              title: t('admin.userDetail.ledgerDescription', '描述'),
            },
            {
              dataIndex: 'createdAt',
              key: 'createdAt',
              render: (value: Date) => new Date(value).toLocaleString(),
              title: t('admin.userDetail.ledgerTime', '时间'),
            },
          ]}
        />
      </div>

      <div>
        <h4>{t('admin.userDetail.recentOrders', '最近充值订单')}</h4>
        <AdminDataTable
          dataSource={data.recentOrders}
          regionLabel={t('admin.userDetail.recentOrders', '详情表格')}
          rowKey="id"
          columns={[
            {
              dataIndex: 'id',
              key: 'id',
              render: (value: string) => <code>{value.slice(0, 8)}</code>,
              title: t('admin.userDetail.orderId', 'ID'),
            },
            {
              dataIndex: 'credits',
              key: 'credits',
              render: (value: number) => formatAdminCredits(value),
              title: t('admin.userDetail.orderCredits', '积分'),
            },
            {
              dataIndex: 'amount',
              key: 'amount',
              title: t('admin.userDetail.orderAmount', '金额'),
            },
            {
              dataIndex: 'currency',
              key: 'currency',
              title: t('admin.userDetail.orderCurrency', '币种'),
            },
            {
              dataIndex: 'status',
              key: 'status',
              render: (value: string) => <Tag>{value}</Tag>,
              title: t('admin.userDetail.orderStatus', '状态'),
            },
            {
              dataIndex: 'createdAt',
              key: 'createdAt',
              render: (value: Date) => new Date(value).toLocaleString(),
              title: t('admin.userDetail.orderCreatedAt', '创建时间'),
            },
          ]}
        />
      </div>

      <div>
        <h4>{t('admin.userDetail.auditTrail', '最近后台操作')}</h4>
        <AdminDataTable
          dataSource={data.recentAudit ?? []}
          regionLabel={t('admin.userDetail.auditTrail', '详情表格')}
          rowKey="id"
          columns={[
            {
              dataIndex: 'createdAt',
              key: 'createdAt',
              render: (value: Date) => new Date(value).toLocaleString(),
              title: t('admin.userDetail.auditTime', '时间'),
              width: 160,
            },
            {
              dataIndex: 'action',
              key: 'action',
              render: (value: string) => <Tag>{value}</Tag>,
              title: t('admin.userDetail.auditAction', '操作'),
            },
            {
              dataIndex: 'actorUserId',
              key: 'actor',
              render: (value: string | null) =>
                value ? <code>{value.slice(0, 8)}</code> : EMPTY_TEXT,
              title: t('admin.userDetail.auditActor', '操作者'),
            },
            {
              dataIndex: 'payload',
              key: 'payload',
              render: (value: Record<string, unknown> | null) =>
                value ? (
                  <code style={{ fontSize: 11 }}>{JSON.stringify(value).slice(0, 80)}</code>
                ) : (
                  EMPTY_TEXT
                ),
              title: t('admin.userDetail.auditPayload', '载荷（Payload）'),
            },
          ]}
        />
      </div>
    </Flexbox>
  );
};

UserDetailSections.displayName = 'UserDetailSections';

export default UserDetailSections;
