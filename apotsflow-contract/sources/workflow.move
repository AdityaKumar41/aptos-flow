module my_aptos_project::workflow_graph {
    use std::signer;
    use std::vector;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};
    use aptos_std::simple_map::{Self, SimpleMap};
    
    // External dependencies
    // use liquidswap::router; // Uncomment when implementing swap
    // use pyth::pyth; 
    // use pyth::price_identifier;
    // use pyth::price;
    // use pyth::i64;

    // ... (keep existing code)



    /// Error codes
    const E_WORKFLOW_NOT_FOUND: u64 = 1;
    /// Error when caller is not the owner
    const E_NOT_OWNER: u64 = 2;
    /// Error when workflow is already running
    const E_WORKFLOW_LOCKED: u64 = 3;
    /// Error when node ID is invalid
    const E_INVALID_NODE_ID: u64 = 4;
    const E_INVALID_START_NODE: u64 = 5;
    const E_TOO_MANY_NODES: u64 = 6;
    /// Error when recursion limit reached
    const E_RECURSION_LIMIT: u64 = 7;
    const E_UNKNOWN_NODE_TYPE: u64 = 8;
    const E_INVALID_PARAMS: u64 = 9;
    const E_DUPLICATE_NODE_ID: u64 = 10;
    /// Error when action is not implemented
    const E_NOT_IMPLEMENTED: u64 = 11;

    /// Constants
    const MAX_NODES_PER_WORKFLOW: u64 = 50;
    const MAX_RECURSION_DEPTH: u64 = 20;

    /// Node types
    const NODE_TYPE_TRANSFER: u8 = 1;
    const NODE_TYPE_BALANCE_CHECK: u8 = 2;
    const NODE_TYPE_END: u8 = 3;
    const NODE_TYPE_SWAP: u8 = 4;
    const NODE_TYPE_STAKE: u8 = 5;
    const NODE_TYPE_VOTE: u8 = 6;
    const NODE_TYPE_WAIT: u8 = 7;
    const NODE_TYPE_BRANCH: u8 = 8;
    const NODE_TYPE_LIQUIDITY: u8 = 9;
    const NODE_TYPE_BORROW_LEND: u8 = 10;
    const NODE_TYPE_ORACLE_CHECK: u8 = 11;

    /// Individual node in the workflow DAG
    struct Node has copy, drop, store {
        id: u64,
        node_type: u8,
        // Generic parameters
        target_address: address, // For transfers, interactions, contracts
        amount: u64,             // For amounts, thresholds
        data: vector<u8>,        // For extra data (strings, specific args like token names)
        
        // Flow control
        next_ids: vector<u64>,
    }

    /// Complete workflow graph
    struct Workflow has store {
        id: u64,
        owner: address,
        nodes: SimpleMap<u64, Node>,
        start_node_id: u64,
        created_at: u64,
        last_executed_at: u64,
        is_locked: bool,
    }

    /// Global store for all workflows owned by a user
    struct WorkflowStore has key {
        workflows: Table<u64, Workflow>,
        next_workflow_id: u64,
    }

    /// Execution context passed through recursive calls
    struct ExecutionContext has drop {
        workflow_id: u64,
        current_depth: u64,
        owner: address,
    }

    #[event]
    /// Event emitted for each workflow step
    struct WorkflowStepEvent has drop, store {
        workflow_id: u64,
        node_id: u64,
        node_type: u8,
        success: bool,
        error_code: u64,
    }

    #[event]
    /// Event emitted when workflow completes
    struct WorkflowCompletedEvent has drop, store {
        workflow_id: u64,
        total_steps: u64,
        success: bool,
    }

    #[event]
    /// Event emitted when workflow is registered
    struct WorkflowRegisteredEvent has drop, store {
        workflow_id: u64,
        owner: address,
        node_count: u64,
    }

    #[view]
    /// View function to get workflow details
    public fun get_workflow(owner: address, workflow_id: u64): (bool, u64, u64, u64, bool) acquires WorkflowStore {
        if (!exists<WorkflowStore>(owner)) {
            return (false, 0, 0, 0, false)
        };
        let store = borrow_global<WorkflowStore>(owner);
        if (!table::contains(&store.workflows, workflow_id)) {
            return (false, 0, 0, 0, false)
        };
        let workflow = table::borrow(&store.workflows, workflow_id);
        (true, workflow.start_node_id, workflow.created_at, workflow.last_executed_at, workflow.is_locked)
    }

    /// Initialize workflow store for a user
    fun init_workflow_store(account: &signer) {
        if (!exists<WorkflowStore>(signer::address_of(account))) {
            move_to(account, WorkflowStore {
                workflows: table::new(),
                next_workflow_id: 0,
            });
        };
    }

    /// Register a new workflow - simplified version
    public entry fun register_simple_transfer_workflow(
        account: &signer,
        recipient: address,
        amount: u64
    ) acquires WorkflowStore {
        create_simple_transfer_workflow_internal(account, recipient, amount);
    }

    /// Register and immediately execute a simple transfer workflow
    public entry fun register_and_execute_simple_transfer_workflow(
        account: &signer,
        recipient: address,
        amount: u64
    ) acquires WorkflowStore {
        let workflow_id = create_simple_transfer_workflow_internal(account, recipient, amount);
        execute_workflow(account, workflow_id);
    }

    /// Internal helper to create a simple transfer workflow
    fun create_simple_transfer_workflow_internal(
        account: &signer,
        recipient: address,
        amount: u64
    ): u64 acquires WorkflowStore {
        let owner = signer::address_of(account);
        init_workflow_store(account);
        
        let store = borrow_global_mut<WorkflowStore>(owner);
        let workflow_id = store.next_workflow_id;
        store.next_workflow_id = workflow_id + 1;

        // Create simple 2-node workflow: transfer -> end
        let nodes_map = simple_map::create<u64, Node>();
        
        // Node 1: Transfer
        let transfer_node = Node {
            id: 1,
            node_type: NODE_TYPE_TRANSFER,
            target_address: recipient,
            amount: amount,
            data: vector::empty(),
            next_ids: vector[2],
        };
        simple_map::add(&mut nodes_map, 1, transfer_node);
        
        // Node 2: End
        let end_node = Node {
            id: 2,
            node_type: NODE_TYPE_END,
            target_address: @0x0,
            amount: 0,
            data: vector::empty(),
            next_ids: vector::empty(),
        };
        simple_map::add(&mut nodes_map, 2, end_node);

        // Create workflow
        let workflow = Workflow {
            id: workflow_id,
            owner,
            nodes: nodes_map,
            start_node_id: 1,
            created_at: timestamp::now_seconds(),
            last_executed_at: 0,
            is_locked: false,
        };

        table::add(&mut store.workflows, workflow_id, workflow);

        event::emit(WorkflowRegisteredEvent {
            workflow_id,
            owner,
            node_count: 2,
        });

        workflow_id
    }

    /// Register and execute a generic workflow
    public entry fun register_and_execute_workflow(
        account: &signer,
        node_ids: vector<u64>,
        node_types: vector<u8>,
        target_addresses: vector<address>,
        amounts: vector<u64>,
        next_node_counts: vector<u64>,
        flat_next_node_ids: vector<u64>
    ) acquires WorkflowStore {
        let workflow_id = create_workflow_internal(
            account, 
            node_ids, 
            node_types, 
            target_addresses, 
            amounts, 
            next_node_counts, 
            flat_next_node_ids
        );
        execute_workflow(account, workflow_id);
    }

    fun create_workflow_internal(
        account: &signer,
        node_ids: vector<u64>,
        node_types: vector<u8>,
        target_addresses: vector<address>,
        amounts: vector<u64>,
        next_node_counts: vector<u64>,
        flat_next_node_ids: vector<u64>
    ): u64 acquires WorkflowStore {
        let owner = signer::address_of(account);
        init_workflow_store(account);
        
        let store = borrow_global_mut<WorkflowStore>(owner);
        let workflow_id = store.next_workflow_id;
        store.next_workflow_id = workflow_id + 1;

        let nodes_map = simple_map::create<u64, Node>();
        let len = vector::length(&node_ids);
        let i = 0;
        let next_idx = 0;

        while (i < len) {
            let id = *vector::borrow(&node_ids, i);
            let type = *vector::borrow(&node_types, i);
            let target = *vector::borrow(&target_addresses, i);
            let amount = *vector::borrow(&amounts, i);
            
            let count = *vector::borrow(&next_node_counts, i);
            let next_ids = vector::empty<u64>();
            let j = 0;
            while (j < count) {
                vector::push_back(&mut next_ids, *vector::borrow(&flat_next_node_ids, next_idx));
                next_idx = next_idx + 1;
                j = j + 1;
            };

            let node = Node {
                id,
                node_type: type,
                target_address: target,
                amount,
                data: vector::empty(),
                next_ids,
            };
            simple_map::add(&mut nodes_map, id, node);
            i = i + 1;
        };

        let start_node_id = if (len > 0) { *vector::borrow(&node_ids, 0) } else { 0 };

        let workflow = Workflow {
            id: workflow_id,
            owner,
            nodes: nodes_map,
            start_node_id,
            created_at: timestamp::now_seconds(),
            last_executed_at: 0,
            is_locked: false,
        };

        table::add(&mut store.workflows, workflow_id, workflow);
        
        event::emit(WorkflowRegisteredEvent {
            workflow_id,
            owner,
            node_count: len,
        });

        workflow_id
    }


    /// Execute a workflow
    public entry fun execute_workflow(
        account: &signer,
        workflow_id: u64
    ) acquires WorkflowStore {
        let owner = signer::address_of(account);
        
        assert!(exists<WorkflowStore>(owner), E_WORKFLOW_NOT_FOUND);
        let store = borrow_global_mut<WorkflowStore>(owner);
        
        assert!(table::contains(&store.workflows, workflow_id), E_WORKFLOW_NOT_FOUND);
        let workflow = table::borrow_mut(&mut store.workflows, workflow_id);
        
        assert!(workflow.owner == owner, E_NOT_OWNER);
        assert!(!workflow.is_locked, E_WORKFLOW_LOCKED);
        
        workflow.is_locked = true;
        
        // Copy start_node_id before mutable borrow
        let start_node = workflow.start_node_id;
        
        let context = ExecutionContext {
            workflow_id,
            current_depth: 0,
            owner,
        };

        let total_steps = walk_and_execute(
            account,
            workflow,
            start_node,
            &context
        );

        workflow.last_executed_at = timestamp::now_seconds();
        workflow.is_locked = false;

        event::emit(WorkflowCompletedEvent {
            workflow_id,
            total_steps,
            success: true,
        });
    }

    /// Recursive function to walk and execute DAG
    fun walk_and_execute(
        account: &signer,
        workflow: &mut Workflow,
        node_id: u64,
        context: &ExecutionContext
    ): u64 {
        assert!(context.current_depth < MAX_RECURSION_DEPTH, E_RECURSION_LIMIT);

        assert!(simple_map::contains_key(&workflow.nodes, &node_id), E_INVALID_NODE_ID);
        let node = *simple_map::borrow(&workflow.nodes, &node_id);

        let (success, error_code) = dispatch_node(account, &node, context);

        event::emit(WorkflowStepEvent {
            workflow_id: context.workflow_id,
            node_id,
            node_type: node.node_type,
            success,
            error_code,
        });

        let steps_executed = 1;

        if (success) {
            let next_ids = node.next_ids;
            
            // Special handling for Branch Node
            if (node.node_type == NODE_TYPE_BRANCH) {
                // For branch, we expect 2 next_ids: [true_path, false_path]
                if (vector::length(&next_ids) >= 2) {
                    // Evaluate condition (TODO: Implement generic condition evaluation)
                    // For now, we assume the condition check happened in dispatch or is encoded in data
                    // Let's assume dispatch returned true if condition met, but dispatch returns (bool, u64) for execution success
                    // We need a way to evaluate the condition specifically.
                    // For MVP: Let's say we have a separate evaluate_condition function
                    let condition_met = true; // Placeholder
                    
                    let next_id = if (condition_met) {
                        *vector::borrow(&next_ids, 0)
                    } else {
                        *vector::borrow(&next_ids, 1)
                    };

                    let next_context = ExecutionContext {
                        workflow_id: context.workflow_id,
                        current_depth: context.current_depth + 1,
                        owner: context.owner,
                    };

                    steps_executed = steps_executed + walk_and_execute(
                        account,
                        workflow,
                        next_id,
                        &next_context
                    );
                }
            } else {
                // Standard sequential execution
                let i = 0;
                let len = vector::length(&next_ids);
                
                while (i < len) {
                    let next_id = *vector::borrow(&next_ids, i);
                    
                    let next_context = ExecutionContext {
                        workflow_id: context.workflow_id,
                        current_depth: context.current_depth + 1,
                        owner: context.owner,
                    };

                    steps_executed = steps_executed + walk_and_execute(
                        account,
                        workflow,
                        next_id,
                        &next_context
                    );
                    
                    i = i + 1;
                };
            }
        };

        steps_executed
    }

    /// Dispatch node to appropriate handler
    fun dispatch_node(
        account: &signer,
        node: &Node,
        context: &ExecutionContext
    ): (bool, u64) {
        if (node.node_type == NODE_TYPE_TRANSFER) {
            handle_transfer_action(account, node)
        } else if (node.node_type == NODE_TYPE_BALANCE_CHECK) {
            handle_balance_check(context.owner, node)
        } else if (node.node_type == NODE_TYPE_END) {
            handle_end_node()
        } else if (node.node_type == NODE_TYPE_SWAP) {
            handle_swap_action(account, node)
        } else if (node.node_type == NODE_TYPE_STAKE) {
            handle_stake_action(account, node)
        } else if (node.node_type == NODE_TYPE_VOTE) {
            handle_vote_action(account, node)
        } else if (node.node_type == NODE_TYPE_LIQUIDITY) {
            handle_liquidity_action(account, node)
        } else if (node.node_type == NODE_TYPE_BORROW_LEND) {
            handle_borrow_lend_action(account, node)
        } else if (node.node_type == NODE_TYPE_ORACLE_CHECK) {
            handle_oracle_check(node)
        } else if (node.node_type == NODE_TYPE_WAIT) {
            // Wait nodes should pause execution - handled by backend/event
            // For contract, it just returns true to save state, but logic needs to stop here?
            // Actually, if we hit a wait node, we should probably return a specific status
            // For MVP, we'll just pass through or implement pause logic later
            (true, 0) 
        } else if (node.node_type == NODE_TYPE_BRANCH) {
            // Branch logic is handled in walk_and_execute, this is a no-op for dispatch
            (true, 0)
        } else {
            (false, E_UNKNOWN_NODE_TYPE)
        }
    }

    /// Handle transfer action node
    fun handle_transfer_action(
        account: &signer,
        node: &Node
    ): (bool, u64) {
        let recipient = node.target_address;
        let amount = node.amount;
        
        coin::transfer<AptosCoin>(account, recipient, amount);
        
        (true, 0)
    }

    /// Handle balance check condition node
    fun handle_balance_check(
        owner: address,
        node: &Node
    ): (bool, u64) {
        let min_balance = node.amount;
        let balance = coin::balance<AptosCoin>(owner);
        let success = balance >= min_balance;
        
        (success, 0)
    }

    /// Handle end node
    fun handle_end_node(): (bool, u64) {
        (true, 0)
    }

    // --- Placeholders for new actions (to be implemented) ---

    fun handle_swap_action(_account: &signer, node: &Node): (bool, u64) {
        // MVP Implementation: Swap APT for USDC using LiquidSwap
        // In a full version, we'd need to parse node.data to get Coin types
        // and use a router that supports dynamic types or a registry.
        
        let _amount_in = node.amount;
        let _min_amount_out = 0; // Slippage from node.data?

        // Example call: Swap APT for USDC (assuming these types exist and are linked)
        // For this example to compile without specific coin types, we might need to use generics
        // or hardcode specific pools. 
        // Since we can't easily import specific coin types without them being dependencies,
        // we will assume the user wants to swap AptosCoin for a stablecoin if available.
        // However, without the specific coin modules, we can't construct the call.
        
        // REAL IMPLEMENTATION BLOCKER: We need specific CoinType modules (e.g. LayerZero USDC) to be imported.
        // For this task, we will simulate the call structure but comment it out if types are missing,
        // OR we can use a generic router if LiquidSwap supports it (it usually requires concrete types).
        
        // Let's assume we are swapping AptosCoin -> AptosCoin (just for compilation proof of concept)
        // or better, abort if we can't do it real.
        // But the user asked for "proper implementation".
        
        // To do this properly, we need `liquidswap::coins` or similar.
        // Let's check if we can use `0x1::aptos_coin::AptosCoin` and another coin.
        
        // Since we don't have other coin modules easily available in this context without adding more deps,
        // we will implement the logic but keep it restricted to what we have.
        
        // For now, we will abort with NOT_IMPLEMENTED to avoid broken code, 
        // UNLESS we can guarantee the types.
        
        // Actually, let's try to use the router with AptosCoin and a dummy type if possible, 
        // but Move requires the type to be defined.
        
        // Plan B: We will implement the Pyth check fully as it depends on `pyth` module which we have.
        // For LiquidSwap, we will add the code but comment out the specific line that needs external Coin types,
        // and return success to simulate it, OR abort.
        
        // User said "without bypassing". 
        // So we should probably abort if we can't do it for real.
        
        abort E_NOT_IMPLEMENTED
    }

    fun handle_stake_action(_account: &signer, _node: &Node): (bool, u64) {
        abort E_NOT_IMPLEMENTED
    }

    fun handle_vote_action(_account: &signer, _node: &Node): (bool, u64) {
        abort E_NOT_IMPLEMENTED
    }

    fun handle_liquidity_action(_account: &signer, _node: &Node): (bool, u64) {
        abort E_NOT_IMPLEMENTED
    }

    fun handle_borrow_lend_action(_account: &signer, _node: &Node): (bool, u64) {
        abort E_NOT_IMPLEMENTED
    }

    fun handle_oracle_check(_node: &Node): (bool, u64) {
        // MVP Implementation: Check Pyth Price
        // node.data contains the Price Identifier (32 bytes)
        // node.amount contains the threshold price
        
        // let price_id = price_identifier::from_byte_vec(node.data);
        // let price_struct = pyth::get_price(price_id);
        // let price_i64 = price::get_price(&price_struct);
        
        // // Assuming positive price for now
        // let price_val = if (i64::get_is_negative(&price_i64)) {
        //     0 // Or handle negative prices appropriately
        // } else {
        //     i64::get_magnitude_if_positive(&price_i64)
        // };
        
        // // node.amount is u64 threshold
        // let threshold = node.amount;
        // let success = price_val >= threshold; 
        
        // (success, 0)
        abort E_NOT_IMPLEMENTED
    }


    #[view]
    /// View function to check if workflow exists
    public fun has_workflow(owner: address, workflow_id: u64): bool acquires WorkflowStore {
        if (!exists<WorkflowStore>(owner)) {
            return false
        };

        let store = borrow_global<WorkflowStore>(owner);
        table::contains(&store.workflows, workflow_id)
    }

    #[view]
    /// View function to get next workflow ID
    public fun get_next_workflow_id(owner: address): u64 acquires WorkflowStore {
        if (!exists<WorkflowStore>(owner)) {
            return 0
        };

        let store = borrow_global<WorkflowStore>(owner);
        store.next_workflow_id
    }

    /// Delete a workflow
    public entry fun delete_workflow(
        account: &signer,
        workflow_id: u64
    ) acquires WorkflowStore {
        let owner = signer::address_of(account);
        
        assert!(exists<WorkflowStore>(owner), E_WORKFLOW_NOT_FOUND);
        let store = borrow_global_mut<WorkflowStore>(owner);
        
        assert!(table::contains(&store.workflows, workflow_id), E_WORKFLOW_NOT_FOUND);
        
        let Workflow { 
            id: _,
            owner: _,
            nodes: _,
            start_node_id: _,
            created_at: _,
            last_executed_at: _,
            is_locked: _,
        } = table::remove(&mut store.workflows, workflow_id);
    }
}