import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database
  databaseUrl: z.string().min(1, 'DATABASE_URL is required'),
  
  // Aptos
  aptosNetwork: z.enum(['devnet', 'testnet', 'mainnet']).default('devnet'),
  aptosSellerAddress: z.string().min(1, 'APTOS_SELLER_ADDRESS is required'),
  aptosPaymentAmount: z.coerce.number().default(5000000), // 0.05 APT in octas
  aptosPaymentExpiryHours: z.coerce.number().default(24),
  aptosPrivateKey: z.string().optional(),
  aptosContractAddress: z.string().default('0xcafe'),
  
  // AI Provider
  openaiApiKey: z.string().min(1, 'OPENAI_API_KEY is required'),
  aiModel: z.string().default('gpt-4o'),
  
  // Inngest
  inngestEventKey: z.string().optional(),
  inngestSigningKey: z.string().optional(),
  
  // Rate Limiting
  rateLimitRequestsPerHour: z.coerce.number().default(1000), // Increased for development
  
  // CORS
  corsOrigin: z.string().default('http://localhost:3000'),
  
  // Development Mode
  skipPaymentInDev: z.coerce.boolean().default(false),
});

const parseConfig = () => {
  try {
    return configSchema.parse({
      port: process.env.PORT,
      nodeEnv: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL,
      aptosNetwork: process.env.APTOS_NETWORK,
      aptosSellerAddress: process.env.APTOS_SELLER_ADDRESS,
      aptosPaymentAmount: process.env.APTOS_PAYMENT_AMOUNT,
      aptosPaymentExpiryHours: process.env.APTOS_PAYMENT_EXPIRY_HOURS,
      aptosPrivateKey: process.env.APTOS_PRIVATE_KEY,
      aptosContractAddress: process.env.APTOS_CONTRACT_ADDRESS,
      openaiApiKey: process.env.OPENAI_API_KEY,
      aiModel: process.env.AI_MODEL,
      inngestEventKey: process.env.INNGEST_EVENT_KEY,
      inngestSigningKey: process.env.INNGEST_SIGNING_KEY,
  // Rate limiting
  rateLimitRequestsPerHour: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR || '1000', 10), // Increased for development
      corsOrigin: process.env.CORS_ORIGIN,
      skipPaymentInDev: process.env.SKIP_PAYMENT_IN_DEV,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

export const config = parseConfig();

export type Config = z.infer<typeof configSchema>;
