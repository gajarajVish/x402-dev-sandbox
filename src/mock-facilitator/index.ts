import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Connection } from '@solana/web3.js';
import { verifySolanaTransaction } from '../sdk/solana-utils';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.FACILITATOR_PORT || '5000', 10);
const MODE = process.env.FACILITATOR_MODE || 'mock';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

interface VerificationRequest {
  proof: any;
  payer: string;
  amount: number;
  chain: string;
  request_id?: string;
}

interface VerificationResponse {
  ok: boolean;
  verification?: string;
  settled?: boolean;
  timestamp?: string;
  error?: string;
  detail?: string;
}

const verifiedPayments = new Map<string, any>();

function mockVerify(req: VerificationRequest): VerificationResponse {
  console.log(`[MOCK] Verifying payment for ${req.payer}, amount: ${req.amount}`);

  const verificationToken = `mock-sig:${crypto.randomBytes(8).toString('hex')}`;

  verifiedPayments.set(verificationToken, {
    payer: req.payer,
    amount: req.amount,
    chain: req.chain,
    timestamp: new Date().toISOString(),
  });

  return {
    ok: true,
    verification: verificationToken,
    settled: true,
    timestamp: new Date().toISOString(),
  };
}

async function devnetVerify(req: VerificationRequest): Promise<VerificationResponse> {
  console.log(`[DEVNET] Verifying Solana transaction for ${req.payer}, amount: ${req.amount}`);

  // Extract transaction signature from proof
  const txSignature = req.proof.transaction || req.proof.signature;

  if (!txSignature) {
    return {
      ok: false,
      error: 'invalid_proof',
      detail: 'Missing transaction signature in proof',
    };
  }

  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Verify the transaction exists on Solana devnet
    const verification = await verifySolanaTransaction(
      connection,
      txSignature,
      '', // recipient verification would require parsing tx details
      req.amount
    );

    if (!verification.verified) {
      return {
        ok: false,
        error: 'verification_failed',
        detail: verification.detail || 'Transaction verification failed',
      };
    }

    // Create verification token
    const verificationToken = `devnet-sig:${crypto.randomBytes(8).toString('hex')}`;

    verifiedPayments.set(verificationToken, {
      payer: req.payer,
      amount: req.amount,
      chain: req.chain,
      txSignature,
      timestamp: new Date().toISOString(),
    });

    console.log(`[DEVNET] Transaction verified: ${txSignature}`);

    return {
      ok: true,
      verification: verificationToken,
      settled: true,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[DEVNET] Verification error:`, error);
    return {
      ok: false,
      error: 'verification_error',
      detail: `Failed to verify transaction: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'mock-facilitator',
    mode: MODE,
    port: PORT,
  });
});

app.post('/verify', async (req: Request, res: Response) => {
  const verificationReq: VerificationRequest = req.body;

  if (!verificationReq.proof || !verificationReq.payer || !verificationReq.amount) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_request',
      detail: 'Missing required fields: proof, payer, amount',
    });
  }

  let result: VerificationResponse;

  if (MODE === 'mock') {
    result = mockVerify(verificationReq);
  } else if (MODE === 'devnet') {
    result = await devnetVerify(verificationReq);
  } else {
    result = {
      ok: false,
      error: 'unsupported_mode',
      detail: `Mode ${MODE} is not supported`,
    };
  }

  const statusCode = result.ok ? 200 : 400;
  return res.status(statusCode).json(result);
});

app.listen(PORT, () => {
  console.log(`🏦 Mock Facilitator running on http://localhost:${PORT}`);
  console.log(`   Mode: ${MODE.toUpperCase()}`);
});

export default app;