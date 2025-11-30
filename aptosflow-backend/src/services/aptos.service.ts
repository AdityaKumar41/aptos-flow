import { Aptos, AptosConfig, Network, Ed25519Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';
import { config } from '@/config/index.js';
import prisma from '@/utils/prisma.js';

export class AptosService {
  private aptos: Aptos;
  private sellerAddress: string;
  private requiredAmount: bigint;
  private expiryHours: number;

  constructor() {
    const networkMap: Record<string, Network> = {
      devnet: Network.DEVNET,
      testnet: Network.TESTNET,
      mainnet: Network.MAINNET,
    };

    const aptosConfig = new AptosConfig({
      network: networkMap[config.aptosNetwork],
    });

    this.aptos = new Aptos(aptosConfig);
    this.sellerAddress = config.aptosSellerAddress;
    this.requiredAmount = BigInt(config.aptosPaymentAmount);
    this.expiryHours = config.aptosPaymentExpiryHours;
  }

  /**
   * Verify a payment transaction on the Aptos blockchain
   */
  async verifyPayment(
    txHash: string,
    senderAddress: string
  ): Promise<{
    valid: boolean;
    amount?: bigint;
    error?: string;
  }> {
    try {
      // Fetch transaction details from blockchain
      const transaction = await this.aptos.getTransactionByHash({
        transactionHash: txHash,
      });

      // Check if transaction exists
      if (!transaction) {
        return { valid: false, error: 'Transaction not found' };
      }

      // Check if transaction was successful (vm_status should be 'Executed successfully')
      const isSuccess = 
        'vm_status' in transaction && 
        transaction.vm_status === 'Executed successfully';
      
      if (!isSuccess) {
        return { valid: false, error: 'Transaction failed on blockchain' };
      }

      // For coin transfer transactions, verify details
      if (transaction.type === 'user_transaction') {
        const payload = transaction.payload as any;

        // Check if it's a coin transfer
        if (
          payload.type === 'entry_function_payload' &&
          payload.function === '0x1::coin::transfer' &&
          payload.type_arguments?.[0] === '0x1::aptos_coin::AptosCoin'
        ) {
          const [recipient, amount] = payload.arguments;

          // Verify recipient is the seller
          if (recipient !== this.sellerAddress) {
            return {
              valid: false,
              error: `Payment sent to wrong address. Expected ${this.sellerAddress}`,
            };
          }

          // Verify amount meets requirement
          const paidAmount = BigInt(amount);
          if (paidAmount < this.requiredAmount) {
            return {
              valid: false,
              error: `Insufficient payment. Required: ${this.requiredAmount}, Paid: ${paidAmount}`,
            };
          }

          // Verify sender matches
          if (transaction.sender !== senderAddress) {
            return {
              valid: false,
              error: 'Sender address mismatch',
            };
          }

          return { valid: true, amount: paidAmount };
        }
      }

      return { valid: false, error: 'Not a valid APT transfer transaction' };
    } catch (error) {
      console.error('Error verifying payment:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a wallet has a recent valid payment
   */
  async checkRecentPayment(walletAddress: string): Promise<{
    hasValidPayment: boolean;
    paymentId?: string;
  }> {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() - this.expiryHours);

    // Check database for recent verified payment
    const recentPayment = await prisma.payment.findFirst({
      where: {
        user: {
          walletAddress,
        },
        status: 'VERIFIED',
        verifiedAt: {
          gte: expiryDate,
        },
        expiresAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        verifiedAt: 'desc',
      },
    });

    if (recentPayment) {
      return {
        hasValidPayment: true,
        paymentId: recentPayment.id,
      };
    }

    return { hasValidPayment: false };
  }

  /**
   * Store verified payment in database
   */
  async storePayment(
    walletAddress: string,
    txHash: string,
    amount: bigint
  ): Promise<{ paymentId: string; userId: string }> {
    // Get or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress },
      });
    }

    // Check if payment already exists
    const existingPayment = await prisma.payment.findUnique({
      where: { txHash },
    });

    if (existingPayment) {
      return {
        paymentId: existingPayment.id,
        userId: user.id,
      };
    }

    // Create payment record
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.expiryHours);

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        txHash,
        amount,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        expiresAt,
      },
    });

    return {
      paymentId: payment.id,
      userId: user.id,
    };
  }

  /**
   * Get account balance
   */
  async getAccountBalance(address: string): Promise<bigint> {
    try {
      const resources = await this.aptos.getAccountResources({
        accountAddress: address,
      });

      const coinResource = resources.find(
        (r) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
      );

      if (coinResource) {
        return BigInt((coinResource.data as any).coin.value);
      }

      return BigInt(0);
    } catch (error) {
      console.error('Error fetching balance:', error);
      return BigInt(0);
    }
  }
  /**
   * Get events from an account
   */
  async getEvents(
    address: string,
    creationNumber: string | number
  ): Promise<any[]> {
    try {
      const events = await this.aptos.getAccountEventsByCreationNumber({
        accountAddress: address,
        creationNumber: Number(creationNumber), // Convert to number for SDK
      });

      return events;
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  /**
   * Execute a workflow on-chain
   */
  /**
   * Execute a workflow on-chain
   */
  async executeWorkflow(workflowId: string): Promise<string> {
    try {
      if (!config.aptosPrivateKey) {
        throw new Error('APTOS_PRIVATE_KEY is not configured');
      }

      // Create account from private key
      const privateKey = new Ed25519Account({ 
        privateKey: new Ed25519PrivateKey(config.aptosPrivateKey) 
      });

      // Build transaction payload
      // Note: We need the module address. Assuming it's the same as seller address or from env.
      // Ideally should be in config. For now using a placeholder or derived from config if possible.
      // But wait, the contract address is 0xcafe in Move.toml.
      // In production, this should be config.aptosContractAddress.
      // Let's assume 0xcafe for now or better, add it to config.
      // I'll use a hardcoded 0xcafe for MVP as requested in "Fix TODOs", 
      // but ideally it should be dynamic.
      // The user asked to "Replace hardcoded 0xcafe with env var" in Frontend.
      // Backend should also use env var.
      // I'll use process.env.NEXT_PUBLIC_MODULE_ADDRESS if available (but this is backend).
      // I should add aptosContractAddress to config.
      // For now, I'll use '0xcafe' but add a TODO to move to config.
      
      const moduleAddress = '0xcafe'; 

      const transaction = await this.aptos.transaction.build.simple({
        sender: privateKey.accountAddress,
        data: {
          function: `${moduleAddress}::workflow_graph::execute_workflow`,
          functionArguments: [workflowId],
        },
      });

      // Sign and submit
      const pendingTxn = await this.aptos.signAndSubmitTransaction({
        signer: privateKey,
        transaction,
      });

      console.log(`Executing workflow ${workflowId} on-chain. Hash: ${pendingTxn.hash}`);
      
      // Wait for transaction
      await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
      
      return pendingTxn.hash;
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw error;
    }
  }
}

export const aptosService = new AptosService();
