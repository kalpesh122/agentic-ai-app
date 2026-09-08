import { z } from 'zod';
import { defineTool } from './types.ts';

export const getTime = defineTool({
  name: 'get_time',
  description:
    'Get the current date and time in ISO 8601. Optionally convert to an IANA time zone such as "Asia/Kolkata".',
  inputSchema: z.object({
    timeZone: z.string().optional().describe('IANA time zone; defaults to UTC'),
  }),
  destructive: false,
  async execute({ timeZone }) {
    const now = new Date();
    const zone = timeZone ?? 'UTC';
    const local = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: zone,
    }).format(now);
    return { iso: now.toISOString(), timeZone: zone, local };
  },
});
