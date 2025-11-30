import { Router } from 'express';
import prisma from '../../utils/prisma.js';

const router = Router();

/**
 * Save chat message
 * POST /api/chat/messages
 */
router.post('/messages', async (req, res) => {
  try {
    const { walletAddress, role, content } = req.body;

    if (!walletAddress || !role || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress },
      });
    }

    // Create message
    const message = await prisma.chatMessage.create({
      data: {
        userId: user.id,
        role,
        content,
      },
    });

    return res.json({ success: true, message });
  } catch (error: any) {
    console.error('Error saving chat message:', error);
    return res.status(500).json({ error: 'Failed to save message' });
  }
});

/**
 * Get chat history
 * GET /api/chat/history/:walletAddress
 */
router.get('/history/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: {
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          take: 100, // Limit to last 100 messages
        },
      },
    });

    if (!user) {
      return res.json({ success: true, messages: [] });
    }

    return res.json({ success: true, messages: user.chatMessages });
  } catch (error: any) {
    console.error('Error fetching chat history:', error);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
