import { Router } from 'express';
import prisma from '../../utils/prisma.js';

const router = Router();

/**
 * Save workflow state
 * POST /api/workflows/save
 */
router.post('/save', async (req, res) => {
  try {
    const { walletAddress, nodes, edges } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
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

    // Find existing workflow or create new one
    let workflow = await prisma.workflow.findFirst({
      where: {
        promptId: `canvas_${walletAddress}`,
        isActive: true,
      },
    });

    const workflowData = { nodes, edges, lastSaved: new Date().toISOString() };

    if (workflow) {
      // Update existing
      workflow = await prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          workflowData,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new
      workflow = await prisma.workflow.create({
        data: {
          promptId: `canvas_${walletAddress}`,
          workflowData,
          executionStatus: 'PENDING',
          isActive: true,
          triggerType: 'manual',
          triggerConfig: {},
        },
      });
    }

    return res.json({ success: true, workflowId: workflow.id });
  } catch (error: any) {
    console.error('Error saving workflow:', error);
    return res.status(500).json({ error: 'Failed to save workflow' });
  }
});

/**
 * Load workflow state
 * GET /api/workflows/load/:walletAddress
 */
router.get('/load/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    const workflow = await prisma.workflow.findFirst({
      where: {
        promptId: `canvas_${walletAddress}`,
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!workflow) {
      return res.json({ success: true, workflow: null });
    }

    return res.json({
      success: true,
      workflow: {
        id: workflow.id,
        nodes: (workflow.workflowData as any)?.nodes || [],
        edges: (workflow.workflowData as any)?.edges || [],
      },
    });
  } catch (error: any) {
    console.error('Error loading workflow:', error);
    return res.status(500).json({ error: 'Failed to load workflow' });
  }
});

export default router;
