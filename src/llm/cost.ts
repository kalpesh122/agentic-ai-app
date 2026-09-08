import { findModel } from './models.ts';

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
}

/** Accepts the AI SDK usage object in either the flat (number) or nested ({ total }) shape. */
export function normaliseUsage(usage: unknown): TokenCounts {
  const u = (usage ?? {}) as Record<string, unknown>;
  return { inputTokens: total(u.inputTokens), outputTokens: total(u.outputTokens) };
}

function total(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && typeof (v as { total?: unknown }).total === 'number') {
    return (v as { total: number }).total;
  }
  return 0;
}

/** USD cost for a usage record; 0 for models missing from the registry (flag `known: false`). */
export function estimateCost(modelFull: string, usage: unknown): { usd: number; known: boolean } {
  const info = findModel(modelFull);
  const { inputTokens, outputTokens } = normaliseUsage(usage);
  if (!info) return { usd: 0, known: false };
  const usd =
    (inputTokens * info.inputPerMillion + outputTokens * info.outputPerMillion) / 1_000_000;
  return { usd: Math.round(usd * 1e6) / 1e6, known: true };
}
