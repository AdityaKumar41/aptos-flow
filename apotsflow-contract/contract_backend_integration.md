# AptosFlow Contract & Backend Integration Specification

This document provides a comprehensive technical guide for implementing the AptosFlow workflow engine, bridging the Frontend visual builder, the Backend orchestrator, and the Move Smart Contract.

## 1. System Architecture: Hybrid Orchestration

To support complex workflows with off-chain triggers (Time, Price) and on-chain execution (Swaps, Transfers), we use a **Hybrid Model**:

*   **Frontend**: Visual builder, generates JSON workflow.
*   **Backend (Orchestrator)**:
    *   Monitors Triggers (Time, Events, Price).
    *   Submits transactions to the Aptos Contract.
    *   Handles "Wait" nodes (pauses execution and resumes later).
*   **Smart Contract (Executor)**:
    *   Stores workflow definition (optional, for on-chain verification).
    *   Executes **Atomic Sequences** of nodes.
    *   Integrates with other Move modules (DEX, Lending, Oracles).

---

## 2. Move Contract Data Structures

To support the diverse node types, the `Node` struct in Move needs to be generic enough to hold various parameters.

```move
module my_aptos_project::workflow_graph {
    // ... imports ...

    struct Node has copy, drop, store {
        id: u64,
        node_type: u8,
        // Generic parameters stored as bytes or specific fields
        // Option A: Specific fields (easier for MVP)
        target_address: address, // For transfers, interactions
        amount: u64,             // For amounts
        data: vector<u8>,        // For extra data (strings, specific args)
        
        // Flow control
        next_ids: vector<u64>,
    }
}
```

---

## 3. Implementation Guide by Node Type

### A. Triggers (Backend Driven)

Triggers are primarily monitored by the **Backend**. When a trigger fires, the Backend submits a transaction to `execute_workflow` on the contract.

| Trigger Type | Backend Responsibility | Contract Responsibility |
| :--- | :--- | :--- |
| **Manual** | User clicks "Run" -> Backend calls contract. | `public entry fun execute_workflow(...)` |
| **Schedule** | Cron job runs -> Backend calls contract. | `public entry fun execute_workflow(...)` |
| **Price** | Polls Price API (Pyth/Binance) -> Checks threshold -> Calls contract. | Can verify price on-chain via Oracle (optional but recommended). |
| **Event** | Indexer listens for event (e.g., `CoinDeposit`) -> Calls contract. | Validates context if needed. |

### B. Conditions (On-Chain Logic)

Conditions are checked **inside** the Move contract during execution.

#### 1. `balance_check`
*   **Logic**: Check if `coin::balance<CoinType>(address)` meets criteria.
*   **Implementation**:
    ```move
    fun check_balance(addr: address, min_amount: u64): bool {
        coin::balance<AptosCoin>(addr) >= min_amount
    }
    ```

#### 2. `oracle_check` (Price)
*   **Integration**: **Pyth** or **Switchboard**.
*   **Logic**: Fetch price on-chain and compare.
*   **Requirement**: You must include the Oracle Move module dependency.
    ```move
    use pyth::pyth;
    use pyth::price_identifier;

    fun check_oracle_price(price_id: vector<u8>, threshold: u64): bool {
        let price = pyth::get_price(price_id);
        let price_val = pyth::get_price_value(&price);
        price_val >= threshold
    }
    ```

### C. Actions (DeFi Integrations)

Actions perform the actual on-chain logic. You will need to import the specific modules for each protocol.

#### 1. `transfer_action`
*   **Module**: `aptos_framework::coin` / `aptos_framework::aptos_account`
*   **Logic**: `aptos_account::transfer(signer, recipient, amount)`

