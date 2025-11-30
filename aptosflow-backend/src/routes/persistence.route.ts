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
 * GET /api/chat/history/:walletAddress
 * Get chat history for a wallet
 */
router.get('/history/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    // Get latest conversation
    const conversation = await prisma.chatConversation.findFirst({
      where: { walletAddress },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50, // Last 50 messages
        },
      },
    });

    if (!conversation) {
      res.json([]);
      return;
    }

    res.json(conversation.messages);
  } catch (error) {
    console.error('Failed to get chat history:', error);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

export default router;
