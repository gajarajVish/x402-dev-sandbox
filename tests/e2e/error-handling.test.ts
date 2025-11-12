import { X402Client } from '../../src/sdk';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('E2E: Error Handling Scenarios', () => {
  let facilitatorProcess: ChildProcess;
  let sellerProcess: ChildProcess;
  const facilitatorPort = 5200;
  const sellerPort = 4200;

  beforeAll(async () => {
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

    sellerProcess = spawn('tsx', [
      path.join(__dirname, '../../src/mock-seller/index.ts'),
    ], {
      env: {
        ...process.env,
        SELLER_PORT: sellerPort.toString(),
        FACILITATOR_URL: `http://localhost:${facilitatorPort}/verify`,
      },
      stdio: 'pipe',
    });

    // Wait longer for servers to start and add health check
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Verify servers are actually running
    try {
      const healthCheck = await fetch(`http://localhost:${facilitatorPort}/health`);
      if (!healthCheck.ok) {
        console.error('Facilitator health check failed');
      }
    } catch (error) {
      console.error('Failed to connect to facilitator:', error);
    }
  });

  afterAll(async () => {
    facilitatorProcess.kill('SIGTERM');
    sellerProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Invalid Payment Tokens', () => {
    it('should reject empty payment header', async () => {
      const response = await fetch(`http://localhost:${sellerPort}/inference`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-PAYMENT': '',
        },
        body: JSON.stringify({ prompt: 'test' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_payment');
    });

    it('should reject malformed payment tokens', async () => {
      const invalidTokens = [
        'not-a-valid-token',
        'bearer:token',
        'random-string',
        '12345',
      ];

      for (const token of invalidTokens) {
        const response = await fetch(`http://localhost:${sellerPort}/inference`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-PAYMENT': token,
          },
          body: JSON.stringify({ prompt: 'test' }),
        });

        expect(response.status).toBe(403);
      }
    });
  });

  describe('Facilitator Errors', () => {
    it('should handle missing required fields in verification', async () => {
      const response = await fetch(`http://localhost:${facilitatorPort}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // Missing proof, payer, amount
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.ok).toBe(false);
      expect(data.error).toBe('invalid_request');
      expect(data.detail).toContain('Missing required fields');
    });

    it('should handle partial verification data', async () => {
      const response = await fetch(`http://localhost:${facilitatorPort}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          proof: { signature: 'test' },
          payer: 'test-wallet',
          // Missing amount
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.ok).toBe(false);
    });
  });

  describe('Seller Errors', () => {
    it('should handle missing request body', async () => {
      const response = await fetch(`http://localhost:${sellerPort}/inference`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-PAYMENT': 'mock-sig:validtoken',
        },
        // No body
      });

      // Should still process (body validation is application-specific)
      expect(response.status).toBe(200);
    });

    it('should return 402 when X-PAYMENT header is missing', async () => {
      const response = await fetch(`http://localhost:${sellerPort}/inference`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: 'test' }),
      });

      expect(response.status).toBe(402);
      const data = await response.json() as any;
      expect(data.error).toBe('payment_required');
      expect(data.payment_requirements).toBeDefined();
    });
  });

  describe('Network Errors', () => {
    it('should handle facilitator being unreachable', async () => {
      const client = new X402Client({
        facilitatorUrl: 'http://localhost:9999/verify', // Non-existent port
        mode: 'mock',
      });

      await expect(
        client.requestWithAutoPay(`http://localhost:${sellerPort}/inference`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: 'test' }),
        })
      ).rejects.toThrow();
    });

    it('should handle seller being unreachable', async () => {
      const client = new X402Client({ mode: 'mock' });

      await expect(
        client.requestWithAutoPay('http://localhost:9998/inference', {
          method: 'POST',
        })
      ).rejects.toThrow();
    });
  });

  describe('SDK Error Handling', () => {
    it('should throw on malformed 402 response', async () => {
      const client = new X402Client();

      const mockResponse = {
        status: 402,
        json: async () => ({
          error: 'payment_required',
          // Missing payment_requirements field
        }),
      } as Response;

      await expect(
        client.parsePaymentRequirements(mockResponse)
      ).rejects.toThrow('402 response missing payment_requirements field');
    });

    it('should throw on verification failure', async () => {
      const client = new X402Client();

      // Save original fetch
      const originalFetch = global.fetch;

      try {
        const mockFetch = jest.fn().mockResolvedValue({
          json: async () => ({
            ok: false,
            error: 'test_error',
          }),
        });
        global.fetch = mockFetch as any;

        const proof = {
          payer: 'test',
          timestamp: new Date().toISOString(),
        };

        const requirements = {
          id: 'test',
          product: 'test',
          amount: 1000,
          currency: 'USDC',
          chain: 'solana',
          facilitator: 'http://test/verify',
          expires_at: new Date().toISOString(),
        };

        await expect(
          client.verifyPayment(proof, requirements)
        ).rejects.toThrow('Payment verification failed: test_error');
      } finally {
        // Restore original fetch
        global.fetch = originalFetch;
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large amounts', async () => {
      const response = await fetch(`http://localhost:${facilitatorPort}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          proof: { signature: 'test' },
          payer: 'test-wallet',
          amount: 999999999999,
          chain: 'solana',
        }),
      });

      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.ok).toBe(true);
    });

    it('should handle special characters in payer identity', async () => {
      const specialPayers = [
        'wallet@#$%',
        'wallet with spaces',
        'wallet\nwith\nnewlines',
        'wallet"with"quotes',
      ];

      for (const payer of specialPayers) {
        const response = await fetch(`http://localhost:${facilitatorPort}/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            proof: { signature: 'test' },
            payer,
            amount: 1000,
            chain: 'solana',
          }),
        });

        expect(response).toBeDefined();
        expect(response.status).toBe(200);
      }
    });

    it('should handle concurrent payment verifications', async () => {
      const promises = Array(20).fill(null).map((_, i) =>
        fetch(`http://localhost:${facilitatorPort}/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            proof: { signature: `sig-${i}` },
            payer: `wallet-${i}`,
            amount: 1000,
            chain: 'solana',
          }),
        })
      );

      const responses = await Promise.all(promises);

      responses.forEach((response, index) => {
        expect(response).toBeDefined();
        if (!response || response.status !== 200) {
          console.error(`Response ${index} failed:`, response);
        }
        expect(response.status).toBe(200);
      });

      const data = await Promise.all(responses.map(r => r.json())) as any[];
      data.forEach((d) => {
        expect(d.ok).toBe(true);
        expect(d.verification).toMatch(/^mock-sig:/);
      });
    });
  });
});
