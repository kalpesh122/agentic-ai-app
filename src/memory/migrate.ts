import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadEnv } from '../env.ts';

const env = loadEnv({ ...process.env, AI_TEST_MODE: process.env.AI_TEST_MODE ?? '1' });
const client = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
await client`create extension if not exists vector`;
await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
await client.end();
process.stdout.write('migrations applied\n');
