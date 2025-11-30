import { Router } from 'express';
import { nodeMetadataService } from '@/services/node-metadata.service.js';

const router = Router();

/**
 * GET /api/nodes
 * Get all available node types with metadata
 */
router.get('/', (_req, res) => {
  try {
    const nodes = nodeMetadataService.getAllNodeTypes();
    res.json({
      success: true,
      nodes,
      count: nodes.length,
    });
  } catch (error) {
    console.error('Error fetching node metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node metadata',
    });
  }
});

/**
 * GET /api/nodes/:type
 * Get metadata for a specific node type
 */
router.get('/:type', (req, res) => {
  try {
    const { type } = req.params;
    const node = nodeMetadataService.getNodeMetadata(type);
    
    if (!node) {
      res.status(404).json({
        success: false,
        error: `Node type '${type}' not found`,
      });
      return;
    }

    res.json({
      success: true,
      node,
    });
  } catch (error) {
    console.error('Error fetching node metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node metadata',
    });
  }
});

/**
 * GET /api/nodes/category/:category
 * Get nodes by category (trigger, condition, action, flow_control)
 */
router.get('/category/:category', (req, res) => {
  try {
    const { category } = req.params;
    
    if (!['trigger', 'condition', 'action', 'flow_control'].includes(category)) {
      res.status(400).json({
        success: false,
        error: 'Invalid category. Must be one of: trigger, condition, action, flow_control',
      });
      return;
    }

    const nodes = nodeMetadataService.getNodesByCategory(category as any);
    
    res.json({
      success: true,
      category,
      nodes,
      count: nodes.length,
    });
  } catch (error) {
    console.error('Error fetching nodes by category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nodes by category',
    });
  }
});

export default router;
