# AptosFlow AI Agent API - Quick Start Guide

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js 18+ installed
- [ ] PostgreSQL database running
- [ ] Aptos wallet (devnet) - [Create one here](https://aptos.dev/network/faucet/)
- [ ] OpenAI API key - [Get one here](https://platform.openai.com/api-keys)

## Setup Steps

### 1. Install Dependencies

```bash
cd aptosflow-backend
npm install
```

### 2. Configure Environment

The `.env` file has been created with placeholders. Update these values:

```bash
# Required: Update your PostgreSQL connection
DATABASE_URL="postgresql://user:password@localhost:5432/aptosflow?schema=public"

# Required: Add your Aptos seller wallet address
APTOS_SELLER_ADDRESS=0xYOUR_WALLET_ADDRESS

# Required: Add your OpenAI API key
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Set Up Database

Generate Prisma client and create database tables:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3001`

## Testing the API

### Step 1: Fund Your Wallet

Get devnet APT from the faucet:
```bash
# Visit https://aptos.dev/network/faucet/
# Enter your wallet address
# Request devnet APT
```

### Step 2: Send Payment

Send 0.05 APT (5000000 octas) to your seller address using Aptos CLI or wallet.

### Step 3: Verify Payment

```bash
curl -X POST http://localhost:3001/api/payment/verify \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0xYOUR_TRANSACTION_HASH",
    "sender": "0xYOUR_WALLET_ADDRESS"
  }'
```

### Step 4: Generate Workflow

```bash
curl -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Send 1 APT to Alice every Monday at 9am",
    "sender": "0xYOUR_WALLET_ADDRESS"
  }'
```

Response will include a `promptId`.

### Step 5: Check Status

```bash
curl http://localhost:3001/api/generate/PROMPT_ID
```

## Available Endpoints

- `GET /health` - Health check
- `POST /api/generate` - Generate workflow from prompt
- `GET /api/generate/:promptId` - Get workflow status
- `POST /api/payment/verify` - Verify payment transaction
- `GET /api/payment/status/:walletAddress` - Check payment status

## Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Check DATABASE_URL is correct
- Run `npm run prisma:migrate`

### Payment Verification Fails
- Ensure you're using the correct Aptos network (devnet)
- Check transaction hash is correct
- Verify payment amount meets minimum (5000000 octas)

### AI Generation Fails
- Check OPENAI_API_KEY is valid
- Ensure you have API credits
- Check prompt is clear and specific

## Next Steps

1. Review the [full README](./README.md) for detailed documentation
2. Set up Inngest for production (optional for local dev)
3. Deploy to production with proper environment variables
4. Integrate with AptosFlow frontend

## Support

For issues or questions, refer to:
- Aptos SDK: https://aptos.dev/
- Vercel AI SDK: https://sdk.vercel.ai/
- Inngest: https://www.inngest.com/docs
- Prisma: https://www.prisma.io/docs
