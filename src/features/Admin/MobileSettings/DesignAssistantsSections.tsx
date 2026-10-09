import { Input } from 'antd';

import {
  AccessibleSwitch,
  IconSelect,
  LabeledField,
  OrderButtons,
} from '../MobileSettingsControls';
import { moveOrderedItem, sortByOrder, updateDesignTool } from '../mobileSettingsHelpers';
import { mobileSettingsStyles as styles } from './styles';
import type { MobileSettingsSectionProps } from './types';

export const DesignToolsSection = ({ formValues, tr, updateForm }: MobileSettingsSectionProps) => (
  <section aria-label={tr('admin.mobile.designTools', 'Design Tools')} className={styles.section}>
    <h2 className={styles.sectionTitle}>{tr('admin.mobile.designTools', 'Design Tools')}</h2>
    {sortByOrder(formValues.design.tools).map((tool, index, tools) => (
      <div className={styles.itemRow} key={tool.id}>
        <LabeledField label={tr('admin.mobile.toolLabel', 'Tool {{id}} label', { id: tool.id })}>
          <Input
            aria-label={tr('admin.mobile.toolLabel', 'Tool {{id}} label', { id: tool.id })}
            value={tool.label}
            onChange={(event) =>
              updateForm(updateDesignTool(formValues, tool.id, { label: event.target.value }))
            }
          />
        </LabeledField>
        <LabeledField label={tr('admin.mobile.toolIcon', 'Tool {{id}} icon', { id: tool.id })}>
          <IconSelect
            label={tr('admin.mobile.toolIcon', 'Tool {{id}} icon', { id: tool.id })}
            value={tool.icon}
            onChange={(icon) => updateForm(updateDesignTool(formValues, tool.id, { icon }))}
          />
        </LabeledField>
        <OrderButtons
          label={tr('admin.mobile.target.tool', 'tool {{id}}', { id: tool.id })}
          position={index}
          total={tools.length}
          onMove={(direction) =>
            updateForm({
              ...formValues,
              design: {
                tools: moveOrderedItem(
                  formValues.design.tools,
                  (item) => item.id === tool.id,
                  direction,
                ),
              },
            })
          }
        />
        <AccessibleSwitch
          checked={tool.enabled}
          label={tr('admin.mobile.toolEnabled', 'Tool {{id}} enabled', { id: tool.id })}
          onChange={(enabled) => updateForm(updateDesignTool(formValues, tool.id, { enabled }))}
        />
        <span />
      </div>
    ))}
  </section>
);

export const DiscoverCommunitySection = ({
  formValues,
  tr,
  updateForm,
}: MobileSettingsSectionProps) => (
  <section
    aria-label={tr('admin.mobile.discoverCommunity', 'Discover community')}
    className={styles.section}
  >
    <h2 className={styles.sectionTitle}>
      {tr('admin.mobile.discoverCommunity', 'Discover community')}
    </h2>
    <div className={styles.grid}>
      <LabeledField label={tr('admin.mobile.communityTitle', 'Community section title')}>
        <Input
          aria-label={tr('admin.mobile.communityTitle', 'Community section title')}
          value={formValues.discover.community.title}
          onChange={(event) =>
            updateForm({
              ...formValues,
              discover: {
                ...formValues.discover,
                community: { ...formValues.discover.community, title: event.target.value },
              },
            })
          }
        />
      </LabeledField>
      <AccessibleSwitch
        checked={formValues.discover.community.enabled}
        label={tr('admin.mobile.communityEnabled', 'Show community section')}
        onChange={(enabled) =>
          updateForm({
            ...formValues,
            discover: {
              ...formValues.discover,
              community: { ...formValues.discover.community, enabled },
            },
          })
        }
      />
    </div>
  </section>
);
