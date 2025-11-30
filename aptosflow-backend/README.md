# AptosFlow AI Agent API

Backend API service for AptosFlow with AI-powered prompt-to-workflow generation and Aptos X402 micropayment gating.

## 🚀 Features

- **AI-Powered Workflow Generation**: Convert natural language prompts into structured AptosFlow workflows
- **Micropayment Gating**: Aptos X402 integration for per-prompt payments
- **Async Processing**: Background job processing with Inngest
- **Rate Limiting**: Per-wallet rate limiting to prevent abuse
- **Type-Safe**: Full TypeScript with Zod validation
- **Database**: PostgreSQL with Prisma ORM

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Aptos wallet (devnet/testnet)
- OpenAI API key (or other AI provider)
- Inngest account (optional for local dev)

## 🛠️ Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `APTOS_SELLER_ADDRESS`: Your Aptos wallet address for receiving payments
- `APTOS_PAYMENT_AMOUNT`: Required payment in octas (e.g., 5000000 = 0.05 APT)
- `OPENAI_API_KEY`: Your OpenAI API key
- `INNGEST_EVENT_KEY`: Inngest event key (optional for local dev)
- `INNGEST_SIGNING_KEY`: Inngest signing key (optional for local dev)

### 3. Set Up Database

Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`

## 📚 API Documentation

### Health Check

```bash
GET /health
```

Returns server health status and service connectivity.

### Generate Workflow

```bash
POST /api/generate
Content-Type: application/json

{
  "prompt": "Send 2 APT to Bob every Friday at 6pm",
  "sender": "0xYOUR_WALLET_ADDRESS"
}
```

**Response (202 Accepted):**
```json
{
  "promptId": "uuid",
  "status": "PROCESSING",
  "message": "Workflow generation started"
}
```

### Check Workflow Status

```bash
GET /api/generate/:promptId
```

**Response (when completed):**
```json
{
  "promptId": "uuid",
  "status": "COMPLETED",
  "workflow": {
    "trigger": {
      "type": "schedule",
      "cron": "0 18 * * FRI"
    },
    "action": {
      "type": "transfer",
      "recipient": "0xBOB",
      "amount": 2000000
    }
  }
}
```

### Verify Payment

```bash
POST /api/payment/verify
Content-Type: application/json

{
  "txHash": "0xTRANSACTION_HASH",
  "sender": "0xYOUR_WALLET_ADDRESS"
}
```

### Check Payment Status

```bash
GET /api/payment/status/:walletAddress
```

## 🔄 Workflow

1. **User sends payment** to seller address on Aptos
2. **User submits prompt** via `/api/generate`
3. **Backend verifies payment** on Aptos blockchain
4. **Prompt is queued** for async processing via Inngest
5. **AI generates workflow** using Vercel AI SDK
6. **Workflow is stored** in database
7. **User retrieves workflow** via `/api/generate/:promptId`

## 🧪 Testing

### Local Testing with Aptos Devnet

1. Create a devnet wallet at [Aptos Faucet](https://aptos.dev/network/faucet/)
2. Fund your wallet with devnet APT
3. Send a test payment to your seller address
4. Use the transaction hash to verify payment
5. Submit a test prompt

### Example cURL Commands

```bash
# Verify payment
curl -X POST http://localhost:3001/api/payment/verify \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0xYOUR_TX_HASH",
    "sender": "0xYOUR_WALLET"
  }'

# Generate workflow
curl -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Send 1 APT to Alice every Monday at 9am",
    "sender": "0xYOUR_WALLET"
  }'

# Check status
curl http://localhost:3001/api/generate/PROMPT_ID
```

## 📦 Project Structure

```
aptosflow-backend/
├── src/
│   ├── config/           # Configuration with Zod validation
│   ├── middleware/       # Express middleware (payment, errors, rate limiting)
│   ├── routes/          # API routes
│   ├── services/        # Business logic (Aptos, AI)
│   ├── inngest/         # Background jobs
│   ├── utils/           # Utilities (Prisma client)
│   ├── types/           # TypeScript types
│   └── index.ts         # Server entry point
├── prisma/
│   └── schema.prisma    # Database schema
├── .env.example         # Environment template
└── package.json
```

## 🔧 Development Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm test                 # Run tests
```

## 🚢 Deployment

1. Set up PostgreSQL database
2. Configure environment variables
3. Run migrations: `npm run prisma:migrate`
4. Build: `npm run build`
5. Start: `npm start`

## 📝 License

ISC
