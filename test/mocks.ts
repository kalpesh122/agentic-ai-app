import { MockLanguageModelV3 } from 'ai/test';
import pino from 'pino';
import type { Embedder } from '../src/memory/embed.ts';
import type { MemoryStore, NoteInput, SearchHit } from '../src/memory/store.ts';

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: output, text: output, reasoning: undefined },
});

/** A model that answers with fixed text (optionally after one tool call). Steps are served in order. */
export function textModel(
  replies: Array<{ text: string } | { toolCall: { name: string; input: Record<string, unknown> } }>,
) {
  let i = 0;
  return new MockLanguageModelV3({
    doGenerate: async () => {
      const reply = replies[Math.min(i, replies.length - 1)];
      i += 1;
      if (reply && 'toolCall' in reply) {
        return {
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `call-${i}`,
              toolName: reply.toolCall.name,
              input: JSON.stringify(reply.toolCall.input),
            },
          ],
          finishReason: { unified: 'tool-calls' as const, raw: 'tool_use' },
          usage: usage(100, 20),
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text' as const, text: reply?.text ?? '' }],
        finishReason: { unified: 'stop' as const, raw: 'end_turn' },
        usage: usage(100, 20),
        warnings: [],
      };
    },
    doStream: async () => {
      const reply = replies[Math.min(i, replies.length - 1)];
      const text = reply && 'text' in reply ? reply.text : '';
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 't1' });
            for (const word of text.split(' '))
              controller.enqueue({ type: 'text-delta', id: 't1', delta: `${word} ` });
            controller.enqueue({ type: 'text-end', id: 't1' });
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'end_turn' },
              usage: usage(50, 10),
            });
            controller.close();
          },
        }),
      };
    },
  });
}

/** A model that returns a JSON object (for Output.object tests). */
export function jsonModel(value: unknown) {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text: JSON.stringify(value) }],
      finishReason: { unified: 'stop' as const, raw: 'end_turn' },
      usage: usage(80, 30),
      warnings: [],
    }),
  });
}

/** Deterministic fake embeddings: a bag-of-characters vector, good enough to rank exact matches first. */
export function fakeVector(text: string, dims = 1536): number[] {
  const v = new Array<number>(dims).fill(0);
  for (const ch of text.toLowerCase()) {
    const idx = ch.charCodeAt(0) % dims;
    v[idx] = (v[idx] ?? 0) + 1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

export const fakeEmbedder: Embedder = {
  one: async (t) => fakeVector(t),
  many: async (ts) => ts.map((t) => fakeVector(t)),
};

/** In-memory MemoryStore with naive substring search; used by HTTP and agent tests. */
export function memoryStub(): MemoryStore & { notes: NoteInput[] } {
  const notes: NoteInput[] = [];
  return {
    notes,
    async add(input) {
      notes.push(input);
      return { id: `note-${notes.length}`, chunks: 1 };
    },
    async search(query, limit): Promise<SearchHit[]> {
      return notes
        .filter((n) => n.content.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit)
        .map((n, i) => ({
          noteId: `note-${i + 1}`,
          chunkId: `chunk-${i + 1}`,
          title: n.title,
          content: n.content,
          score: 1,
        }));
    },
    async close() {},
  };
}

export const silentLog = pino({ level: 'silent' });
