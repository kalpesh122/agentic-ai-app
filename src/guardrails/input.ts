export class InputRejectedError extends Error {
  readonly code = 'input_rejected';
}

const KEEP = new Set(['\n', '\r', '\t']);

/** Cheap, deterministic input checks that run before any model call: strip control characters, enforce size. */
export function checkInput(text: string, maxChars: number): string {
  // \p{Cc} = Unicode control characters; keep the whitespace ones that carry meaning.
  const cleaned = text.replace(/\p{Cc}/gu, (c) => (KEEP.has(c) ? c : '')).trim();
  if (cleaned.length === 0) throw new InputRejectedError('Input is empty');
  if (cleaned.length > maxChars)
    throw new InputRejectedError(`Input is ${cleaned.length} characters; the limit is ${maxChars}`);
  return cleaned;
}
