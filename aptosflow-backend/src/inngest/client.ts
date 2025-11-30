import { Inngest } from 'inngest';
import { config } from '@/config/index.js';

export const inngest = new Inngest({
  id: 'aptosflow-ai-agent',
  eventKey: config.inngestEventKey,
});

// Event types for type safety
export type Events = {
  'prompt/submitted': {
    data: {
      promptId: string;
      userId: string;
      promptText: string;
    };
  };
  'workflow/generated': {
    data: {
      promptId: string;
      workflowId: string;
    };
  };
  'workflow/failed': {
    data: {
      promptId: string;
      error: string;
    };
  };
};
