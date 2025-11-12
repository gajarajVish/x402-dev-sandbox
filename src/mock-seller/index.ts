import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.SELLER_PORT || '4000', 10);
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://localhost:5000/verify';
const PRODUCT_AMOUNT = parseInt(process.env.PRODUCT_AMOUNT || '1000', 10);
const PRODUCT_CURRENCY = process.env.PRODUCT_CURRENCY || 'USDC';

interface PaymentRequirements {
  id: string;
  product: string;
  amount: number;
  currency: string;
  chain: string;
  facilitator: string;
  expires_at: string;
}

function generatePaymentRequirements(): PaymentRequirements {
  const reqId = `req_${crypto.randomBytes(8).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  
  return {
    id: reqId,
    product: 'api_inference_v1',
    amount: PRODUCT_AMOUNT,
    currency: PRODUCT_CURRENCY,
    chain: 'solana',
    facilitator: FACILITATOR_URL,
    expires_at: expiresAt.toISOString(),
  };
}

function isValidPaymentToken(token: string): boolean {
  // Accept mock tokens starting with "mock-sig:"
  return token.startsWith('mock-sig:');
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'mock-seller', port: PORT });
});

app.post('/inference', (req: Request, res: Response) => {
  const paymentHeader = req.header('X-PAYMENT');

  // Check if payment header is completely missing (undefined)
  if (paymentHeader === undefined) {
    const requirements = generatePaymentRequirements();
    console.log(`[402] Payment required for request. ID: ${requirements.id}`);

    return res.status(402).json({
      error: 'payment_required',
      message: 'Payment is required to access this resource',
      payment_requirements: requirements,
    });
  }

  // If header is present but empty or invalid, return 403
  if (!paymentHeader || paymentHeader.trim() === '' || !isValidPaymentToken(paymentHeader)) {
    console.log(`[403] Invalid payment token`);
    return res.status(403).json({
      error: 'invalid_payment',
      message: 'The provided payment token is invalid',
    });
  }
  
  const { prompt } = req.body;
  console.log(`[200] Request authorized. Processing: ${prompt}`);
  
  const result = {
    result: `Processed inference for: "${prompt}"`,
    model: 'mock-model-v1',
    cost_charged: PRODUCT_AMOUNT,
    timestamp: new Date().toISOString(),
  };
  
  return res.status(200).json(result);
});

app.listen(PORT, () => {
  console.log(`🚀 Mock Seller running on http://localhost:${PORT}`);
  console.log(`   Price: ${PRODUCT_AMOUNT} ${PRODUCT_CURRENCY}`);
});

export default app;