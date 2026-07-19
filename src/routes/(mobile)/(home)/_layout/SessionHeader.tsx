'use client';

import { ActionIcon, Flexbox, Icon } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { message } from '@/components/AntdStaticMethods';
import { ProductLogo } from '@/components/Branding';
import { MOBILE_HEADER_ICON_SIZE } from '@/const/layoutTokens';
import { useMobileConfig } from '@/features/MobileWorkspace/useMobileConfig';
import UserAvatar from '@/features/User/UserAvatar';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useAgentStore } from '@/store/agent';
import { useHomeStore } from '@/store/home';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import { styles } from './SessionHeader/style';

const Header = memo(() => {
  const { t } = useTranslation('common');
  const { config } = useMobileConfig();
  const createAgent = useAgentStore((state) => state.createAgent);
  const refreshAgentList = useHomeStore((state) => state.refreshAgentList);
  const navigate = useWorkspaceAwareNavigate();
  const [creating, setCreating] = useState(false);
  const { displayName, logoUrl } = config.brand;
  const hasMobileBrand = Boolean(displayName || logoUrl);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { agentId } = await createAgent({});
      void refreshAgentList().catch(() => undefined);
      navigate(`/agent/${encodeURIComponent(agentId)}`);
    } catch {
      message.error(t('mobile.recent.createAgentError'));
    } finally {
      setCreating(false);
    }
  };

  const createTitle = t('mobile.recent.createAgent');

  return (
    <ChatHeader
      style={mobileHeaderSticky}
      left={
        <Flexbox horizontal align="center" className={styles.leftContainer} gap={8}>
          <UserAvatar size={32} onClick={() => navigate('/me', { escape: true })} />
          {hasMobileBrand ? (
            <Flexbox horizontal align="center" gap={8}>
              {logoUrl ? (
                <img alt={displayName || createTitle} className={styles.brandLogo} src={logoUrl} />
              ) : null}
              {displayName ? <span className={styles.brandName}>{displayName}</span> : null}
            </Flexbox>
          ) : (
            <ProductLogo type="text" />
          )}
        </Flexbox>
      }
      right={
        <ActionIcon
          disabled={creating}
          icon={creating ? <Icon spin icon={Loader2} /> : MessageSquarePlus}
          size={MOBILE_HEADER_ICON_SIZE}
          title={createTitle}
          onClick={() => void handleCreate()}
        />
      }
    />
  );
});

Header.displayName = 'SessionHeader';

export default Header;
