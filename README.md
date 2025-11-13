# X402 API Sandbox

> Developer sandbox for testing x402 payment flows with mock nodes on Solana

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.0.0-green)](https://nodejs.org/)

**X402 Sandbox** is a complete local testing environment for building and testing payment-gated APIs using the x402 protocol. Run a full network of mock seller nodes and a facilitator service locally, or use the TypeScript SDK to build your own payment-enabled applications.

Perfect for hackathons, rapid prototyping, and learning the x402 payment protocol without blockchain complexity.

---

## ✨ Features

- 🚀 **One-Command Launch** - Start a full network with `npm run launch`
- 🔧 **Mock Mode** - Test payment flows instantly without blockchain setup
- ⚡ **Solana Devnet Integration** - Real on-chain payments with SOL
- 🔐 **Escrow Program** - Secure payment escrow smart contract on Solana
- 📦 **TypeScript SDK** - Client library with automatic payment handling
- 🌐 **Multi-Node Network** - Simulate distributed API marketplace
- ✅ **Comprehensive Tests** - >80% test coverage with unit and E2E tests
- 📚 **Complete Documentation** - API reference, architecture docs, and examples

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/x402-sandbox.git
cd x402-sandbox

# Install dependencies
npm install

# Build the project
npm run build
```

### Launch the Network

Start 3 seller nodes + 1 facilitator with a single command:

```bash
npm run launch
```

You should see:

```
🚀 Launching X402 Mock Network...

📦 Starting Mock Facilitator on port 5000...
🏦 Mock Facilitator running on http://localhost:5000
   Mode: MOCK

📦 Starting Seller #1 on port 4000...
🚀 Mock Seller running on http://localhost:4000
   Price: 1000 USDC

📦 Starting Seller #2 on port 4001...
🚀 Mock Seller running on http://localhost:4001
   Price: 1000 USDC

📦 Starting Seller #3 on port 4002...
🚀 Mock Seller running on http://localhost:4002
   Price: 1000 USDC

✅ Network ready! Press Ctrl+C to stop all nodes.
```

### Run Your First Request

In a new terminal, run the simple client example:

```bash
tsx examples/simple-client.ts
```

You'll see the full payment flow in action:

```
🚀 Starting Simple X402 Client Example

📞 Making request to seller API...
[SDK] Payment required: 1000 USDC
[SDK] Payment verified
✅ Response status: 200

📦 Response data:
   Result: Processed inference for: "What is the meaning of life?"
   Model: mock-model-v1
   Cost charged: 1000 minor units
   Timestamp: 2025-11-08T15:25:00Z

✨ Example completed successfully!
```

---

## 📖 Usage

### Mock Mode vs Devnet Mode

X402 Sandbox supports two modes:

- **Mock Mode** (default): Fast local testing without blockchain. Accepts any payment proof.
- **Devnet Mode**: Real Solana devnet integration with actual on-chain transactions.

### Using the TypeScript SDK (Mock Mode)

The SDK automatically handles the entire x402 payment flow:

```typescript
import { X402Client } from './src/sdk';

// Create a client instance
const client = new X402Client({
  mode: 'mock',
  payerIdentity: 'my-wallet-address',
});

// Make a request - SDK handles 402, payment, and retry automatically
const response = await client.requestWithAutoPay(
  'http://localhost:4000/inference',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'Hello, world!' }),
  }
);

const data = await response.json();
console.log(data.result);
```

### Using the TypeScript SDK (Devnet Mode)

For testing with real Solana devnet transactions:

```typescript
import { X402Client, createTestKeypair, requestAirdrop } from './src/sdk';
import { Connection } from '@solana/web3.js';

// Create a test keypair (or load your existing wallet)
const payerKeypair = createTestKeypair();

// Request SOL airdrop for testing
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
await requestAirdrop(connection, payerKeypair.publicKey, 1);

// Create client in devnet mode
const client = new X402Client({
  mode: 'devnet',
  solanaKeypair: payerKeypair,
  solanaRpcUrl: 'https://api.devnet.solana.com',
});

// Make request - SDK creates real Solana transaction
const response = await client.requestWithAutoPay(
  'http://localhost:4000/inference',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'Hello, Solana!' }),
  }
);

const data = await response.json();
console.log(data.result);
```

**Prerequisites for Devnet Mode:**
1. Start facilitator in devnet mode: `FACILITATOR_MODE=devnet npm run dev:facilitator`
2. Set seller wallet address: `SELLER_WALLET_ADDRESS=<your-solana-address> npm run dev:seller`
3. Ensure your wallet has devnet SOL (use `solana airdrop` or the SDK's `requestAirdrop()`)

See [`examples/devnet-client.ts`](examples/devnet-client.ts) for a complete example.

### Manual Payment Flow

You can also implement the payment flow manually:

```bash
# 1. Get 402 Payment Required response
curl -X POST http://localhost:4000/inference \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'

