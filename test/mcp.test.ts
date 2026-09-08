import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createMcpServer } from '../src/mcp/server.ts';
import { memoryStub, silentLog } from './mocks.ts';

async function connect(approved: boolean) {
  const server = createMcpServer({
    memory: memoryStub(),
    log: silentLog,
    httpAllowedHosts: [],
    approved,
  });
  const client = new Client({ name: 't', version: '0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}

describe('MCP exposure of the tool registry', () => {
  it('lists every tool with schema and annotations', async () => {
    const client = await connect(false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_time',
      'http_fetch',
      'save_note',
      'search_notes',
    ]);
    const save = tools.find((t) => t.name === 'save_note');
    if (!save) throw new Error('save_note missing');
    expect(save.annotations?.destructiveHint).toBe(true);
    const schema = save.inputSchema as { required?: string[] };
    expect(schema.required).toEqual(expect.arrayContaining(['title', 'content']));
  });
  it('gates destructive tools and runs read-only ones', async () => {
    const client = await connect(false);
    const blocked = await client.callTool({
      name: 'save_note',
      arguments: { title: 'a', content: 'b' },
    });
    expect(blocked.isError).toBe(true);
    const time = await client.callTool({ name: 'get_time', arguments: {} });
    expect(time.isError).toBeFalsy();
    const first = (time.content as Array<{ text: string }>)[0];
    expect(JSON.parse(first?.text ?? '{}').timeZone).toBe('UTC');
  });
});
