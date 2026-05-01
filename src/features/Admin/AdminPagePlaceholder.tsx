'use client';

import { Card, Typography } from 'antd';
import { memo } from 'react';

interface AdminPagePlaceholderProps {
  description?: string;
  title: string;
}

export const AdminPagePlaceholder = memo<AdminPagePlaceholderProps>(({ description, title }) => (
  <Card>
    <Typography.Title level={3}>{title}</Typography.Title>
    {description && <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>}
  </Card>
));

AdminPagePlaceholder.displayName = 'AdminPagePlaceholder';
