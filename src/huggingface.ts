import { createOpenAI } from '@ai-sdk/openai';

export function createHuggingFace(opts: { apiKey?: string; baseUrl?: string } = {}) {
  return createOpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseUrl || 'https://router.huggingface.co/v1',
  });
}