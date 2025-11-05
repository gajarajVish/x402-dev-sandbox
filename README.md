# X402 API Sandbox

> Developer sandbox for testing x402 payment flows with mock nodes

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Launch the sandbox (3 sellers + 1 facilitator)
npm run launch
```

## 📦 What's Included

- **Mock Seller APIs** - HTTP servers that return 402 Payment Required
- **Mock Facilitator** - Payment verification service  
- **TypeScript SDK** - Client library with auto-payment handling
- **CLI Launcher** - Spawn multiple nodes for network simulation

## 🎮 Usage

### Launch Network
```bash
npm run launch
```

### Use the SDK
```typescript
import { X402Client } from './src/sdk';

const client = new X402Client({ mode: 'mock' });

const response = await client.requestWithAutoPay(
  'http://localhost:4000/inference',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'Hello!' })
  }
);

const data = await response.json();
console.log(data.result);
```

### Manual Testing
```bash
# 1. Get 402 response
curl -X POST http://localhost:4000/inference \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'

# 2. Verify payment (mock accepts any proof)
curl -X POST http://localhost:5000/verify \
  -H "Content-Type: application/json" \
  -d '{"proof":{"stub":true},"payer":"test","amount":1000,"chain":"solana"}'

# 3. Use verification token
curl -X POST http://localhost:4000/inference \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: mock-sig:abc123..." \
  -d '{"prompt":"test"}'
```

## 🔧 Configuration

Environment variables (see `.env.example`):
- `LAUNCHER_NUM_SELLERS=3` - Number of seller nodes
- `SELLER_PORT=4000` - Base port for sellers
- `FACILITATOR_PORT=5000` - Facilitator port
- `PRODUCT_AMOUNT=1000` - Price in minor units

## 📁 Project Structure

```
src/
├── mock-seller/     # Seller API implementation
├── mock-facilitator/ # Facilitator implementation  
├── sdk/             # TypeScript SDK
└── launcher/        # CLI launcher
```

Built for testing x402 payment flows locally without mainnet costs.