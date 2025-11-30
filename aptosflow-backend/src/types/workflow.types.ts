import { z } from 'zod';

// ============================================================================
// Trigger Node Types
// ============================================================================

export const manualTriggerSchema = z.object({
  type: z.literal('manual_trigger'),
  description: z.string().optional(),
});

export const scheduleSchema = z.object({
  type: z.literal('schedule_trigger'),
  cron: z.string().describe('Cron expression for scheduling'),
  timezone: z.string().optional().default('UTC'),
});

export const webhookSchema = z.object({
  type: z.literal('webhook_trigger'),
  url: z.string().url().optional(),
  event: z.string().describe('Event name to listen for'),
});

export const eventSchema = z.object({
  type: z.literal('event_trigger'),
  eventType: z.enum(['token_transfer', 'nft_received', 'nft_transfer', 'balance_change']),
  contract: z.string().optional(),
  filters: z.record(z.any()).optional(),
});

export const priceTriggerSchema = z.object({
  type: z.literal('price_trigger'),
  token: z.string().describe('Token to monitor'),
  operator: z.enum(['>', '<', '>=', '<=', '==']),
  threshold: z.number().positive(),
  oracleProvider: z.enum(['chainlink', 'pyth', 'switchboard']).optional().default('pyth'),
});

export const triggerSchema = z.discriminatedUnion('type', [
  manualTriggerSchema,
  scheduleSchema,
  webhookSchema,
  eventSchema,
  priceTriggerSchema,
]);

export type TriggerNode = z.infer<typeof triggerSchema>;

// ============================================================================
// Condition Node Types
// ============================================================================

export const balanceConditionSchema = z.object({
  type: z.literal('balance_check'),
  operator: z.enum(['>', '<', '>=', '<=', '==']),
  amount: z.number().positive(),
  token: z.string().optional().default('APT'),
});

export const oracleConditionSchema = z.object({
  type: z.literal('oracle_check'),
  token: z.string(),
  operator: z.enum(['>', '<', '>=', '<=', '==']),
  value: z.number(),
  oracleProvider: z.enum(['chainlink', 'pyth', 'switchboard']).optional().default('pyth'),
});

export const multiConditionSchema = z.object({
  type: z.literal('multi_condition'),
  logic: z.enum(['AND', 'OR']),
  conditions: z.array(z.union([
    balanceConditionSchema,
    oracleConditionSchema,
  ])),
});

export const timeConditionSchema = z.object({
  type: z.literal('time_condition'),
  operator: z.enum(['before', 'after', 'between']),
  time: z.string(),
  endTime: z.string().optional(),
});

export const customConditionSchema = z.object({
  type: z.literal('custom_condition'),
  expression: z.string().describe('Custom condition expression'),
});

export const conditionSchema = z.discriminatedUnion('type', [
  balanceConditionSchema,
  oracleConditionSchema,
  multiConditionSchema,
  timeConditionSchema,
  customConditionSchema,
]).optional();

export type ConditionNode = z.infer<typeof conditionSchema>;

// ============================================================================
// Action Node Types
// ============================================================================

export const transferActionSchema = z.object({
  type: z.literal('transfer_action'),
  recipient: z.string().describe('Recipient wallet address'),
  amount: z.number().positive().describe('Amount in octas'),
  token: z.string().optional().default('APT'),
});

export const stakeActionSchema = z.object({
  type: z.literal('stake_action'),
  poolAddress: z.string().describe('Staking pool address'),
  amount: z.number().positive().describe('Amount to stake in octas'),
  token: z.string().optional().default('APT'),
});

export const unstakeActionSchema = z.object({
  type: z.literal('unstake_action'),
  poolAddress: z.string().describe('Staking pool address'),
  amount: z.number().positive().describe('Amount to unstake in octas'),
  token: z.string(),
});

export const swapActionSchema = z.object({
  type: z.literal('swap_action'),
  fromToken: z.string(),
  toToken: z.string(),
  amount: z.number().positive(),
  slippage: z.number().min(0).max(100).optional().default(1),
  dex: z.enum(['pancakeswap', 'liquidswap', 'pontem']).optional().default('liquidswap'),
  minOutput: z.number().optional(),
});

export const mintNftActionSchema = z.object({
  type: z.literal('mint_nft_action'),
  collection: z.string().describe('NFT collection address'),
  metadata: z.object({
    name: z.string(),
    description: z.string(),
    uri: z.string().url(),
  }),
});

export const daoVoteActionSchema = z.object({
  type: z.literal('dao_vote_action'),
  proposalId: z.string(),
  vote: z.enum(['yes', 'no', 'abstain']),
  daoContract: z.string(),
});

export const liquidityProvideSchema = z.object({
  type: z.literal('liquidity_provide'),
  tokenA: z.string(),
  tokenB: z.string(),
  amountA: z.number().positive(),
  amountB: z.number().positive(),
  dex: z.enum(['pancakeswap', 'liquidswap', 'pontem']).optional().default('liquidswap'),
});

export const borrowLendActionSchema = z.object({
  type: z.literal('borrow_lend_action'),
  asset: z.string(),
  mode: z.enum(['borrow', 'lend', 'repay', 'withdraw']),
  amount: z.number().positive(),
  protocol: z.enum(['aptin', 'aries']).optional().default('aptin'),
});

