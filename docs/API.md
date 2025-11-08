# API Reference

Complete API documentation for X402 Sandbox components.

---

## Table of Contents

- [X402Client SDK](#x402client-sdk)
- [Mock Seller API](#mock-seller-api)
- [Mock Facilitator API](#mock-facilitator-api)
- [Type Definitions](#type-definitions)

---

## X402Client SDK

The TypeScript SDK for interacting with x402 payment-gated APIs.

### Installation

```typescript
import { X402Client } from './src/sdk';
```

### Constructor

```typescript
new X402Client(options?: X402ClientOptions)
```

Creates a new X402 client instance.

**Parameters:**

- `options` (optional): Configuration options
  - `facilitatorUrl?: string` - Override facilitator URL from payment requirements
  - `mode?: 'mock' | 'devnet'` - Payment mode (default: 'mock')
  - `payerIdentity?: string` - Payer wallet identifier (auto-generated if not provided)

**Example:**

```typescript
const client = new X402Client({
  mode: 'mock',
  payerIdentity: 'my-wallet-address',
});
```

### Methods

#### `requestWithAutoPay(url, init?)`

Makes an HTTP request with automatic x402 payment handling.

**Signature:**

```typescript
async requestWithAutoPay(url: string, init?: RequestInit): Promise<Response>
```

**Parameters:**

- `url: string` - The URL to request
- `init?: RequestInit` - Fetch API options (method, headers, body, etc.)

**Returns:** `Promise<Response>` - The final response after payment (if required)

**Behavior:**

1. Makes initial request to URL
2. If response is 402, extracts payment requirements
3. Creates payment proof
4. Verifies payment with facilitator
5. Retries request with `X-PAYMENT` header
6. Returns successful response

**Example:**

```typescript
const response = await client.requestWithAutoPay(
  'http://localhost:4000/inference',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'test' }),
  }
);

const data = await response.json();
```

#### `parsePaymentRequirements(response)`

Extracts payment requirements from a 402 response.

**Signature:**

```typescript
async parsePaymentRequirements(response: Response): Promise<PaymentRequirements>
```

**Parameters:**

- `response: Response` - A 402 response from a seller API

**Returns:** `Promise<PaymentRequirements>` - Parsed payment requirements

**Throws:** Error if `payment_requirements` field is missing

**Example:**

```typescript
const response = await fetch('http://localhost:4000/inference', {
  method: 'POST',
  body: JSON.stringify({ prompt: 'test' }),
});

if (response.status === 402) {
  const requirements = await client.parsePaymentRequirements(response);
  console.log(`Payment required: ${requirements.amount} ${requirements.currency}`);
}
```

#### `createPaymentProof(requirements)`

Creates a payment proof for the given requirements.

**Signature:**

```typescript
async createPaymentProof(requirements: PaymentRequirements): Promise<PaymentProof>
```

**Parameters:**

- `requirements: PaymentRequirements` - Payment requirements from seller

**Returns:** `Promise<PaymentProof>` - Payment proof object

**Modes:**

- **Mock mode**: Generates mock proof instantly
- **Devnet mode**: Creates real Solana transaction (not yet implemented)

**Example:**

```typescript
const proof = await client.createPaymentProof(requirements);
```

#### `verifyPayment(proof, requirements)`

Verifies a payment proof with the facilitator.

**Signature:**

```typescript
async verifyPayment(
  proof: PaymentProof,
  requirements: PaymentRequirements
): Promise<string>
```

**Parameters:**

- `proof: PaymentProof` - The payment proof to verify
- `requirements: PaymentRequirements` - Original payment requirements

**Returns:** `Promise<string>` - Verification token to use in `X-PAYMENT` header

**Throws:** Error if verification fails

**Example:**

```typescript
const token = await client.verifyPayment(proof, requirements);
// Use token in X-PAYMENT header for subsequent requests
```

---

## Mock Seller API

HTTP server that implements the x402 payment protocol.

### Base URL

Default: `http://localhost:4000` (configurable via `SELLER_PORT`)

### Endpoints

#### `GET /health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "service": "mock-seller",
  "port": 4000
}
```

#### `POST /inference`

Protected endpoint requiring x402 payment.

**Request (without payment):**

```http
POST /inference HTTP/1.1
Content-Type: application/json

{
  "prompt": "Your prompt here"
}
```

**Response (402 Payment Required):**

```json
{
  "error": "payment_required",
  "message": "Payment is required to access this resource",
  "payment_requirements": {
    "id": "req_abc123xyz",
    "product": "api_inference_v1",
    "amount": 1000,
    "currency": "USDC",
    "chain": "solana",
    "facilitator": "http://localhost:5000/verify",
    "expires_at": "2025-11-08T15:30:00Z"
  }
}
```

**Request (with payment):**

```http
POST /inference HTTP/1.1
Content-Type: application/json
X-PAYMENT: mock-sig:abc123...

{
  "prompt": "Your prompt here"
}
```

**Response (200 OK):**

```json
{
  "result": "Processed inference for: \"Your prompt here\"",
  "model": "mock-model-v1",
  "cost_charged": 1000,
  "timestamp": "2025-11-08T15:25:00Z"
}
```

**Error Responses:**

- `403 Forbidden` - Invalid payment token format
  ```json
  {
    "error": "invalid_payment",
    "message": "The provided payment token is invalid"
  }
  ```

### Configuration

Environment variables:

- `SELLER_PORT` - Server port (default: 4000)
- `PRODUCT_AMOUNT` - Price in minor units (default: 1000)
- `PRODUCT_CURRENCY` - Currency code (default: USDC)
- `FACILITATOR_URL` - Facilitator endpoint (default: http://localhost:5000/verify)

---

## Mock Facilitator API

Payment verification service.

### Base URL

Default: `http://localhost:5000` (configurable via `FACILITATOR_PORT`)

### Endpoints

#### `GET /health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "service": "mock-facilitator",
  "mode": "mock",
  "port": 5000
}
```

#### `POST /verify`

Verifies payment proofs and issues verification tokens.

**Request:**

```http
POST /verify HTTP/1.1
Content-Type: application/json

{
  "proof": {
    "signature": "...",
    "transaction": "..."
  },
  "payer": "wallet_address_or_id",
  "amount": 1000,
  "chain": "solana",
  "request_id": "req_abc123"
}
```

**Response (Success):**

```json
{
  "ok": true,
  "verification": "mock-sig:verification_token_abc123",
  "settled": true,
  "timestamp": "2025-11-08T15:25:00Z"
}
```

**Response (Failure):**

```json
{
  "ok": false,
  "error": "invalid_request",
  "detail": "Missing required fields: proof, payer, amount"
}
```

**Required Fields:**

- `proof` - Payment proof object (any structure in mock mode)
- `payer` - Payer identifier (wallet address or ID)
- `amount` - Payment amount in minor units
- `chain` - Blockchain network (e.g., "solana")

**Optional Fields:**

- `request_id` - Original payment requirement ID (for tracking)

### Configuration

Environment variables:

- `FACILITATOR_PORT` - Server port (default: 5000)
- `FACILITATOR_MODE` - Verification mode: "mock" | "devnet" (default: mock)
- `SOLANA_RPC_URL` - Solana RPC endpoint (for devnet mode, not yet implemented)

---

## Type Definitions

### PaymentRequirements

Information about required payment for a resource.

```typescript
interface PaymentRequirements {
  id: string;              // Unique request identifier
  product: string;         // Product/service identifier
  amount: number;          // Price in minor units (e.g., 1000 = $0.01 for 2-decimal currency)
  currency: string;        // Currency code (e.g., "USDC", "SOL")
  chain: string;           // Blockchain network (e.g., "solana")
  facilitator: string;     // Facilitator verification endpoint URL
  expires_at: string;      // ISO 8601 timestamp when requirement expires
}
```

### PaymentProof

Proof of payment for verification.

```typescript
interface PaymentProof {
  signature?: string;      // Transaction signature (blockchain-specific)
  transaction?: string;    // Transaction data (blockchain-specific)
  timestamp: string;       // ISO 8601 timestamp when proof was created
  payer: string;           // Payer wallet address or identifier
}
```

### X402ClientOptions

Configuration options for X402Client.

```typescript
interface X402ClientOptions {
  facilitatorUrl?: string;    // Override facilitator URL
  mode?: 'mock' | 'devnet';   // Payment mode
  payerIdentity?: string;     // Payer wallet identifier
}
```

### VerificationRequest

Request to facilitator for payment verification.

```typescript
interface VerificationRequest {
  proof: any;              // Payment proof (structure varies by mode)
  payer: string;           // Payer identifier
  amount: number;          // Payment amount
  chain: string;           // Blockchain network
  request_id?: string;     // Optional payment requirement ID
}
```

### VerificationResponse

Response from facilitator after verification.

```typescript
interface VerificationResponse {
  ok: boolean;                // Success flag
  verification?: string;      // Verification token (if successful)
  settled?: boolean;          // Whether payment is settled
  timestamp?: string;         // Verification timestamp
  error?: string;             // Error code (if failed)
  detail?: string;            // Error details (if failed)
}
```

---

## Error Handling

### Common Error Scenarios

1. **Missing X-PAYMENT header** → 402 Payment Required
2. **Invalid payment token format** → 403 Forbidden
3. **Verification failure** → Exception thrown by SDK
4. **Network errors** → Fetch exceptions
5. **Malformed 402 response** → Exception from `parsePaymentRequirements()`

### Best Practices

```typescript
try {
  const response = await client.requestWithAutoPay(url, options);
  const data = await response.json();
  // Handle success
} catch (error) {
  if (error.message.includes('Payment verification failed')) {
    // Handle verification failure
  } else if (error.message.includes('402 response missing')) {
    // Handle malformed 402 response
  } else {
    // Handle network or other errors
  }
}
```

---

## Rate Limiting

The mock implementation does not enforce rate limits. For production use, implement rate limiting based on:

- Payer identity
- IP address
- Verification token usage

---

## Authentication vs Authorization

- **Authentication**: Handled via x402 payment protocol
- **Authorization**: Each payment authorizes a specific request (identified by `payment_requirements.id`)
- **Token Reuse**: Mock mode allows token reuse; production should validate one-time use

---

## Additional Resources

- [X402 Protocol Specification](https://x402.org)
- [Architecture Documentation](./ARCHITECTURE.md)
- [Examples](../examples/)
- [Contributing Guide](./CONTRIBUTING.md)