# Returns:
# {
#   "error": "payment_required",
#   "payment_requirements": {
#     "id": "req_abc123...",
#     "amount": 1000,
#     "currency": "USDC",
#     "facilitator": "http://localhost:5000/verify",
#     ...
#   }
# }

# 2. Verify payment with facilitator (mock accepts any proof)
curl -X POST http://localhost:5000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "proof": {"stub": true},
    "payer": "test-wallet",
    "amount": 1000,
    "chain": "solana"
  }'

# Returns:
# {
#   "ok": true,
#   "verification": "mock-sig:abc123...",
#   "settled": true
# }

# 3. Retry with verification token in X-PAYMENT header
curl -X POST http://localhost:4000/inference \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: mock-sig:abc123..." \
  -d '{"prompt":"test"}'

# Returns:
# {
#   "result": "Processed inference for: \"test\"",
#   "cost_charged": 1000,
#   ...
# }
```

See [`examples/manual-flow.ts`](examples/manual-flow.ts) for a complete step-by-step example.

---

## 🎮 Examples

Explore different use cases:

### Simple Client (Mock Mode)

Basic SDK usage with automatic payment:

```bash
tsx examples/simple-client.ts
```

### Devnet Client (Real Solana)

Test with real Solana devnet transactions:

```bash
# Start services in devnet mode
FACILITATOR_MODE=devnet npm run dev:facilitator  # Terminal 1
SELLER_WALLET_ADDRESS=<address> PRODUCT_CURRENCY=SOL npm run dev:seller  # Terminal 2

# Run devnet client
tsx examples/devnet-client.ts  # Terminal 3
```

### Multi-Seller Demo

Demonstrates load distribution across multiple sellers:

```bash
tsx examples/multi-seller-demo.ts
```

### Manual Flow

Step-by-step payment flow without the SDK:

```bash
tsx examples/manual-flow.ts
```

---

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test suite
npm test -- tests/unit
npm test -- tests/e2e

# Run in watch mode
npm test -- --watch
```

**Test Coverage**: >80% overall, >95% on critical paths

---

## 📁 Project Structure

```
x402-sandbox/
├── src/
│   ├── mock-seller/         # HTTP 402 payment-gated API server
│   ├── mock-facilitator/    # Payment verification service
│   ├── sdk/                 # TypeScript client SDK
│   │   ├── index.ts         # Main SDK exports
│   │   ├── solana-utils.ts  # Solana payment utilities
│   │   └── solana-program-client.ts  # Escrow program client
│   └── launcher/            # Multi-node network launcher
│
├── solana-program/          # Solana smart contract (Rust/Anchor)
│   ├── programs/
│   │   └── x402_escrow/     # Escrow program source
│   ├── Anchor.toml          # Anchor configuration
│   └── README.md            # Program documentation
│
├── tests/
│   ├── unit/                # Unit tests (SDK, verifier)
│   └── e2e/                 # End-to-end flow tests
│
├── examples/                # Usage examples
│   ├── simple-client.ts     # Mock mode example
│   ├── devnet-client.ts     # Devnet mode example
│   ├── multi-seller-demo.ts # Multi-node example
│   └── manual-flow.ts       # Step-by-step flow
│
├── docs/
│   ├── API.md              # Complete API reference
│   ├── ARCHITECTURE.md     # Architecture deep-dive
│   └── CONTRIBUTING.md     # Contribution guidelines
│
├── DEPLOYMENT.md           # Solana program deployment guide
└── dist/                   # Compiled JavaScript (generated)
```

---

## 🔐 Solana Program Deployment

The X402 Sandbox includes a Solana smart contract (program) for secure payment escrow. This is **required for hackathon submission**.

### 🚀 Quick Start (15 minutes)

**New to Solana?** Follow our step-by-step guide: **[QUICKSTART_DEVNET.md](QUICKSTART_DEVNET.md)**

**Experienced?** Quick commands:

```bash
# Install tools
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.29.0 && avm use 0.29.0

# Deploy
cd solana-program
anchor build
anchor deploy
```

**Guides**:
- 📘 [Quick Start Guide](QUICKSTART_DEVNET.md) - 15-minute setup
- 📗 [Full Deployment Guide](DEPLOYMENT.md) - Detailed instructions
- 📕 [Integration Summary](SOLANA_INTEGRATION.md) - Technical overview

### Program Features

- **Payment Escrow**: Secure on-chain payment holding
- **Automatic Release**: Funds released after verification
- **Refund Support**: Expired payments can be refunded
- **PDA-based Security**: Program Derived Addresses for account security

### Using the Escrow Program

Enable in SDK:

```typescript
const client = new X402Client({
  mode: 'devnet',
  solanaKeypair: payerKeypair,
  useEscrowProgram: true,  // Enable escrow program
});
```

