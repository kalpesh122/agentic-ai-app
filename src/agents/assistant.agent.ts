import {
  type LanguageModel,
  type ModelMessage,
  stepCountIs,
  ToolLoopAgent,
  type ToolSet,
} from 'ai';
import { BudgetTracker } from '../guardrails/budget.ts';
import { loadPrompt } from '../prompts/load.ts';

export interface AssistantOptions {
  model: LanguageModel;
  modelId: string;
  tools: ToolSet;
  maxSteps: number;
  maxCostUsd: number;
  telemetry: boolean;
  instructions?: string;
}

export interface RunResult {
  text: string;
  steps: number;
  toolCalls: Array<{ tool: string; args: unknown }>;
  approvalRequired: Array<{ tool: string; args: unknown }>;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
  finishReason: string;
}

/** Builds the tool-loop agent plus a per-request budget tracker wired in as a stop condition. */
export function createAssistant(opts: AssistantOptions) {
  const budget = new BudgetTracker(opts.modelId, opts.maxCostUsd);
  const agent = new ToolLoopAgent({
    id: 'assistant',
    model: opts.model,
    instructions: opts.instructions ?? loadPrompt('assistant'),
    tools: opts.tools,
    stopWhen: [stepCountIs(opts.maxSteps), budget.stop],
    experimental_telemetry: { isEnabled: opts.telemetry, functionId: 'assistant' },
  });
  return { agent, budget };
}

/** One-shot run returning a compact, JSON-friendly summary (used by POST /agent/run and the evals). */
export async function runAssistant(
  opts: AssistantOptions,
  input: { prompt?: string; messages?: ModelMessage[] },
): Promise<RunResult> {
  const { agent, budget } = createAssistant(opts);
  const result = await agent.generate({
    ...(input.messages ? { messages: input.messages } : { prompt: input.prompt ?? '' }),
  });
  budget.assert(result.steps);
  const toolCalls: RunResult['toolCalls'] = [];
  const approvalRequired: RunResult['approvalRequired'] = [];
  for (const step of result.steps) {
    for (const call of step.toolCalls) toolCalls.push({ tool: call.toolName, args: call.input });
    for (const tr of step.toolResults) {
      const out = tr.output as { status?: string; args?: unknown } | undefined;
      if (out?.status === 'approval_required')
        approvalRequired.push({ tool: tr.toolName, args: out.args });
    }
  }
  const cost = budget.costOf(result.steps);
  return {
    text: result.text,
    steps: result.steps.length,
    toolCalls,
    approvalRequired,
    usage: { inputTokens: cost.inputTokens, outputTokens: cost.outputTokens },
    costUsd: cost.usd,
    finishReason: String(result.finishReason),
  };
}
