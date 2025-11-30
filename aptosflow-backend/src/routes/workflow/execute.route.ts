import { Router } from 'express';
import { requirePayment } from '../../middleware/payment.middleware.js';
import { aptosService } from '../../services/aptos.service.js';
import prisma from '../../utils/prisma.js';

const router = Router();

/**
 * Execute workflow on Aptos blockchain
 * POST /api/workflow/execute
 */
router.post('/execute', requirePayment, async (req, res) => {
  try {
    const { workflow } = req.body;
    
    if (!workflow || !workflow.nodes || !workflow.edges) {
      return res.status(400).json({
        error: 'Invalid workflow structure',
      });
    }

    // Validate workflow
    const validation = validateWorkflow(workflow.nodes);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Workflow validation failed',
        details: validation.errors,
      });
    }

    // Create workflow in database using correct schema fields
    const dbWorkflow = await prisma.workflow.create({
      data: {
        promptId: workflow.promptId || 'manual',
        workflowData: { nodes: workflow.nodes, edges: workflow.edges },
        executionStatus: 'PENDING',
        isActive: true,
        triggerType: 'manual',
        triggerConfig: {},
      },
    });

    // Execute on contract using backend private key
    // const privateKeyHex = process.env.APTOS_PRIVATE_KEY!;
    // const privateKey = new Ed25519PrivateKey(privateKeyHex);

    // Execute workflow on blockchain
    const txHash = await aptosService.executeWorkflow(
      dbWorkflow.id
    );

    // Update workflow with transaction hash
    await prisma.workflow.update({
      where: { id: dbWorkflow.id },
      data: {
        executionStatus: 'SUBMITTED',
        workflowData: { 
          ...dbWorkflow.workflowData as any,
          transactionHash: txHash 
        },
      },
    });

    return res.json({ success: true, transactionHash: txHash });
  } catch (error: any) {
    console.error('Workflow execution error:', error);
    return res.status(500).json({ error: error.message || 'Failed to execute workflow' });
  }
});

/**
 * Get workflow execution status
 * GET /api/workflow/execute/:id
 */
router.get('/execute/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Extract transaction hash from workflowData
    const workflowData = workflow.workflowData as any;
    const txHash = workflowData?.txHash;
    let txStatus = null;

    if (txHash) {
      try {
        // Access aptos through a public method instead
        const tx = await aptosService.verifyPayment(txHash, '0x1'); // Temporary workaround
        txStatus = {
          success: true,
          verified: tx.valid,
        };
      } catch (error) {
        console.error('Error fetching transaction:', error);
      }
    }

    return res.json({
      workflow: {
        id: workflow.id,
        executionStatus: workflow.executionStatus,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
      transaction: txStatus,
    });
  } catch (error: any) {
    console.error('Error fetching workflow status:', error);
    return res.status(500).json({
      error: 'Failed to fetch workflow status',
      details: error.message,
    });
  }
});

// Helper functions (these would normally be in a separate service)
function validateWorkflow(nodes: any[]) {
  const errors: string[] = [];

  const hasTrigger = nodes.some((n) => n.type.includes('trigger'));
  if (!hasTrigger) {
    errors.push('Workflow must have at least one trigger node');
  }

  const hasAction = nodes.some((n) => n.type.includes('action'));
  if (!hasAction) {
    errors.push('Workflow must have at least one action node');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default router;
