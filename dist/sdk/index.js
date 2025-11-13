"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.X402Client = void 0;
const solana_utils_1 = require("./solana-utils");
// Export Solana utilities for external use
__exportStar(require("./solana-utils"), exports);
__exportStar(require("./solana-program-client"), exports);
class X402Client {
    constructor(options = {}) {
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
    async requestWithAutoPay(url, init = {}) {
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
        const headers = new Headers(init.headers);
        headers.set('X-PAYMENT', verificationToken);
        response = await fetch(url, {
            ...init,
            headers,
        });
        return response;
    }
    async parsePaymentRequirements(response) {
        const body = await response.json();
        if (!body.payment_requirements) {
            throw new Error('402 response missing payment_requirements field');
        }
        return body.payment_requirements;
    }
    async createPaymentProof(requirements) {
        if (this.mode === 'mock') {
            return {
                timestamp: new Date().toISOString(),
                payer: this.payerIdentity,
                signature: `mock-proof-${requirements.id}`,
            };
        }
        else {
            // Devnet mode - create real Solana transaction
            if (!this.solanaKeypair) {
                throw new Error('Solana keypair required for devnet payments');
            }
            if (!requirements.recipient) {
                throw new Error('Payment requirements missing recipient wallet address for devnet payment');
            }
            console.log(`[SDK] Creating Solana payment: ${requirements.amount} ${requirements.currency} to ${requirements.recipient}`);
            const config = {
                rpcUrl: this.solanaRpcUrl,
                payerKeypair: this.solanaKeypair,
                commitment: 'confirmed',
                useProgram: this.useEscrowProgram,
                requestId: requirements.id, // Pass request ID for program mode
            };
            try {
                const txSignature = await (0, solana_utils_1.createSolanaPayment)(config, requirements.recipient, requirements.amount, requirements.currency);
                console.log(`[SDK] Payment transaction sent: ${txSignature}`);
                return {
                    timestamp: new Date().toISOString(),
                    payer: this.payerIdentity,
                    transaction: txSignature,
                    signature: txSignature, // Use transaction signature as proof
                };
            }
            catch (error) {
                throw new Error(`Failed to create Solana payment: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    async verifyPayment(proof, requirements) {
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
exports.X402Client = X402Client;
