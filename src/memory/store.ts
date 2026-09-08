import { desc, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { chunkText, DEFAULT_CHUNKING } from './chunk.ts';
import type { Embedder } from './embed.ts';
import * as schema from './schema.ts';
import { rrf } from './search.ts';

export interface NoteInput {
  title: string;
  content: string;
  tags?: string[];
}

export interface SearchHit {
  noteId: string;
  chunkId: string;
  title: string;
  content: string;
  score: number;
}

export interface MemoryStore {
  add(input: NoteInput): Promise<{ id: string; chunks: number }>;
  search(query: string, limit: number): Promise<SearchHit[]>;
  close(): Promise<void>;
}

/**
 * Postgres + pgvector long-term memory with hybrid retrieval: cosine similarity over embeddings and
 * Postgres full-text search, fused with RRF. Contextual retrieval: each chunk is embedded with the
 * note title prepended so short chunks keep their context.
 */
export function createMemoryStore(connectionString: string, embedder: Embedder): MemoryStore {
  const client = postgres(connectionString, { max: 5, onnotice: () => {} });
  const db = drizzle(client, { schema });

  return {
    async add(input) {
      const parts = chunkText(input.content, DEFAULT_CHUNKING);
      if (parts.length === 0) throw new Error('note content is empty');
      const embeddings = await embedder.many(parts.map((p) => `${input.title}\n\n${p}`));
      return db.transaction(async (tx) => {
        const [note] = await tx
          .insert(schema.notes)
          .values({ title: input.title, content: input.content, tags: input.tags ?? [] })
          .returning({ id: schema.notes.id });
        if (!note) throw new Error('insert returned no row');
        await tx.insert(schema.chunks).values(
          parts.map((content, ordinal) => ({
            noteId: note.id,
            ordinal,
            content,
            embedding: embeddings[ordinal] ?? [],
          })),
        );
        return { id: note.id, chunks: parts.length };
      });
    },

    async search(query, limit) {
      const candidates = Math.max(limit * 4, 20);
      const qv = await embedder.one(query);
      const vectorLiteral = `[${qv.join(',')}]`;
      const byVector = await db
        .select({ id: schema.chunks.id })
        .from(schema.chunks)
        .orderBy(sql`${schema.chunks.embedding} <=> ${vectorLiteral}::vector`)
        .limit(candidates);
      const byText = await db
        .select({ id: schema.chunks.id })
        .from(schema.chunks)
        .where(
          sql`to_tsvector('english', ${schema.chunks.content}) @@ plainto_tsquery('english', ${query})`,
        )
        .orderBy(
          desc(
            sql`ts_rank(to_tsvector('english', ${schema.chunks.content}), plainto_tsquery('english', ${query}))`,
          ),
        )
        .limit(candidates);
      const fused = rrf([
        byVector.map((r, i) => ({ id: r.id, rank: i + 1 })),
        byText.map((r, i) => ({ id: r.id, rank: i + 1 })),
      ]).slice(0, limit);
      if (fused.length === 0) return [];
      const ids = fused.map((f) => f.id);
      const rows = await db
        .select({
          chunkId: schema.chunks.id,
          noteId: schema.chunks.noteId,
          content: schema.chunks.content,
          title: schema.notes.title,
        })
        .from(schema.chunks)
        .innerJoin(schema.notes, sql`${schema.notes.id} = ${schema.chunks.noteId}`)
        .where(sql`${schema.chunks.id} in ${ids}`);
      const byId = new Map(rows.map((r) => [r.chunkId, r]));
      return fused.flatMap(({ id, score }) => {
        const r = byId.get(id);
        return r
          ? [{ noteId: r.noteId, chunkId: r.chunkId, title: r.title, content: r.content, score }]
          : [];
      });
    },

    async close() {
      await client.end({ timeout: 5 });
    },
  };
}
