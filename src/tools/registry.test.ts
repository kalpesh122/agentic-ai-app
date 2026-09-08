import { describe, expect, it } from 'vitest';
import { memoryStub, silentLog } from '../../test/mocks.ts';
import { allTools } from './index.ts';
import { createToolset } from './registry.ts';
import type { ToolContext } from './types.ts';

const ctx = (approved: boolean, fetchImpl?: typeof fetch): ToolContext => ({
  memory: memoryStub(),
  log: silentLog,
  httpAllowedHosts: ['example.com'],
  approved,
  ...(fetchImpl ? { fetchImpl } : {}),
});

const exec = async (set: ReturnType<typeof createToolset>, name: string, args: unknown) => {
  const t = set[name];
  if (!t?.execute) throw new Error(`tool ${name} missing`);
  return t.execute(args as never, { toolCallId: 'c1', messages: [] } as never);
};

describe('tool registry', () => {
  it('only exposes allowlisted tools', () => {
    const set = createToolset(allTools, ['get_time'], ctx(false));
    expect(Object.keys(set)).toEqual(['get_time']);
  });
  it('gates destructive tools behind approval', async () => {
    const c = ctx(false);
    const set = createToolset(allTools, ['save_note'], c);
    const blocked = await exec(set, 'save_note', { title: 't', content: 'c', tags: [] });
    expect(blocked).toMatchObject({ status: 'approval_required', tool: 'save_note' });
    await expect(c.memory.search('c', 5)).resolves.toEqual([]);

    const allowed = createToolset(allTools, ['save_note'], ctx(true));
    const saved = await exec(allowed, 'save_note', { title: 't', content: 'c', tags: [] });
    expect(saved).toEqual({ id: 'note-1', chunks: 1 });
  });
  it('wraps untrusted output and enforces the http allowlist', async () => {
    const fetchImpl = (async () =>
      new Response(
        '<html><body><h1>Hi</h1><script>x()</script></body></html>',
      )) as unknown as typeof fetch;
    const set = createToolset(allTools, ['http_fetch'], ctx(false, fetchImpl));
    const ok = (await exec(set, 'http_fetch', { url: 'https://example.com/page' })) as {
      untrusted: boolean;
      data: { text: string };
    };
    expect(ok.untrusted).toBe(true);
    expect(ok.data.text).toBe('Hi');
    const denied = (await exec(set, 'http_fetch', { url: 'https://evil.com/x' })) as {
      data: { error: string };
    };
    expect(denied.data.error).toMatch(/allowlist/);
  });
  it('turns thrown errors into error results', async () => {
    const c = ctx(true);
    c.memory.add = async () => {
      throw new Error('db down');
    };
    const set = createToolset(allTools, ['save_note'], c);
    expect(await exec(set, 'save_note', { title: 't', content: 'c', tags: [] })).toEqual({
      error: 'db down',
    });
  });
});
