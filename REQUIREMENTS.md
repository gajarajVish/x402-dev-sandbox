# X402 API Sandbox + Mock Node Launcher
## Project Requirements Documentation v1.0

---

## 1. Executive Summary

### 1.1 Project Overview
Build an open-source developer sandbox that simulates x402 payment flows and agent APIs for testing purposes. The system enables developers to test blockchain-based API payment flows without mainnet deployment costs or complexity.

### 1.2 Value Proposition
- **Problem**: Testing x402 payment flows requires complex mainnet setup, costs real money, and slows development
- **Solution**: Local mock environment with Solana devnet integration for rapid iteration
- **Impact**: Reduces onboarding time from hours to minutes; enables hackathon productivity; lowers barriers for new teams

### 1.3 Target Hackathon Track
**Best x402 Dev Tool** - Create SDKs, libraries, frameworks, or infrastructure to accelerate x402 development on Solana ($10,000 prize)

---

## 2. Technical Architecture

### 2.1 System Components

#### Component 1: Mock Seller API Server
- **Technology**: Express.js (TypeScript)
- **Purpose**: Simulates a paid API endpoint that implements x402 payment protocol
- **Port**: Configurable (default: 4000+)
- **Key Behaviors**:
  - Returns HTTP 402 "Payment Required" on first request
  - Includes `payment_requirements` JSON in response body
  - Validates `X-PAYMENT` header on subsequent requests
  - Returns 200 with content after successful payment verification

#### Component 2: Mock Facilitator Service
- **Technology**: Express.js (TypeScript)
- **Purpose**: Simulates payment verification and settlement
- **Port**: Configurable (default: 5000)
- **Key Behaviors**:
  - Accepts payment proof payloads via POST
  - Returns verification tokens
  - Simulates on-chain verification (with optional real Solana devnet verification)
  - Handles verification failures gracefully

#### Component 3: TypeScript SDK
- **Technology**: TypeScript (Node.js compatible)
- **Purpose**: Client library to simplify x402 payment flows
- **Key Features**:
  - Auto-discovery of payment requirements from 402 responses
  - Payment proof creation (mock and real Solana)
  - Automatic request retry with payment headers
  - Simple one-function API: `requestWithAutoPay(url, options)`

#### Component 4: Mock Node Launcher (CLI)
- **Technology**: Node.js CLI script
- **Purpose**: Spawn multiple mock nodes for network simulation
- **Key Features**:
  - Configurable number of seller nodes (via `N` environment variable)
  - Single facilitator instance
  - Process management and cleanup
  - Port management and collision avoidance

#### Component 5: Testing Suite
- **Technology**: Jest or Mocha
- **Purpose**: Comprehensive end-to-end and unit tests
- **Coverage Requirements**:
  - 402 flow: request → payment required → pay → success
  - Expired payment requirements handling
  - Facilitator failure scenarios
  - Invalid payment signature handling
  - Multi-node network scenarios

---

## 3. Detailed Technical Specifications

### 3.1 Mock Seller API Specification

#### Endpoints

**POST /inference** (example protected endpoint)
- **Unauthenticated Request**:
  ```
  POST /inference
  Content-Type: application/json

  { "prompt": "test" }
  ```

- **Response (402)**:
  ```json
  {
    "error": "payment_required",
    "payment_requirements": {
      "id": "req_abc123xyz",
      "product": "api_inference_v1",
      "amount": 1000,
      "currency": "USDC",
      "chain": "solana",
      "facilitator": "http://localhost:5000/verify",
      "expires_at": "2025-11-04T15:30:00Z"
    }
  }
  ```

- **Authenticated Request**:
  ```
  POST /inference
  Content-Type: application/json
  X-PAYMENT: mock-sig:abc123...

  { "prompt": "test" }
  ```

- **Response (200)**:
  ```json
  {
    "result": "inference_result_data",
    "cost_charged": 1000
  }
  ```

