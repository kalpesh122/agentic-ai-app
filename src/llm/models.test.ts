import { describe, expect, it } from 'vitest';
import { estimateCost, normaliseUsage } from './cost.ts';
import { findModel, parseModelId } from './models.ts';

describe('model ids', () => {
  it('parses provider/model', () => {
    expect(parseModelId('anthropic/claude-sonnet-5')).toEqual({
      provider: 'anthropic',
      id: 'claude-sonnet-5',
      full: 'anthropic/claude-sonnet-5',
    });
    expect(() => parseModelId('mistral/large')).toThrow(/Unsupported provider/);
    expect(() => parseModelId('claude-sonnet-5')).toThrow(/provider\/model/);
  });
  it('finds registry entries and prices them', () => {
    expect(findModel('openai/gpt-5.6-terra')?.inputPerMillion).toBe(2);
    const cost = estimateCost('anthropic/claude-sonnet-5', {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
    });
    expect(cost).toEqual({ usd: 3, known: true });
    expect(estimateCost('anthropic/claude-unknown', { inputTokens: 10, outputTokens: 10 })).toEqual(
      { usd: 0, known: false },
    );
  });
  it('normalises nested and flat usage', () => {
    expect(normaliseUsage({ inputTokens: { total: 5 }, outputTokens: 7 })).toEqual({
      inputTokens: 5,
      outputTokens: 7,
    });
    expect(normaliseUsage(undefined)).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
