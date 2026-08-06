import { Flexbox } from '@lobehub/ui';
import { type FC } from 'react';

import HomePageTracker from '@/components/Analytics/HomePageTracker';
import HomeContent from '@/features/Home';
import { useHomeMinimalLayout } from '@/features/Home/CustomizeModal/useHomeCustomization';
import HomeNavHeader from '@/features/Home/HomeNavHeader';
import WideScreenContainer from '@/features/WideScreenContainer';

const Home: FC = () => {
  // Auto margins are what center a flex item inside the scroll lane, and they
  // have to sit on the item itself — the dashboard never wants them.
  const minimal = useHomeMinimalLayout();

  return (
    <>
      <HomePageTracker />
      <HomeNavHeader />
      <Flexbox
        height={'100%'}
        style={{ overflow: 'hidden', paddingBlockStart: 32, paddingInline: 24 }}
        width={'100%'}
      >
        <WideScreenContainer
          fullWidth
          style={{ marginInline: 'auto', maxWidth: 1240, minHeight: 0 }}
          wrapperStyle={{
            flex: minimal ? 'none' : 1,
            marginBlock: minimal ? 'auto' : undefined,
            minHeight: 0,
          }}
        >
          <HomeContent />
        </WideScreenContainer>
      </Flexbox>
    </>
  );
};

export default Home;
