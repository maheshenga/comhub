import { type EdgeSpeechPayload } from '@lobehub/tts';
import { EdgeSpeechTTS } from '@lobehub/tts';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { createSpeechResponse } from '@/server/utils/createSpeechResponse';

const handler = async (req: Request) => {
  const payload = (await req.json()) as EdgeSpeechPayload;

  return createSpeechResponse(() => EdgeSpeechTTS.createRequest({ payload }), {
    logTag: 'webapi/tts/edge',
    messages: {
      failure: 'Failed to synthesize speech',
      invalid: 'Unexpected payload from Edge speech API',
    },
  });
};

export const POST = checkAuth(handler);
