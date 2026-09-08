import { z } from 'zod';
import { defineTool } from './types.ts';

export const saveNote = defineTool({
  name: 'save_note',
  description:
    'Save a note to long-term memory so it can be found later with search_notes. Use only when the user asks to remember something. Needs approval.',
  inputSchema: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(20_000).describe('Markdown or plain text'),
    tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  }),
  destructive: true,
  async execute(input, { memory }) {
    const note = await memory.add(input);
    return { id: note.id, chunks: note.chunks };
  },
});
