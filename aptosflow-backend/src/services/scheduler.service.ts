import * as cron from 'node-cron';
import { aptosService } from './aptos.service.js';
import prisma from '../utils/prisma.js';

export class SchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize scheduler by loading all active scheduled workflows
   */
  async init() {
    console.log('Initializing Scheduler Service...');
    // Fetch active scheduled workflows from DB and register them
    const workflows = await prisma.workflow.findMany({ where: { isActive: true, triggerType: 'schedule' } as any });
    workflows.forEach((wf: any) => {
        if (wf.cronExpression) {
            this.scheduleWorkflow(wf.id, wf.cronExpression);
        }
    });
  }

  /**
   * Schedule a workflow execution
   */
  scheduleWorkflow(workflowId: string, cronExpression: string) {
    if (this.jobs.has(workflowId)) {
      this.jobs.get(workflowId)?.stop();
    }

    console.log(`Scheduling workflow ${workflowId} with cron: ${cronExpression}`);

    const task = cron.schedule(cronExpression, async () => {
      console.log(`Executing scheduled workflow: ${workflowId}`);
      try {
        // Trigger workflow execution on-chain
        // Note: We need the owner's address and maybe a funded account for the backend to execute it?
        // Or we just emit an event?
        // For MVP, we'll log it. In production, backend wallet calls 'execute_workflow'
        
        await aptosService.executeWorkflow(workflowId); 
        console.log(`Workflow ${workflowId} triggered successfully.`);
      } catch (error) {
        console.error(`Failed to execute scheduled workflow ${workflowId}:`, error);
      }
    });

    this.jobs.set(workflowId, task);
  }

  /**
   * Stop a scheduled workflow
   */
  stopWorkflow(workflowId: string) {
    if (this.jobs.has(workflowId)) {
      this.jobs.get(workflowId)?.stop();
      this.jobs.delete(workflowId);
      console.log(`Stopped scheduled workflow: ${workflowId}`);
    }
  }

  /**
   * Handle Wait Node resumption
   * @param workflowId 
   * @param durationSeconds 
   */
  async scheduleResume(workflowId: string, durationSeconds: number) {
    console.log(`Scheduling resume for workflow ${workflowId} in ${durationSeconds}s`);
    
    setTimeout(async () => {
      console.log(`Resuming workflow ${workflowId} after wait`);
      try {
        // await aptosService.resumeWorkflow(workflowId);
      } catch (error) {
        console.error(`Failed to resume workflow ${workflowId}:`, error);
      }
    }, durationSeconds * 1000);
  }
}

export const schedulerService = new SchedulerService();
