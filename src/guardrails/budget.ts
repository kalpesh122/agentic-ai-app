import { estimateCost, normaliseUsage } from '../llm/cost.ts';

export class BudgetExceededError extends Error {
  readonly code = 'budget_exceeded';
}

interface StepLike {
  usage: unknown;
}

/**
 * Per-request spend control. `stop(steps)` is an AI SDK `stopWhen` condition that ends the tool loop
 * the moment accumulated cost passes the cap; `assert(steps)` re-checks after the run and throws so
 * the HTTP layer can answer 402. Costs come from the model registry prices.
 */
export class BudgetTracker {
  error: BudgetExceededError | undefined;
  readonly controller = new AbortController();
  private readonly model: string;
  private readonly maxUsd: number;

  constructor(model: string, maxUsd: number) {
    this.model = model;
    this.maxUsd = maxUsd;
  }

  costOf(steps: readonly StepLike[]): { usd: number; inputTokens: number; outputTokens: number } {
    let usd = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    for (const step of steps) {
      const t = normaliseUsage(step.usage);
      inputTokens += t.inputTokens;
      outputTokens += t.outputTokens;
      usd += estimateCost(this.model, step.usage).usd;
    }
    return { usd: Math.round(usd * 1e6) / 1e6, inputTokens, outputTokens };
  }

  /** stopWhen condition: true once the cap is exceeded (also records the error and aborts). */
  stop = ({ steps }: { steps: readonly StepLike[] }): boolean => {
    const { usd } = this.costOf(steps);
    if (usd > this.maxUsd) {
      this.error ??= new BudgetExceededError(
        `Request cost $${usd.toFixed(4)} exceeds the cap of $${this.maxUsd}`,
      );
      this.controller.abort(this.error);
      return true;
    }
    return false;
  };

  /** Throws BudgetExceededError if the finished run went over the cap. */
  assert(steps: readonly StepLike[]): void {
    this.stop({ steps });
    if (this.error) throw this.error;
  }
}
