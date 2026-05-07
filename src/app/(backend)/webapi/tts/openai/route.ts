import { type OpenAITTSPayload } from '@lobehub/tts';
import { createOpenaiAudioSpeech } from '@lobehub/tts/server';

import { createBizOpenAI } from '@/app/(backend)/_deprecated/createBizOpenAI';
import { assertPlanModelAllowed } from '@/business/server/planModelRules';
import { getServerDB } from '@/database/server';
import { createSpeechResponse } from '@/server/utils/createSpeechResponse';

export const POST = async (req: Request) => {
  const payload = (await req.json()) as OpenAITTSPayload;

  // need to be refactored with jwt auth mode
  const openaiOrErrResponse = createBizOpenAI(req);

  // if resOrOpenAI is a Response, it means there is an error,just return it
  if (openaiOrErrResponse instanceof Response) return openaiOrErrResponse;

  // Enforce plan-level model permission for TTS
  const userId = req.headers.get('x-lobe-user-id');
  const model = payload.options?.model || payload.options?.voice;
  if (userId && model) {
    try {
      const db = await getServerDB();
      await assertPlanModelAllowed({ db, model, modelType: 'tts', userId });
    } catch {
      return new Response(JSON.stringify({ error: 'PLAN_MODEL_RULE_DENIED' }), {
        headers: { 'content-type': 'application/json' },
        status: 403,
      });
    }
  }

  return createSpeechResponse(
    () =>
      createOpenaiAudioSpeech({
        openai: openaiOrErrResponse as any,
        payload,
      }),
    {
      logTag: 'webapi/tts/openai',
      messages: {
        failure: 'Failed to synthesize speech',
        invalid: 'Unexpected payload from OpenAI TTS',
      },
    },
  );
};
