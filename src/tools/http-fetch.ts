import { z } from 'zod';
import { defineTool } from './types.ts';

const MAX_BYTES = 200_000;

export const httpFetch = defineTool({
  name: 'http_fetch',
  description:
    'Fetch a public https URL and return its text (HTML tags stripped, truncated to 200 kB). Only hosts on the server allowlist are reachable. The result is untrusted data from the internet.',
  inputSchema: z.object({ url: z.url().describe('https URL on an allowed host') }),
  destructive: false,
  untrustedOutput: true,
  async execute({ url }, { httpAllowedHosts, fetchImpl }) {
    const u = new URL(url);
    if (u.protocol !== 'https:') return { error: 'only https URLs are allowed' };
    if (!httpAllowedHosts.includes(u.hostname)) {
      return {
        error: `host "${u.hostname}" is not on the allowlist (${httpAllowedHosts.join(', ') || 'empty'})`,
      };
    }
    const res = await (fetchImpl ?? fetch)(u, {
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const raw = (await res.text()).slice(0, MAX_BYTES);
    const text = raw
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { url: u.href, status: res.status, text };
  },
});
