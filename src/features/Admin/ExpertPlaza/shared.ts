import type { ExpertPlazaCard } from '@/const/expertPlaza';

export type CardFormValue = Omit<ExpertPlazaCard, 'tags'> & {
  tagsText?: string;
};

export type FormValues = {
  cards: CardFormValue[];
  categoriesText: string;
  description: string;
  enabled: boolean;
  name: string;
};
