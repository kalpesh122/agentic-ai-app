import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createGateway, type EmbeddingModel, type LanguageModel } from 'ai';
import type { Env } from '../env.ts';
import { parseModelId } from './models.ts';

type Keys = Pick<
  Env,
  'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY' | 'GOOGLE_GENERATIVE_AI_API_KEY' | 'AI_GATEWAY_API_KEY'
>;

/**
 * One switch for "which SDK provider serves this model id". With AI_GATEWAY_API_KEY set, every
 * model goes through Vercel AI Gateway (one key, failover); otherwise direct provider keys are used.
 */
export function resolveLanguageModel(full: string, keys: Keys): LanguageModel {
  const { provider, id } = parseModelId(full);
  if (keys.AI_GATEWAY_API_KEY)
    return createGateway({ apiKey: keys.AI_GATEWAY_API_KEY })(`${provider}/${id}`);
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: required(keys.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY') })(id);
    case 'openai':
      return createOpenAI({ apiKey: required(keys.OPENAI_API_KEY, 'OPENAI_API_KEY') })(id);
    case 'google':
      return createGoogleGenerativeAI({
        apiKey: required(keys.GOOGLE_GENERATIVE_AI_API_KEY, 'GOOGLE_GENERATIVE_AI_API_KEY'),
      })(id);
  }
}

export function resolveEmbeddingModel(full: string, keys: Keys): EmbeddingModel {
  const { provider, id } = parseModelId(full);
  if (keys.AI_GATEWAY_API_KEY)
    return createGateway({ apiKey: keys.AI_GATEWAY_API_KEY }).embeddingModel(`${provider}/${id}`);
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey: required(keys.OPENAI_API_KEY, 'OPENAI_API_KEY') }).embedding(
        id,
      );
    case 'google':
      return createGoogleGenerativeAI({
        apiKey: required(keys.GOOGLE_GENERATIVE_AI_API_KEY, 'GOOGLE_GENERATIVE_AI_API_KEY'),
      }).embedding(id);
    case 'anthropic':
      throw new Error(
        'Anthropic does not offer embedding models; use openai/… or google/… for AI_EMBEDDING_MODEL',
      );
  }
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required for the selected model`);
  return value;
}
