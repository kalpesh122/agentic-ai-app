import { readFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname);

/** Prompts are markdown files versioned in git; changing one should come with an eval case. */
export function loadPrompt(name: string): string {
  return readFileSync(path.join(dir, `${name}.md`), 'utf8').trim();
}
