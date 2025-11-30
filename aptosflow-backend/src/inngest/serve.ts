import { serve } from 'inngest/express';
import { inngest } from './client.js';
import { processPrompt } from './functions/process-prompt.js';
import { config } from '@/config/index.js';

export const inngestServe = serve({
  client: inngest,
  functions: [processPrompt],
  signingKey: config.inngestSigningKey,
});
