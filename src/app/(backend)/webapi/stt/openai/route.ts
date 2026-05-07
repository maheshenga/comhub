import { type OpenAISTTPayload } from '@lobehub/tts';
import { createOpenaiAudioTranscriptions } from '@lobehub/tts/server';

import { createBizOpenAI } from '@/app/(backend)/_deprecated/createBizOpenAI';
import { assertPlanModelAllowed } from '@/business/server/planModelRules';
import { getServerDB } from '@/database/server';

export const POST = async (req: Request) => {
  const formData = await req.formData();
  const speechBlob = formData.get('speech') as Blob;
  const optionsString = formData.get('options') as string;
  const payload = {
    options: JSON.parse(optionsString),
    speech: speechBlob,
  } as OpenAISTTPayload;

  const openaiOrErrResponse = createBizOpenAI(req);

  // if resOrOpenAI is a Response, it means there is an error,just return it
  if (openaiOrErrResponse instanceof Response) return openaiOrErrResponse;

  // Enforce plan-level model permission for STT
  const userId = req.headers.get('x-lobe-user-id');
  const model = payload.options?.model;
  if (userId && model) {
    try {
      const db = await getServerDB();
      await assertPlanModelAllowed({ db, model, modelType: 'stt', userId });
    } catch {
      return new Response(JSON.stringify({ error: 'PLAN_MODEL_RULE_DENIED' }), {
        headers: { 'content-type': 'application/json' },
        status: 403,
      });
    }
  }

  const res = await createOpenaiAudioTranscriptions({
    openai: openaiOrErrResponse as any,
    payload,
  });

  return new Response(JSON.stringify(res), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
};
