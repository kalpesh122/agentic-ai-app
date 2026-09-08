// promptfoo custom provider: runs the compiled assistant so evals exercise tools and guardrails.
// Build first (`just build`); provider keys come from .env.
export default class AgentProvider {
  id() {
    return 'assistant';
  }
  async callApi(prompt) {
    const [
      { loadEnv },
      { resolveLanguageModel },
      { runAssistant },
      { createToolset },
      { allTools },
      pino,
    ] = await Promise.all([
      import('../dist/env.js'),
      import('../dist/llm/provider.js'),
      import('../dist/agents/assistant.agent.js'),
      import('../dist/tools/registry.js'),
      import('../dist/tools/index.js'),
      import('pino'),
    ]);
    const env = loadEnv();
    const log = pino.default({ level: 'silent' });
    const memory = {
      add: async () => ({ id: 'eval-note', chunks: 1 }),
      search: async () => [],
      close: async () => {},
    };
    const tools = createToolset(allTools, env.ALLOWED_TOOLS, {
      memory,
      log,
      httpAllowedHosts: env.HTTP_FETCH_ALLOWED_HOSTS,
      approved: false,
    });
    const result = await runAssistant(
      {
        model: resolveLanguageModel(env.AI_MODEL, env),
        modelId: env.AI_MODEL,
        tools,
        maxSteps: env.MAX_STEPS,
        maxCostUsd: env.MAX_COST_USD,
        telemetry: false,
      },
      { prompt },
    );
    return {
      output: result.text,
      tokenUsage: {
        prompt: result.usage.inputTokens,
        completion: result.usage.outputTokens,
        total: result.usage.inputTokens + result.usage.outputTokens,
      },
      cost: result.costUsd,
      metadata: {
        toolCalls: result.toolCalls,
        approvalRequired: result.approvalRequired,
        steps: result.steps,
      },
    };
  }
}
