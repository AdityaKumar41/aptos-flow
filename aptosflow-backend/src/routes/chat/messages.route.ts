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

    // Find or create conversation for this user
    let conversation = await prisma.chatConversation.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.chatConversation.create({
        data: {
          userId: user.id,
          title: 'New Conversation',
        },
      });
    }

    // Create message
    const message = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
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
    });

    if (!user) {
      return res.json({ success: true, messages: [] });
    }

    // Get all conversations and their messages
    const conversations = await prisma.chatConversation.findMany({
      where: { userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 1, // Get most recent conversation
    });

    const messages = conversations[0]?.messages || [];

    return res.json({ success: true, messages });
  } catch (error: any) {
    console.error('Error fetching chat history:', error);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