export const yieldFarmBoostSchema = z.object({
  type: z.literal('yield_farm_boost'),
  lpToken: z.string().describe('LP token address'),
  farmContract: z.string().describe('Farm contract address'),
  amount: z.number().positive(),
});

export const defiCompoundSchema = z.object({
  type: z.literal('defi_compound'),
  farmAddress: z.string(),
  interval: z.number().positive().describe('Compound interval in seconds'),
  minReward: z.number().optional().describe('Minimum reward before compounding'),
});

export const notifyActionSchema = z.object({
  type: z.literal('notify_action'),
  message: z.string(),
  channel: z.enum(['email', 'webhook', 'push']).optional().default('webhook'),
  destination: z.string().optional(),
});

export const actionSchema = z.discriminatedUnion('type', [
  transferActionSchema,
  stakeActionSchema,
  unstakeActionSchema,
  swapActionSchema,
  mintNftActionSchema,
  daoVoteActionSchema,
  liquidityProvideSchema,
  borrowLendActionSchema,
  yieldFarmBoostSchema,
  defiCompoundSchema,
  notifyActionSchema,
]);

export type ActionNode = z.infer<typeof actionSchema>;

// ============================================================================
// Flow Control Node Types
// ============================================================================

export const waitNodeSchema = z.object({
  type: z.literal('wait_node'),
  duration: z.number().positive().describe('Wait duration in seconds'),
});

export const loopNodeSchema = z.object({
  type: z.literal('loop_node'),
  iterations: z.number().positive().optional(),
  condition: conditionSchema.optional(),
  maxIterations: z.number().positive().optional().default(100),
});

export const branchNodeSchema = z.object({
  type: z.literal('branch_node'),
  condition: conditionSchema,
  truePath: z.string().optional().describe('Node ID for true branch'),
  falsePath: z.string().optional().describe('Node ID for false branch'),
});

export const endNodeSchema = z.object({
  type: z.literal('end_node'),
  message: z.string().optional(),
});

export const flowControlSchema = z.discriminatedUnion('type', [
  waitNodeSchema,
  loopNodeSchema,
  branchNodeSchema,
  endNodeSchema,
]);

export type FlowControlNode = z.infer<typeof flowControlSchema>;

// ============================================================================
// Complete Workflow Schema
// ============================================================================

export const workflowSchema = z.object({
  trigger: z.object({
    type: z.string(),
    cron: z.string().optional(),
    timezone: z.string().optional(),
    url: z.string().optional(),
    event: z.string().optional(),
    eventType: z.string().optional(),
    contract: z.string().optional(),
    filters: z.record(z.any()).optional(),
    token: z.string().optional(),
    operator: z.string().optional(),
    threshold: z.number().optional(),
    oracleProvider: z.string().optional(),
    description: z.string().optional(),
  }),
  condition: z.object({
    type: z.string(),
    operator: z.string().optional(),
    amount: z.number().optional(),
    token: z.string().optional(),
    value: z.number().optional(),
    oracleProvider: z.string().optional(),
    logic: z.string().optional(),
    conditions: z.array(z.object({
      type: z.string(),
      operator: z.string().optional(),
      amount: z.number().optional(),
      token: z.string().optional(),
      value: z.number().optional(),
      oracleProvider: z.string().optional(),
    })).optional(),
    time: z.string().optional(),
    endTime: z.string().optional(),
    expression: z.string().optional(),
  }).optional(),
  action: z.object({
    type: z.string(),
    recipient: z.string().optional(),
    amount: z.number().optional(),
    token: z.string().optional(),
    poolAddress: z.string().optional(),
    fromToken: z.string().optional(),
    toToken: z.string().optional(),
    slippage: z.number().optional(),
    dex: z.string().optional(),
    minOutput: z.number().optional(),
    collection: z.string().optional(),
    metadata: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      uri: z.string().optional(),
    }).optional(),
    proposalId: z.string().optional(),
    vote: z.string().optional(),
    daoContract: z.string().optional(),
    tokenA: z.string().optional(),
    tokenB: z.string().optional(),
    amountA: z.number().optional(),
    amountB: z.number().optional(),
    asset: z.string().optional(),
    mode: z.string().optional(),
    protocol: z.string().optional(),
    lpToken: z.string().optional(),
    farmContract: z.string().optional(),
    farmAddress: z.string().optional(),
    interval: z.number().optional(),
    minReward: z.number().optional(),
    message: z.string().optional(),
    channel: z.string().optional(),
    destination: z.string().optional(),
  }),
  flowControl: z.object({
    type: z.string(),
    duration: z.number().optional(),
    iterations: z.number().optional(),
    condition: z.any().optional(),
    maxIterations: z.number().optional(),
    truePath: z.string().optional(),
    falsePath: z.string().optional(),
    message: z.string().optional(),
  }).optional(),
  metadata: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

export type WorkflowGraph = z.infer<typeof workflowSchema>;

// ============================================================================
// API Request/Response Types
// ============================================================================

export const generateRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(1000, 'Prompt too long'),
  sender: z.string().regex(/^0x[a-fA-F0-9]{1,64}$/, 'Invalid wallet address'),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const verifyPaymentRequestSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{1,64}$/, 'Invalid transaction hash'),
  sender: z.string().regex(/^0x[a-fA-F0-9]{1,64}$/, 'Invalid wallet address'),
});

export type VerifyPaymentRequest = z.infer<typeof verifyPaymentRequestSchema>;