---

## ⚙️ Configuration

Configure the sandbox via environment variables (see [`.env.example`](.env.example)):

### Seller Configuration

```bash
SELLER_PORT=4000                    # Server port
PRODUCT_AMOUNT=1000                 # Price in minor units
PRODUCT_CURRENCY=USDC               # Currency code
FACILITATOR_URL=http://localhost:5000/verify
```

### Facilitator Configuration

```bash
FACILITATOR_PORT=5000               # Server port
FACILITATOR_MODE=mock               # mock | devnet
```

### Launcher Configuration

```bash
LAUNCHER_NUM_SELLERS=3              # Number of seller nodes
LAUNCHER_BASE_PORT=4000             # Starting port for sellers
```

### Custom Configuration

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
# Edit .env with your custom values
```

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────┐
│          X402 Sandbox Network            │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────┐      ┌──────────┐         │
│  │  Client  │      │  Client  │         │
│  │ (SDK)    │      │ (Manual) │         │
│  └────┬─────┘      └────┬─────┘         │
│       │                 │                │
│       └────────┬────────┘                │
│                │                         │
│    ┌───────────▼──────────┐              │
│    │                      │              │
│ ┌──▼───┐  ┌──────┐  ┌──────┐            │
│ │Seller│  │Seller│  │Seller│            │
│ │  #1  │  │  #2  │  │  #3  │            │
│ └──┬───┘  └──┬───┘  └──┬───┘            │
│    │         │         │                │
│    └────┬────┴────┬────┘                │
│         │         │                     │
│    ┌────▼─────────▼────┐                │
│    │   Facilitator     │                │
│    │   (Verifier)      │                │
│    └───────────────────┘                │
│                                          │
└─────────────────────────────────────────┘
```

### Payment Flow

```
1. Client → Seller: POST /inference (no payment)
2. Seller → Client: 402 Payment Required + payment_requirements
3. Client: Creates payment proof
4. Client → Facilitator: POST /verify + proof
5. Facilitator → Client: Verification token
6. Client → Seller: POST /inference + X-PAYMENT header
7. Seller → Client: 200 OK + result
```

**Learn more**: [Architecture Documentation](docs/ARCHITECTURE.md)

---

## 📚 Documentation

### Core Documentation

- **[API Reference](docs/API.md)** - Complete API documentation for all components
- **[Architecture Guide](docs/ARCHITECTURE.md)** - System design and implementation details
- **[Contributing Guide](docs/CONTRIBUTING.md)** - How to contribute to the project

### Additional Resources

- [X402 Protocol Specification](https://x402.org)
- [Solana Documentation](https://docs.solana.com)
- [HTTP 402 Status Code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402)

---

## 🛠️ Development

### Available Scripts

```bash
# Build TypeScript to JavaScript
npm run build

# Run individual components
npm run dev:seller         # Start single seller
npm run dev:facilitator    # Start facilitator

# Launch full network
npm run launch

# Run tests
npm test
```

### Running Components Individually

```bash
# Terminal 1: Start facilitator
npm run dev:facilitator

# Terminal 2: Start seller
npm run dev:seller

# Terminal 3: Test the flow
tsx examples/simple-client.ts
```

### Debugging

Enable verbose logging:

```bash
LOG_LEVEL=debug npm run launch
```

---

## 🔒 Security Considerations

⚠️ **Mock mode is for development only** and should never be used in production.

### Mock Mode Limitations

- Accepts any payment proof
- No signature verification
- Token reuse is allowed
- No rate limiting

### Production Requirements

For production use, implement:

1. Real blockchain transaction verification
2. One-time token validation
3. Expiration enforcement
4. Rate limiting per wallet/IP
5. Persistent storage for verified payments

See [Architecture Documentation](docs/ARCHITECTURE.md#security-considerations) for details.

---

## 🗺️ Roadmap

### Current Status (v1.0)

- ✅ Mock payment flow implementation
- ✅ TypeScript SDK with auto-payment
- ✅ Multi-node network launcher
- ✅ Comprehensive test suite
- ✅ Complete documentation
- ✅ Solana devnet integration (SOL transfers)

### Planned Features

- [ ] SPL Token support (USDC, USDT on devnet)
- [ ] Solana smart contract for escrow/verification
- [ ] Web dashboard for network visualization
- [ ] Subscription payment support
- [ ] Multi-chain support (Ethereum, Bitcoin Lightning)
- [ ] Performance benchmarking suite

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🏆 Acknowledgments

Built for the **Solana X402 Hackathon** - Best x402 Dev Tool track.

Special thanks to:
- [X402 Protocol](https://x402.org) team
- Solana developer community
- Open source contributors


## 🌟 Show Your Support

If you find this project helpful, please consider:

- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting new features
- 🤝 Contributing code

---

**Built with ❤️ for the Solana x402 ecosystem**
