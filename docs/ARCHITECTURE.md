# Architecture Documentation

Deep dive into the X402 Sandbox architecture, design decisions, and implementation details.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Payment Flow](#payment-flow)
4. [Data Models](#data-models)
5. [Security Considerations](#security-considerations)
6. [Scalability & Performance](#scalability--performance)
7. [Extension Points](#extension-points)
8. [Design Decisions](#design-decisions)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    X402 Sandbox Ecosystem                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │   Client     │      │   Client     │                     │
│  │  (X402SDK)   │      │  (Manual)    │                     │
│  └──────┬───────┘      └──────┬───────┘                     │
│         │                     │                             │
│         └─────────┬───────────┘                             │
│                   │                                         │
│         ┌─────────▼─────────┐                               │
│         │                   │                               │
│    ┌────▼────┐         ┌────▼────┐        ┌─────────┐      │
│    │ Seller  │         │ Seller  │   ...  │ Seller  │      │
│    │  #1     │         │  #2     │        │  #N     │      │
│    └────┬────┘         └────┬────┘        └────┬────┘      │
│         │                   │                  │            │
│         └───────────┬───────┴──────────────────┘            │
│                     │                                       │
│              ┌──────▼────────┐                              │
│              │  Facilitator  │                              │
│              │  (Verifier)   │                              │
│              └───────────────┘                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Mock-First Design**: Default to mock mode for rapid iteration
2. **Progressive Enhancement**: Support real blockchain verification as extension
3. **Stateless Sellers**: Each seller operates independently
4. **Centralized Verification**: Single facilitator for all sellers (in basic setup)
5. **TypeScript Native**: Full type safety across all components

---

## Component Architecture

### 1. Mock Seller

**Location**: `src/mock-seller/index.ts`

**Responsibilities**:
- Implement x402 payment protocol
- Generate payment requirements
- Validate payment tokens
- Process authorized requests

**Key Design Patterns**:

```typescript
// Middleware pattern for payment validation
app.use(paymentMiddleware);

// Factory pattern for payment requirements
function generatePaymentRequirements(): PaymentRequirements {
  // Generates unique request ID
  // Sets expiration timestamp
  // Returns structured requirements
}

// Validator pattern for tokens
function isValidPaymentToken(token: string): boolean {
  // Mock: Check prefix "mock-sig:"
  // Production: Verify signature cryptographically
}
```

**State Management**:
- Stateless (no request tracking)
- Ephemeral payment requirements
- No persistent storage

**Configuration**:
- Environment-driven (dotenv)
- Port assignment
- Pricing configuration
- Facilitator URL injection

### 2. Mock Facilitator

**Location**: `src/mock-facilitator/index.ts`

**Responsibilities**:
- Verify payment proofs
- Issue verification tokens
- Track verified payments (in-memory)

**Key Design Patterns**:

```typescript
// Strategy pattern for verification modes
interface VerificationStrategy {
  verify(req: VerificationRequest): VerificationResponse;
}

class MockVerifier implements VerificationStrategy {
  verify(req: VerificationRequest): VerificationResponse {
    // Accept any proof, return mock token
  }
}

class DevnetVerifier implements VerificationStrategy {
  verify(req: VerificationRequest): VerificationResponse {
    // Verify real Solana transaction
  }
}
```

**State Management**:
- In-memory Map for verified payments
- Not persistent (resets on restart)
- Production should use Redis/database

**Token Format**:
```
mock-sig:<16-char-hex>
```

### 3. X402 SDK

**Location**: `src/sdk/index.ts`

**Responsibilities**:
- Abstract payment flow complexity
- Auto-detect 402 responses
- Handle payment creation and verification
- Retry with payment token

**Key Design Patterns**:

```typescript
// Template method pattern for payment flow
async requestWithAutoPay(url, init) {
  const response = await fetch(url, init);

  if (response.status !== 402) {
    return response;  // Fast path
  }

  // Slow path: payment required
  const requirements = await this.parsePaymentRequirements(response);
  const proof = await this.createPaymentProof(requirements);
  const token = await this.verifyPayment(proof, requirements);

  // Retry with payment
  return await fetch(url, {
    ...init,
    headers: { ...init.headers, 'X-PAYMENT': token }
  });
}
```

**Configurability**:
- Mode selection (mock/devnet)
- Facilitator override
- Payer identity management

### 4. Network Launcher

**Location**: `src/launcher/index.ts`

**Responsibilities**:
- Spawn multiple node processes
- Port management
- Graceful shutdown
- Environment injection

**Key Design Patterns**:

```typescript
// Builder pattern for process spawning
class ProcessBuilder {
  withEnv(env: Record<string, string>): this;
  withStdio(stdio: string): this;
  spawn(): ChildProcess;
}

// Observer pattern for cleanup
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
```

**Process Management**:
- Child process spawning via `child_process.spawn()`
- Sequential startup with delays
- Coordinated shutdown
- Stdio inheritance for logging

---

## Payment Flow

### Sequence Diagram

```
Client          Seller              Facilitator
  │               │                      │
  │   POST        │                      │
  ├──────────────>│                      │
  │               │                      │
  │   402 + reqs  │                      │
  │<──────────────┤                      │
  │               │                      │
  │  (create proof)                      │
  │───────┐       │                      │
  │       │       │                      │
  │<──────┘       │                      │
  │               │                      │
  │               │   POST /verify       │
  │               │   + proof            │
  ├───────────────┴─────────────────────>│
  │                                      │
  │               │    verification      │
  │<──────────────┴──────────────────────┤
  │               │                      │
  │   POST        │                      │
  │  + X-PAYMENT  │                      │
  ├──────────────>│                      │
  │               │                      │
  │               │ (validate token)     │
  │               │─────────┐            │
  │               │         │            │
  │               │<────────┘            │
  │               │                      │
  │   200 + data  │                      │
  │<──────────────┤                      │
  │               │                      │
```

### Flow States

1. **Initial Request**: No `X-PAYMENT` header → 402 response
2. **Payment Discovery**: Parse `payment_requirements` from response
3. **Proof Creation**: Generate payment proof (mock or real)
4. **Verification**: Submit proof to facilitator
5. **Token Receipt**: Receive `verification` token
6. **Authorized Request**: Retry with `X-PAYMENT: <token>`
7. **Success**: Receive 200 response with data

### Error Paths

```
Initial Request
    │
    ├─> 200 OK (no payment needed)
    │
    ├─> 402 Payment Required
    │     │
    │     ├─> Verification Failure
    │     │     └─> Throw Error
    │     │
    │     └─> Invalid Token
    │           └─> 403 Forbidden
    │
    └─> Network Error
          └─> Throw Error
```

---

## Data Models

### Payment Requirements Lifecycle

```typescript
// 1. Generation (Seller)
const requirements: PaymentRequirements = {
  id: crypto.randomBytes(8).toString('hex'),
  product: 'api_inference_v1',
  amount: 1000,
  currency: 'USDC',
  chain: 'solana',
  facilitator: 'http://localhost:5000/verify',
  expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
};

// 2. Transmission (402 Response Body)
{
  error: 'payment_required',
  payment_requirements: requirements
}

// 3. Consumption (Client SDK)
const parsed = await client.parsePaymentRequirements(response);

// 4. Expiration Check
const expiresAt = new Date(parsed.expires_at);
if (expiresAt < new Date()) {
  throw new Error('Payment requirement expired');
}
```

### Verification Token Format

**Structure**: `<prefix>:<data>`

**Mock Mode**:
```
mock-sig:a1b2c3d4e5f6g7h8
         └─ 16-char hex
```

**Devnet Mode** (future):
```
solana-sig:<base58-signature>
```

---

## Security Considerations

### Current Implementation (Mock Mode)

⚠️ **Not production-ready**. Mock mode is designed for development only.

**Known Limitations**:
- Accepts any payment proof
- No signature verification
- Token reuse is allowed
- No rate limiting
- No request tracking

### Production Requirements

1. **Signature Verification**:
   ```typescript
   function verifySignature(proof: PaymentProof): boolean {
     // Verify blockchain transaction signature
     // Validate sender/receiver addresses
     // Check amount matches requirements
   }
   ```

2. **One-Time Token Use**:
   ```typescript
   const usedTokens = new Set<string>();

   function validateToken(token: string): boolean {
     if (usedTokens.has(token)) {
       throw new Error('Token already used');
     }
     usedTokens.add(token);
     return true;
   }
   ```

3. **Expiration Enforcement**:
   ```typescript
   function checkExpiration(requirements: PaymentRequirements): void {
     const expiresAt = new Date(requirements.expires_at);
     if (expiresAt < new Date()) {
       throw new Error('Payment requirement expired');
     }
   }
   ```

4. **Rate Limiting**:
   - Per-IP limits
   - Per-wallet limits
   - Global throughput limits

### Threat Model

**Threats Mitigated**:
- ✅ Unauthorized API access (via 402 gate)
- ✅ Basic DoS (via payment requirement)

**Threats NOT Mitigated** (mock mode):
- ❌ Payment fraud (no signature verification)
- ❌ Token replay attacks
- ❌ Double spending
- ❌ Sybil attacks

---

## Scalability & Performance

### Horizontal Scaling

**Sellers**:
- Stateless design enables horizontal scaling
- Load balancing via standard HTTP load balancers
- No shared state between sellers

**Facilitator**:
- Current: Single instance with in-memory state
- Production: Replicate with shared state (Redis/Postgres)

### Performance Characteristics

**Latency Breakdown** (mock mode):
```
Total request latency: ~150ms
├─ Initial request: 50ms
├─ Proof creation: 1ms (mock)
├─ Verification: 50ms
└─ Retry request: 50ms
```

**Throughput** (single seller, mock mode):
- Theoretical: ~100 req/sec
- Limited by: Express.js event loop, network I/O

### Optimization Opportunities

1. **Connection Pooling**: Reuse HTTP connections to facilitator
2. **Proof Caching**: Cache valid proofs for same payer
3. **Batch Verification**: Verify multiple proofs in single request
4. **CDN Integration**: Cache payment requirements for popular endpoints

---

## Extension Points

### 1. Custom Verification Strategies

```typescript
// src/mock-facilitator/verifiers/custom-verifier.ts
export class CustomVerifier implements VerificationStrategy {
  async verify(req: VerificationRequest): Promise<VerificationResponse> {
    // Your custom verification logic
  }
}
```

### 2. Custom Payment Proof Types

```typescript
// Extend PaymentProof interface
interface SolanaPaymentProof extends PaymentProof {
  transaction: {
    signature: string;
    slot: number;
    confirmations: number;
  };
}
```

### 3. Middleware Integration

```typescript
// Express middleware for x402
export function x402Middleware(options: X402Options) {
  return async (req, res, next) => {
    const paymentHeader = req.header('X-PAYMENT');
    if (!paymentHeader) {
      return res.status(402).json({
        error: 'payment_required',
        payment_requirements: generateRequirements(req),
      });
    }
    // Validate token and proceed
    next();
  };
}
```

### 4. Database Integration

```typescript
// Replace in-memory Map with persistent storage
class DatabaseVerificationStore {
  async storeVerification(token: string, data: any): Promise<void> {
    await db.verifications.insert({ token, data, created_at: new Date() });
  }

  async getVerification(token: string): Promise<any> {
    return await db.verifications.findOne({ token });
  }
}
```

---

## Design Decisions

### Why Express.js?

**Chosen**: Express.js
**Alternatives**: Fastify, Koa, Hapi

**Reasoning**:
- Mature ecosystem with extensive middleware
- Well-documented for educational purposes
- Sufficient performance for sandbox use case
- Lower learning curve for contributors

### Why In-Memory State?

**Chosen**: In-memory Map
**Alternatives**: Redis, PostgreSQL, SQLite

**Reasoning**:
- Zero external dependencies for quick start
- Acceptable for development/testing
- Easy to understand and debug
- Production deployment can swap implementation

### Why Mock-First?

**Chosen**: Mock mode as default
**Alternatives**: Devnet-first, testnet integration

**Reasoning**:
- Instant feedback loop (no blockchain wait times)
- No RPC node dependencies
- Works offline
- Lower barrier to entry for hackathons

### Why Monorepo Structure?

**Chosen**: Single repository with multiple components
**Alternatives**: Separate repos for SDK, seller, facilitator

**Reasoning**:
- Easier to coordinate changes across components
- Simplified setup for new users
- Better for educational purposes
- Type sharing between components

### Why TypeScript?

**Chosen**: TypeScript
**Alternatives**: JavaScript, Go, Rust

**Reasoning**:
- Type safety prevents common errors
- Better IDE support and autocomplete
- Self-documenting via types
- Node.js ecosystem compatibility

---

## Future Enhancements

### Planned Features

1. **Solana Devnet Integration**
   - Real transaction verification
   - SPL token transfer validation
   - Anchor program integration

2. **Web Dashboard**
   - Visual network status
   - Payment flow visualization
   - Request analytics

3. **Multi-Chain Support**
   - Ethereum/Polygon
   - Bitcoin Lightning
   - Cosmos

4. **Advanced Features**
   - Subscription payments
   - Batched payments
   - Micropayment channels

---

## References

- [X402 Protocol Specification](https://x402.org)
- [HTTP 402 Status Code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
