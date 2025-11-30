export interface NodeMetadata {
  type: string;
  category: 'trigger' | 'condition' | 'action' | 'flow_control';
  label: string;
  description: string;
  icon?: string;
  color?: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
    default?: any;
    options?: string[];
  }>;
}

export class NodeMetadataService {
  /**
   * Get metadata for all available node types
   */
  getAllNodeTypes(): NodeMetadata[] {
    return [
      ...this.getTriggerNodes(),
      ...this.getConditionNodes(),
      ...this.getActionNodes(),
      ...this.getFlowControlNodes(),
    ];
  }

  /**
   * Get trigger node metadata
   */
  private getTriggerNodes(): NodeMetadata[] {
    return [
      {
        type: 'manual_trigger',
        category: 'trigger',
        label: 'Manual Trigger',
        description: 'Start workflow manually via UI button',
        icon: 'Play',
        color: 'emerald',
        parameters: [
          {
            name: 'description',
            type: 'string',
            required: false,
            description: 'Optional description',
          },
        ],
      },
      {
        type: 'schedule_trigger',
        category: 'trigger',
        label: 'Scheduled Trigger',
        description: 'Run workflow on a schedule using cron expressions',
        icon: 'Clock',
        color: 'amber',
        parameters: [
          {
            name: 'cron',
            type: 'string',
            required: true,
            description: 'Cron expression (e.g., "0 18 * * FRI")',
          },
          {
            name: 'timezone',
            type: 'string',
            required: false,
            default: 'UTC',
            description: 'Timezone for schedule',
          },
        ],
      },
      {
        type: 'price_trigger',
        category: 'trigger',
        label: 'Price Trigger',
        description: 'Execute when token price crosses threshold',
        icon: 'TrendingUp',
        color: 'purple',
        parameters: [
          {
            name: 'token',
            type: 'string',
            required: true,
            description: 'Token to monitor',
          },
          {
            name: 'operator',
            type: 'enum',
            required: true,
            options: ['>', '<', '>=', '<=', '=='],
            description: 'Comparison operator',
          },
          {
            name: 'threshold',
            type: 'number',
            required: true,
            description: 'Price threshold in USD',
          },
          {
            name: 'oracleProvider',
            type: 'enum',
            required: false,
            options: ['chainlink', 'pyth', 'switchboard'],
            default: 'pyth',
          },
        ],
      },
      {
        type: 'event_trigger',
        category: 'trigger',
        label: 'Event Trigger',
        description: 'Trigger on blockchain events',
        icon: 'Zap',
        color: 'blue',
        parameters: [
          {
            name: 'eventType',
            type: 'enum',
            required: true,
            options: ['token_transfer', 'nft_received', 'nft_transfer', 'balance_change'],
          },
          {
            name: 'contract',
            type: 'string',
            required: false,
            description: 'Optional contract address filter',
          },
        ],
      },
    ];
  }

  /**
   * Get condition node metadata
   */
  private getConditionNodes(): NodeMetadata[] {
    return [
      {
        type: 'balance_check',
        category: 'condition',
        label: 'Balance Check',
        description: 'Check wallet token balance',
        icon: 'Wallet',
        color: 'green',
        parameters: [
          {
            name: 'operator',
            type: 'enum',
            required: true,
            options: ['>', '<', '>=', '<=', '=='],
          },
          {
            name: 'amount',
            type: 'number',
            required: true,
            description: 'Amount in octas',
          },
          {
            name: 'token',
            type: 'string',
            required: false,
            default: 'APT',
          },
        ],
      },
      {
        type: 'oracle_check',
        category: 'condition',
        label: 'Oracle Price Check',
        description: 'Check token price from oracle',
        icon: 'Activity',
        color: 'purple',
        parameters: [
          {
            name: 'token',
            type: 'string',
            required: true,
          },
          {
            name: 'operator',
            type: 'enum',
            required: true,
            options: ['>', '<', '>=', '<=', '=='],
          },
          {
            name: 'value',
            type: 'number',
            required: true,
            description: 'Price in USD',
          },
          {
            name: 'oracleProvider',
            type: 'enum',
            required: false,
            options: ['chainlink', 'pyth', 'switchboard'],
            default: 'pyth',
          },
        ],
      },
    ];
  }