#### 2. `swap_action` (DEX Integration)
*   **Target**: **LiquidSwap** (Pontem) or **Pancakeswap**.
*   **Logic**: Call the router's swap function.
*   **Example (LiquidSwap)**:
    ```move
    use liquidswap::router;
    
    fun execute_swap(account: &signer, coin_in: u64, min_out: u64) {
        // Requires generic type args for coins <CoinX, CoinY, Curve>
        router::swap_exact_coin_for_coin<APT, USDC, Uncorrelated>(
            account,
            coin_in,
            min_out
        );
    }
    ```
    *Note: Dynamic coin types in Move are tricky. For MVP, you might need specific functions for common pairs (APT-USDC).*

#### 3. `liquidity_provide` (DEX Integration)
*   **Target**: **LiquidSwap** (Pontem).
*   **Logic**: Call `router::add_liquidity`.
*   **Example**:
    ```move
    fun execute_add_liquidity(account: &signer, amount_x: u64, amount_y: u64) {
        router::add_liquidity<APT, USDC, Uncorrelated>(
            account,
            amount_x,
            0, // min_x (slippage)
            amount_y,
            0  // min_y (slippage)
        );
    }
    ```

#### 4. `stake_action` / `borrow_lend_action`
*   **Target**: **Aptin** or **Aries**.
*   **Logic**: Call `supply` or `borrow` entry functions.
*   **Example (Aptin)**:
    ```move
    use aptin::lending;
    
    fun execute_lend(account: &signer, amount: u64) {
        lending::supply<APT>(account, amount);
    }
    ```

#### 5. `dao_vote_action`
*   **Target**: Custom DAO contract or standard governance.
*   **Logic**: Call `vote` function on the DAO resource.

### D. Flow Control

#### 1. `branch_node` (If/Else)
*   **Logic**: Evaluate condition. If true, follow `next_ids[0]`, else `next_ids[1]`.
*   **Implementation**:
    ```move
    let next_node_id = if (condition_met) {
        *vector::borrow(&node.next_ids, 0)
    } else {
        *vector::borrow(&node.next_ids, 1)
    };
    ```

#### 2. `wait_node` (The Tricky Part)
*   **Problem**: Blockchain transactions are atomic and instant. You cannot "wait 1 hour" inside a function.
*   **Solution**: **Backend Orchestration**.
    1.  Contract executes nodes *until* it hits a `wait_node`.
    2.  Contract saves state: "Workflow Paused at Node X".
    3.  Backend detects pause.
    4.  Backend waits for the duration (off-chain timer).
    5.  Backend calls `resume_workflow(workflow_id)` to continue execution.

---

## 4. Backend Implementation Checklist

1.  **Event Listener**:
    *   Implement an **Aptos Indexer** or poll events to detect `EventTrigger` conditions (e.g., "When I receive USDC").
    *   When event detected -> Trigger workflow.

2.  **Scheduler**:
    *   Use a library like `node-cron` or `bullmq` (Redis) to handle `ScheduleTrigger` and `WaitNode` resumes.

3.  **Transaction Builder**:
    *   The backend must construct the transaction payload.
    *   **Crucial**: For DEX swaps, the backend needs to determine the correct Type Arguments (e.g., `<0x1::aptos_coin::AptosCoin, 0x...::usdc::Coin>`) and pass them to the Move entry function.

---

## 5. Move Contract Dependencies (Move.toml)

To integrate these features, add these dependencies to your `Move.toml`:

```toml
[dependencies]
AptosFramework = { git = "https://github.com/aptos-labs/aptos-framework.git", rev = "mainnet" }
# Add these for integrations (URLs are examples, verify latest)
LiquidSwap = { git = "https://github.com/pontem-network/liquidswap.git", rev = "main" }
Pyth = { git = "https://github.com/pyth-network/pyth-crosschain.git", subdir = "target_chains/aptos/contracts", rev = "main" }
```

## 6. Summary of Work

1.  **Update `workflow.move`**:
    *   Expand `Node` struct to hold `target_address`, `amount`, `data`.
    *   Add `dispatch_node` logic for Swap, Stake, Oracle.
    *   Implement `branch` logic.
2.  **Backend**:
    *   Implement Event Indexer.
    *   Implement Cron Scheduler.
    *   Implement "Wait" resume logic.