#### Configuration
- `PORT` - Server port (default: 4000)
- `FACILITATOR_URL` - Facilitator endpoint (default: http://localhost:5000/verify)
- `PRODUCT_ID` - Product identifier
- `PRICE_AMOUNT` - Price in minor units
- `PRICE_CURRENCY` - Currency code (USDC, SOL, etc.)

#### Error Handling
- 400: Invalid request format
- 402: Payment required
- 500: Internal server error
- 503: Facilitator unavailable

---

### 3.2 Mock Facilitator Specification

#### Endpoints

**POST /verify**
- **Request**:
  ```json
  {
    "proof": { "signature": "...", "transaction": "..." },
    "payer": "wallet_address_or_id",
    "amount": 1000,
    "chain": "solana"
  }
  ```

- **Response (Success)**:
  ```json
  {
    "ok": true,
    "verification": "mock-sig:verification_token_abc123",
    "settled": true,
    "timestamp": "2025-11-04T15:25:00Z"
  }
  ```

- **Response (Failure)**:
  ```json
  {
    "ok": false,
    "error": "insufficient_funds" | "invalid_signature" | "expired_request",
    "detail": "Human readable error message"
  }
  ```

#### Mock vs Real Modes
- **Mock Mode** (default): Accept any proof, instant verification
- **Devnet Mode** (optional): Verify real Solana devnet transactions
  - Requires Solana RPC endpoint
  - Validates transaction signatures
  - Checks token transfers

#### Configuration
- `PORT` - Server port (default: 5000)
- `MODE` - "mock" | "devnet"
- `SOLANA_RPC_URL` - Solana devnet RPC endpoint (if MODE=devnet)

---

### 3.3 TypeScript SDK Specification

#### Core Class: X402Client

```typescript
export class X402Client {
  constructor(options?: {
    facilitatorUrl?: string;
    walletProvider?: WalletProvider;
    mode?: 'mock' | 'devnet';
  });

  // Main method: auto-handle 402 flows
  async requestWithAutoPay(
    url: string,
    init?: RequestInit
  ): Promise<Response>;

  // Low-level methods
  async parsePaymentRequirements(response: Response): Promise<PaymentRequirements>;
  async createPaymentProof(requirements: PaymentRequirements): Promise<PaymentProof>;
  async verifyPayment(proof: PaymentProof, requirements: PaymentRequirements): Promise<string>;
}
```

#### Types

```typescript
export type PaymentRequirements = {
  id: string;
  product: string;
  amount: number;
  currency: string;
  chain: string;
  facilitator: string;
  expires_at: string;
};

export type PaymentProof = {
  signature?: string;
  transaction?: string;
  timestamp: string;
  payer: string;
};
```

#### Usage Example

```typescript
import { X402Client } from 'x402-sdk';

const client = new X402Client({ mode: 'mock' });

// Automatically handles 402, pays, and retries
const response = await client.requestWithAutoPay(
  'http://localhost:4000/inference',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'test' })
  }
);

const data = await response.json();
console.log(data.result);
```

---

### 3.4 Mock Node Launcher Specification

#### CLI Interface

```bash
# Launch with default 3 sellers + 1 facilitator
npm run launch

# Launch with 5 sellers
N=5 npm run launch

# Custom base port
BASE_PORT=8000 N=3 npm run launch
```

#### Implementation Requirements
- Spawn seller processes on ports BASE_PORT, BASE_PORT+1, ..., BASE_PORT+N-1
- Spawn facilitator on port FACILITATOR_PORT (default: 5000)
- Handle SIGINT/SIGTERM for clean shutdown
- Log startup status for all nodes
- Environment variable injection to child processes
- Process cleanup on exit

#### Output Example
```
Launching X402 Mock Network...
✓ Mock Facilitator started on port 5000
✓ Seller #1 started on port 4000
✓ Seller #2 started on port 4001
✓ Seller #3 started on port 4002

Network ready! Press Ctrl+C to stop all nodes.
```

---

## 4. Repository Structure

```
x402-sandbox/
├── README.md                          # Main documentation
├── REQUIREMENTS.md                    # This file
├── CLAUDE.md                          # Claude Code guidance
├── LICENSE                            # Open source license (MIT recommended)
├── package.json                       # Dependencies and scripts
├── tsconfig.json                      # TypeScript configuration
├── .gitignore
├── .env.example                       # Environment variable template
│
├── src/
│   ├── mock-seller/
│   │   ├── index.ts                   # Main seller server
│   │   ├── config.ts                  # Configuration management
│   │   └── routes/
│   │       └── inference.ts           # Example protected endpoint
│   │
│   ├── mock-facilitator/
│   │   ├── index.ts                   # Main facilitator server
│   │   ├── verifier.ts                # Verification logic
│   │   └── solana-devnet.ts           # Optional Solana devnet integration
│   │
│   ├── sdk/
│   │   ├── index.ts                   # SDK exports
│   │   ├── client.ts                  # X402Client implementation
│   │   ├── types.ts                   # TypeScript types
│   │   └── utils.ts                   # Helper functions
│   │
│   └── launcher/
│       ├── index.ts                   # CLI launcher
│       └── process-manager.ts         # Process spawning logic
│
├── tests/
│   ├── e2e/
│   │   ├── basic-flow.test.ts         # Basic 402 flow
│   │   ├── multi-node.test.ts         # Multi-node scenarios
│   │   └── error-handling.test.ts     # Error scenarios
│   │
│   └── unit/
│       ├── sdk.test.ts                # SDK unit tests
│       └── verifier.test.ts           # Facilitator unit tests
│
├── examples/
│   ├── simple-client.ts               # Basic SDK usage
│   ├── nextjs-integration/            # Next.js example
│   └── multi-seller-demo.ts           # Multi-node example
│
└── docs/
    ├── ARCHITECTURE.md                # Architecture deep-dive
    ├── API.md                         # API documentation
    └── CONTRIBUTING.md                # Contribution guide
```

---

## 5. Environment Configuration

### Complete .env.example Template

```bash
#######################################
# X402 Sandbox Configuration
#######################################

# ============ Mock Seller ============
SELLER_PORT=4000
SELLER_HOST=localhost

# Product Configuration
PRODUCT_ID=api_inference_v1
PRODUCT_DESCRIPTION="AI Inference API Call"
PRODUCT_AMOUNT=1000              # Amount in minor units (1000 = $0.01 if 2 decimals)
PRODUCT_CURRENCY=USDC
PRODUCT_CHAIN=solana

# Payment Settings
PAYMENT_EXPIRY_MINUTES=5         # How long payment requirements are valid
FACILITATOR_URL=http://localhost:5000/verify

# ========== Mock Facilitator ==========
FACILITATOR_PORT=5000
FACILITATOR_HOST=localhost
FACILITATOR_MODE=mock            # mock | devnet

# Solana Configuration (only for FACILITATOR_MODE=devnet)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
SOLANA_COMMITMENT=confirmed      # processed | confirmed | finalized

# ============= Launcher ==============
LAUNCHER_NUM_SELLERS=3           # Number of seller nodes to spawn
LAUNCHER_BASE_PORT=4000          # Starting port for sellers
LAUNCHER_FACILITATOR_PORT=5000

# ============== Logging ==============
LOG_LEVEL=info                   # debug | info | warn | error
LOG_FORMAT=pretty                # pretty | json

# ============ Development ============
NODE_ENV=development             # development | production | test
ENABLE_CORS=true
ENABLE_REQUEST_LOGGING=true
```

---

## 6. Testing Requirements

### 6.1 Test Coverage Goals
- Overall coverage: >80%
- Critical paths: >95%

### 6.2 Test Scenarios

#### Unit Tests
1. **SDK Tests**
   - Parse payment requirements correctly
   - Create valid payment proofs
   - Handle malformed 402 responses
   - Timeout handling

2. **Verifier Tests**
   - Accept valid proofs
   - Reject invalid signatures
   - Handle expired requests
   - Rate limiting

#### E2E Tests
1. **Happy Path**
   - Client → 402 → Pay → Success (200)
   - Verify correct data returned
   - Verify payment recorded

2. **Error Scenarios**
   - Expired payment requirements → 401
   - Invalid payment signature → 403
   - Insufficient funds → 402 with error details
   - Facilitator down → Graceful failure

3. **Multi-Node Scenarios**
   - Multiple sellers, one facilitator
   - Load distribution
   - Concurrent requests

---

## 7. Payment Flow Sequence

```
┌──────┐         ┌────────┐         ┌─────────────┐
│Client│         │Seller  │         │Facilitator  │
└──┬───┘         └───┬────┘         └──────┬──────┘
   │                 │                     │
   │ POST /inference │                     │
   ├────────────────>│                     │
   │                 │                     │
   │  402 + payment  │                     │
   │  requirements   │                     │
   │<────────────────┤                     │
   │                 │                     │
   │ Create payment  │                     │
   │ proof (SDK)     │                     │
   │─────────┐       │                     │
   │         │       │                     │
   │<────────┘       │                     │
   │                 │                     │
   │                 │  POST /verify       │
   │                 │  + proof            │
   ├─────────────────┴────────────────────>│
   │                                       │
   │                 verification token    │
   │<──────────────────────────────────────┤
   │                 │                     │
   │ POST /inference │                     │
   │ + X-PAYMENT     │                     │
   ├────────────────>│                     │
   │                 │                     │
   │                 │ Verify token        │
   │                 │─────────┐           │
   │                 │         │           │
   │                 │<────────┘           │
   │                 │                     │
   │  200 + result   │                     │
   │<────────────────┤                     │
   │                 │                     │
```

---

## 8. Implementation Timeline (7 days)

### Day 0 (Nov 4) - Foundation
**Goals**: Scaffold, core mock seller, basic facilitator
- [ ] Initialize repo with structure
- [ ] Setup TypeScript configuration
- [ ] Implement basic Express seller with 402 response
- [ ] Implement basic facilitator with mock verification
- [ ] Write initial README
- **Deliverable**: Can start seller, get 402 response

### Day 1 (Nov 5) - SDK & Launcher
**Goals**: Working SDK, multi-node launcher
- [ ] Implement X402Client class
- [ ] Implement `requestWithAutoPay()` method
- [ ] Build CLI launcher script
- [ ] Test basic flow: client → seller → facilitator → success
- **Deliverable**: End-to-end mock flow works

### Day 2 (Nov 6) - Testing
**Goals**: Comprehensive test coverage
- [ ] Setup Jest configuration
- [ ] Write unit tests for SDK
- [ ] Write unit tests for verifier
- [ ] Write E2E tests for happy path
- [ ] Write E2E tests for error scenarios
- **Deliverable**: >80% test coverage

### Day 3 (Nov 7) - Documentation
**Goals**: Complete docs
- [ ] Write comprehensive README
- [ ] Create API.md reference
- [ ] Create ARCHITECTURE.md
- [ ] Create code examples
- **Deliverable**: Docs complete for external users

### Day 4 (Nov 8) - Solana Integration (Optional)
**Goals**: Real devnet verification path
- [ ] Integrate @solana/web3.js
- [ ] Implement real transaction verification
- [ ] Add devnet configuration mode
- [ ] Test with real Solana devnet
- **Deliverable**: Can verify real Solana transactions (optional)

### Day 5 (Nov 9) - Polish & Examples
**Goals**: UX improvements, example integrations
- [ ] Create example client scripts
- [ ] Improve CLI output formatting
- [ ] Add progress indicators
- [ ] Error message improvements
- **Deliverable**: Production-ready developer experience

### Day 6-7 (Nov 10-11) - Final Review & Submission
**Goals**: Final testing and submission
- [ ] Final testing on clean machine
- [ ] Update documentation based on final code
- [ ] Fix any critical bugs
- [ ] Final git tag/release
- **Deliverable**: Project ready for submission

---

## 9. Key Design Decisions

### 9.1 Technology Choices

**Express.js over Fastify**
- Reasoning: Better documentation, wider community, sufficient performance for sandbox use case

**TypeScript over JavaScript**
- Reasoning: Better DX with types, easier to maintain, required for SDK users

**Mock-first over Devnet-first**
- Reasoning: Faster iteration, lower barrier to entry, devnet as optional enhancement

**Jest over Mocha**
- Reasoning: Better TypeScript integration, built-in assertions, snapshot testing

### 9.2 Scope Decisions

**In Scope**:
- Mock payment flows (core)
- Basic SDK (core)
- CLI launcher (core)
- E2E tests (core)
- Optional Solana devnet verification

**Out of Scope** (future work):
- Mainnet support
- Web UI dashboard
- Multi-chain support beyond Solana
- Production-grade rate limiting
- Advanced analytics

---

## 10. Success Metrics

### 10.1 Technical Metrics
- **Performance**: Handle 100 req/sec per seller node
- **Reliability**: >99% uptime in local environment
- **Test Coverage**: >80% overall, >95% on critical paths
- **Documentation**: All public APIs documented
- **Code Quality**: No critical linting errors

### 10.2 Developer Experience Metrics
- **Time to First Request**: <5 minutes from clone to running
- **Setup Steps**: <5 commands to get running
- **Documentation Quality**: No unanswered questions in FAQ
- **Error Messages**: All error paths have clear, actionable messages

---

## Appendix: References & Resources

### X402 Protocol
- X402 Specification: https://x402.org
- Coinbase X402 Docs: https://docs.cdp.coinbase.com
- X402 GitHub: https://github.com/coinbase/x402

### Solana Development
- Solana Docs: https://docs.solana.com
- Solana Web3.js: https://solana-labs.github.io/solana-web3.js
- Solana Devnet Guide: https://docs.solana.com/clusters#devnet

### Best Practices
- Express.js Best Practices: https://expressjs.com/en/advanced/best-practice-performance.html
- TypeScript Deep Dive: https://basarat.gitbook.io/typescript
- Jest Testing Guide: https://jestjs.io/docs/getting-started

---

**Document Version:** 1.0
**Last Updated:** November 7, 2025
**Target Hackathon:** Solana X402 Hackathon
**License:** MIT
