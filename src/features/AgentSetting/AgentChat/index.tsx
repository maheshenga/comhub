'use client';

// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/Form.Item name+rules）与受控字段绑定，无 base-ui 行为不变等价物；迁 FormKit 属另行立项。
import { Form, type FormGroupItemType } from '@lobehub/ui';
import { SliderWithInput, Switch, TextArea } from '@lobehub/ui/base-ui';
import isEqual from 'fast-deep-equal';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';

import { selectors, useStore } from '../store';

const AgentChat = memo(() => {
  const { t } = useTranslation('setting');
  const [form] = Form.useForm();
  const updateConfig = useStore((s) => s.setChatConfig);
  const config = useStore(selectors.currentChatConfig, isEqual);

  const chat: FormGroupItemType = {
    children: [
      {
        children: <TextArea placeholder={t('settingChat.inputTemplate.placeholder')} />,
        desc: t('settingChat.inputTemplate.desc'),
        label: t('settingChat.inputTemplate.title'),
        name: 'inputTemplate',
      },
      {
        children: <Switch />,
        desc: t('settingChat.enableAutoCreateTopic.desc'),
        label: t('settingChat.enableAutoCreateTopic.title'),
        layout: 'horizontal',
        minWidth: undefined,
        name: 'enableAutoCreateTopic',
        valuePropName: 'checked',
      },
      {
        children: <SliderWithInput max={8} min={0} unlimitedInput={true} />,
        desc: t('settingChat.autoCreateTopicThreshold.desc'),
        divider: false,
        hidden: !config.enableAutoCreateTopic,
        label: t('settingChat.autoCreateTopicThreshold.title'),
        name: 'autoCreateTopicThreshold',
      },
      {
        children: <Switch />,
        label: t('settingChat.enableHistoryCount.title'),
        layout: 'horizontal',
        minWidth: undefined,
        name: 'enableHistoryCount',
        valuePropName: 'checked',
      },
      {
        children: <SliderWithInput max={20} min={0} unlimitedInput={true} />,
        desc: t('settingChat.historyCount.desc'),
        divider: false,
        hidden: !config.enableHistoryCount,
        label: t('settingChat.historyCount.title'),
        name: 'historyCount',
      },
      {
        children: <Switch />,
        hidden: !config.enableHistoryCount,
        label: t('settingChat.enableCompressHistory.title'),
        layout: 'horizontal',
        minWidth: undefined,
        name: 'enableCompressHistory',
        valuePropName: 'checked',
      },
      {
        children: <Switch />,
        desc: t('settingChat.enableAutoScrollOnStreaming.desc'),
        label: t('settingChat.enableAutoScrollOnStreaming.title'),
        layout: 'horizontal',
        minWidth: undefined,
        name: 'enableAutoScrollOnStreaming',
        valuePropName: 'checked',
      },
    ],
    title: t('settingChat.title'),
  };

  return (
    <Form
      footer={<Form.SubmitFooter />}
      form={form}
      initialValues={config}
      items={[chat]}
      itemsType={'group'}
      variant={'borderless'}
      onFinish={updateConfig}
      {...FORM_STYLE}
    />
  );
});

export default AgentChat;
