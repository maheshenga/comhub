import useSWRMutation from 'swr/mutation';

import { docmeeService } from '@/services/docmee';

export const useDocmeeToken = () =>
  useSWRMutation(['docmee-ppt-token'], () => docmeeService.createPptToken());
