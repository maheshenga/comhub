import { lambdaClient } from '@/libs/trpc/client';

export const docmeeService = {
  createPptToken: () => lambdaClient.docmee.createPptToken.mutate(),
  getPptRuntime: () => lambdaClient.docmee.getPptRuntime.query(),
  reportPptEvent: (params: {
    data?: unknown;
    sessionId: string;
    type: 'afterGenerate' | 'beforeDownload' | 'charge' | 'error' | 'pageChange';
    upstreamTaskId?: string;
  }) => lambdaClient.docmee.reportPptEvent.mutate(params),
};
