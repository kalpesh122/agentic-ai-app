/** Model registry: ids we support and their list prices (USD per 1M tokens) for cost accounting. */
export type Provider = 'anthropic' | 'openai' | 'google';

export interface ModelInfo {
  provider: Provider;
  id: string;
  inputPerMillion: number;
  outputPerMillion: number;
  notes: string;
}

export const MODELS: readonly ModelInfo[] = [
  {
    provider: 'anthropic',
    id: 'claude-opus-5',
    inputPerMillion: 5,
    outputPerMillion: 25,
    notes: 'Default for hard agentic work',
  },
  {
    provider: 'anthropic',
    id: 'claude-sonnet-5',
    inputPerMillion: 2,
    outputPerMillion: 10,
    notes: 'Best price/performance',
  },
  {
    provider: 'anthropic',
    id: 'claude-haiku-4-5',
    inputPerMillion: 1,
    outputPerMillion: 5,
    notes: 'Fast, cheap, classification/routing',
  },
  {
    provider: 'openai',
    id: 'gpt-5.6-sol',
    inputPerMillion: 4,
    outputPerMillion: 20,
    notes: 'OpenAI depth tier',
  },
  {
    provider: 'openai',
    id: 'gpt-5.6-terra',
    inputPerMillion: 2,
    outputPerMillion: 12,
    notes: 'OpenAI workhorse',
  },
  {
    provider: 'google',
    id: 'gemini-3.1-pro-preview',
    inputPerMillion: 2,
    outputPerMillion: 12,
    notes: 'Preview; no GA Gemini 3 Pro yet',
  },
  {
    provider: 'google',
    id: 'gemini-3.8-flash',
    inputPerMillion: 0.75,
    outputPerMillion: 3.75,
    notes: 'Promotional pricing through 2026-12-31',
  },
];

export interface ParsedModelId {
  provider: Provider;
  id: string;
  full: string;
}

/** Splits "provider/model-id". Unknown providers are rejected; unknown ids are allowed (priced as 0, flagged). */
export function parseModelId(full: string): ParsedModelId {
  const [provider, ...rest] = full.split('/');
  const id = rest.join('/');
  if (!provider || !id) throw new Error(`Model id must be "provider/model", got "${full}"`);
  if (provider !== 'anthropic' && provider !== 'openai' && provider !== 'google') {
    throw new Error(`Unsupported provider "${provider}" (anthropic | openai | google)`);
  }
  return { provider, id, full };
}

export function findModel(full: string): ModelInfo | undefined {
  const { provider, id } = parseModelId(full);
  return MODELS.find((m) => m.provider === provider && m.id === id);
}
