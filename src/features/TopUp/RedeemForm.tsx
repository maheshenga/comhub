// eslint-disable-next-line no-restricted-imports -- antd message 命令式反馈散布 3 处且 Input.Search（回车提交+内嵌按钮）在 base-ui 无渲染不变等价物；改 toast 并重排输入区属 UI 渲染变更，违反行为不变约束，整行豁免。
import { Button, Input, message } from 'antd';
import { useState } from 'react';

import { refreshCommercialEntitlementState } from '@/business/client/commercialRefresh';
import { commercialService } from '@/services/commercial';

export const RedeemForm = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      message.warning('请输入卡密');
      return;
    }

    setLoading(true);
    try {
      const result = await commercialService.redeemCode(code.trim());
      message.success(`兑换成功！获得 ${result.summary?.credits ?? ''} 算力`);
      setCode('');
      await refreshCommercialEntitlementState();
    } catch (error: any) {
      message.error(error?.message ?? '兑换失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <h3>兑换卡密</h3>
      <Input.Search
        placeholder="输入算力卡密"
        value={code}
        enterButton={
          <Button loading={loading} type="primary">
            兑换
          </Button>
        }
        onChange={(e) => setCode(e.target.value)}
        onSearch={handleRedeem}
      />
    </div>
  );
};
