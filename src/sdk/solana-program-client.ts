/**
 * TypeScript client for the X402 Escrow Solana Program
 *
 * This module provides functions to interact with the on-chain escrow program.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as borsh from 'borsh';

// Program ID (must match the ID in the Solana program)
export const X402_PROGRAM_ID = new PublicKey('X4oZJgFqbY7p8YqV2qh3E5cR6w8N9tA2sK3bL4mD5nE');

/**
 * Derives the payment account PDA (Program Derived Address)
 */
export async function getPaymentAccountPDA(
  seller: PublicKey,
  requestId: string,
  programId: PublicKey = X402_PROGRAM_ID
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('payment'),
      seller.toBuffer(),
      Buffer.from(requestId),
    ],
    programId
  );
}

/**
 * Instruction discriminators for each instruction in the program
 */
enum InstructionDiscriminator {
  InitializePayment = 0,
  DepositPayment = 1,
  VerifyAndRelease = 2,
  RefundPayment = 3,
}

/**
 * Initialize a payment requirement on-chain
 * Called by the seller to create escrow for a payment
 */
export async function initializePayment(
  connection: Connection,
  seller: Keypair,
  requestId: string,
  amount: number,
  expiresAt: number,
  programId: PublicKey = X402_PROGRAM_ID
): Promise<string> {
  const [paymentAccount] = await getPaymentAccountPDA(seller.publicKey, requestId, programId);

  // Serialize instruction data
  const data = Buffer.concat([
    Buffer.from([InstructionDiscriminator.InitializePayment]),
    serializeString(requestId),
    serializeU64(amount),
    serializeI64(expiresAt),
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: paymentAccount, isSigner: false, isWritable: true },
      { pubkey: seller.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [seller],
    { commitment: 'confirmed' }
  );

  console.log(`[Program] Payment requirement initialized: ${paymentAccount.toBase58()}`);
  return signature;
}

/**
 * Deposit payment from buyer to escrow
 * Called by the buyer to pay for the API request
 */
export async function depositPayment(
  connection: Connection,
  payer: Keypair,
  seller: PublicKey,
  requestId: string,
  programId: PublicKey = X402_PROGRAM_ID
): Promise<string> {
  const [paymentAccount] = await getPaymentAccountPDA(seller, requestId, programId);

  // Serialize instruction data
  const data = Buffer.concat([
    Buffer.from([InstructionDiscriminator.DepositPayment]),
    serializeString(requestId),
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: paymentAccount, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer],
    { commitment: 'confirmed' }
  );

  console.log(`[Program] Payment deposited: ${signature}`);
  return signature;
}

/**
 * Verify payment and release funds to seller
 * Called after verification to complete the payment
 */
export async function verifyAndRelease(
  connection: Connection,
  seller: Keypair,
  requestId: string,
  programId: PublicKey = X402_PROGRAM_ID
): Promise<string> {
  const [paymentAccount] = await getPaymentAccountPDA(seller.publicKey, requestId, programId);

  // Serialize instruction data
  const data = Buffer.concat([
    Buffer.from([InstructionDiscriminator.VerifyAndRelease]),
    serializeString(requestId),
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: paymentAccount, isSigner: false, isWritable: true },
      { pubkey: seller.publicKey, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [seller],
    { commitment: 'confirmed' }
  );

  console.log(`[Program] Payment released to seller: ${signature}`);
  return signature;
}

/**
 * Refund an expired payment to the payer
 */
export async function refundPayment(
  connection: Connection,
  payer: Keypair,
  seller: PublicKey,
  requestId: string,
  programId: PublicKey = X402_PROGRAM_ID
): Promise<string> {
  const [paymentAccount] = await getPaymentAccountPDA(seller, requestId, programId);

  // Serialize instruction data
  const data = Buffer.concat([
    Buffer.from([InstructionDiscriminator.RefundPayment]),
    serializeString(requestId),
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: paymentAccount, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer],
    { commitment: 'confirmed' }
  );

  console.log(`[Program] Payment refunded: ${signature}`);
  return signature;
}

/**
 * Fetch payment account data
 */
export async function getPaymentAccount(
  connection: Connection,
  seller: PublicKey,
  requestId: string,
  programId: PublicKey = X402_PROGRAM_ID
): Promise<PaymentAccountData | null> {
  const [paymentAccount] = await getPaymentAccountPDA(seller, requestId, programId);

  const accountInfo = await connection.getAccountInfo(paymentAccount);
  if (!accountInfo) {
    return null;
  }

  return deserializePaymentAccount(accountInfo.data);
}

/**
 * Payment account data structure
 */
export interface PaymentAccountData {
  seller: PublicKey;
  requestId: string;
  amount: number;
  expiresAt: number;
  isPaid: boolean;
  payer: PublicKey;
  bump: number;
}

/**
 * Deserialize payment account data
 */
function deserializePaymentAccount(data: Buffer): PaymentAccountData {
  // Skip 8-byte discriminator
  let offset = 8;

  // Read seller (32 bytes)
  const seller = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read request_id (4 bytes length + string data)
  const requestIdLen = data.readUInt32LE(offset);
  offset += 4;
  const requestId = data.slice(offset, offset + requestIdLen).toString('utf-8');
  offset += requestIdLen;

  // Read amount (8 bytes)
  const amount = Number(data.readBigUInt64LE(offset));
  offset += 8;

  // Read expires_at (8 bytes)
  const expiresAt = Number(data.readBigInt64LE(offset));
  offset += 8;

  // Read is_paid (1 byte)
  const isPaid = data[offset] === 1;
  offset += 1;

  // Read payer (32 bytes)
  const payer = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read bump (1 byte)
  const bump = data[offset];

  return {
    seller,
    requestId,
    amount,
    expiresAt,
    isPaid,
    payer,
    bump,
  };
}

// Serialization helpers
function serializeString(str: string): Buffer {
  const strBuffer = Buffer.from(str, 'utf-8');
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32LE(strBuffer.length, 0);
  return Buffer.concat([lenBuffer, strBuffer]);
}

function serializeU64(value: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value), 0);
  return buffer;
}

function serializeI64(value: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(BigInt(value), 0);
  return buffer;
}
