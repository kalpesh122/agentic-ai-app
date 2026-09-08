import { describe, expect, it } from 'vitest';
import { chunkText } from './chunk.ts';
import { rrf } from './search.ts';

describe('chunkText', () => {
  it('splits long text with overlap and prefers sentence boundaries', () => {
    const sentence = 'The quick brown fox jumps over the lazy dog. ';
    const text = sentence.repeat(40);
    const chunks = chunkText(text, { size: 200, overlap: 40 });
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200);
    expect(chunks[0]?.endsWith('.')).toBe(true);
    expect(chunks.join(' ')).toContain('lazy dog');
  });
  it('returns one chunk for short text and none for empty', () => {
    expect(chunkText('hello')).toEqual(['hello']);
    expect(chunkText('   ')).toEqual([]);
    expect(() => chunkText('x', { size: 10, overlap: 10 })).toThrow(/overlap/);
  });
});

describe('rrf', () => {
  it('rewards items that rank well in several lists', () => {
    const fused = rrf([
      [
        { id: 'a', rank: 1 },
        { id: 'b', rank: 2 },
        { id: 'c', rank: 3 },
      ],
      [
        { id: 'b', rank: 1 },
        { id: 'a', rank: 2 },
        { id: 'd', rank: 3 },
      ],
    ]);
    expect(fused.map((f) => f.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(fused[0]?.score).toBeGreaterThan(fused[2]?.score ?? 0);
  });
});
