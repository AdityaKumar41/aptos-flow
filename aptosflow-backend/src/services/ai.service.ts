import { openai } from '@ai-sdk/openai';
import { generateObject, streamText, streamObject } from 'ai';
import { config } from '@/config/index.js';
import { workflowSchema, type WorkflowGraph } from '@/types/workflow.types.js';

export class AIService {
  private model: string;

  constructor() {
    this.model = config.aiModel;
  }

  /**
   * Stream conversational chat responses
   */
  async streamChat(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ) {
    const systemPrompt = `You are a helpful AI assistant for AptosFlow, a visual workflow automation platform for the Aptos blockchain.

You can help users:
- Understand what AptosFlow can do
- Learn about available workflow nodes (triggers, conditions, actions)
- Get guidance on building workflows
- Answer questions about Aptos blockchain automation

Be friendly, concise, and helpful. If the user wants to create a workflow, guide them to use specific language like "Send X APT to Y" or "Swap X for Y".

Available workflow capabilities:
- Triggers: Manual, Scheduled (cron), Price-based, Blockchain events
- Conditions: Balance checks, Oracle price checks, Time conditions
- Actions: Transfer tokens, Swap on DEX, Stake, Lend/Borrow, Provide liquidity, DAO voting, NFT minting
- Flow Control: Wait, Loop, Branch, End nodes`;

    // Convert history to messages format
    const messages = history.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    return streamText({
      model: openai(this.model),
      system: systemPrompt,
      messages: [...messages, { role: 'user', content: message }],
    });
  }

  /**
   * Stream workflow generation with progressive updates
   */
  async streamWorkflowGeneration(prompt: string, existingWorkflow?: any) {
    const systemPrompt = this.buildSystemPrompt();
    
    // Build user prompt with optional existing workflow context
    let userPrompt = prompt;
    if (existingWorkflow) {
      userPrompt = `EXISTING WORKFLOW (to be edited):
${JSON.stringify(existingWorkflow, null, 2)}

USER REQUEST: ${prompt}

INSTRUCTIONS: Modify the existing workflow according to the user's request. Only change the specific parts mentioned. Preserve all other fields and nodes.`;
    }

    const result = await streamObject({
      model: openai(config.aiModel),
      schema: workflowSchema,
      prompt: userPrompt,
      system: systemPrompt,
    });

    return result;
  }

  /**
   * Generate workflow from natural language prompt (non-streaming)
   */
  async generateWorkflow(prompt: string): Promise<{
    success: boolean;
    workflow?: WorkflowGraph;
    error?: string;
  }> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const fewShotExamples = this.getFewShotExamples();

      const result = await generateObject({
        model: openai(this.model),
        schema: workflowSchema,
        prompt: `${systemPrompt}\n\n${fewShotExamples}\n\nUser prompt: "${prompt}"\n\nGenerate a valid workflow JSON:`,
      });

