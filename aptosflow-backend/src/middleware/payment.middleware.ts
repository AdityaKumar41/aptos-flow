import { Request, Response, NextFunction } from 'express';
import { aptosService } from '@/services/aptos.service.js';

// Extend Express Request type to include payment info
declare global {
  namespace Express {
    interface Request {
      payment?: {
        paymentId: string;
        userId: string;
      };
    }
  }
}

/**
 * Middleware to verify that the user has made a valid payment
 */
export const requirePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sender } = req.body;

    if (!sender) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Sender wallet address is required',
      });
      return;
    }

    // Import config here to avoid circular dependency
    const { config } = await import('@/config/index.js');
    
    // Skip payment verification in development mode if configured
    if (config.nodeEnv === 'development' && config.skipPaymentInDev) {
      console.log('⚠️  Development mode: Skipping payment verification');
      
      // Create a development payment record for database consistency
      const { aptosService: devAptosService } = await import('@/services/aptos.service.js');
      const devPayment = await devAptosService.storePayment(
        sender,
        `dev_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        BigInt(0)
      );
      
      req.payment = {
        paymentId: devPayment.paymentId,
        userId: devPayment.userId,
      };
      
      next();
      return;
    }

    // Production mode: Require actual payment verification
    const paymentCheck = await aptosService.checkRecentPayment(sender);

    if (!paymentCheck.hasValidPayment) {
      res.status(402).json({
        error: 'Payment Required',
        message: 'No valid payment found. Please complete payment to use the AI service.',
        details: {
          sellerAddress: aptosService['sellerAddress'],
          requiredAmount: aptosService['requiredAmount'].toString(),
          network: config.aptosNetwork,
        },
      });
      return;
    }

    // Attach payment info to request for downstream use
    req.payment = {
      paymentId: paymentCheck.paymentId!,
      userId: '', // Will be populated from payment record if needed
    };

    next();
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify payment',
    });
  }
};
