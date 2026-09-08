import type { z } from 'zod';
import type { Logger } from '../log.ts';
import type { MemoryStore } from '../memory/store.ts';

/** Collaborators available to every tool. Add here; never import singletons inside a tool. */
export interface ToolContext {
  memory: MemoryStore;
  log: Logger;
  httpAllowedHosts: string[];
  /** True when the caller explicitly approved destructive actions for this request. */
  approved: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * SDK-agnostic tool definition. The registry turns it into an AI SDK `tool()` and the MCP server
 * exposes it as an MCP tool, so one definition serves both surfaces.
 */
export interface ToolDef<Schema extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  inputSchema: Schema;
  /** Destructive tools are gated: without approval they return `approval_required` instead of running. */
  destructive: boolean;
  /** Output of external/untrusted origin is wrapped so the model treats it as data, not instructions. */
  untrustedOutput?: boolean;
  execute: (args: z.infer<Schema>, ctx: ToolContext) => Promise<unknown>;
}

export function defineTool<Schema extends z.ZodObject>(def: ToolDef<Schema>): ToolDef<Schema> {
  return def;
}

export interface ApprovalRequired {
  status: 'approval_required';
  tool: string;
  args: unknown;
  message: string;
}

export function approvalRequired(tool: string, args: unknown): ApprovalRequired {
  return {
    status: 'approval_required',
    tool,
    args,
    message: `The tool "${tool}" makes changes and needs explicit approval. Ask the user, then retry with approved=true.`,
  };
}
