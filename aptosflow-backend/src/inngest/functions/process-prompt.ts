import { inngest } from '../client.js';
import { aiService } from '@/services/ai.service.js';
import prisma from '@/utils/prisma.js';

export const processPrompt = inngest.createFunction(
  {
    id: 'process-prompt',
    name: 'Process AI Prompt and Generate Workflow',
    retries: 3,
  },
  { event: 'prompt/submitted' },
  async ({ event, step }) => {
    const { promptId, promptText } = event.data;

    // Step 1: Update prompt status to PROCESSING
    await step.run('update-status-processing', async () => {
      await prisma.prompt.update({
        where: { id: promptId },
        data: { status: 'PROCESSING' },
      });
    });

    // Step 2: Generate workflow using AI
    const workflowResult = await step.run('generate-workflow', async () => {
      return await aiService.generateWorkflow(promptText);
    });

    if (!workflowResult.success || !workflowResult.workflow) {
      // Step 3a: Handle failure
      await step.run('update-status-failed', async () => {
        await prisma.prompt.update({
          where: { id: promptId },
          data: {
            status: 'FAILED',
            errorMessage: workflowResult.error || 'Failed to generate workflow',
            completedAt: new Date(),
          },
        });
      });

      // Send failure event
      await step.sendEvent('send-failure-event', {
        name: 'workflow/failed',
        data: {
          promptId,
          error: workflowResult.error || 'Unknown error',
        },
      });

      return { success: false, error: workflowResult.error };
    }

    // Step 3b: Store workflow in database
    const workflow = await step.run('store-workflow', async () => {
      return await prisma.$transaction(async () => {
        // Update prompt with workflow JSON
        await prisma.prompt.update({
          where: { id: promptId },
          data: {
            status: 'COMPLETED',
            workflowJson: workflowResult.workflow as any,
            completedAt: new Date(),
          },
        });

        // Create workflow record
        const workflow = await prisma.workflow.create({
          data: {
            promptId,
            workflowData: workflowResult.workflow as any,
            executionStatus: 'DRAFT',
          },
        });

        return workflow;
      });
    });

    // Step 4: Send success event
    await step.sendEvent('send-success-event', {
      name: 'workflow/generated',
      data: {
        promptId,
        workflowId: workflow.id,
      },
    });

    return {
      success: true,
      promptId,
      workflowId: workflow.id,
    };
  }
);
