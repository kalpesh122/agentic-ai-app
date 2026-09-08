import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import { checkOutput } from '../guardrails/output.ts';

export const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type Contact = z.infer<typeof ContactSchema>;

/**
 * Structured output with the AI SDK v7 `Output.object` API (replaces the removed generateObject),
 * then re-validated by our own guardrail before it leaves the service.
 */
export async function extractContact(model: LanguageModel, text: string): Promise<Contact> {
  const result = await generateText({
    model,
    output: Output.object({
      schema: ContactSchema,
      name: 'contact',
      description: 'A contact card extracted from text',
    }),
    prompt: `Extract the contact details from the text below. Use null for anything not present. Set confidence between 0 and 1.\n\n<text>\n${text}\n</text>`,
  });
  return checkOutput(ContactSchema, result.output);
}
