import prisma from '@/utils/prisma.js';
import { Prisma } from '../generated/client/client.js';

export class WorkflowService {
  /**
   * Get the latest workflow for a user (or global latest for MVP)
   */
  async getLatestWorkflow() {
    return prisma.workflow.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { prompt: true }
    });
  }

  /**
   * Create or update a workflow
   */
  async saveWorkflow(data: Prisma.WorkflowCreateInput) {
    return prisma.workflow.create({ data });
  }
}

export const workflowService = new WorkflowService();
