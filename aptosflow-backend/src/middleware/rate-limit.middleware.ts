import { Request, Response, NextFunction } from 'express';
import prisma from '@/utils/prisma.js';
import { config } from '@/config/index.js';

/**
 * Rate limiting middleware based on wallet address
 */
export const rateLimitByWallet = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sender } = req.body;

    if (!sender) {
      next();
      return;
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

    // Get or create rate limit record
    const rateLimit = await prisma.rateLimit.findFirst({
      where: {
        walletAddress: sender,
        windowStart: {
          gte: windowStart,
        },
      },
    });

    if (rateLimit) {
      // Check if limit exceeded
      if (rateLimit.requestCount >= config.rateLimitRequestsPerHour) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${config.rateLimitRequestsPerHour} requests per hour.`,
          retryAfter: Math.ceil((rateLimit.windowStart.getTime() + 60 * 60 * 1000 - now.getTime()) / 1000),
        });
        return;
      }

      // Increment counter
      await prisma.rateLimit.update({
        where: { id: rateLimit.id },
        data: { requestCount: { increment: 1 } },
      });
    } else {
      // Create new rate limit record
      await prisma.rateLimit.create({
        data: {
          walletAddress: sender,
          requestCount: 1,
          windowStart: now,
        },
      });
    }

    next();
  } catch (error) {
    console.error('Rate limit error:', error);
    // Don't block request on rate limit errors
    next();
  }
};

/**
 * Cleanup old rate limit records (should be run periodically)
 */
export const cleanupRateLimits = async (): Promise<void> => {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 2); // Keep 2 hours of history

  await prisma.rateLimit.deleteMany({
    where: {
      windowStart: {
        lt: cutoff,
      },
    },
  });
};
