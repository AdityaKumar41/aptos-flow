# AptosFlow Frontend Node Specifications

This document lists all the workflow nodes available in the AptosFlow frontend. Use this as a reference for implementing the corresponding logic in the Move smart contract.

## 1. Triggers
Nodes that initiate a workflow.

### `manual_trigger`
*   **Label:** Manual Trigger
*   **Description:** Start workflow manually via UI button.
*   **Parameters:**
    *   `description` (string, optional): Optional description.

### `schedule_trigger`
*   **Label:** Scheduled Trigger
*   **Description:** Run workflow on a schedule using cron expressions.
*   **Parameters:**
    *   `cron` (string, required): Cron expression (e.g., "0 18 * * FRI").
    *   `timezone` (string, optional, default: 'UTC'): Timezone for schedule.

### `price_trigger`
*   **Label:** Price Trigger
*   **Description:** Execute when token price crosses threshold.
*   **Parameters:**
    *   `token` (string, required): Token to monitor.
    *   `operator` (enum, required): Comparison operator ('>', '<', '>=', '<=', '==').
    *   `threshold` (number, required): Price threshold in USD.
    *   `oracleProvider` (enum, optional, default: 'pyth'): 'chainlink', 'pyth', 'switchboard'.

### `event_trigger`
*   **Label:** Event Trigger
*   **Description:** Trigger on blockchain events.
*   **Parameters:**
    *   `eventType` (enum, required): 'token_transfer', 'nft_received', 'nft_transfer', 'balance_change'.
    *   `contract` (string, optional): Optional contract address filter.

---

## 2. Conditions
Nodes that check for specific criteria before proceeding.

### `balance_check`
*   **Label:** Balance Check
*   **Description:** Check wallet token balance.
*   **Parameters:**
    *   `operator` (enum, required): '>', '<', '>=', '<=', '=='.
    *   `amount` (number, required): Amount in octas.
    *   `token` (string, optional, default: 'APT'): Token symbol/address.

### `oracle_check`
*   **Label:** Oracle Price Check
*   **Description:** Check token price from oracle.
*   **Parameters:**
    *   `token` (string, required): Token symbol.
    *   `operator` (enum, required): '>', '<', '>=', '<=', '=='.
    *   `value` (number, required): Price in USD.
    *   `oracleProvider` (enum, optional, default: 'pyth'): 'chainlink', 'pyth', 'switchboard'.

---

## 3. Actions
Nodes that perform on-chain operations.

### `transfer_action`
*   **Label:** Token Transfer
*   **Description:** Send APT or tokens to recipient.
*   **Parameters:**
    *   `recipient` (string, required): Recipient wallet address.
    *   `amount` (number, required): Amount in octas.
    *   `token` (string, optional, default: 'APT'): Token symbol/address.

### `stake_action`
*   **Label:** Stake Tokens
*   **Description:** Stake APT into DeFi pool.
*   **Parameters:**
    *   `poolAddress` (string, required): Staking pool address.
    *   `amount` (number, required): Amount to stake in octas.
    *   `token` (string, optional, default: 'APT'): Token symbol/address.

### `swap_action`
*   **Label:** Token Swap
*   **Description:** Exchange tokens on DEX.
*   **Parameters:**
    *   `fromToken` (string, required): Source token.
    *   `toToken` (string, required): Destination token.
    *   `amount` (number, required): Amount in octas.
    *   `slippage` (number, optional, default: 1): Max slippage %.
    *   `dex` (enum, optional, default: 'liquidswap'): 'pancakeswap', 'liquidswap', 'pontem'.

### `liquidity_provide`
*   **Label:** Provide Liquidity
*   **Description:** Add liquidity to DEX pool.
*   **Parameters:**
    *   `tokenA` (string, required): First token.
    *   `tokenB` (string, required): Second token.
    *   `amountA` (number, required): Amount of first token.
    *   `amountB` (number, required): Amount of second token.
    *   `dex` (enum, optional, default: 'liquidswap'): 'pancakeswap', 'liquidswap', 'pontem'.

### `borrow_lend_action`
*   **Label:** Borrow/Lend
*   **Description:** Interact with lending protocols.
*   **Parameters:**
    *   `asset` (string, required): Asset symbol/address.
    *   `mode` (enum, required): 'borrow', 'lend', 'repay', 'withdraw'.
    *   `amount` (number, required): Amount.
    *   `protocol` (enum, optional, default: 'aptin'): 'aptin', 'aries'.

### `dao_vote_action`
*   **Label:** DAO Vote
*   **Description:** Vote on DAO proposal.
*   **Parameters:**
    *   `proposalId` (string, required): ID of the proposal.
    *   `vote` (enum, required): 'yes', 'no', 'abstain'.
    *   `daoContract` (string, required): Address of the DAO contract.

---

## 4. Flow Control
Nodes that manage the execution flow.

### `wait_node`
*   **Label:** Wait
*   **Description:** Wait for specified duration.
*   **Parameters:**
    *   `duration` (number, required): Wait duration in seconds.

### `branch_node`
*   **Label:** Branch
*   **Description:** Conditional routing (if/else).
*   **Parameters:**
    *   `condition` (object, required): Condition to evaluate.
    *   `truePath` (string, optional): Node ID for true branch.
    *   `falsePath` (string, optional): Node ID for false branch.

### `end_node`
*   **Label:** End
*   **Description:** Mark workflow completion.
*   **Parameters:**
    *   `message` (string, optional): Completion message.
