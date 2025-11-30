import { Router, Request, Response } from 'express';
import { requirePayment } from '@/middleware/payment.middleware.js';
import { aiService } from '@/services/ai.service.js';
import prisma from '@/utils/prisma.js';

const router = Router();

/**
 * POST /api/workflow/stream
 * Stream workflow generation with progressive node updates (SSE)
 */
router.post('/', requirePayment, async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, sender, existingWorkflow } = req.body;

    if (!prompt || !sender) {
      res.status(400).json({ error: 'Prompt and sender are required' });
      return;
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create required database records before streaming
    // Get or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: sender },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress: sender },
      });
    }

    // Get payment ID from middleware (already verified)
    const paymentId = req.payment!.paymentId;

    // Create prompt record
    const promptRecord = await prisma.prompt.create({
      data: {
        userId: user.id,
        paymentId: paymentId,
        promptText: prompt,
        status: 'PROCESSING',
      },
    });

    // Stream workflow generation (with optional existing workflow for editing)
    const stream = await aiService.streamWorkflowGeneration(prompt, existingWorkflow);
    let nodeCount = 0;
    let edgeCount = 0;
    let completeWorkflow: any = null;

    // Send initial status
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Starting generation...' })}\n\n`);

    // Track which nodes have been sent to avoid duplicates
    const sentNodes = new Set<string>();
    let triggerId: string | null = null;
    let conditionId: string | null = null;
    let actionId: string | null = null;

    // Detect if prompt mentions schedule/time keywords
    const hasScheduleKeywords = /every|daily|weekly|monthly|hourly|cron|schedule|at \d|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(prompt);

    // Stream partial objects as they're generated
    for await (const partialObject of stream.partialObjectStream) {
      completeWorkflow = partialObject; // Keep updating with latest

      // POST-PROCESS: Fix trigger type if AI incorrectly uses schedule_trigger
      if (partialObject.trigger && partialObject.trigger.type === 'schedule_trigger' && !hasScheduleKeywords) {
        partialObject.trigger.type = 'manual_trigger';
        // Remove schedule-related fields
        const trigger = partialObject.trigger as any;
        delete trigger.schedule;
        delete trigger.cron;
      }

      // Send trigger node when available (only once)
      if (partialObject.trigger && !sentNodes.has('trigger')) {
        triggerId = `trigger_${Date.now()}`;
        
        // Determine correct trigger type (apply post-processing here)
        let triggerType = partialObject.trigger.type || 'manual_trigger';
        if (triggerType === 'schedule_trigger' && !hasScheduleKeywords) {
          triggerType = 'manual_trigger'; // Override to manual
        }
        
        res.write(`data: ${JSON.stringify({
          type: 'node',
          data: {
            id: triggerId,
            type: triggerType, // Use corrected type
            ...partialObject.trigger,
          }
        })}\n\n`);
        sentNodes.add('trigger');
        nodeCount++;
      }

      // Send condition node when available (only once)
      if (partialObject.condition && !sentNodes.has('condition')) {
        conditionId = `condition_${Date.now()}`;
        res.write(`data: ${JSON.stringify({
          type: 'node',
          data: {
            id: conditionId,
            type: partialObject.condition.type || 'balance_check',
            ...partialObject.condition,
          }
        })}\n\n`);
        sentNodes.add('condition');
        nodeCount++;
        
        // Send edge connecting trigger to condition
        if (triggerId) {
          res.write(`data: ${JSON.stringify({
            type: 'edge',
            data: {
              id: `edge_${edgeCount++}`,
              source: triggerId,
              target: conditionId,
            }
          })}\n\n`);
        }
      }

      // Send action node when available (only once)
      if (partialObject.action && !sentNodes.has('action')) {
        actionId = `action_${Date.now()}`;
        res.write(`data: ${JSON.stringify({
          type: 'node',
          data: {
            id: actionId,
            type: partialObject.action.type || 'transfer_action',
            ...partialObject.action,
          }
        })}\n\n`);
        sentNodes.add('action');
        nodeCount++;
        
        // Send edge connecting to action
        const sourceId = conditionId || triggerId;
        if (sourceId) {
          res.write(`data: ${JSON.stringify({
            type: 'edge',
            data: {
              id: `edge_${edgeCount++}`,
              source: sourceId,
              target: actionId,
            }
          })}\n\n`);
        }
      }

      // Send flow control nodes when available
      if (partialObject.flowControl && !sentNodes.has('flowControl')) {
        const flowControlId = `flow_${Date.now()}`;
        res.write(`data: ${JSON.stringify({
          type: 'node',
          data: {
            id: flowControlId,
            type: partialObject.flowControl.type || 'end_node',
            ...partialObject.flowControl,
          }
        })}\n\n`);
        sentNodes.add('flowControl');
        nodeCount++;
        
        // Send edge connecting to flow control
        const sourceId = actionId || conditionId || triggerId;
        if (sourceId) {
          res.write(`data: ${JSON.stringify({
            type: 'edge',
            data: {
              id: `edge_${edgeCount++}`,
              source: sourceId,
              target: flowControlId,
            }
          })}\n\n`);
        }
      }
    }


    // Save workflow to database
    if (completeWorkflow) {
      try {
        const workflow = await prisma.$transaction(async (tx: any) => {
          // Update prompt status to COMPLETED
          await tx.prompt.update({
            where: { id: promptRecord.id },
            data: {
              status: 'COMPLETED',
              workflowJson: completeWorkflow as any,
              completedAt: new Date(),
            },
          });

          // Create workflow record linked to prompt
          return await tx.workflow.create({
            data: {
              promptId: promptRecord.id,
              workflowData: completeWorkflow as any,
              executionStatus: 'DRAFT',
            },
          });
        });

        // Send completion event with workflow ID
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          data: {
            totalNodes: nodeCount,
            totalEdges: edgeCount,
            workflowId: workflow.id,
          }
        })}\n\n`);
      } catch (dbError) {
        console.error('Failed to save workflow:', dbError);
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          data: {
            totalNodes: nodeCount,
            totalEdges: edgeCount,
          }
        })}\n\n`);
      }
    }

    res.end();
  } catch (error) {
    console.error('Streaming workflow generation error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Failed to generate workflow'
    })}\n\n`);
    res.end();
  }
});

export default router;
