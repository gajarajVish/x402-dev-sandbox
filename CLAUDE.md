# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

X402 API Sandbox is a developer sandbox for testing x402 payment flows with mock nodes. It simulates a payment-gated API ecosystem where sellers require payment (HTTP 402) and facilitators verify payments before granting access.

**For detailed project specifications, architecture decisions, and implementation timeline, see [REQUIREMENTS.md](REQUIREMENTS.md).**

## Commands

### Development
```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Run individual components for development
npm run dev:seller        # Start a single mock seller
npm run dev:facilitator   # Start the mock facilitator

# Launch full network (3 sellers + 1 facilitator)
npm run launch

# Run tests
npm test
```

### Manual Testing Flow
```bash
# 1. Get 402 Payment Required response
curl -X POST http://localhost:4000/inference \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'

# 2. Verify payment with facilitator (mock accepts any proof)
curl -X POST http://localhost:5000/verify \
  -H "Content-Type: application/json" \
  -d '{"proof":{"stub":true},"payer":"test","amount":1000,"chain":"solana"}'

# 3. Retry with verification token in X-PAYMENT header
curl -X POST http://localhost:4000/inference \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: mock-sig:abc123..." \
  -d '{"prompt":"test"}'
```

## Architecture

### Core Components

**Mock Seller (`src/mock-seller/index.ts`)**
- Express server that implements the 402 Payment Required flow
- Returns payment requirements on initial request without X-PAYMENT header
- Validates payment tokens (must start with "mock-sig:")
- Processes requests when valid payment is provided
- Configurable via: `SELLER_PORT`, `PRODUCT_AMOUNT`, `PRODUCT_CURRENCY`, `FACILITATOR_URL`

**Mock Facilitator (`src/mock-facilitator/index.ts`)**
- Payment verification service that issues verification tokens
- Stores verified payments in-memory Map
- Accepts any proof in mock mode (returns `mock-sig:` tokens)
- Configurable via: `FACILITATOR_PORT`, `FACILITATOR_MODE`

**X402 SDK (`src/sdk/index.ts`)**
- TypeScript client library with automatic payment handling
- `requestWithAutoPay()` method intercepts 402 responses, creates payment proof, verifies with facilitator, and retries request
- Supports mock mode (generates mock proofs) and devnet mode (not yet implemented)
- Configurable via constructor options: `facilitatorUrl`, `mode`, `payerIdentity`

**Network Launcher (`src/launcher/index.ts`)**
- CLI tool to spawn multiple nodes for network simulation
- Starts 1 facilitator + N sellers (default 3)
- Assigns sequential ports starting from base port
- Handles graceful shutdown on SIGINT/SIGTERM
- Configurable via: `LAUNCHER_NUM_SELLERS`, `LAUNCHER_BASE_PORT`, `FACILITATOR_PORT`

### Payment Flow

1. Client makes request to seller API without payment
2. Seller returns 402 with `payment_requirements` object containing:
   - `id`: Unique request identifier
   - `product`: Product/service identifier
   - `amount`: Price in minor units
   - `currency`: Payment currency (e.g., USDC)
   - `chain`: Blockchain network (e.g., solana)
   - `facilitator`: Verification endpoint URL
   - `expires_at`: Payment requirement expiration timestamp
3. Client creates payment proof (mock or real blockchain transaction)
4. Client sends proof to facilitator `/verify` endpoint
5. Facilitator returns verification token (format: `mock-sig:<hex>`)
6. Client retries original request with `X-PAYMENT: <token>` header
7. Seller validates token and processes request

### TypeScript Configuration

- Target: ES2020
- Module: CommonJS
- Output: `dist/` directory
- Strict mode enabled
- All source in `src/`, organized by component

## Key Patterns

- **Environment-driven configuration**: All components use dotenv and accept configuration via environment variables
- **Mock-first design**: System defaults to mock mode for local testing without blockchain dependencies
- **Process management**: Launcher uses child_process.spawn with proper cleanup handlers
- **Headers-based auth**: Payment verification uses `X-PAYMENT` header for token transmission
- **In-memory state**: Facilitator stores verified payments in Map (not persistent)
