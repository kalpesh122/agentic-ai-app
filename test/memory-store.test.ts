import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMemoryStore, type MemoryStore } from '../src/memory/store.ts';
import { fakeEmbedder } from './mocks.ts';

const url = process.env.TEST_DATABASE_URL;

/** Runs only against a real pgvector Postgres (CI service container or `just test-db`). */
describe.skipIf(!url)('pgvector memory store', () => {
  let store: MemoryStore;
  beforeAll(async () => {
    const client = postgres(url as string, { max: 1, onnotice: () => {} });
    await client`create extension if not exists vector`;
    await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
    await client`truncate table note_chunks, notes`;
    await client.end();
    store = createMemoryStore(url as string, fakeEmbedder);
  });
  afterAll(async () => {
    await store?.close();
  });

  it('adds notes as chunks and retrieves them with hybrid search', async () => {
    const a = await store.add({
      title: 'Coffee',
      content: 'The espresso machine needs descaling every 200 shots.',
      tags: ['kitchen'],
    });
    await store.add({
      title: 'Servers',
      content: 'Rotate the TLS certificates before they expire in March.',
    });
    expect(a.chunks).toBe(1);
    const hits = await store.search('espresso descaling', 3);
    expect(hits[0]?.noteId).toBe(a.id);
    expect(hits[0]?.title).toBe('Coffee');
    expect(Array.isArray(await store.search('zzzz-nothing-matches-qqq', 3))).toBe(true);
  });
});
