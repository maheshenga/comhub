import { memo } from 'react';

import { ModelItemRender } from '@/components/ModelSelect';

import { type ModelWithProviders } from '../../types';
import ModelPriceSummary from './ModelPriceSummary';

interface SingleProviderModelItemProps {
  data: ModelWithProviders;
  newLabel: string;
  proBadgeLabel?: string;
  showInfoTag?: boolean;
}

export const SingleProviderModelItem = memo<SingleProviderModelItemProps>(
  ({ data, newLabel, proBadgeLabel, showInfoTag }) => {
    return (
      <ModelItemRender
        {...data.model}
        {...data.model.abilities}
        newBadgeLabel={newLabel}
        proBadgeLabel={proBadgeLabel}
        showInfoTag={showInfoTag}
        priceLabel={
          <ModelPriceSummary
            modelId={data.model.id}
            pricing={data.model.pricing}
            provider={data.providers[0].id}
          />
        }
      />
    );
  },
);

SingleProviderModelItem.displayName = 'SingleProviderModelItem';
