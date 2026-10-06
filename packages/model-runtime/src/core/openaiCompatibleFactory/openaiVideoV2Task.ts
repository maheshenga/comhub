import type { PollVideoStatusResult } from '../../types/video';

/**
 * ComHub OpenAI V2 video-task fallback.
 *
 * Some OpenAI-compatible NewAPI instances only expose the legacy
 * `/v2/videos/generations` task API instead of the OpenAI Sora-style
 * `/v1/videos` one. This module owns the whole fallback: when the v1 create
 * or status call 404s, the caller retries through these v2 helpers.
 * `createVideo.ts` keeps the upstream v1 shape and delegates here.
 */

interface OpenAICompatibleVideoError extends Error {
  status?: number;
}

export interface OpenAIV2VideoTaskResponse {
  data?: {
    error?: string;
    output?: string;
    usage?: {
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  error?: {
    message?: string;
  };
  id?: string;
  status?: string;
  task_id?: string;
}

export const createVideoError = (message: string, status?: number): OpenAICompatibleVideoError => {
  const error = new Error(message) as OpenAICompatibleVideoError;
  error.status = status;
  return error;
};

export const normalizeBaseURL = (baseURL: string) => baseURL.replace(/\/$/, '');

export const toV2BaseURL = (baseURL: string) => {
  const normalized = normalizeBaseURL(baseURL || 'https://api.openai.com/v1');
  return normalized.endsWith('/v1') ? normalized.slice(0, -3) : normalized;
};

export const isOpenAICompatibleVideoError = (
  error: unknown,
  status: number,
): error is OpenAICompatibleVideoError =>
  (error as OpenAICompatibleVideoError | undefined)?.status === status;

export async function queryOpenAIV2VideoGenerationStatus(
  inferenceId: string,
  options: { apiKey: string; baseURL: string },
): Promise<OpenAIV2VideoTaskResponse> {
  const statusUrl = `${toV2BaseURL(options.baseURL)}/v2/videos/generations/${inferenceId}`;

  const response = await fetch(statusUrl, {
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'GET',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw createVideoError(
      `OpenAI-compatible video v2 status API error: ${response.status} ${errorText}`,
      response.status,
    );
  }

  return (await response.json()) as OpenAIV2VideoTaskResponse;
}

export function parseOpenAIV2VideoStatus(
  response: OpenAIV2VideoTaskResponse,
): PollVideoStatusResult {
  const status = response.status?.toLowerCase();

  if (['success', 'succeeded', 'completed'].includes(status || '')) {
    const videoUrl = response.data?.output;
    if (!videoUrl) return { error: 'Task succeeded but no video URL found', status: 'failed' };

    return {
      status: 'success',
      ...(response.data?.usage && {
        usage: {
          completionTokens: response.data.usage.completion_tokens ?? 0,
          totalTokens: response.data.usage.total_tokens ?? 0,
        },
      }),
      videoUrl,
    };
  }

  if (['failed', 'failure', 'error'].includes(status || '')) {
    return {
      error: response.data?.error || response.error?.message || 'Video generation failed',
      status: 'failed',
    };
  }

  return { status: 'pending' };
}
