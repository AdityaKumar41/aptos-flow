import { Router, Request, Response } from 'express';
import { generateRequestSchema } from '@/types/workflow.types.js';
import { requirePayment } from '@/middleware/payment.middleware.js';
import { rateLimitByWallet } from '@/middleware/rate-limit.middleware.js';
import { inngest } from '@/inngest/client.js';
import prisma from '@/utils/prisma.js';

const router = Router();

/**
 * POST /api/generate
 * Generate workflow from natural language prompt
 */
router.post(
  '/',
  rateLimitByWallet,
  requirePayment,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const { prompt, sender } = generateRequestSchema.parse(req.body);

      // Get or create user
      let user = await prisma.user.findUnique({
        where: { walletAddress: sender },
      });

      if (!user) {
        user = await prisma.user.create({
          data: { walletAddress: sender },
        });
      }

      // Get payment ID from middleware (already verified)
      const paymentId = req.payment!.paymentId;

      // Create prompt record
      const promptRecord = await prisma.prompt.create({
        data: {
          userId: user.id,
          paymentId,
          promptText: prompt,
          status: 'PENDING',
        },
      });

      // Trigger Inngest function for async processing
      await inngest.send({
        name: 'prompt/submitted',
        data: {
          promptId: promptRecord.id,
          userId: user.id,
          promptText: prompt,
        },
      });

      // Return 202 Accepted with prompt ID
      res.status(202).json({
        promptId: promptRecord.id,
        status: 'PROCESSING',
        message: 'Workflow generation started. Use the promptId to check status.',
      });
    } catch (error) {
      console.error('Generate endpoint error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process prompt',
      });
    }
  }
);

/**
 * GET /api/generate/:promptId
 * Check status and retrieve generated workflow
 */
router.get('/:promptId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { promptId } = req.params;

    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      include: {
        workflow: true,
      },
    });

    if (!prompt) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Prompt not found',
      });
      return;
    }

    // Return different responses based on status
    if (prompt.status === 'COMPLETED' && prompt.workflow) {
      res.json({
        promptId: prompt.id,
        status: prompt.status,
        workflow: prompt.workflow.workflowData,
        completedAt: prompt.completedAt,
      });
    } else if (prompt.status === 'FAILED') {
      res.json({
        promptId: prompt.id,
        status: prompt.status,
        error: prompt.errorMessage,
        completedAt: prompt.completedAt,
      });
    } else {
      res.json({
        promptId: prompt.id,
        status: prompt.status,
        message: 'Workflow generation in progress',
      });
    }
  } catch (error) {
    console.error('Get prompt status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve prompt status',
    });
  }
});

export default router;
