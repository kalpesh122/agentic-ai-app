import type Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic-native example for features the provider-agnostic layer does not expose:
 * prompt caching (`cache_control`) on a large, reused document and adaptive thinking.
 * Use this pattern when the same big context is queried many times; cached input tokens are billed
 * at a fraction of the price. Not used by the HTTP app; called from scripts or your own routes.
 */
export async function summariseWithCache(
  client: Anthropic,
  document: string,
  question: string,
  model = 'claude-sonnet-5',
): Promise<{ answer: string; cacheReadTokens: number; cacheWriteTokens: number }> {
  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: 'You answer questions about the provided document. Be precise and cite sections.',
      },
      // The document is the cache breakpoint: everything up to here is reused across calls.
      {
        type: 'text',
        text: `<document>\n${document}\n</document>`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: question }],
  });
  const answer = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return {
    answer,
    cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
  };
}
