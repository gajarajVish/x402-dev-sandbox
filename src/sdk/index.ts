import { Keypair } from '@solana/web3.js';
import { createSolanaPayment, SolanaPaymentConfig } from './solana-utils';

// Export Solana utilities for external use
export * from './solana-utils';
export * from './solana-program-client';

export interface PaymentRequirements {
  id: string;
  product: string;
  amount: number;
  currency: string;
  chain: string;
  facilitator: string;
  expires_at: string;
  recipient?: string; // Seller's wallet address for devnet payments
}

export interface PaymentProof {
  signature?: string;
  transaction?: string; // Solana transaction signature for devnet
  timestamp: string;
  payer: string;
}

export interface X402ClientOptions {
  facilitatorUrl?: string;
  mode?: 'mock' | 'devnet';
  payerIdentity?: string;
  solanaKeypair?: Keypair; // Required for devnet mode
  solanaRpcUrl?: string;
  useEscrowProgram?: boolean; // If true, use on-chain escrow program (more secure)
}

export class X402Client {
  private facilitatorUrl?: string;
  private mode: 'mock' | 'devnet';
  private payerIdentity: string;
  private solanaKeypair?: Keypair;
  private solanaRpcUrl?: string;
  private useEscrowProgram: boolean;

  constructor(options: X402ClientOptions = {}) {
    this.facilitatorUrl = options.facilitatorUrl;
    this.mode = options.mode || 'mock';
    this.solanaKeypair = options.solanaKeypair;
    this.solanaRpcUrl = options.solanaRpcUrl;
    this.useEscrowProgram = options.useEscrowProgram || false;

    if (this.mode === 'devnet' && !this.solanaKeypair) {
      throw new Error('solanaKeypair is required for devnet mode');
    }

    this.payerIdentity = options.payerIdentity ||
      (this.solanaKeypair ? this.solanaKeypair.publicKey.toBase58() :
       'mock-wallet-' + Math.random().toString(36).substring(7));
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
    const body = await response.json() as any;

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
      // Devnet mode - create real Solana transaction
      if (!this.solanaKeypair) {
        throw new Error('Solana keypair required for devnet payments');
      }

      if (!requirements.recipient) {
        throw new Error('Payment requirements missing recipient wallet address for devnet payment');
      }

      console.log(`[SDK] Creating Solana payment: ${requirements.amount} ${requirements.currency} to ${requirements.recipient}`);

      const config: SolanaPaymentConfig = {
        rpcUrl: this.solanaRpcUrl,
        payerKeypair: this.solanaKeypair,
        commitment: 'confirmed',
        useProgram: this.useEscrowProgram,
        requestId: requirements.id, // Pass request ID for program mode
      };

      try {
        const txSignature = await createSolanaPayment(
          config,
          requirements.recipient,
          requirements.amount,
          requirements.currency
        );

        console.log(`[SDK] Payment transaction sent: ${txSignature}`);

        return {
          timestamp: new Date().toISOString(),
          payer: this.payerIdentity,
          transaction: txSignature,
          signature: txSignature, // Use transaction signature as proof
        };
      } catch (error) {
        throw new Error(`Failed to create Solana payment: ${error instanceof Error ? error.message : String(error)}`);
      }
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

    const result = await response.json() as any;

    if (!result.ok) {
      throw new Error(`Payment verification failed: ${result.error}`);
    }

    return result.verification as string;
  }
}