import { z } from 'zod';

const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default('info'),
    AI_MODEL: z
      .string()
      .regex(/^[a-z]+\/[a-z0-9.-]+$/i, 'expected provider/model-id')
      .default('anthropic/claude-sonnet-5'),
    AI_EMBEDDING_MODEL: z
      .string()
      .regex(/^[a-z]+\/[a-z0-9.-]+$/i)
      .default('openai/text-embedding-3-small'),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    DEEPSEEK_API_KEY: z.string().optional(),
    AI_GATEWAY_API_KEY: z.string().optional(),
    MAX_INPUT_CHARS: z.coerce.number().int().positive().default(20_000),
    MAX_STEPS: z.coerce.number().int().min(1).max(50).default(8),
    MAX_COST_USD: z.coerce.number().positive().default(0.5),
    ALLOWED_TOOLS: z.string().default('get_time,search_notes,save_note,http_fetch').transform(list),
    HTTP_FETCH_ALLOWED_HOSTS: z.string().default('').transform(list),
    DATABASE_URL: z
      .url({ protocol: /^postgres(ql)?$/ })
      .default('postgres://app:app@localhost:5436/app'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
    LANGFUSE_PUBLIC_KEY: z.string().optional(),
    LANGFUSE_SECRET_KEY: z.string().optional(),
    LANGFUSE_BASE_URL: z.string().optional(),
    AI_TEST_MODE: z.string().optional(),
  })
  .transform((e) => ({
    ...e,
    ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY || undefined,
    OPENAI_API_KEY: e.OPENAI_API_KEY || undefined,
    GOOGLE_GENERATIVE_AI_API_KEY: e.GOOGLE_GENERATIVE_AI_API_KEY || undefined,
    DEEPSEEK_API_KEY: e.DEEPSEEK_API_KEY || undefined,
    AI_GATEWAY_API_KEY: e.AI_GATEWAY_API_KEY || undefined,
    OTEL_EXPORTER_OTLP_ENDPOINT: e.OTEL_EXPORTER_OTLP_ENDPOINT || undefined,
    LANGFUSE_PUBLIC_KEY: e.LANGFUSE_PUBLIC_KEY || undefined,
    LANGFUSE_SECRET_KEY: e.LANGFUSE_SECRET_KEY || undefined,
  }));

export type Env = z.infer<typeof schema>;

/** Parse configuration; throws one readable error listing every problem. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new Error(`Invalid environment:\n${lines.join('\n')}\nSee .env.example.`);
  }
  const env = result.data;
  const provider = env.AI_MODEL.split('/')[0];
  const hasKey =
    env.AI_GATEWAY_API_KEY ||
    (provider === 'anthropic' && env.ANTHROPIC_API_KEY) ||
    (provider === 'openai' && env.OPENAI_API_KEY) ||
    (provider === 'google' && env.GOOGLE_GENERATIVE_AI_API_KEY) ||
    (provider === 'deepseek' && env.DEEPSEEK_API_KEY);
  if (!hasKey && !env.AI_TEST_MODE) {
    throw new Error(
      `AI_MODEL=${env.AI_MODEL} but no API key for "${provider}" is set (or AI_GATEWAY_API_KEY). See .env.example.`,
    );
  }
  return env;
}
