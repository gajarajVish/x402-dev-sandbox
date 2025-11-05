export interface PaymentRequirements {
  id: string;
  product: string;
  amount: number;
  currency: string;
  chain: string;
  facilitator: string;
  expires_at: string;
}

export interface PaymentProof {
  signature?: string;
  timestamp: string;
  payer: string;
}

export interface X402ClientOptions {
  facilitatorUrl?: string;
  mode?: 'mock' | 'devnet';
  payerIdentity?: string;
}

export class X402Client {
  private facilitatorUrl?: string;
  private mode: 'mock' | 'devnet';
  private payerIdentity: string;

  constructor(options: X402ClientOptions = {}) {
    this.facilitatorUrl = options.facilitatorUrl;
    this.mode = options.mode || 'mock';
    this.payerIdentity = options.payerIdentity || 'mock-wallet-' + Math.random().toString(36).substring(7);
  }

  async requestWithAutoPay(url: string, init: RequestInit = {}): Promise<Response> {
    // Make initial request
    let response = await fetch(url, init);

    // If not 402, return immediately
    if (response.status !== 402) {
      return response;
    }

    // Parse payment requirements
    const paymentReq = await this.parsePaymentRequirements(response);
    console.log(`[SDK] Payment required: ${paymentReq.amount} ${paymentReq.currency}`);

    // Create payment proof
    const proof = await this.createPaymentProof(paymentReq);

    // Verify payment with facilitator
    const verificationToken = await this.verifyPayment(proof, paymentReq);
    console.log(`[SDK] Payment verified`);

    // Retry original request with payment header
    const headers = new Headers(init.headers as any);
    headers.set('X-PAYMENT', verificationToken);

    response = await fetch(url, {
      ...init,
      headers,
    });

    return response;
  }

  async parsePaymentRequirements(response: Response): Promise<PaymentRequirements> {
    const body = await response.json();

    if (!body.payment_requirements) {
      throw new Error('402 response missing payment_requirements field');
    }

    return body.payment_requirements as PaymentRequirements;
  }

  async createPaymentProof(requirements: PaymentRequirements): Promise<PaymentProof> {
    if (this.mode === 'mock') {
      return {
        timestamp: new Date().toISOString(),
        payer: this.payerIdentity,
        signature: `mock-proof-${requirements.id}`,
      };
    } else {
      throw new Error('Devnet mode not yet implemented');
    }
  }

  async verifyPayment(proof: PaymentProof, requirements: PaymentRequirements): Promise<string> {
    const facilitatorUrl = this.facilitatorUrl || requirements.facilitator;

    const response = await fetch(facilitatorUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        proof,
        payer: this.payerIdentity,
        amount: requirements.amount,
        chain: requirements.chain,
        request_id: requirements.id,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Payment verification failed: ${result.error}`);
    }

    return result.verification;
  }
}