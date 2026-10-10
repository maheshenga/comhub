'use client';

import { Flexbox } from '@lobehub/ui';
import { Tag } from '@lobehub/ui/base-ui';
import { Descriptions, Empty, Table } from 'antd';
import { useTranslation } from 'react-i18next';

import { formatAdminCredits } from '../adminCreditUnits';

const EMPTY_TEXT = '-';

const UserDetailSections = ({ data }: { data: any }) => {
  const { t } = useTranslation('subscription');

  return (
        <Flexbox gap={24}>
          <Descriptions
            bordered
            column={1}
            size="small"
            title={t('admin.userDetail.profile', '用户资料')}
          >
            <Descriptions.Item label={t('admin.userDetail.userId', 'ID')}>
              <code>{data.user.id}</code>
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.email', '邮箱')}>
              {data.user.email ?? EMPTY_TEXT}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.phone', '手机号')}>
              {data.user.phone ?? EMPTY_TEXT}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.name', '名称')}>
              {data.user.fullName ?? EMPTY_TEXT}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.role', '角色')}>
              {data.user.role ? (
                <Tag color={data.user.role === 'admin' ? 'purple' : 'blue'}>{data.user.role}</Tag>
              ) : (
                EMPTY_TEXT
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.status', '状态')}>
              {data.user.banned ? <Tag color="red">已封禁</Tag> : <Tag color="green">正常</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.joined', '注册时间')}>
              {data.user.createdAt ? new Date(data.user.createdAt).toLocaleString() : EMPTY_TEXT}
            </Descriptions.Item>
          </Descriptions>

          <Descriptions
            bordered
            column={2}
            size="small"
            title={t('admin.userDetail.balance', '积分余额')}
          >
            <Descriptions.Item label={t('admin.userDetail.balanceCurrent', '当前余额')}>
              {formatAdminCredits(data.creditAccount?.balance)}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.userDetail.totalCredited', '累计增加')}>
              {formatAdminCredits(data.creditAccount?.totalCredited)}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.userDetail.totalDebited', '累计扣减')}>
              {formatAdminCredits(data.creditAccount?.totalDebited)}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.userDetail.currency', '币种')}>
              {data.creditAccount?.currency ?? 'credits'}
            </Descriptions.Item>
          </Descriptions>

          {data.subscription ? (
            <Descriptions
              bordered
              column={2}
              size="small"
              title={t('admin.userDetail.subscription', '订阅')}
            >
              <Descriptions.Item label={t('admin.userDetail.plan', '套餐')}>
                <Tag>{data.subscription.plan}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.cycle', '周期')}>
                {data.subscription.cycle}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.subStatus', '状态')}>
                {data.subscription.status}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.monthlyCredits', '每月积分')}>
                {formatAdminCredits(data.subscription.monthlyCredits)}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.cycleAmount', '周期金额')}>
                {data.subscription.monthlyPrice} {data.subscription.currency}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.renewsAt', '续费时间')}>
                {data.subscription.renewsAt
                  ? new Date(data.subscription.renewsAt).toLocaleDateString()
                  : EMPTY_TEXT}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.endTime', '结束时间')}>
                {data.subscription.endsAt
                  ? new Date(data.subscription.endsAt).toLocaleDateString()
                  : EMPTY_TEXT}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Empty description={t('admin.userDetail.noSubscription', '暂无订阅')} />
          )}

          <div>
            <h4>{t('admin.userDetail.recentLedger', '最近积分流水')}</h4>
            <Table
              dataSource={data.recentLedger}
              pagination={false}
              rowKey="id"
              size="small"
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
            <Table
              dataSource={data.recentOrders}
              pagination={false}
              rowKey="id"
              size="small"
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
            <Table
              dataSource={data.recentAudit ?? []}
              pagination={false}
              rowKey="id"
              size="small"
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
