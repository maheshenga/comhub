'use client';

import { Icon } from '@lobehub/ui';
import { Button, Col, Row, Space, Spin, Statistic, Tag, Typography } from 'antd';
import {
  BarChart3,
  ChartNoAxesColumn,
  GitPullRequest,
  Package,
  Plug,
  Settings,
  Users,
} from 'lucide-react';
import { memo } from 'react';
import { useNavigate } from 'react-router';

import { Card } from '@/components/antd-compat/Card';
import { ADMIN_BASE_PATH, ADMIN_NAV_GROUPS } from '@/features/Admin/adminNavigation';
import { ADMIN_OVERVIEW_QUICK_LINKS } from '@/features/Admin/adminOverviewLinks';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

const QUICK_LINK_ICONS = {
  matrix: Settings,
  plans: Package,
  providers: Plug,
  stats: BarChart3,
};

const AdminOverviewPage = memo(() => {
  const navigate = useNavigate();
  const { data: overview } = useClientDataSWR(['admin-overview-stats'], () =>
    adminCommercialService.getStatsOverview(),
  );
  const { data: pendingChanges } = useClientDataSWR(['admin-overview-pending-changes'], () =>
    adminCommercialService.listChangeRequests({ limit: 1, status: 'pending' }),
  );
  const { data: settings } = useClientDataSWR(['admin-overview-settings'], () =>
    adminCommercialService.getAllSettings(),
  );

  const pendingChangeCount = pendingChanges?.total ?? 0;
  const defaultModel =
    settings?.defaultAgentProvider && settings?.defaultAgentModel
      ? `${settings.defaultAgentProvider}/${settings.defaultAgentModel}`
      : '未设置';

  return (
    <Space direction="vertical" size={16} style={{ padding: 24, width: '100%' }}>
      <Space direction="vertical" size={4}>
        <Title level={3} style={{ margin: 0 }}>
          后台工作台
        </Title>
        <Text type="secondary">
          集中查看关键状态，并从这里进入用户与套餐、模型与计费、品牌增长和系统运维。
        </Text>
      </Space>

      <Row gutter={[16, 16]}>
        <Col lg={6} md={12} xs={24}>
          <Card>
            <Statistic
              prefix={<Icon icon={Users} />}
              title="总用户"
              value={overview?.totalUsers ?? 0}
            />
          </Card>
        </Col>
        <Col lg={6} md={12} xs={24}>
          <Card>
            <Statistic title="日活用户" value={overview?.dau ?? 0} />
          </Card>
        </Col>
        <Col lg={6} md={12} xs={24}>
          <Card>
            <Statistic
              prefix={<Icon icon={ChartNoAxesColumn} />}
              title="有效订阅"
              value={overview?.activeSubscriptions ?? 0}
            />
          </Card>
        </Col>
        <Col lg={6} md={12} xs={24}>
          <Card>
            <Statistic prefix="$" title="近 30 天实收充值收入" value={overview?.revenueLast30dUsd ?? 0} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col lg={12} xs={24}>
          <Card
            extra={
              <Button size="small" onClick={() => navigate(`${ADMIN_BASE_PATH}/subscriptions`)}>
                处理
              </Button>
            }
            title={
              <Space>
                <Icon icon={GitPullRequest} />
                待处理事项
              </Space>
            }
          >
            {pendingChanges ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space>
                  <Tag color={pendingChangeCount > 0 ? 'processing' : 'success'}>
                    套餐变更请求 {pendingChangeCount}
                  </Tag>
                  <Text type="secondary">优先处理会影响用户订阅状态的请求。</Text>
                </Space>
                <Button onClick={() => navigate(`${ADMIN_BASE_PATH}/orders`)}>查看订单</Button>
              </Space>
            ) : (
              <Spin />
            )}
          </Card>
        </Col>
        <Col lg={12} xs={24}>
          <Card
            extra={
              <Button size="small" onClick={() => navigate(`${ADMIN_BASE_PATH}/settings`)}>
                修改
              </Button>
            }
            title={
              <Space>
                <Icon icon={Settings} />
                当前默认设置
              </Space>
            }
          >
            {settings ? (
              <Space direction="vertical" size={8}>
                <Text>
                  品牌名称：<strong>{settings.brandName || '未设置'}</strong>
                </Text>
                <Text>
                  默认模型：<strong>{defaultModel}</strong>
                </Text>
                <Text>
                  推荐奖励：<strong>{settings.referralRewardCredits ?? 0}</strong> 积分
                </Text>
              </Space>
            ) : (
              <Spin />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {ADMIN_NAV_GROUPS.filter((group) => group.key !== 'overview').map((group) => (
          <Col key={group.key} lg={8} md={12} xs={24}>
            <Card
              title={group.label}
              actions={group.items.slice(0, 3).map((item) => (
                <Button
                  key={item.path}
                  size="small"
                  type="link"
                  onClick={() => navigate(item.path)}
                >
                  {item.label}
                </Button>
              ))}
            >
              <Space direction="vertical" size={8}>
                <Text type="secondary">{group.description}</Text>
                <Text type="secondary">
                  {group.items.length} 个入口，覆盖{' '}
                  {group.items.map((item) => item.label).join('、')}
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Space wrap>
          {ADMIN_OVERVIEW_QUICK_LINKS.map((item) => (
            <Button
              icon={<Icon icon={QUICK_LINK_ICONS[item.key]} />}
              key={item.key}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </Button>
          ))}
        </Space>
      </Card>
    </Space>
  );
});

AdminOverviewPage.displayName = 'AdminOverviewPage';

export default AdminOverviewPage;
