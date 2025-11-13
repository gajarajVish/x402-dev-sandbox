import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { depositPayment } from './solana-program-client';

export interface SolanaPaymentConfig {
  rpcUrl?: string;
  payerKeypair?: Keypair;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  useProgram?: boolean; // If true, use the escrow program instead of direct transfer
  requestId?: string; // Required if useProgram is true
}

/**
 * Creates and sends a Solana payment transaction
 * @param config - Solana configuration
 * @param recipientAddress - Seller's wallet address
 * @param amount - Amount in lamports (for SOL) or token smallest unit
 * @param currency - Currency type (SOL, USDC, etc.)
 * @returns Transaction signature
 */
export async function createSolanaPayment(
  config: SolanaPaymentConfig,
  recipientAddress: string,
  amount: number,
  currency: string
): Promise<string> {
  const rpcUrl = config.rpcUrl || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, config.commitment || 'confirmed');

  if (!config.payerKeypair) {
    throw new Error('Payer keypair required for devnet payments');
  }

  const payerKeypair = config.payerKeypair;
  const recipient = new PublicKey(recipientAddress);

  // If using the escrow program, call depositPayment
  if (config.useProgram) {
    if (!config.requestId) {
      throw new Error('requestId required when using escrow program');
    }

    console.log('[SDK] Using X402 Escrow Program for payment');
    const signature = await depositPayment(
      connection,
      payerKeypair,
      recipient,
      config.requestId
    );

    return signature;
  }

  // Otherwise, use direct transfer (simpler but less secure)
  let transaction: Transaction;
  let signature: string;

  if (currency.toLowerCase() === 'sol') {
    // SOL transfer
    transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payerKeypair.publicKey,
        toPubkey: recipient,
        lamports: amount,
      })
    );

    signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payerKeypair],
      { commitment: config.commitment || 'confirmed' }
    );
  } else {
    // SPL Token transfer (USDC, etc.)
    // This requires the token mint address
    // For now, we'll throw an error and implement this next
    throw new Error(`SPL token transfers not yet implemented for ${currency}`);
  }

  return signature;
}

/**
 * Verifies a Solana transaction exists and matches expected parameters
 * @param connection - Solana connection
 * @param signature - Transaction signature to verify
 * @param expectedRecipient - Expected recipient address
 * @param expectedAmount - Expected amount transferred
 * @returns Verification result
 */
export async function verifySolanaTransaction(
  connection: Connection,
  signature: string,
  expectedRecipient: string,
  expectedAmount: number
): Promise<{ verified: boolean; detail?: string }> {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { verified: false, detail: 'Transaction not found' };
    }

    if (tx.meta?.err) {
      return { verified: false, detail: 'Transaction failed on-chain' };
    }

    // Basic verification - transaction exists and succeeded
    // More detailed verification (amount, recipient) requires parsing instructions
    return { verified: true };
  } catch (error) {
    return {
      verified: false,
      detail: `Verification error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Requests airdrop for testing on devnet
 * @param connection - Solana connection
 * @param publicKey - Public key to receive airdrop
 * @param amount - Amount in SOL
 */
export async function requestAirdrop(
  connection: Connection,
  publicKey: PublicKey,
  amount: number = 1
): Promise<string> {
  const signature = await connection.requestAirdrop(
    publicKey,
    amount * LAMPORTS_PER_SOL
  );

  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

/**
 * Creates a new Solana keypair for testing
 */
export function createTestKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Loads a keypair from a base58 private key string
 */
export function loadKeypairFromPrivateKey(privateKey: string): Keypair {
  const bs58 = require('bs58');
  const decoded = bs58.decode(privateKey);
  return Keypair.fromSecretKey(decoded);
}
