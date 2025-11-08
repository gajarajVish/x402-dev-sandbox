import { X402Client } from '../../src/sdk';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('E2E: Basic 402 Payment Flow', () => {
  let facilitatorProcess: ChildProcess;
  let sellerProcess: ChildProcess;
  const facilitatorPort = 5100;
  const sellerPort = 4100;

  beforeAll(async () => {
    // Start facilitator
    facilitatorProcess = spawn('tsx', [
      path.join(__dirname, '../../src/mock-facilitator/index.ts'),
    ], {
      env: {
        ...process.env,
        FACILITATOR_PORT: facilitatorPort.toString(),
        FACILITATOR_MODE: 'mock',
      },
      stdio: 'pipe',
    });

    // Start seller
    sellerProcess = spawn('tsx', [
      path.join(__dirname, '../../src/mock-seller/index.ts'),
    ], {
      env: {
        ...process.env,
        SELLER_PORT: sellerPort.toString(),
        FACILITATOR_URL: `http://localhost:${facilitatorPort}/verify`,
        PRODUCT_AMOUNT: '1000',
      },
      stdio: 'pipe',
    });

    // Wait for services to start
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  afterAll(async () => {
    facilitatorProcess.kill('SIGTERM');
    sellerProcess.kill('SIGTERM');

    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  it('should complete full payment flow: 402 → pay → success', async () => {
    const client = new X402Client({
      mode: 'mock',
      payerIdentity: 'e2e-test-wallet',
    });

    const response = await client.requestWithAutoPay(
      `http://localhost:${sellerPort}/inference`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: 'E2E test prompt' }),
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json() as any;
    expect(data.result).toContain('E2E test prompt');
    expect(data.cost_charged).toBe(1000);
    expect(data.timestamp).toBeDefined();
  });

  it('should handle multiple sequential requests', async () => {
    const client = new X402Client({ mode: 'mock' });

    for (let i = 0; i < 3; i++) {
      const response = await client.requestWithAutoPay(
        `http://localhost:${sellerPort}/inference`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: `Test ${i}` }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.result).toContain(`Test ${i}`);
    }
  });

  it('should verify payment requirements structure', async () => {
    // Make a request without payment to get 402 response
    const response = await fetch(`http://localhost:${sellerPort}/inference`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'test' }),
    });

    expect(response.status).toBe(402);

    const data = await response.json() as any;
    expect(data.error).toBe('payment_required');
    expect(data.payment_requirements).toBeDefined();

    const reqs = data.payment_requirements;
    expect(reqs.id).toMatch(/^req_/);
    expect(reqs.product).toBe('api_inference_v1');
    expect(reqs.amount).toBe(1000);
    expect(reqs.currency).toBe('USDC');
    expect(reqs.chain).toBe('solana');
    expect(reqs.facilitator).toBe(`http://localhost:${facilitatorPort}/verify`);
    expect(reqs.expires_at).toBeDefined();

    // Verify expiration is in the future
    const expiresAt = new Date(reqs.expires_at);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should allow manual payment flow', async () => {
    // Step 1: Get 402 response
    const initialResponse = await fetch(`http://localhost:${sellerPort}/inference`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'manual test' }),
    });

    expect(initialResponse.status).toBe(402);
    const paymentData = await initialResponse.json() as any;
    const requirements = paymentData.payment_requirements;

    // Step 2: Verify payment with facilitator
    const verifyResponse = await fetch(`http://localhost:${facilitatorPort}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        proof: { stub: true },
        payer: 'manual-test-wallet',
        amount: requirements.amount,
        chain: requirements.chain,
      }),
    });

    expect(verifyResponse.status).toBe(200);
    const verifyData = await verifyResponse.json() as any;
    expect(verifyData.ok).toBe(true);
    expect(verifyData.verification).toMatch(/^mock-sig:/);

    // Step 3: Retry request with payment token
    const retryResponse = await fetch(`http://localhost:${sellerPort}/inference`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-PAYMENT': verifyData.verification,
      },
      body: JSON.stringify({ prompt: 'manual test' }),
    });

    expect(retryResponse.status).toBe(200);
    const result = await retryResponse.json() as any;
    expect(result.result).toContain('manual test');
  });

  it('should reject requests with invalid payment tokens', async () => {
    const response = await fetch(`http://localhost:${sellerPort}/inference`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-PAYMENT': 'invalid-token-format',
      },
      body: JSON.stringify({ prompt: 'test' }),
    });

    expect(response.status).toBe(403);
    const data = await response.json() as any;
    expect(data.error).toBe('invalid_payment');
  });

  it('should check health endpoints', async () => {
    const sellerHealth = await fetch(`http://localhost:${sellerPort}/health`);
    expect(sellerHealth.status).toBe(200);
    const sellerData = await sellerHealth.json() as any;
    expect(sellerData.status).toBe('ok');
    expect(sellerData.service).toBe('mock-seller');

    const facilitatorHealth = await fetch(`http://localhost:${facilitatorPort}/health`);
    expect(facilitatorHealth.status).toBe(200);
    const facilitatorData = await facilitatorHealth.json() as any;
    expect(facilitatorData.status).toBe('ok');
    expect(facilitatorData.service).toBe('mock-facilitator');
  });
});
