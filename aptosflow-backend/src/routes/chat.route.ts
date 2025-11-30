import { Router, Request, Response } from 'express';
import { aiService } from '@/services/ai.service.js';
import { chatService } from '@/services/chat.service.js';

const router = Router();

/**
 * POST /api/chat/stream
 * Stream conversational responses (SSE) with database persistence
 */
router.post('/stream', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history = [], walletAddress } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Get or create conversation if wallet is provided
    let conversationId: string | null = null;
    if (walletAddress) {
      conversationId = await chatService.getOrCreateConversation(walletAddress);
      // Save user message
      await chatService.saveMessage(conversationId, 'user', message);
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream the chat response with history
    const stream = await aiService.streamChat(message, history);
    let fullResponse = '';

    for await (const chunk of stream.textStream) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    // Save assistant response to database
    if (conversationId) {
      await chatService.saveMessage(conversationId, 'assistant', fullResponse);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Chat stream error:', error);
    res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
    res.end();
  }
});

export default router;
