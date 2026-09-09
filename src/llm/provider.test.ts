import { describe, expect, it } from 'vitest';
import { type Keys, resolveEmbeddingModel, resolveLanguageModel } from './provider.ts';

const keys: Keys = {
  ANTHROPIC_API_KEY: 'a',
  OPENAI_API_KEY: 'o',
  GOOGLE_GENERATIVE_AI_API_KEY: 'g',
  DEEPSEEK_API_KEY: 'd',
  AI_GATEWAY_API_KEY: undefined,
};
/** The SDK's LanguageModel type hides these, but every provider model object carries them. */
type Described = { modelId: string; provider: string };
const describeModel = (full: string, k: Keys) =>
  resolveLanguageModel(full, k) as unknown as Described;

describe('provider switch', () => {
  it('resolves every supported provider to a language model', () => {
    for (const id of [
      'anthropic/claude-sonnet-5',
      'openai/gpt-5.6-terra',
      'google/gemini-3.8-flash',
      'deepseek/deepseek-v4-flash',
    ]) {
      expect(describeModel(id, keys).modelId).toBe(id.split('/')[1]);
    }
  });
  it('fails clearly when the provider key is missing', () => {
    expect(() =>
      resolveLanguageModel('deepseek/deepseek-v4-pro', { ...keys, DEEPSEEK_API_KEY: undefined }),
    ).toThrow(/DEEPSEEK_API_KEY/);
  });
  it('routes everything through the gateway when its key is set', () => {
    expect(
      describeModel('deepseek/deepseek-v4-flash', { ...keys, AI_GATEWAY_API_KEY: 'gw' }).provider,
    ).toMatch(/gateway/i);
  });
  it('rejects providers without embedding models', () => {
    expect(() => resolveEmbeddingModel('deepseek/deepseek-v4-flash', keys)).toThrow(/embedding/);
    expect(() => resolveEmbeddingModel('anthropic/x', keys)).toThrow(/embedding/);
  });
});
