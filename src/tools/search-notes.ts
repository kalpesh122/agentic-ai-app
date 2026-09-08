import { z } from 'zod';
import { defineTool } from './types.ts';

export const searchNotes = defineTool({
  name: 'search_notes',
  description:
    'Semantic + keyword search over the saved notes (long-term memory). Use it before answering questions about anything the user may have saved earlier. Returns the most relevant chunks with their note ids.',
  inputSchema: z.object({
    query: z.string().min(1).max(500).describe('What to look for'),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  destructive: false,
  untrustedOutput: true,
  async execute({ query, limit }, { memory }) {
    const hits = await memory.search(query, limit);
    return { hits };
  },
});
