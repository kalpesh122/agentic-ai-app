import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadEnv } from './env.ts';
import { resolveEmbeddingModel, resolveLanguageModel } from './llm/provider.ts';
import { createLogger } from './log.ts';
import { createEmbedder } from './memory/embed.ts';
import { createMemoryStore } from './memory/store.ts';
import { startTelemetry } from './telemetry/otel.ts';

const env = loadEnv();
const log = createLogger(env.LOG_LEVEL, env.NODE_ENV === 'development');
const telemetry = await startTelemetry(env);
const model = resolveLanguageModel(env.AI_MODEL, env);
const memory = createMemoryStore(
  env.DATABASE_URL,
  createEmbedder(resolveEmbeddingModel(env.AI_EMBEDDING_MODEL, env)),
);
const app = createApp({ env, log, model, memory, telemetry: telemetry.enabled });

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  log.info(
    {
      port: info.port,
      model: env.AI_MODEL,
      tools: env.ALLOWED_TOOLS,
      telemetry: telemetry.enabled,
    },
    'listening',
  );
});

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log.info({ signal }, 'shutting down');
  setTimeout(() => process.exit(1), 10_000).unref();
  await new Promise<void>((r) => server.close(() => r()));
  await memory.close();
  await telemetry.shutdown();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
