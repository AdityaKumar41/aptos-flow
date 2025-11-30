import express from 'express';
import prisma from '@/utils/prisma.js';

const router = express.Router();

/**
 * GET /api/workflows/latest
 * Get the most recent workflow
 */
router.get('/latest', async (_req, res) => {
  try {
    const workflow = await prisma.workflow.findFirst({
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (!workflow) {
      res.json(null);
      return;
    }

    res.json(workflow);
  } catch (error) {
    console.error('Failed to get latest workflow:', error);
    res.status(500).json({ error: 'Failed to load workflow' });
  }
});

/**
 * GET /api/workflows/latest/:walletAddress
 * Get the most recent workflow for a specific user
 */
router.get('/latest/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return res.json(null);
    }

    const workflow = await prisma.workflow.findFirst({
      where: {
        prompt: {
          userId: user.id
        }
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json(workflow);
  } catch (error) {
    console.error('Failed to get user latest workflow:', error);
    return res.status(500).json({ error: 'Failed to load workflow' });
  }
});

/**
 * GET /api/chat/history/:walletAddress
 * Get chat history for a wallet
 */
router.get('/history/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Find user first
    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return res.json({ success: true, conversations: [] });
    }

    // Get conversations for this user
    const conversations = await prisma.chatConversation.findMany({
      where: { userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({ success: true, conversations });
  } catch (error: any) {
    console.error('Failed to get chat history:', error);
    return res.status(500).json({ error: 'Failed to load chat history' });
  }
});

export default router;
