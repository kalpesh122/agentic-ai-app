export interface Ranked {
  id: string;
  rank: number;
}

/**
 * Reciprocal Rank Fusion: merges several ranked lists into one without needing comparable scores.
 * k=60 is the standard constant; lower values weight top ranks more.
 */
export function rrf(lists: Ranked[][], k = 60): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    for (const { id, rank } of list) {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    }
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
