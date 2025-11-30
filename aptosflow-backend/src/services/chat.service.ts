import prisma from '@/utils/prisma.js';

export class ChatService {
  /**
   * Get or create a conversation for a wallet
   */
  async getOrCreateConversation(walletAddress: string): Promise<string> {
    // Find the most recent conversation for this wallet
    let conversation = await prisma.chatConversation.findFirst({
      where: { walletAddress },
      orderBy: { updatedAt: 'desc' },
    });

    // If no conversation exists or the last one is old (>24h), create a new one
    if (!conversation || (Date.now() - conversation.updatedAt.getTime() > 24 * 60 * 60 * 1000)) {
      conversation = await prisma.chatConversation.create({
        data: {
          walletAddress,
          title: 'New Conversation',
        },
      });
    }

    return conversation.id;
  }

  /**
   * Save a message to the conversation
   */
  async saveMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
    await prisma.chatMessage.create({
      data: {
        conversationId,
        role,
        content,
      },
    });

    // Update conversation timestamp
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId: string, limit: number = 50) {
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        role: true,
        content: true,
        createdAt: true,
      },
    });

    return messages;
  }

  /**
   * Get all conversations for a wallet
   */
  async getWalletConversations(walletAddress: string) {
    return await prisma.chatConversation.findMany({
      where: { walletAddress },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }
}

export const chatService = new ChatService();
