import {
  convertToModelMessages,
  type LanguageModel,
  type ModelMessage,
  NoObjectGeneratedError,
  type UIMessage,
} from 'ai';
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { createAssistant, runAssistant } from './agents/assistant.agent.ts';
import type { Env } from './env.ts';
import { BudgetExceededError } from './guardrails/budget.ts';
import { checkInput, InputRejectedError } from './guardrails/input.ts';
import { OutputRejectedError } from './guardrails/output.ts';
import { extractContact } from './http/extract.ts';
import { MODELS } from './llm/models.ts';
import type { Logger } from './log.ts';
import type { MemoryStore } from './memory/store.ts';
import { allTools } from './tools/index.ts';
import { createToolset } from './tools/registry.ts';

export interface AppDeps {
  env: Env;
  log: Logger;
  model: LanguageModel;
  memory: MemoryStore;
  telemetry: boolean;
  fetchImpl?: typeof fetch;
}

type Vars = { Variables: { requestId: string; log: Logger } };

const RunBody = z.object({
  prompt: z.string().min(1),
  approved: z.boolean().default(false),
  tools: z.array(z.string()).optional(),
});
const ChatBody = z.object({
  messages: z.array(z.custom<UIMessage>()).min(1),
  approved: z.boolean().default(false),
});
const ExtractBody = z.object({ text: z.string().min(1) });

/** Assembles the HTTP app from injected dependencies (tests pass a mock model and an in-memory store). */
export function createApp(deps: AppDeps) {
  const app = new Hono<Vars>();
  app.use('*', requestId());
  app.use('*', secureHeaders());
  app.use('*', async (c, next) => {
    const log = deps.log.child({ requestId: c.get('requestId') });
    c.set('log', log);
    const start = performance.now();
    await next();
    log.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - start),
      },
      'request',
    );
  });

  app.get('/health', (c) =>
    c.json({ status: 'ok', model: deps.env.AI_MODEL, telemetry: deps.telemetry }),
  );
  app.get('/models', (c) => c.json({ default: deps.env.AI_MODEL, models: MODELS }));

  const assistantOptions = (approved: boolean, log: Logger, allowed?: string[]) => ({
    model: deps.model,
    modelId: deps.env.AI_MODEL,
    tools: createToolset(allTools, allowed ?? deps.env.ALLOWED_TOOLS, {
      memory: deps.memory,
      log,
      httpAllowedHosts: deps.env.HTTP_FETCH_ALLOWED_HOSTS,
      approved,
      ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
    }),
    maxSteps: deps.env.MAX_STEPS,
    maxCostUsd: deps.env.MAX_COST_USD,
    telemetry: deps.telemetry,
  });

  /** One-shot agent run: returns text, tool calls, pending approvals, usage and cost. */
  app.post('/agent/run', async (c) => {
    const body = RunBody.parse(await c.req.json());
    const prompt = checkInput(body.prompt, deps.env.MAX_INPUT_CHARS);
    const allowed = body.tools?.filter((t) => deps.env.ALLOWED_TOOLS.includes(t));
    const result = await runAssistant(assistantOptions(body.approved, c.get('log'), allowed), {
      prompt,
    });
    return c.json(result);
  });

  /** Streaming chat for UI clients (AI SDK UI message stream protocol). */
  app.post('/chat', async (c) => {
    const body = ChatBody.parse(await c.req.json());
    const last = body.messages.at(-1);
    const lastText =
      last?.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { text: string }).text)
        .join('') ?? '';
    checkInput(lastText, deps.env.MAX_INPUT_CHARS);
    // The budget is a stopWhen condition on the agent, so the stream ends when the cap is reached.
    const { agent } = createAssistant(assistantOptions(body.approved, c.get('log')));
    const messages: ModelMessage[] = await convertToModelMessages(body.messages);
    const result = await agent.stream({ messages });
    return result.toUIMessageStreamResponse();
  });

  /** Structured output: extract a contact card from free text, validated by zod on both sides. */
  app.post('/extract/contact', async (c) => {
    const body = ExtractBody.parse(await c.req.json());
    const text = checkInput(body.text, deps.env.MAX_INPUT_CHARS);
    return c.json(await extractContact(deps.model, text));
  });

  app.onError((err, c) => {
    const rid = c.get('requestId');
    const respond = (status: 400 | 402 | 422 | 500, code: string, message: string) =>
      c.json({ error: { code, message, requestId: rid } }, status);
    if (err instanceof z.ZodError) return respond(422, 'validation_error', z.prettifyError(err));
    if (err instanceof InputRejectedError) return respond(422, err.code, err.message);
    if (err instanceof OutputRejectedError) return respond(500, err.code, err.message);
    if (NoObjectGeneratedError.isInstance(err))
      return respond(
        500,
        'output_rejected',
        `Model output did not match the schema: ${err.message}`,
      );
    if (err instanceof BudgetExceededError) return respond(402, err.code, err.message);
    c.get('log').error({ err }, 'unhandled error');
    return respond(500, 'internal_error', 'Internal server error');
  });
  return app;
}

export type App = ReturnType<typeof createApp>;
