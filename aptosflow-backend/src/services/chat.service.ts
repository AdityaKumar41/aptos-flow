import prisma from '@/utils/prisma.js';

export class ChatService {
  /**
   * Get or create a conversation for a wallet
   */
  async getOrCreateConversation(walletAddress: string): Promise<string> {
    // Find user first
    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress },
      });
    }

    // Find or create conversation
    const conversation = await prisma.chatConversation.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });

    if (conversation) {
      return conversation.id;
    }

    const newConversation = await prisma.chatConversation.create({
      data: {
        userId: user.id,
        title: 'New Conversation',
      },
    });

    return newConversation.id;
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
  async getChatHistory(walletAddress: string): Promise<any[]> {
    // Find user first
    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return [];
    }

    const conversations = await prisma.chatConversation.findMany({
      where: { userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    });
    return conversations;
  }
}

export const chatService = new ChatService();
