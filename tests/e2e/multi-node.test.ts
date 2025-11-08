import { X402Client } from '../../src/sdk';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('E2E: Multi-Node Network Scenarios', () => {
  let facilitatorProcess: ChildProcess;
  let sellerProcesses: ChildProcess[] = [];
  const facilitatorPort = 5300;
  const basePort = 4300;
  const numSellers = 3;

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

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start multiple sellers
    for (let i = 0; i < numSellers; i++) {
      const port = basePort + i;
      const sellerProcess = spawn('tsx', [
        path.join(__dirname, '../../src/mock-seller/index.ts'),
      ], {
        env: {
          ...process.env,
          SELLER_PORT: port.toString(),
          FACILITATOR_URL: `http://localhost:${facilitatorPort}/verify`,
          PRODUCT_AMOUNT: (1000 + i * 100).toString(),
        },
        stdio: 'pipe',
      });

      sellerProcesses.push(sellerProcess);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    facilitatorProcess.kill('SIGTERM');
    sellerProcesses.forEach(proc => proc.kill('SIGTERM'));
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  it('should verify all sellers are running', async () => {
    for (let i = 0; i < numSellers; i++) {
      const port = basePort + i;
      const response = await fetch(`http://localhost:${port}/health`);

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.status).toBe('ok');
      expect(data.service).toBe('mock-seller');
      expect(data.port).toBe(port);
    }
  });

  it('should handle requests to different sellers', async () => {
    const client = new X402Client({ mode: 'mock' });

    for (let i = 0; i < numSellers; i++) {
      const port = basePort + i;
      const response = await client.requestWithAutoPay(
        `http://localhost:${port}/inference`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: `Test seller ${i}` }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.result).toContain(`Test seller ${i}`);
      expect(data.cost_charged).toBe(1000 + i * 100);
    }
  });

  it('should handle concurrent requests across multiple sellers', async () => {
    const client = new X402Client({ mode: 'mock' });

    const promises = [];
    for (let i = 0; i < numSellers; i++) {
      const port = basePort + i;
      for (let j = 0; j < 3; j++) {
        promises.push(
          client.requestWithAutoPay(
            `http://localhost:${port}/inference`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ prompt: `Seller ${i} Request ${j}` }),
            }
          )
        );
      }
    }

    const responses = await Promise.all(promises);

    expect(responses).toHaveLength(numSellers * 3);
    responses.forEach((response) => {
      expect(response.status).toBe(200);
    });
  });

  it('should verify each seller has different pricing', async () => {
    const prices = [];

    for (let i = 0; i < numSellers; i++) {
      const port = basePort + i;
      const response = await fetch(`http://localhost:${port}/inference`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: 'test' }),
      });

      expect(response.status).toBe(402);
      const data = await response.json() as any;
      prices.push(data.payment_requirements.amount);
    }

    // Verify different prices
    expect(prices[0]).toBe(1000);
    expect(prices[1]).toBe(1100);
    expect(prices[2]).toBe(1200);
  });

  it('should handle round-robin distribution', async () => {
    const client = new X402Client({ mode: 'mock' });
    const results = [];

    // Make requests in round-robin fashion
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < numSellers; i++) {
        const port = basePort + i;
        const response = await client.requestWithAutoPay(
          `http://localhost:${port}/inference`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ prompt: `Round ${round} Seller ${i}` }),
          }
        );

        expect(response.status).toBe(200);
        const data = await response.json() as any;
        results.push({
          seller: i,
          round,
          cost: data.cost_charged,
        });
      }
    }

    expect(results).toHaveLength(9);

    // Verify each seller was hit 3 times
    for (let i = 0; i < numSellers; i++) {
      const sellerRequests = results.filter(r => r.seller === i);
      expect(sellerRequests).toHaveLength(3);
    }
  });

  it('should share single facilitator across all sellers', async () => {
    const verifications = new Set();

    for (let i = 0; i < numSellers; i++) {
      const port = basePort + i;

      // Get payment requirements
      const response402 = await fetch(`http://localhost:${port}/inference`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: 'test' }),
      });

      const data402 = await response402.json() as any;
      const requirements = data402.payment_requirements;

      // Verify all sellers point to same facilitator
      expect(requirements.facilitator).toBe(`http://localhost:${facilitatorPort}/verify`);

      // Get verification token
      const verifyResponse = await fetch(requirements.facilitator, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          proof: { signature: `sig-${i}` },
          payer: `wallet-${i}`,
          amount: requirements.amount,
          chain: 'solana',
        }),
      });

      const verifyData = await verifyResponse.json() as any;
      expect(verifyData.ok).toBe(true);
      verifications.add(verifyData.verification);
    }

    // Verify all tokens are unique
    expect(verifications.size).toBe(numSellers);
  });

  it('should handle seller failure gracefully', async () => {
    const client = new X402Client({ mode: 'mock' });

    // Kill one seller
    const failedSellerIndex = 1;
    sellerProcesses[failedSellerIndex].kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Requests to other sellers should still work
    const workingSellerIndex = 0;
    const port = basePort + workingSellerIndex;

    const response = await client.requestWithAutoPay(
      `http://localhost:${port}/inference`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: 'test' }),
      }
    );

    expect(response.status).toBe(200);

    // Request to failed seller should fail
    const failedPort = basePort + failedSellerIndex;
    await expect(
      client.requestWithAutoPay(`http://localhost:${failedPort}/inference`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: 'test' }),
      })
    ).rejects.toThrow();

    // Restart the killed seller for cleanup
    sellerProcesses[failedSellerIndex] = spawn('tsx', [
      path.join(__dirname, '../../src/mock-seller/index.ts'),
    ], {
      env: {
        ...process.env,
        SELLER_PORT: failedPort.toString(),
        FACILITATOR_URL: `http://localhost:${facilitatorPort}/verify`,
        PRODUCT_AMOUNT: (1000 + failedSellerIndex * 100).toString(),
      },
      stdio: 'pipe',
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  it('should handle high load across network', async () => {
    const client = new X402Client({ mode: 'mock' });
    const numRequestsPerSeller = 10;
    const promises = [];

    for (let i = 0; i < numSellers; i++) {
      const port = basePort + i;
      for (let j = 0; j < numRequestsPerSeller; j++) {
        promises.push(
          client.requestWithAutoPay(
            `http://localhost:${port}/inference`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ prompt: `Load test ${i}-${j}` }),
            }
          )
        );
      }
    }

    const responses = await Promise.all(promises);

    expect(responses).toHaveLength(numSellers * numRequestsPerSeller);
    responses.forEach((response) => {
      expect(response.status).toBe(200);
    });
  });
});
