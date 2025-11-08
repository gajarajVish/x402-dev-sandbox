import request from 'supertest';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

// Create a test version of the facilitator
function createTestFacilitator() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const verifiedPayments = new Map<string, any>();

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'mock-facilitator',
      mode: 'mock',
    });
  });

  app.post('/verify', (req, res) => {
    const { proof, payer, amount, chain } = req.body;

    if (!proof || !payer || !amount) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_request',
        detail: 'Missing required fields: proof, payer, amount',
      });
    }

    // Mock verification
    const verificationToken = `mock-sig:${crypto.randomBytes(8).toString('hex')}`;

    verifiedPayments.set(verificationToken, {
      payer,
      amount,
      chain,
      timestamp: new Date().toISOString(),
    });

    res.json({
      ok: true,
      verification: verificationToken,
      settled: true,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

describe('Mock Facilitator', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestFacilitator();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        service: 'mock-facilitator',
        mode: 'mock',
      });
    });
  });

  describe('POST /verify', () => {
    it('should verify valid payment proof', async () => {
      const response = await request(app)
        .post('/verify')
        .send({
          proof: { signature: 'test-sig', transaction: 'test-tx' },
          payer: 'test-wallet',
          amount: 1000,
          chain: 'solana',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.verification).toMatch(/^mock-sig:/);
      expect(response.body.settled).toBe(true);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should accept any proof in mock mode', async () => {
      const response = await request(app)
        .post('/verify')
        .send({
          proof: { stub: true },
          payer: 'any-wallet',
          amount: 5000,
          chain: 'solana',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should return 400 if proof is missing', async () => {
      const response = await request(app)
        .post('/verify')
        .send({
          payer: 'test-wallet',
          amount: 1000,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('invalid_request');
      expect(response.body.detail).toContain('Missing required fields');
    });

    it('should return 400 if payer is missing', async () => {
      const response = await request(app)
        .post('/verify')
        .send({
          proof: { signature: 'test' },
          amount: 1000,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 if amount is missing', async () => {
      const response = await request(app)
        .post('/verify')
        .send({
          proof: { signature: 'test' },
          payer: 'test-wallet',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should generate unique verification tokens', async () => {
      const response1 = await request(app)
        .post('/verify')
        .send({
          proof: { signature: 'test1' },
          payer: 'wallet1',
          amount: 1000,
          chain: 'solana',
        });

      const response2 = await request(app)
        .post('/verify')
        .send({
          proof: { signature: 'test2' },
          payer: 'wallet2',
          amount: 2000,
          chain: 'solana',
        });

      expect(response1.body.verification).not.toBe(response2.body.verification);
    });

    it('should handle concurrent verification requests', async () => {
      const requests = Array(10).fill(null).map((_, i) =>
        request(app)
          .post('/verify')
          .send({
            proof: { signature: `test-${i}` },
            payer: `wallet-${i}`,
            amount: 1000 + i,
            chain: 'solana',
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
      });

      const tokens = responses.map(r => r.body.verification);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(10);
    });
  });
});
