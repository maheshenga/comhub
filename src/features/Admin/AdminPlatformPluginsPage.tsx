'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Empty, Spin, Tabs, Typography } from 'antd';
import { memo } from 'react';

const { Text, Title } = Typography;

type PanelState = 'empty' | 'error' | 'loading';

type PlatformPluginPanelProps = {
  description: string;
  state: PanelState;
  title: string;
};

const PlatformPluginPanel = memo<PlatformPluginPanelProps>(({ description, state, title }) => {
  if (state === 'loading') {
    return (
      <Flexbox align="center" gap={12} padding={32}>
        <Spin />
        <Text type="secondary">{description}</Text>
      </Flexbox>
    );
  }

  if (state === 'error') {
    return (
      <Alert
        showIcon
        description={description}
        message={title}
        type="error"
      />
    );
  }

  return <Empty description={description} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
});

PlatformPluginPanel.displayName = 'PlatformPluginPanel';

const AdminPlatformPluginsPage = memo(() => {
  const tabItems = [
    {
      children: (
        <PlatformPluginPanel
          description="暂无平台插件。"
          state="empty"
          title="插件市场"
        />
      ),
      key: 'plugins',
      label: '插件',
    },
    {
      children: (
        <PlatformPluginPanel
          description="暂无运行记录。"
          state="empty"
          title="运行记录"
        />
      ),
      key: 'runs',
      label: '运行记录',
    },
    {
      children: (
        <PlatformPluginPanel
          description="暂无产物。"
          state="empty"
          title="产物"
        />
      ),
      key: 'artifacts',
      label: '产物',
    },
    {
      children: (
        <PlatformPluginPanel
          description="暂无密钥。"
          state="empty"
          title="密钥"
        />
      ),
      key: 'secrets',
      label: '密钥',
    },
  ];

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 960 }}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          平台插件
        </Title>
        <Text type="secondary">
          管理平台插件、运行记录、生成产物、密钥状态、套餐权限和商业计费入口。
        </Text>
      </Flexbox>

      <Alert
        showIcon
        description="平台插件与现有 MCP、Skills 独立管理，权限、计费、密钥和运行记录在本页集中查看。"
        message="独立插件市场"
        type="info"
      />

      <Tabs items={tabItems} />
    </Flexbox>
  );
});

AdminPlatformPluginsPage.displayName = 'AdminPlatformPluginsPage';

export default AdminPlatformPluginsPage;
