import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { testEnv } from './env.ts';
import { jsonModel, memoryStub, silentLog, textModel } from './mocks.ts';

const build = (model: Parameters<typeof createApp>[0]['model']) =>
  createApp({ env: testEnv, log: silentLog, model, memory: memoryStub(), telemetry: false });

const post = (app: ReturnType<typeof createApp>, path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

// biome-ignore lint/suspicious/noExplicitAny: response bodies in tests
const json = async (res: Response): Promise<any> => res.json();

describe('platform routes', () => {
  it('health and models', async () => {
    const app = build(textModel([{ text: 'hi' }]));
    expect((await json(await app.request('/health'))).status).toBe('ok');
    const models = await json(await app.request('/models'));
    expect(models.default).toBe('anthropic/claude-sonnet-5');
    expect(models.models.length).toBeGreaterThan(3);
  });
});

describe('POST /agent/run', () => {
  it('runs a tool loop and reports usage + cost', async () => {
    const app = build(
      textModel([
        { toolCall: { name: 'get_time', input: { timeZone: 'UTC' } } },
        { text: 'It is now.' },
      ]),
    );
    const res = await post(app, '/agent/run', { prompt: 'What time is it?' });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.text).toBe('It is now.');
    expect(body.steps).toBe(2);
    expect(body.toolCalls).toEqual([{ tool: 'get_time', args: { timeZone: 'UTC' } }]);
    expect(body.usage).toEqual({ inputTokens: 200, outputTokens: 40 });
    expect(body.costUsd).toBeCloseTo(0.0008, 6);
  });
  it('surfaces approval_required for destructive tools', async () => {
    const app = build(
      textModel([
        { toolCall: { name: 'save_note', input: { title: 'a', content: 'b', tags: [] } } },
        { text: 'Need approval.' },
      ]),
    );
    const body = await json(await post(app, '/agent/run', { prompt: 'remember a' }));
    expect(body.approvalRequired).toEqual([
      { tool: 'save_note', args: { title: 'a', content: 'b', tags: [] } },
    ]);
  });
  it('rejects empty and oversized prompts with 422', async () => {
    const app = build(textModel([{ text: 'x' }]));
    expect((await post(app, '/agent/run', { prompt: '   ' })).status).toBe(422);
    expect((await post(app, '/agent/run', {})).status).toBe(422);
    expect(
      (await post(app, '/agent/run', { prompt: 'x'.repeat(testEnv.MAX_INPUT_CHARS + 1) })).status,
    ).toBe(422);
  });
  it('stops with 402 when the cost cap is exceeded', async () => {
    const app = createApp({
      env: { ...testEnv, MAX_COST_USD: 0.0001 },
      log: silentLog,
      model: textModel([{ text: 'expensive' }]),
      memory: memoryStub(),
      telemetry: false,
    });
    const res = await post(app, '/agent/run', { prompt: 'hi' });
    expect(res.status).toBe(402);
    expect((await json(res)).error.code).toBe('budget_exceeded');
  });
});

describe('POST /chat', () => {
  it('streams a UI message stream', async () => {
    const app = build(textModel([{ text: 'streamed reply' }]));
    const res = await post(app, '/chat', {
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const text = await res.text();
    expect(text).toContain('streamed');
    expect(text).toContain('"type":"finish"');
  });
});

describe('POST /extract/contact', () => {
  it('returns validated structured output', async () => {
    const app = build(
      jsonModel({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: null,
        company: 'Analytical Engines',
        confidence: 0.9,
      }),
    );
    const res = await post(app, '/extract/contact', {
      text: 'Ada Lovelace <ada@example.com>, Analytical Engines',
    });
    expect(res.status).toBe(200);
    expect((await json(res)).name).toBe('Ada Lovelace');
  });
  it('rejects model output that violates the contract', async () => {
    const app = build(jsonModel({ name: '', email: 'not-an-email', confidence: 3 }));
    const res = await post(app, '/extract/contact', { text: 'garbage' });
    expect(res.status).toBe(500);
    expect((await json(res)).error.code).toBe('output_rejected');
  });
});