      return {
        success: true,
        workflow: result.object,
      };
    } catch (error) {
      console.error('Error generating workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate workflow',
      };
    }
  }

  /**
   * Build system prompt with instructions
   */
  private buildSystemPrompt(): string {
    return `You are an AI assistant that converts natural language prompts into structured workflow JSON for the AptosFlow automation platform.

CRITICAL DEFAULT RULE: Unless the user explicitly mentions a time, schedule, or recurring pattern, ALWAYS use "manual_trigger" as the trigger type.

Your task is to analyze the user's prompt and generate a valid workflow with:
1. A trigger (when the workflow should run) - DEFAULT to manual_trigger
2. An optional condition (what must be true)
3. An action (what should happen)
4. Optional flow control (wait, loop, branch, end)

Available trigger types:
- manual_trigger: User manually runs the workflow (use when prompt says "manual", "manually", "when I run", "when I trigger", or doesn't specify a schedule)
- schedule_trigger: Time-based triggers (use cron expressions like "0 * * * *" for every hour) - ONLY use when user specifies a time/schedule
- webhook_trigger: External event triggers
- event_trigger: Blockchain events (token_transfer, nft_received, nft_transfer, balance_change)
- price_trigger: Execute when token price crosses threshold

Available condition types:
- balance_check: Check wallet balance (use this for "check balance" requests)
- oracle_check: Check token price from oracle (chainlink, pyth, switchboard)
- multi_condition: Combine multiple conditions with AND/OR logic
- time_condition: Time-based conditions (e.g., "after 2 hours")
- custom_condition: Custom expressions

Available action types:
BASIC:
- balance_check: Check and return wallet balance (use this for balance queries, NOT transfer_action)
- transfer_action: Send APT or tokens to an address (only for actual transfers)
  Fields: recipient (address), amount (in octas), tokenType (optional)
- notify_action: Send notifications
  Fields: message, channel (email, sms, webhook)

DEFI:
- stake_action: Stake APT into a DeFi pool
  Fields: amount (octas), poolAddress, protocol
- unstake_action: Unstake tokens from pool
  Fields: amount (octas), poolAddress, protocol
- swap_action: Exchange tokens on DEX (pancakeswap, liquidswap, pontem)
  Fields: fromToken, toToken, amount, dex, slippage
- liquidity_provide: Add liquidity to DEX pool
  Fields: token0, token1, amount0, amount1, poolAddress, dex
- borrow_lend_action: Borrow/lend on lending markets (aptin, aries)
  Fields: action (borrow/lend), amount, asset, protocol, collateralRatio
- yield_farm_boost: Deposit LP tokens into farming contract
  Fields: lpTokenAddress, farmAddress, amount, protocol
- defi_compound: Auto-compound earnings periodically
  Fields: protocol, poolAddress, frequency

NFT & DAO:
- mint_nft_action: Mint NFT via collection
  Fields: collectionAddress, metadata
- dao_vote_action: Vote on DAO proposal
  Fields: proposalId, contractAddress, vote (yes/no/abstain)

Flow Control:
- wait_node: Wait X seconds between steps
  Fields: duration (seconds)
- loop_node: Repeat a subflow N times or until condition
  Fields: iterations, condition
- branch_node: Route based on condition result (if/else)
  Fields: condition, truePath, falsePath
- end_node: Mark end of workflow (use this when user says "end the workflow")

CRITICAL VALUE EXTRACTION RULES:
1. **Wallet Addresses**: Extract any 0x... addresses and put in correct field
   Example: "send to 0x123abc" → recipient: "0x123abc"

2. **Amounts**: Convert to octas (1 APT = 100,000,000 octas)
   Example: "send 5 APT" → amount: "500000000"
   Example: "stake 0.5 APT" → amount: "50000000"

3. **Proposal IDs**: Extract numbers after "proposal"
   Example: "vote on proposal 42" → proposalId: "42"

4. **Contract Addresses**: Extract addresses mentioned with "contract" or "DAO"
   Example: "at contract 0xdao123" → contractAddress: "0xdao123"

5. **Token Names**: Extract token symbols
   Example: "swap APT for USDC" → fromToken: "APT", toToken: "USDC"

6. **Protocol Names**: Extract DEX/protocol names
   Example: "on Pancakeswap" → dex: "pancakeswap"
   Example: "stake on Aptin" → protocol: "aptin"

7. **Time Values**: Convert to seconds or cron
   Example: "every hour" → schedule: "0 * * * *"
   Example: "wait 2 hours" → duration: 7200

8. **Percentages**: Extract slippage, ratios
   Example: "5% slippage" → slippage: 0.05
   Example: "150% collateral" → collateralRatio: 1.5

IMPORTANT RULES:
- DEFAULT to manual_trigger unless user explicitly specifies a time/schedule
- For "check balance" requests, use action type "balance_check", NOT "transfer_action"
- Use cron expressions for schedules: "0 * * * *" = every hour, "0 */2 * * *" = every 2 hours
- For time conditions like "after 2 hours", use time_condition with duration
- When user says "end the workflow", add flowControl with type "end_node"
- Amounts should be in octas (1 APT = 100,000,000 octas)
- ALWAYS extract and include specific values from the prompt (addresses, IDs, amounts, etc.)
- Be precise and extract ALL relevant details from the prompt
- CRITICAL: Use the EXACT address and amount provided by the user

EXAMPLES:

Prompt: "manual trigger check balance then send 1 APT to 0x440574625c46ef4d3429df220686eab520ef1d54d60893470d1701537c629337"
Output: {
  "trigger": {"type": "manual_trigger"},
  "action": {
    "type": "transfer_action",
    "recipient": "0x440574625c46ef4d3429df220686eab520ef1d54d60893470d1701537c629337",
    "amount": "100000000",
    "tokenType": "APT"
  }
}

Prompt: "vote on proposal 123 at contract 0xabc...def"
Output: {
  "trigger": {"type": "manual_trigger"},
  "action": {
    "type": "dao_vote_action",
    "proposalId": "123",
    "contractAddress": "0xabc...def",
    "vote": "yes"
  }
}

Prompt: "send 5 APT to 0x123...456 every Friday"
Output: {
  "trigger": {"type": "schedule_trigger", "schedule": "0 0 * * FRI"},
  "action": {
    "type": "transfer_action",
    "recipient": "0x123...456",
    "amount": "500000000",
    "tokenType": "APT"
  }
}

Prompt: "swap 10 APT for USDC on Pancakeswap with 1% slippage"
Output: {
  "trigger": {"type": "manual_trigger"},
  "action": {
    "type": "swap_action",
    "fromToken": "APT",
    "toToken": "USDC",
    "amount": "1000000000",
    "dex": "pancakeswap",
    "slippage": 0.01
  }
}

CRITICAL:
- You MUST return a valid JSON object.
- The root object must have keys: "trigger", "action", and optionally "condition", "flowControl", "metadata".
- Do not wrap the JSON in markdown code blocks (e.g., \`\`\`json). Just return the raw JSON object.
- Ensure all "type" fields exactly match the list above (e.g., "manual_trigger", not "Manual Trigger").
- ALWAYS include user-provided values in the appropriate fields.`;
  }

  /**
   * Get few-shot examples for better generation
   */
  private getFewShotExamples(): string {
    return `Examples:

Example 1 - Basic Transfer:
Prompt: "Send 2 APT to Bob every Friday at 6pm"
Output:
{
  "trigger": {
    "type": "schedule_trigger",
    "cron": "0 18 * * FRI",
    "timezone": "UTC"
  },
  "action": {
    "type": "transfer_action",
    "recipient": "0xBOB",
    "amount": 200000000,
    "token": "APT"
  }
}

Example 2 - DeFi Staking:
Prompt: "Stake 10 APT when price is above $8"
Output:
{
  "trigger": {
    "type": "price_trigger",
    "token": "APT",
    "operator": ">",
    "threshold": 8,
    "oracleProvider": "pyth"
  },
  "action": {
    "type": "stake_action",
    "poolAddress": "0xSTAKING_POOL",
    "amount": 1000000000,
    "token": "APT"
  }
}

Example 3 - Token Swap with Condition:
Prompt: "If my balance is greater than 10 APT, swap 5 APT to USDC"
Output:
{
  "trigger": {
    "type": "manual_trigger"
  },
  "condition": {
    "type": "balance_check",
    "operator": ">",
    "amount": 1000000000,
    "token": "APT"
  },
  "action": {
    "type": "swap_action",
    "fromToken": "APT",
    "toToken": "USDC",
    "amount": 500000000,
    "slippage": 1,
    "dex": "liquidswap"
  }
}

Example 4 - Yield Farming:
Prompt: "Provide liquidity with 5 APT and 100 USDC to Liquidswap"
Output:
{
  "trigger": {
    "type": "manual_trigger"
  },
  "action": {
    "type": "liquidity_provide",
    "tokenA": "APT",
    "tokenB": "USDC",
    "amountA": 500000000,
    "amountB": 100000000,
    "dex": "liquidswap"
  }
}

Example 5 - Auto-Compound Strategy:
Prompt: "Auto-compound my farm rewards every day"
Output:
{
  "trigger": {
    "type": "schedule_trigger",
    "cron": "0 0 * * *",
    "timezone": "UTC"
  },
  "action": {
    "type": "defi_compound",
    "farmAddress": "0xFARM_CONTRACT",
    "interval": 86400,
    "minReward": 1000000
  }
}

Example 6 - Lending Protocol:
Prompt: "Lend 50 APT on Aptin Finance"
Output:
{
  "trigger": {
    "type": "manual_trigger"
  },
  "action": {
    "type": "borrow_lend_action",
    "asset": "APT",
    "mode": "lend",
    "amount": 5000000000,
    "protocol": "aptin"
  }
}

Example 7 - DAO Voting:
Prompt: "Vote yes on proposal #42"
Output:
{
  "trigger": {
    "type": "manual_trigger"
  },
  "action": {
    "type": "dao_vote_action",
    "proposalId": "42",
    "vote": "yes",
    "daoContract": "0xDAO_CONTRACT"
  }
}

Example 8 - NFT Minting:
Prompt: "Mint an NFT when I receive a token transfer"
Output:
{
  "trigger": {
    "type": "event_trigger",
    "eventType": "token_transfer"
  },
  "action": {
    "type": "mint_nft_action",
    "collection": "0xNFT_COLLECTION",
    "metadata": {
      "name": "Welcome NFT",
      "description": "Thank you for the transfer!",
      "uri": "ipfs://QmExample"
    }
  }
}

Example 9 - Multi-Condition Check:
Prompt: "If APT price is above $10 AND my balance is over 5 APT, swap 2 APT to USDC"
Output:
{
  "trigger": {
    "type": "manual_trigger"
  },
  "condition": {
    "type": "multi_condition",
    "logic": "AND",
    "conditions": [
      {
        "type": "oracle_check",
        "token": "APT",
        "operator": ">",
        "value": 10,
        "oracleProvider": "pyth"
      },
      {
        "type": "balance_check",
        "operator": ">",
        "amount": 500000000,
        "token": "APT"
      }
    ]
  },
  "action": {
    "type": "swap_action",
    "fromToken": "APT",
    "toToken": "USDC",
    "amount": 200000000,
    "slippage": 1,
    "dex": "liquidswap"
  }
}`;
  }

  /**
   * Validate generated workflow
   */
  async validateWorkflow(workflow: unknown): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      workflowSchema.parse(workflow);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.errors?.[0]?.message || 'Invalid workflow structure',
      };
    }
  }
}

export const aiService = new AIService();
