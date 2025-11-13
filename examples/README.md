# X402 Payment Flow Examples

This directory contains working examples that demonstrate the X402 payment protocol.

## Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the network (in a separate terminal):
```bash
npm run launch
```

This will start:
- 1 Mock Facilitator on port 5000
- 3 Mock Sellers on ports 4000, 4001, 4002

## Examples

### 1. Manual Payment Flow (`manual-flow.ts`)

Demonstrates the complete payment flow step-by-step:
- Step 1: Request API → Get 402 Payment Required
- Step 2: Send proof to facilitator → Get verification token
- Step 3: Retry with token → Get successful response

```bash
tsx examples/manual-flow.ts
```

**Output:**
```
=== X402 Manual Payment Flow Demo ===

Step 1: Making request without payment...
Status: 402 Payment Required

Payment Required!
Payment Requirements: {
  "id": "req_abc123...",
  "product": "api_inference_v1",
  "amount": 1000,
  "currency": "USDC",
  "chain": "solana",
  "facilitator": "http://localhost:5000/verify",
  "expires_at": "2025-11-08T12:00:00.000Z"
}

Step 2: Verifying payment with facilitator...
Status: 200
Verification Result: {
  "ok": true,
  "verification": "mock-sig:abc123...",
  "settled": true,
  "timestamp": "2025-11-08T11:55:00.000Z"
}

Step 3: Retrying request with payment token...
Status: 200 OK

=== SUCCESS! ===
API Response: {
  "result": "Processed inference for: \"What is the meaning of life?\"",
  "model": "mock-model-v1",
  "cost_charged": 1000,
  "timestamp": "2025-11-08T11:55:00.000Z"
}
```

### 2. SDK Automated Flow (`sdk-flow.ts`)

Shows how the X402Client SDK automatically handles the entire payment flow:

```bash
tsx examples/sdk-flow.ts
```

**Output:**
```
=== X402 SDK Automated Payment Flow Demo ===

Making request with automatic payment handling...

[SDK] Payment required: 1000 USDC
[SDK] Payment verified

Final Status: 200 OK

=== SUCCESS! ===
API Response: {
  "result": "Processed inference for: \"Explain quantum computing...\"",
  "model": "mock-model-v1",
  "cost_charged": 1000,
  "timestamp": "2025-11-08T11:56:00.000Z"
}

=== Multiple Requests Example ===

Request 1/3: "What is machine learning?"
[SDK] Payment required: 1000 USDC
[SDK] Payment verified
  ✓ Success! Cost: 1000 USDC

Request 2/3: "Explain blockchain technology"
[SDK] Payment required: 1000 USDC
[SDK] Payment verified
  ✓ Success! Cost: 1000 USDC

Request 3/3: "What are neural networks?"
[SDK] Payment required: 1000 USDC
[SDK] Payment verified
  ✓ Success! Cost: 1000 USDC

=== All requests completed! ===
```

## Testing Different Scenarios

### Connect to Different Sellers

Each seller can have different pricing:

```typescript
// Port 4000: 1000 USDC
// Port 4001: 1000 USDC
// Port 4002: 1000 USDC
const response = await client.requestWithAutoPay('http://localhost:4001/inference', {...});
```

### Health Checks

Check if services are running:

```bash
curl http://localhost:4000/health  # Seller
curl http://localhost:5000/health  # Facilitator
```

### Manual cURL Testing

```bash
# 1. Get 402 response
curl -X POST http://localhost:4000/inference \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'

# 2. Verify payment
curl -X POST http://localhost:5000/verify \
  -H "Content-Type: application/json" \
  -d '{"proof":{"stub":true},"payer":"test","amount":1000,"chain":"solana"}'

# 3. Retry with token (replace TOKEN with the verification from step 2)
curl -X POST http://localhost:4000/inference \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: TOKEN" \
  -d '{"prompt":"test"}'
```

## Key Concepts

### Payment Requirements Object
When you get a 402 response, it includes:
- `id`: Unique request identifier
- `product`: Service being accessed
- `amount`: Price in minor units
- `currency`: Payment currency
- `chain`: Blockchain network
- `facilitator`: Verification endpoint
- `expires_at`: Expiration timestamp

### Verification Token
Format: `mock-sig:<hex-string>`
- Obtained from facilitator after payment verification
- Sent in `X-PAYMENT` header for authenticated requests
- Valid for the lifetime of the session (in mock mode)

### Mock Mode vs Devnet Mode
- **Mock Mode**: No real blockchain transactions, accepts any proof
- **Devnet Mode**: Uses real Solana devnet transactions for payment verification

### 3. Devnet Client (`devnet-client.ts`)

Demonstrates real Solana devnet payment flow:

```bash
# Terminal 1: Start facilitator in devnet mode
FACILITATOR_MODE=devnet npm run dev:facilitator

# Terminal 2: Start seller with wallet address
SELLER_WALLET_ADDRESS=<your-solana-address> PRODUCT_CURRENCY=SOL npm run dev:seller

# Terminal 3: Run devnet client
tsx examples/devnet-client.ts
```

**What it does:**
- Creates a new Solana keypair for testing
- Requests SOL airdrop from devnet
- Makes payment using real Solana transaction
- Verifies transaction on-chain
- Completes API request with verified payment

**Output:**
```
🚀 Starting Devnet X402 Client Example

👛 Payer wallet: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

💰 Requesting airdrop from Solana devnet...
✅ Airdrop successful: 2ZE7ty...

📞 Making request to seller API...

[SDK] Payment required: 1000 SOL
[SDK] Creating Solana payment: 1000 SOL to 5rQ8nV...
[SDK] Payment transaction sent: 3nZ6y...
[SDK] Payment verified
✅ Response status: 200

📦 Response data:
   Result: Processed inference for: "Explain how..."
   Model: mock-model-v1
   Cost charged: 1000 minor units
   Timestamp: 2025-11-08T...

✨ Example completed successfully!
```

## Troubleshooting

**Connection refused errors:**
- Make sure the network is running: `npm run launch`
- Wait a few seconds for services to start up

**402 responses not working:**
- Check that you're not including the `X-PAYMENT` header on initial requests
- Verify facilitator is accessible at `http://localhost:5000`

**Tests failing:**
- Run `npm test` to check if core functionality works
- Restart the network if services are in a bad state
