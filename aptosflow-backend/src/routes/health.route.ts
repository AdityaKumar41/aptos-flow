import { Router, Request, Response } from 'express';
import prisma from '@/utils/prisma.js';
import { aptosService } from '@/services/aptos.service.js';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'unknown',
      aptos: 'unknown',
    },
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'ok';
  } catch (error) {
    health.services.database = 'error';
    health.status = 'degraded';
  }

  try {
    // Check Aptos connection by fetching a balance
    await aptosService.getAccountBalance(aptosService['sellerAddress']);
    health.services.aptos = 'ok';
  } catch (error) {
    health.services.aptos = 'error';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
