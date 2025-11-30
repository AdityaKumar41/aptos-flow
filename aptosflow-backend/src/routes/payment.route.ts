import { Router, Request, Response } from 'express';
import { verifyPaymentRequestSchema } from '@/types/workflow.types.js';
import { aptosService } from '@/services/aptos.service.js';
import prisma from '@/utils/prisma.js';

const router = Router();

/**
 * POST /api/payment/verify
 * Manually verify a payment transaction
 */
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { txHash, sender } = verifyPaymentRequestSchema.parse(req.body);

    // Verify payment on blockchain
    const verification = await aptosService.verifyPayment(txHash, sender);

    if (!verification.valid) {
      res.status(400).json({
        error: 'Invalid Payment',
        message: verification.error || 'Payment verification failed',
      });
      return;
    }

    // Store payment in database
    const { paymentId, userId } = await aptosService.storePayment(
      sender,
      txHash,
      verification.amount!
    );

    res.json({
      success: true,
      message: 'Payment verified successfully',
      paymentId,
      userId,
      amount: verification.amount!.toString(),
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify payment',
    });
  }
});

/**
 * GET /api/payment/status/:walletAddress
 * Check payment status for a wallet
 */
router.get('/status/:walletAddress', async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletAddress } = req.params;

    const paymentCheck = await aptosService.checkRecentPayment(walletAddress);

    if (paymentCheck.hasValidPayment) {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentCheck.paymentId },
      });

      res.json({
        hasValidPayment: true,
        payment: {
          id: payment?.id,
          amount: payment?.amount.toString(),
          verifiedAt: payment?.verifiedAt,
          expiresAt: payment?.expiresAt,
        },
      });
    } else {
      res.json({
        hasValidPayment: false,
        message: 'No valid payment found',
      });
    }
  } catch (error) {
    console.error('Payment status check error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check payment status',
    });
  }
});

export default router;
