import type { z } from 'zod';

export class OutputRejectedError extends Error {
  readonly code = 'output_rejected';
}

/** Validate a model's structured output against the contract before it leaves the service. */
export function checkOutput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new OutputRejectedError(
      `Model output failed validation: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    );
  }
  return parsed.data;
}
