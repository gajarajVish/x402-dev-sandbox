import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.FACILITATOR_PORT || '5000', 10);
const MODE = process.env.FACILITATOR_MODE || 'mock';

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

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'mock-facilitator',
    mode: MODE,
    port: PORT,
  });
});

app.post('/verify', (req: Request, res: Response) => {
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
  } else {
    result = {
      ok: false,
      error: 'unsupported_mode',
      detail: `Mode ${MODE} is not yet implemented`,
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