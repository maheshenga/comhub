import { BalanceDisplay } from './BalanceDisplay';
import { RedeemForm } from './RedeemForm';
import { TopUpHistory } from './TopUpHistory';

const TopUpPage = () => {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h2>充值中心</h2>
      <BalanceDisplay />
      <RedeemForm />
      <TopUpHistory />
    </div>
  );
};

export default TopUpPage;
