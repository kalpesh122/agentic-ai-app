export interface ChunkOptions {
  /** Target characters per chunk. */
  size: number;
  /** Characters shared between consecutive chunks so sentences that straddle a boundary are kept. */
  overlap: number;
}

export const DEFAULT_CHUNKING: ChunkOptions = { size: 800, overlap: 120 };

/**
 * Fixed-size chunking with overlap, breaking on paragraph or sentence boundaries when one is near.
 * Deterministic and dependency-free; swap for a semantic chunker if retrieval quality demands it.
 */
export function chunkText(text: string, opts: ChunkOptions = DEFAULT_CHUNKING): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length === 0) return [];
  if (opts.overlap >= opts.size) throw new Error('overlap must be smaller than size');
  const out: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + opts.size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const cut = Math.max(
        window.lastIndexOf('\n\n'),
        window.lastIndexOf('. '),
        window.lastIndexOf('\n'),
      );
      if (cut > opts.size * 0.5) end = start + cut + 1;
    }
    out.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - opts.overlap, start + 1);
  }
  return out.filter((c) => c.length > 0);
}
