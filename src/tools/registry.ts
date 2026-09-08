import { type ToolSet, tool } from 'ai';
import { wrapUntrusted } from '../guardrails/untrusted.ts';
import type { ToolContext, ToolDef } from './types.ts';
import { approvalRequired } from './types.ts';

/**
 * Builds the AI SDK toolset for one request: allowlist filtering, approval gating for destructive
 * tools, untrusted-output wrapping, and per-call logging. Tool definitions stay pure.
 */
export function createToolset(defs: ToolDef[], allowed: string[], ctx: ToolContext): ToolSet {
  const set: ToolSet = {};
  for (const def of defs) {
    if (!allowed.includes(def.name)) continue;
    set[def.name] = tool({
      description: def.description,
      inputSchema: def.inputSchema,
      execute: async (args: unknown) => {
        if (def.destructive && !ctx.approved) {
          ctx.log.info({ tool: def.name }, 'destructive tool blocked pending approval');
          return approvalRequired(def.name, args);
        }
        const started = performance.now();
        try {
          const result = await def.execute(args as never, ctx);
          ctx.log.debug({ tool: def.name, ms: Math.round(performance.now() - started) }, 'tool ok');
          return def.untrustedOutput ? wrapUntrusted(def.name, result) : result;
        } catch (err) {
          ctx.log.warn({ tool: def.name, err }, 'tool failed');
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }
  return set;
}
