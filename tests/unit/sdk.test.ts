import { X402Client, PaymentRequirements } from '../../src/sdk';

describe('X402Client', () => {
  describe('constructor', () => {
    it('should create client with default options', () => {
      const client = new X402Client();
      expect(client).toBeInstanceOf(X402Client);
    });

    it('should create client with custom options', () => {
      const client = new X402Client({
        facilitatorUrl: 'http://custom:5000/verify',
        mode: 'devnet',
        payerIdentity: 'test-wallet',
      });
      expect(client).toBeInstanceOf(X402Client);
    });
  });

  describe('parsePaymentRequirements', () => {
    it('should parse valid payment requirements from 402 response', async () => {
      const client = new X402Client();

      const mockResponse = {
        json: async () => ({
          payment_requirements: {
            id: 'req_test123',
            product: 'api_inference_v1',
            amount: 1000,
            currency: 'USDC',
            chain: 'solana',
            facilitator: 'http://localhost:5000/verify',
            expires_at: '2025-11-08T15:30:00Z',
          },
        }),
      } as Response;

      const requirements = await client.parsePaymentRequirements(mockResponse);

      expect(requirements.id).toBe('req_test123');
      expect(requirements.amount).toBe(1000);
      expect(requirements.currency).toBe('USDC');
      expect(requirements.chain).toBe('solana');
    });

    it('should throw error if payment_requirements field is missing', async () => {
      const client = new X402Client();

      const mockResponse = {
        json: async () => ({
          error: 'payment_required',
        }),
      } as Response;

      await expect(
        client.parsePaymentRequirements(mockResponse)
      ).rejects.toThrow('402 response missing payment_requirements field');
    });
  });

  describe('createPaymentProof', () => {
    it('should create mock payment proof in mock mode', async () => {
      const client = new X402Client({ mode: 'mock', payerIdentity: 'test-wallet' });

      const requirements: PaymentRequirements = {
        id: 'req_test123',
        product: 'api_inference_v1',
        amount: 1000,
        currency: 'USDC',
        chain: 'solana',
        facilitator: 'http://localhost:5000/verify',
        expires_at: '2025-11-08T15:30:00Z',
      };

      const proof = await client.createPaymentProof(requirements);

      expect(proof.payer).toBe('test-wallet');
      expect(proof.timestamp).toBeDefined();
      expect(proof.signature).toContain('mock-proof');
      expect(new Date(proof.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should throw error in devnet mode (not yet implemented)', async () => {
      const client = new X402Client({ mode: 'devnet' });

      const requirements: PaymentRequirements = {
        id: 'req_test123',
        product: 'api_inference_v1',
        amount: 1000,
        currency: 'USDC',
        chain: 'solana',
        facilitator: 'http://localhost:5000/verify',
        expires_at: '2025-11-08T15:30:00Z',
      };

      await expect(
        client.createPaymentProof(requirements)
      ).rejects.toThrow('Devnet mode not yet implemented');
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment and return verification token', async () => {
      const client = new X402Client();

      const mockFetch = jest.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          verification: 'mock-sig:abc123',
          settled: true,
          timestamp: '2025-11-08T15:25:00Z',
        }),
      });
      global.fetch = mockFetch as any;

      const proof = {
        payer: 'test-wallet',
        timestamp: '2025-11-08T15:24:00Z',
        signature: 'mock-proof-test',
      };

      const requirements: PaymentRequirements = {
        id: 'req_test123',
        product: 'api_inference_v1',
        amount: 1000,
        currency: 'USDC',
        chain: 'solana',
        facilitator: 'http://localhost:5000/verify',
        expires_at: '2025-11-08T15:30:00Z',
      };

      const token = await client.verifyPayment(proof, requirements);

      expect(token).toBe('mock-sig:abc123');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/verify',
        expect.objectContaining({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        })
      );
    });

    it('should throw error if verification fails', async () => {
      const client = new X402Client();

      const mockFetch = jest.fn().mockResolvedValue({
        json: async () => ({
          ok: false,
          error: 'invalid_signature',
          detail: 'Payment signature is invalid',
        }),
      });
      global.fetch = mockFetch as any;

      const proof = {
        payer: 'test-wallet',
        timestamp: '2025-11-08T15:24:00Z',
        signature: 'bad-signature',
      };

      const requirements: PaymentRequirements = {
        id: 'req_test123',
        product: 'api_inference_v1',
        amount: 1000,
        currency: 'USDC',
        chain: 'solana',
        facilitator: 'http://localhost:5000/verify',
        expires_at: '2025-11-08T15:30:00Z',
      };

      await expect(
        client.verifyPayment(proof, requirements)
      ).rejects.toThrow('Payment verification failed: invalid_signature');
    });

    it('should use custom facilitator URL if provided', async () => {
      const customUrl = 'http://custom-facilitator:6000/verify';
      const client = new X402Client({ facilitatorUrl: customUrl });

      const mockFetch = jest.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          verification: 'mock-sig:custom123',
        }),
      });
      global.fetch = mockFetch as any;

      const proof = {
        payer: 'test-wallet',
        timestamp: '2025-11-08T15:24:00Z',
      };

      const requirements: PaymentRequirements = {
        id: 'req_test123',
        product: 'api_inference_v1',
        amount: 1000,
        currency: 'USDC',
        chain: 'solana',
        facilitator: 'http://localhost:5000/verify',
        expires_at: '2025-11-08T15:30:00Z',
      };

      await client.verifyPayment(proof, requirements);

      expect(mockFetch).toHaveBeenCalledWith(
        customUrl,
        expect.any(Object)
      );
    });
  });

  describe('requestWithAutoPay', () => {
    it('should return response immediately if not 402', async () => {
      const client = new X402Client();

      const mockFetch = jest.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ result: 'success' }),
      });
      global.fetch = mockFetch as any;

      const response = await client.requestWithAutoPay('http://localhost:4000/inference', {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle 402 response and retry with payment', async () => {
      const client = new X402Client({ payerIdentity: 'test-wallet' });

      const mockFetch = jest.fn()
        // First call: 402 response
        .mockResolvedValueOnce({
          status: 402,
          json: async () => ({
            payment_requirements: {
              id: 'req_test123',
              product: 'api_inference_v1',
              amount: 1000,
              currency: 'USDC',
              chain: 'solana',
              facilitator: 'http://localhost:5000/verify',
              expires_at: '2025-11-08T15:30:00Z',
            },
          }),
        })
        // Second call: verification request
        .mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            verification: 'mock-sig:abc123',
          }),
        })
        // Third call: retry with payment
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ result: 'success' }),
        });

      global.fetch = mockFetch as any;

      const response = await client.requestWithAutoPay('http://localhost:4000/inference', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
      });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify the third call included X-PAYMENT header
      const lastCall = mockFetch.mock.calls[2];
      expect(lastCall[1].headers.get('X-PAYMENT')).toBe('mock-sig:abc123');
    });
  });
});
