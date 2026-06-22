'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Space, Typography } from 'antd';
import { memo } from 'react';
import { useNavigate } from 'react-router';

const { Text, Title } = Typography;

type MergedRouteAction = {
  label: string;
  path: string;
};

type AdminMergedRoutePageProps = {
  description: string;
  primaryAction: MergedRouteAction;
  secondaryAction?: MergedRouteAction;
  title: string;
};

const AdminMergedRoutePage = memo<AdminMergedRoutePageProps>(
  ({ description, primaryAction, secondaryAction, title }) => {
    const navigate = useNavigate();

    return (
      <Flexbox gap={16} padding={24} style={{ maxWidth: 760 }}>
        <Flexbox gap={4}>
          <Title level={3} style={{ margin: 0 }}>
            {title}
          </Title>
          <Text type="secondary">{description}</Text>
        </Flexbox>

        <Alert
          showIcon
          message="此旧入口不再提供独立保存表单，避免同一配置在多个页面被覆盖。"
          type="info"
        />

        <Space wrap>
          <Button type="primary" onClick={() => navigate(primaryAction.path)}>
            {primaryAction.label}
          </Button>
          {secondaryAction && (
            <Button onClick={() => navigate(secondaryAction.path)}>{secondaryAction.label}</Button>
          )}
        </Space>
      </Flexbox>
    );
  },
);

AdminMergedRoutePage.displayName = 'AdminMergedRoutePage';

export default AdminMergedRoutePage;