  /**
   * Get action node metadata
   */
  private getActionNodes(): NodeMetadata[] {
    return [
      {
        type: 'transfer_action',
        category: 'action',
        label: 'Token Transfer',
        description: 'Send APT or tokens to recipient',
        icon: 'ArrowRightLeft',
        color: 'blue',
        parameters: [
          {
            name: 'recipient',
            type: 'string',
            required: true,
            description: 'Recipient wallet address',
          },
          {
            name: 'amount',
            type: 'number',
            required: true,
            description: 'Amount in octas',
          },
          {
            name: 'token',
            type: 'string',
            required: false,
            default: 'APT',
          },
        ],
      },
      {
        type: 'stake_action',
        category: 'action',
        label: 'Stake Tokens',
        description: 'Stake APT into DeFi pool',
        icon: 'Lock',
        color: 'green',
        parameters: [
          {
            name: 'poolAddress',
            type: 'string',
            required: true,
            description: 'Staking pool address',
          },
          {
            name: 'amount',
            type: 'number',
            required: true,
            description: 'Amount to stake in octas',
          },
          {
            name: 'token',
            type: 'string',
            required: false,
            default: 'APT',
          },
        ],
      },
      {
        type: 'swap_action',
        category: 'action',
        label: 'Token Swap',
        description: 'Exchange tokens on DEX',
        icon: 'Repeat',
        color: 'purple',
        parameters: [
          {
            name: 'fromToken',
            type: 'string',
            required: true,
          },
          {
            name: 'toToken',
            type: 'string',
            required: true,
          },
          {
            name: 'amount',
            type: 'number',
            required: true,
            description: 'Amount in octas',
          },
          {
            name: 'slippage',
            type: 'number',
            required: false,
            default: 1,
            description: 'Max slippage %',
          },
          {
            name: 'dex',
            type: 'enum',
            required: false,
            options: ['pancakeswap', 'liquidswap', 'pontem'],
            default: 'liquidswap',
          },
        ],
      },
      {
        type: 'liquidity_provide',
        category: 'action',
        label: 'Provide Liquidity',
        description: 'Add liquidity to DEX pool',
        icon: 'Droplet',
        color: 'cyan',
        parameters: [
          {
            name: 'tokenA',
            type: 'string',
            required: true,
          },
          {
            name: 'tokenB',
            type: 'string',
            required: true,
          },
          {
            name: 'amountA',
            type: 'number',
            required: true,
          },
          {
            name: 'amountB',
            type: 'number',
            required: true,
          },
          {
            name: 'dex',
            type: 'enum',
            required: false,
            options: ['pancakeswap', 'liquidswap', 'pontem'],
            default: 'liquidswap',
          },
        ],
      },
      {
        type: 'borrow_lend_action',
        category: 'action',
        label: 'Borrow/Lend',
        description: 'Interact with lending protocols',
        icon: 'Coins',
        color: 'orange',
        parameters: [
          {
            name: 'asset',
            type: 'string',
            required: true,
          },
          {
            name: 'mode',
            type: 'enum',
            required: true,
            options: ['borrow', 'lend', 'repay', 'withdraw'],
          },
          {
            name: 'amount',
            type: 'number',
            required: true,
          },
          {
            name: 'protocol',
            type: 'enum',
            required: false,
            options: ['aptin', 'aries'],
            default: 'aptin',
          },
        ],
      },
      {
        type: 'dao_vote_action',
        category: 'action',
        label: 'DAO Vote',
        description: 'Vote on DAO proposal',
        icon: 'Vote',
        color: 'indigo',
        parameters: [
          {
            name: 'proposalId',
            type: 'string',
            required: true,
          },
          {
            name: 'vote',
            type: 'enum',
            required: true,
            options: ['yes', 'no', 'abstain'],
          },
          {
            name: 'daoContract',
            type: 'string',
            required: true,
          },
        ],
      },
    ];
  }

  /**
   * Get flow control node metadata
   */
  private getFlowControlNodes(): NodeMetadata[] {
    return [
      {
        type: 'wait_node',
        category: 'flow_control',
        label: 'Wait',
        description: 'Wait for specified duration',
        icon: 'Timer',
        color: 'gray',
        parameters: [
          {
            name: 'duration',
            type: 'number',
            required: true,
            description: 'Wait duration in seconds',
          },
        ],
      },
      {
        type: 'branch_node',
        category: 'flow_control',
        label: 'Branch',
        description: 'Conditional routing (if/else)',
        icon: 'GitBranch',
        color: 'yellow',
        parameters: [
          {
            name: 'condition',
            type: 'object',
            required: true,
            description: 'Condition to evaluate',
          },
          {
            name: 'truePath',
            type: 'string',
            required: false,
            description: 'Node ID for true branch',
          },
          {
            name: 'falsePath',
            type: 'string',
            required: false,
            description: 'Node ID for false branch',
          },
        ],
      },
      {
        type: 'end_node',
        category: 'flow_control',
        label: 'End',
        description: 'Mark workflow completion',
        icon: 'CheckCircle',
        color: 'green',
        parameters: [
          {
            name: 'message',
            type: 'string',
            required: false,
            description: 'Completion message',
          },
        ],
      },
    ];
  }

  /**
   * Get metadata for a specific node type
   */
  getNodeMetadata(nodeType: string): NodeMetadata | null {
    const allNodes = this.getAllNodeTypes();
    return allNodes.find(node => node.type === nodeType) || null;
  }

  /**
   * Get nodes by category
   */
  getNodesByCategory(category: 'trigger' | 'condition' | 'action' | 'flow_control'): NodeMetadata[] {
    return this.getAllNodeTypes().filter(node => node.category === category);
  }
}

export const nodeMetadataService = new NodeMetadataService();
