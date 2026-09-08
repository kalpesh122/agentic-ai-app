import { loadEnv } from '../src/env.ts';

export const testEnv = loadEnv({
  AI_TEST_MODE: '1',
  AI_MODEL: 'anthropic/claude-sonnet-5',
  ALLOWED_TOOLS: 'get_time,search_notes,save_note,http_fetch',
  HTTP_FETCH_ALLOWED_HOSTS: 'example.com',
  MAX_COST_USD: '0.05',
  LOG_LEVEL: 'silent',
});
