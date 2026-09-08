import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Logger } from '../log.ts';
import type { MemoryStore } from '../memory/store.ts';
import { allTools } from '../tools/index.ts';
import type { ToolContext, ToolDef } from '../tools/types.ts';
import { approvalRequired } from '../tools/types.ts';

/**
 * Exposes the same tool registry over MCP so Claude Code, Cursor, or Claude Desktop can use the
 * app's tools directly. Destructive tools stay gated behind MCP_APPROVED=true.
 */
export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: 'agentic-ai-app', version: '0.1.0' });
  for (const def of allTools as ToolDef[]) {
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.inputSchema.shape,
        annotations: {
          readOnlyHint: !def.destructive,
          destructiveHint: def.destructive,
          openWorldHint: def.name === 'http_fetch',
        },
      },
      async (args: unknown) => {
        if (def.destructive && !ctx.approved) {
          return {
            content: [{ type: 'text', text: JSON.stringify(approvalRequired(def.name, args)) }],
            isError: true,
          };
        }
        try {
          const result = await def.execute(args as never, ctx);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return {
            content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
            isError: true,
          };
        }
      },
    );
  }
  return server;
}

export async function serveMcpStdio(
  memory: MemoryStore,
  log: Logger,
  allowedHosts: string[],
  approved: boolean,
): Promise<void> {
  const server = createMcpServer({ memory, log, httpAllowedHosts: allowedHosts, approved });
  await server.connect(new StdioServerTransport());
  log.info('mcp stdio transport connected');
}

// Entry point when run directly: `pnpm mcp` / `just mcp`.
if (import.meta.main) {
  const [
    { loadEnv },
    { createLogger },
    { resolveEmbeddingModel },
    { createEmbedder },
    { createMemoryStore },
    pino,
  ] = await Promise.all([
    import('../env.ts'),
    import('../log.ts'),
    import('../llm/provider.ts'),
    import('../memory/embed.ts'),
    import('../memory/store.ts'),
    import('pino'),
  ]);
  const env = loadEnv();
  // stdout is the protocol channel: log to stderr only.
  const log = createLogger(env.LOG_LEVEL, false);
  log.level = 'silent';
  const stderrLog = pino.default({ level: env.LOG_LEVEL }, pino.destination(2));
  const memory = createMemoryStore(
    env.DATABASE_URL,
    createEmbedder(resolveEmbeddingModel(env.AI_EMBEDDING_MODEL, env)),
  );
  await serveMcpStdio(
    memory,
    stderrLog,
    env.HTTP_FETCH_ALLOWED_HOSTS,
    process.env.MCP_APPROVED === 'true',
  );
}
