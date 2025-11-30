import { Router } from 'express';
import { requirePayment } from '../../middleware/payment.middleware.js';
import { aptosService } from '../../services/aptos.service.js';
import prisma from '../../utils/prisma.js';
import { Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

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
    const privateKeyHex = process.env.APTOS_PRIVATE_KEY!;
    const privateKey = new Ed25519PrivateKey(privateKeyHex);

    const txHash = await aptosService.executeWorkflow(
      privateKey,
      dbWorkflow.id
    );

    // Update workflow with transaction hash
    await prisma.workflow.update({
      where: { id: dbWorkflow.id },
      data: {
        executionStatus: 'SUBMITTED',
        workflowData: { 
          ...dbWorkflow.workflowData as any,
          txHash 
        },
      },
    });

    return res.json({
      success: true,
      workflowId: dbWorkflow.id,
      txHash,
      message: 'Workflow submitted for execution',
    });
  } catch (error: any) {
    console.error('Workflow execution error:', error);
    return res.status(500).json({
      error: 'Failed to execute workflow',
      details: error.message,
    });
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

function mapWorkflowToContract(nodes: any[], edges: any[]) {
  const nodeIdMap = new Map<string, number>();
  nodes.forEach((node, index) => {
    nodeIdMap.set(node.id, index);
  });

  return nodes.map((node) => {
    const nextEdges = edges.filter((e: any) => e.source === node.id);
    const next_ids = nextEdges.map((e: any) => nodeIdMap.get(e.target) || 0);

    const config = node.data.config || {};
    
    return {
      id: nodeIdMap.get(node.id) || 0,
      node_type: getNodeType(node.type),
      target_address: extractAddress(node.type, config),
      amount: extractAmount(node.type, config),
      data: extractData(node.type, config),
      next_ids,
    };
  });
}

function getNodeType(type: string): number {
  const typeMap: Record<string, number> = {
    manual_trigger: 0,
    schedule_trigger: 1,
    price_trigger: 2,
    event_trigger: 3,
    balance_check: 100,
    oracle_check: 101,
    transfer_action: 200,
    stake_action: 201,
    swap_action: 202,
    liquidity_provide: 203,
    borrow_lend_action: 204,
    dao_vote_action: 205,
    wait_node: 300,
    branch_node: 301,
    end_node: 302,
  };
  return typeMap[type] || 0;
}

function extractAddress(nodeType: string, config: any): string {
  switch (nodeType) {
    case 'transfer_action':
      return config.recipient || '0x0';
    case 'stake_action':
      return config.poolAddress || '0x0';
    case 'dao_vote_action':
      return config.daoContract || '0x0';
    default:
      return '0x0';
  }
}

function extractAmount(nodeType: string, config: any): string {
  switch (nodeType) {
    case 'transfer_action':
    case 'stake_action':
    case 'swap_action':
    case 'borrow_lend_action':
      return config.amount || '0';
    case 'balance_check':
      return config.amount || '0';
    default:
      return '0';
  }
}

function extractData(nodeType: string, config: any): number[] {
  const encoder = new TextEncoder();
  
  switch (nodeType) {
    case 'swap_action':
      return Array.from(encoder.encode(
        JSON.stringify({
          fromToken: config.fromToken,
          toToken: config.toToken,
          slippage: config.slippage,
          dex: config.dex,
        })
      ));
    default:
      return [];
  }
}

export default router;
